import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { pageOffset, type PageRequest } from '../../../shared/application/pagination'
import { escapeLike } from '../../../shared/infra/persistence/escape-like'
import type { CheckoutStage } from '../../cart/domain/cart'
import {
  CustomersQuery,
  type CustomerDetail,
  type CustomerFilters,
  type CustomerRow,
} from '../application/customers.query'

/** Só sessões que importam: com itens, cliente identificada ou pedido (sacolas vazias anônimas ficam fora). */
const RELEVANT = `(EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id) OR c.customer IS NOT NULL OR c.order_id IS NOT NULL)`

/** Valor atual de uma sacola: itens × preço do catálogo */
const CART_VALUE = `(SELECT COALESCE(SUM(i.quantity * p.price_cents), 0) FROM cart_items i JOIN products p ON p.id = i.product_id WHERE i.cart_id = c.id)`

/**
 * Uma linha por cliente (e-mail), juntando pedidos e sacolas identificadas.
 * Nome, telefone e cidade vêm do registro mais recente.
 */
const CUSTOMERS_CTE = `
  WITH people AS (
    SELECT lower(o.customer_email) AS email, o.customer_name AS name, o.customer_phone AS phone, o.customer_cpf AS cpf,
           o.customer_birth_date::text AS birth_date, o.shipping_address AS address, o.created_at AS at
      FROM orders o
    UNION ALL
    SELECT lower(c.customer->>'email'), c.customer->>'name', c.customer->>'phone', c.customer->>'cpf',
           NULLIF(c.customer->>'birthDate', ''), c.shipping_address, c.updated_at
      FROM carts c
     WHERE c.customer IS NOT NULL AND c.customer->>'email' IS NOT NULL
  ),
  latest AS (
    SELECT DISTINCT ON (email) email, name, phone, cpf FROM people ORDER BY email, at DESC
  ),
  birthday AS (
    SELECT DISTINCT ON (email) email, birth_date FROM people WHERE birth_date IS NOT NULL ORDER BY email, at DESC
  ),
  last_address AS (
    SELECT DISTINCT ON (email) email, address FROM people WHERE address IS NOT NULL ORDER BY email, at DESC
  ),
  activity AS (
    SELECT email, min(at) AS first_seen_at, max(at) AS last_activity_at FROM people GROUP BY email
  ),
  ord AS (
    SELECT lower(customer_email) AS email,
           count(*) FILTER (WHERE status <> 'cancelado')::int AS orders_count,
           count(*) FILTER (WHERE status = 'pago')::int AS paid_count,
           COALESCE(SUM(total_cents) FILTER (WHERE status = 'pago'), 0)::bigint AS spent,
           max(created_at) AS last_order_at
      FROM orders GROUP BY 1
  ),
  open_carts AS (
    SELECT lower(c.customer->>'email') AS email, count(*)::int AS carts, COALESCE(SUM(${CART_VALUE}), 0)::bigint AS value
      FROM carts c
     WHERE c.customer IS NOT NULL AND c.order_id IS NULL
       AND EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id)
     GROUP BY 1
  ),
  customers AS (
    SELECT l.email, l.name, l.phone, l.cpf, b.birth_date,
           la.address, la.address->>'city' AS city, la.address->>'state' AS state,
           COALESCE(o.orders_count, 0) AS orders_count, COALESCE(o.paid_count, 0) AS paid_count,
           COALESCE(o.spent, 0) AS spent, o.last_order_at,
           COALESCE(oc.carts, 0) AS open_carts, COALESCE(oc.value, 0) AS open_value,
           a.first_seen_at, a.last_activity_at
      FROM latest l
      JOIN activity a USING (email)
      LEFT JOIN last_address la USING (email)
      LEFT JOIN birthday b USING (email)
      LEFT JOIN ord o USING (email)
      LEFT JOIN open_carts oc USING (email)
  )`

interface RawCustomer {
  email: string
  name: string
  phone: string
  cpf: string | null
  birth_date: string | null
  address: CustomerDetail['address']
  city: string | null
  state: string | null
  orders_count: number
  paid_count: number
  spent: string | number
  last_order_at: Date | null
  open_carts: number
  open_value: string | number
  first_seen_at: Date
  last_activity_at: Date
}

@Injectable()
export class SqlCustomersQuery extends CustomersQuery {
  constructor(@InjectDataSource() private readonly db: DataSource) {
    super()
  }

  async funnel() {
    const rows: { stage: CheckoutStage; total: number; open_value: number; ordered_value: number }[] = await this.db.query(`
      SELECT c.checkout_stage AS stage,
             count(*)::int AS total,
             COALESCE(SUM(CASE WHEN c.order_id IS NULL THEN ${CART_VALUE} END), 0)::bigint AS open_value,
             COALESCE(SUM(o.total_cents), 0)::bigint AS ordered_value
        FROM carts c
        LEFT JOIN orders o ON o.id = c.order_id
       WHERE ${RELEVANT}
       GROUP BY c.checkout_stage`)
    const count = (s: string) => rows.find((r) => r.stage === s)?.total ?? 0
    return {
      cart: count('cart'),
      identified: count('identified'),
      delivery: count('delivery'),
      ordered: count('ordered'),
      orderedValueCents: rows.reduce((s, r) => s + Number(r.ordered_value), 0),
      openValueCents: rows.reduce((s, r) => s + Number(r.open_value), 0),
    }
  }

