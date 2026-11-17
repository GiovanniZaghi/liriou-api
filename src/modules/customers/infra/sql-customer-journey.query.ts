import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { pageOffset, type PageRequest } from '../../../shared/application/pagination'
import { escapeLike } from '../../../shared/infra/persistence/escape-like'
import type { CheckoutStage } from '../../cart/domain/cart'
import {
  CustomerJourneyQuery,
  type JourneyDetail,
  type JourneyFilters,
  type JourneyRow,
} from '../application/customer-journey.query'

/** Só sessões que importam: com itens, cliente identificada ou pedido (sacolas vazias anônimas ficam fora). */
const RELEVANT = `(EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id) OR c.customer IS NOT NULL OR c.order_id IS NOT NULL)`

/** Colunas da listagem: valor = total do pedido, ou itens × preço atual para sacola aberta */
const ROW_SELECT = `
  c.id                       AS cart_id,
  c.checkout_stage           AS stage,
  c.customer                 AS customer,
  c.shipping_address->>'city'  AS city,
  c.shipping_address->>'state' AS state,
  c.created_at               AS created_at,
  c.updated_at               AS last_activity_at,
  o.id                       AS order_id,
  o.number                   AS order_number,
  o.status                   AS order_status,
  o.total_cents              AS order_total_cents,
  COALESCE((SELECT SUM(i.quantity) FROM cart_items i WHERE i.cart_id = c.id), 0)::int AS item_count,
  COALESCE(o.total_cents, (
    SELECT SUM(i.quantity * p.price_cents) FROM cart_items i JOIN products p ON p.id = i.product_id WHERE i.cart_id = c.id
  ), 0)::int AS value_cents`

interface RawRow {
  cart_id: string
  stage: CheckoutStage
  customer: JourneyRow['customer']
  city: string | null
  state: string | null
  created_at: Date
  last_activity_at: Date
  order_id: string | null
  order_number: number | null
  order_status: string | null
  order_total_cents: number | null
  item_count: number
  value_cents: number
}

@Injectable()
export class SqlCustomerJourneyQuery extends CustomerJourneyQuery {
  constructor(@InjectDataSource() private readonly db: DataSource) {
    super()
  }

  async funnel() {
    const rows: { stage: CheckoutStage; total: number; open_value: number; ordered_value: number }[] = await this.db.query(`
      SELECT c.checkout_stage AS stage,
             count(*)::int AS total,
             COALESCE(SUM(CASE WHEN c.order_id IS NULL THEN (
               SELECT SUM(i.quantity * p.price_cents) FROM cart_items i JOIN products p ON p.id = i.product_id WHERE i.cart_id = c.id
             ) END), 0)::bigint AS open_value,
             COALESCE(SUM(o.total_cents), 0)::bigint AS ordered_value
        FROM carts c
        LEFT JOIN orders o ON o.id = c.order_id
       WHERE ${RELEVANT}
       GROUP BY c.checkout_stage`)
    const count = (s: CheckoutStage) => rows.find((r) => r.stage === s)?.total ?? 0
    return {
      cart: count('cart' as CheckoutStage),
      identified: count('identified' as CheckoutStage),
      delivery: count('delivery' as CheckoutStage),
      ordered: count('ordered' as CheckoutStage),
      orderedValueCents: rows.reduce((s, r) => s + Number(r.ordered_value), 0),
      openValueCents: rows.reduce((s, r) => s + Number(r.open_value), 0),
    }
  }

