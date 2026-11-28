import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import type { TrackingEvent } from '../../shipping/domain/shipping-gateway'
import { isPickup } from '../../shipping/domain/pickup'
import { CustomerOrdersQuery, type CustomerOrdersResult } from '../application/customer-orders.query'
import { fulfillmentStage } from '../domain/fulfillment'
import type { OrderStatus } from '../domain/order'

/** Quantos pedidos a área da cliente mostra */
const LIMIT = 20

interface Raw {
  number: number
  status: OrderStatus
  customer_name: string
  shipping_option_id: string
  shipping_option_label: string
  delivery_days: string | null
  gift_wrap: boolean
  total_cents: number
  city: string | null
  state: string | null
  delivered_at: Date | null
  created_at: Date
  shipment_status: string | null
  tracking_number: string | null
  tracking_url: string | null
  last_event: TrackingEvent | null
  items: { name: string; quantity: number; image: string }[] | null
}

@Injectable()
export class SqlCustomerOrdersQuery extends CustomerOrdersQuery {
  constructor(@InjectDataSource() private readonly db: DataSource) {
    super()
  }

  async byCpf(cpf: string): Promise<CustomerOrdersResult> {
    const rows: Raw[] = await this.db.query(
      `SELECT o.number, o.status, o.customer_name, o.shipping_option_id, o.shipping_option_label,
              o.shipping_details->>'deliveryDays' AS delivery_days, o.gift_wrap, o.total_cents,
              o.shipping_address->>'city' AS city, o.shipping_address->>'state' AS state,
              o.delivered_at, o.created_at,
              s.status AS shipment_status, s.tracking_number, s.tracking_url, s.last_event,
              (SELECT json_agg(json_build_object('name', i.product_name, 'quantity', i.quantity, 'image', i.image_url)
                               ORDER BY i.product_name)
                 FROM order_items i WHERE i.order_id = o.id) AS items
         FROM orders o
         LEFT JOIN shipments s ON s.order_id = o.id
        WHERE o.customer_cpf = $1
        ORDER BY o.created_at DESC
        LIMIT ${LIMIT}`,
      [cpf],
    )

    return {
      firstName: rows[0]?.customer_name.trim().split(/\s+/)[0] ?? null,
      orders: rows.map((r) => ({
        number: Number(r.number),
        status: r.status,
        stage: fulfillmentStage({
          status: r.status,
          deliveredAt: r.delivered_at,
          shipment: r.shipment_status
            ? { status: r.shipment_status, trackingNumber: r.tracking_number, lastEventDescription: r.last_event?.description ?? null }
            : null,
        }),
        totalCents: Number(r.total_cents),
        items: (r.items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity) })),
        shipping: {
          label: r.shipping_option_label,
          pickup: isPickup(r.shipping_option_id),
          deliveryDays: r.delivery_days ? Number(r.delivery_days) : null,
        },
        tracking: r.shipment_status ? { number: r.tracking_number, url: r.tracking_url, lastEvent: r.last_event } : null,
        giftWrap: r.gift_wrap,
        city: r.city,
        state: r.state,
        deliveredAt: r.delivered_at,
        createdAt: r.created_at,
      })),
    }
  }
}