  async list({ q, segment }: CustomerFilters, page: PageRequest) {
    const where: string[] = []
    const params: unknown[] = []
    const param = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }

    if (segment === 'buyers') where.push('orders_count > 0')
    if (segment === 'not_bought') where.push('orders_count = 0')
    // Aniversariantes do mês (fuso de São Paulo)
    if (segment === 'birthday_month') {
      where.push(`birth_date IS NOT NULL AND extract(month FROM birth_date::date) = extract(month FROM now() AT TIME ZONE 'America/Sao_Paulo')`)
    }
    const term = q?.trim()
    if (term) {
      const like = param(`%${escapeLike(term)}%`)
      const conds = [`name ILIKE ${like}`, `email ILIKE ${like}`]
      const digits = term.replace(/\D/g, '')
      if (digits.length >= 3) {
        const d = param(`%${digits}%`)
        conds.push(`phone LIKE ${d}`, `cpf LIKE ${d}`)
      }
      where.push(`(${conds.join(' OR ')})`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows, [{ total }]] = await Promise.all([
      this.db.query(
        `${CUSTOMERS_CTE}
         SELECT * FROM customers ${whereSql}
          ORDER BY ${segment === 'birthday_month' ? `extract(day FROM birth_date::date), ` : ''}last_activity_at DESC
          LIMIT ${param(page.pageSize)} OFFSET ${param(pageOffset(page))}`,
        params,
      ) as Promise<RawCustomer[]>,
      this.db.query(`${CUSTOMERS_CTE} SELECT count(*)::int AS total FROM customers ${whereSql}`, params.slice(0, -2)) as Promise<
        { total: number }[]
      >,
    ])
    return { items: rows.map(toRow), total, ...page }
  }

  async detail(email: string): Promise<CustomerDetail | null> {
    const [raw]: RawCustomer[] = await this.db.query(`${CUSTOMERS_CTE} SELECT * FROM customers WHERE email = $1`, [email])
    if (!raw) return null

    const [orders, carts] = await Promise.all([
      this.db.query(
        `SELECT o.id, o.number, o.status, o.total_cents, o.created_at, s.status AS shipment_status,
                (SELECT COALESCE(SUM(i.quantity), 0)::int FROM order_items i WHERE i.order_id = o.id) AS item_count
           FROM orders o LEFT JOIN shipments s ON s.order_id = o.id
          WHERE lower(o.customer_email) = $1
          ORDER BY o.created_at DESC`,
        [email],
      ),
      this.db.query(
        `SELECT c.id, c.checkout_stage, c.updated_at, ${CART_VALUE}::int AS value_cents,
                COALESCE((
                  SELECT json_agg(json_build_object('name', p.name, 'quantity', i.quantity, 'image', p.image_url) ORDER BY i.added_at)
                    FROM cart_items i JOIN products p ON p.id = i.product_id WHERE i.cart_id = c.id
                ), '[]') AS items
           FROM carts c
          WHERE lower(c.customer->>'email') = $1 AND c.order_id IS NULL
            AND EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id)
          ORDER BY c.updated_at DESC`,
        [email],
      ),
    ])

    return {
      ...toRow(raw),
      cpf: raw.cpf,
      address: raw.address,
      orders: orders.map((o: Record<string, unknown>) => ({
        id: o.id as string,
        number: Number(o.number),
        status: o.status as never,
        itemCount: Number(o.item_count),
        totalCents: Number(o.total_cents),
        shipmentStatus: (o.shipment_status as string | null) ?? null,
        createdAt: o.created_at as Date,
      })),
      openCarts: carts.map((c: { id: string; checkout_stage: CheckoutStage; updated_at: Date; value_cents: number; items: CustomerDetail['openCarts'][number]['items'] }) => ({
        cartId: c.id,
        stage: c.checkout_stage,
        itemCount: c.items.reduce((s, i) => s + Number(i.quantity), 0),
        valueCents: Number(c.value_cents),
        items: c.items,
        lastActivityAt: c.updated_at,
      })),
    }
  }
}

function toRow(r: RawCustomer): CustomerRow {
  return {
    email: r.email,
    name: r.name,
    phone: r.phone,
    birthDate: r.birth_date,
    city: r.city,
    state: r.state,
    ordersCount: Number(r.orders_count),
    paidOrdersCount: Number(r.paid_count),
    totalSpentCents: Number(r.spent),
    lastOrderAt: r.last_order_at,
    openCartsCount: Number(r.open_carts),
    openCartsValueCents: Number(r.open_value),
    firstSeenAt: r.first_seen_at,
    lastActivityAt: r.last_activity_at,
  }
}
