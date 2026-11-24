import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { pageOffset, type PageRequest } from '../../../shared/application/pagination'
import { escapeLike } from '../../../shared/infra/persistence/escape-like'
import {
  AdminOrdersQuery,
  type AdminOrderDetail,
  type AdminOrderFilters,
  type AdminOrderRow,
} from '../application/admin-orders.query'
import { OrderStatus } from '../domain/order'

/** Fuso usado para "pedidos de hoje". */
const TIME_ZONE = 'America/Sao_Paulo'

/** Pedido + itens + último pagamento + envio, numa linha por pedido. */
const ROW_SELECT = `
  o.id, o.number, o.status, o.customer_name, o.customer_email, o.customer_phone, o.customer_cpf,
  o.shipping_address, o.total_cents, o.gift_wrap, o.created_at,
  (SELECT COALESCE(SUM(i.quantity), 0)::int FROM order_items i WHERE i.order_id = o.id) AS item_count,
  pay.method AS payment_method, pay.status AS payment_status, pay.installments AS payment_installments,
  s.status AS shipment_status, s.tracking_number`

const ROW_FROM = `
  FROM orders o
  LEFT JOIN LATERAL (
    SELECT p.method, p.status, p.installments FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1
  ) pay ON true
  LEFT JOIN shipments s ON s.order_id = o.id`

interface RawRow {
  id: string
  number: number
  status: OrderStatus
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_cpf: string
  shipping_address: AdminOrderDetail['shippingAddress']
  total_cents: number
  gift_wrap: boolean
  created_at: Date
  item_count: number
  payment_method: string | null
  payment_status: string | null
  payment_installments: number | null
  shipment_status: string | null
  tracking_number: string | null
}

@Injectable()
export class SqlAdminOrdersQuery extends AdminOrdersQuery {
  constructor(@InjectDataSource() private readonly db: DataSource) {
    super()
  }

  async summary() {
    const [r] = await this.db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE o.status = $1)::int AS awaiting,
              count(*) FILTER (WHERE o.status = $2)::int AS paid,
              count(*) FILTER (WHERE o.status = $3)::int AS cancelled,
              count(*) FILTER (WHERE o.status = $2 AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id))::int AS to_ship,
              COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = $2), 0)::bigint AS paid_value,
              COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = $1), 0)::bigint AS awaiting_value,
              count(*) FILTER (WHERE (o.created_at AT TIME ZONE $4)::date = (now() AT TIME ZONE $4)::date)::int AS today
         FROM orders o`,
      [OrderStatus.AGUARDANDO_PAGAMENTO, OrderStatus.PAGO, OrderStatus.CANCELADO, TIME_ZONE],
    )
    return {
      total: r.total,
      awaitingPayment: r.awaiting,
      paid: r.paid,
      cancelled: r.cancelled,
      toShip: r.to_ship,
      paidValueCents: Number(r.paid_value),
      awaitingValueCents: Number(r.awaiting_value),
      today: r.today,
    }
  }

  async list({ q, status, toShip, email }: AdminOrderFilters, page: PageRequest) {
    const where: string[] = []
    const params: unknown[] = []
    const param = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }

    if (status) where.push(`o.status = ${param(status)}`)
    if (toShip) where.push(`o.status = ${param(OrderStatus.PAGO)} AND s.id IS NULL`)
    if (email) where.push(`lower(o.customer_email) = lower(${param(email)})`)

    const term = q?.trim().replace(/^#/, '')
    if (term) {
      const like = param(`%${escapeLike(term)}%`)
      const conds = [`o.customer_name ILIKE ${like}`, `o.customer_email ILIKE ${like}`]
      if (/^\d+$/.test(term) && term.length <= 9) conds.push(`o.number = ${param(Number(term))}`)
      const digits = term.replace(/\D/g, '')
      if (digits.length >= 3) {
        const d = param(`%${digits}%`)
        conds.push(`o.customer_phone LIKE ${d}`, `o.customer_cpf LIKE ${d}`)
      }
      where.push(`(${conds.join(' OR ')})`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows, [{ total }]] = await Promise.all([
      this.db.query(
        `SELECT ${ROW_SELECT} ${ROW_FROM} ${whereSql}
          ORDER BY o.created_at DESC
          LIMIT ${param(page.pageSize)} OFFSET ${param(pageOffset(page))}`,
        params,
      ) as Promise<RawRow[]>,
      // Mesmos filtros, sem paginação (os 2 últimos parâmetros ficam de fora)
      this.db.query(`SELECT count(*)::int AS total ${ROW_FROM} ${whereSql}`, params.slice(0, -2)) as Promise<
        { total: number }[]
      >,
    ])
    return { items: rows.map(toRow), total, ...page }
  }

  async detail(id: string): Promise<AdminOrderDetail | null> {
    const [raw]: (RawRow & {
      shipping_option_label: string
      coupon_code: string | null
      subtotal_cents: number
      discount_cents: number
      shipping_cents: number
      updated_at: Date
    })[] = await this.db.query(
      `SELECT ${ROW_SELECT}, o.shipping_option_label, o.coupon_code,
              o.subtotal_cents, o.discount_cents, o.shipping_cents, o.updated_at
         ${ROW_FROM}
        WHERE o.id = $1`,
      [id],
    )
    if (!raw) return null

    const [items, payments] = await Promise.all([
      this.db.query(
        `SELECT product_id, product_name, sku, image_url, unit_price_cents, quantity
           FROM order_items WHERE order_id = $1 ORDER BY product_name`,
        [id],
      ),
      this.db.query(
        `SELECT id, method, status, status_detail, amount_cents, installments, created_at
           FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
    ])

    const row = toRow(raw)
    return {
      ...row,
      customer: { ...row.customer, cpf: raw.customer_cpf },
      shippingAddress: raw.shipping_address,
      shippingLabel: raw.shipping_option_label,
      couponCode: raw.coupon_code,
      items: items.map((i: Record<string, unknown>) => ({
        productId: i.product_id as string,
        name: i.product_name as string,
        sku: i.sku as string,
        image: i.image_url as string,
        unitPriceCents: Number(i.unit_price_cents),
        quantity: Number(i.quantity),
      })),
      totals: {
        subtotalCents: raw.subtotal_cents,
        discountCents: raw.discount_cents,
        shippingCents: raw.shipping_cents,
        totalCents: raw.total_cents,
      },
      payments: payments.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        method: p.method as string,
        status: p.status as string,
        statusDetail: p.status_detail as string,
        amountCents: Number(p.amount_cents),
        installments: Number(p.installments),
        createdAt: p.created_at as Date,
      })),
      updatedAt: raw.updated_at,
    }
  }
}

function toRow(r: RawRow): AdminOrderRow {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone },
    city: r.shipping_address?.city ?? '',
    state: r.shipping_address?.state ?? '',
    itemCount: Number(r.item_count),
    totalCents: r.total_cents,
    giftWrap: Boolean(r.gift_wrap),
    payment: r.payment_method
      ? { method: r.payment_method, status: r.payment_status ?? '', installments: Number(r.payment_installments ?? 1) }
      : null,
    shipment: r.shipment_status ? { status: r.shipment_status, trackingNumber: r.tracking_number } : null,
    createdAt: r.created_at,
  }
}