  async list({ q, stage }: JourneyFilters, page: PageRequest) {
    const where = [RELEVANT]
    const params: unknown[] = []
    if (stage) {
      params.push(stage)
      where.push(`c.checkout_stage = $${params.length}`)
    }
    const term = q?.trim()
    if (term) {
      params.push(`%${escapeLike(term)}%`)
      const like = `$${params.length}`
      const conds = [`c.customer->>'name' ILIKE ${like}`, `c.customer->>'email' ILIKE ${like}`]
      const digits = term.replace(/\D/g, '')
      if (digits.length >= 3) {
        params.push(`%${digits}%`)
        conds.push(`c.customer->>'phone' LIKE $${params.length}`, `c.customer->>'cpf' LIKE $${params.length}`)
      }
      where.push(`(${conds.join(' OR ')})`)
    }
    const whereSql = where.join(' AND ')

    const [rows, [{ total }]] = await Promise.all([
      this.db.query(
        `SELECT ${ROW_SELECT}
           FROM carts c LEFT JOIN orders o ON o.id = c.order_id
          WHERE ${whereSql}
          ORDER BY c.updated_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, page.pageSize, pageOffset(page)],
      ) as Promise<RawRow[]>,
      this.db.query(`SELECT count(*)::int AS total FROM carts c WHERE ${whereSql}`, params) as Promise<{ total: number }[]>,
    ])
    return { items: rows.map(toRow), total, ...page }
  }

  async detail(cartId: string): Promise<JourneyDetail | null> {
    const [raw]: (RawRow & {
      shipping_address: JourneyDetail['shippingAddress']
      cart_shipping_label: string | null
      coupon_code: string | null
      identified_at: Date | null
      delivery_at: Date | null
      ordered_at: Date | null
      subtotal_cents: number | null
      discount_cents: number | null
      shipping_cents: number | null
      shipping_option_label: string | null
    })[] = await this.db.query(
      `SELECT ${ROW_SELECT},
              c.shipping_address, c.coupon_code, c.identified_at, c.delivery_at, c.ordered_at,
              NULLIF(concat_ws(' · ', c.shipping_quote->>'carrier', c.shipping_quote->>'service'), '') AS cart_shipping_label,
              o.subtotal_cents, o.discount_cents, o.shipping_cents, o.shipping_option_label
         FROM carts c LEFT JOIN orders o ON o.id = c.order_id
        WHERE c.id = $1`,
      [cartId],
    )
    if (!raw) return null

    const items: JourneyDetail['items'] = raw.order_id
      ? (
          await this.db.query(
            `SELECT product_id, product_name AS name, sku, image_url AS image, unit_price_cents, quantity
               FROM order_items WHERE order_id = $1 ORDER BY product_name`,
            [raw.order_id],
          )
        ).map(toItem)
      : (
          await this.db.query(
            `SELECT p.id AS product_id, p.name, p.sku, p.image_url AS image, p.price_cents AS unit_price_cents, i.quantity
               FROM cart_items i JOIN products p ON p.id = i.product_id
              WHERE i.cart_id = $1 ORDER BY i.added_at`,
            [cartId],
          )
        ).map(toItem)

    const email = raw.customer?.email
    const others: RawRow[] = email
      ? await this.db.query(
          `SELECT ${ROW_SELECT}
             FROM carts c LEFT JOIN orders o ON o.id = c.order_id
            WHERE lower(c.customer->>'email') = lower($1) AND c.id <> $2
            ORDER BY c.updated_at DESC LIMIT 20`,
          [email, cartId],
        )
      : []

    return {
      ...toRow(raw),
      shippingAddress: raw.shipping_address,
      cartShippingLabel: raw.cart_shipping_label,
      couponCode: raw.coupon_code,
      items,
      orderTotals: raw.order_id
        ? {
            subtotalCents: raw.subtotal_cents ?? 0,
            discountCents: raw.discount_cents ?? 0,
            shippingCents: raw.shipping_cents ?? 0,
            totalCents: raw.order_total_cents ?? 0,
          }
        : null,
      orderShippingLabel: raw.shipping_option_label,
      timeline: {
        createdAt: raw.created_at,
        identifiedAt: raw.identified_at,
        deliveryAt: raw.delivery_at,
        orderedAt: raw.ordered_at,
      },
      otherSessions: others.map(toRow).map(({ cartId: id, stage, valueCents, order, lastActivityAt }) => ({
        cartId: id,
        stage,
        valueCents,
        order,
        lastActivityAt,
      })),
    }
  }
}

function toRow(r: RawRow): JourneyRow {
  return {
    cartId: r.cart_id,
    stage: r.stage,
    customer: r.customer,
    city: r.city,
    state: r.state,
    itemCount: Number(r.item_count),
    valueCents: Number(r.value_cents),
    order: r.order_id
      ? { id: r.order_id, number: r.order_number!, status: r.order_status as never, totalCents: r.order_total_cents ?? 0 }
      : null,
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
  }
}

function toItem(r: { product_id: string; name: string; sku: string; image: string; unit_price_cents: number; quantity: number }) {
  return {
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    image: r.image,
    unitPriceCents: Number(r.unit_price_cents),
    quantity: Number(r.quantity),
  }
}
