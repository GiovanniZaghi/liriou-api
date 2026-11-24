import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import type { ShippingAddress } from '../../cart/domain/checkout-data'
import { OrderStatus, type OrderShipping } from '../domain/order'

@Entity({ name: 'orders' })
export class OrderOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'integer' })
  number: number

  @Column({ type: 'varchar', length: 30 })
  status: OrderStatus

  @Column({ type: 'varchar', length: 120, name: 'customer_name' })
  customerName: string

  @Column({ type: 'varchar', length: 254, name: 'customer_email' })
  customerEmail: string

  @Column({ type: 'char', length: 11, name: 'customer_cpf' })
  customerCpf: string

  @Column({ type: 'varchar', length: 11, name: 'customer_phone' })
  customerPhone: string

  @Column({ type: 'jsonb', name: 'shipping_address' })
  shippingAddress: ShippingAddress

  @Column({ type: 'varchar', length: 40, name: 'shipping_option_id' })
  shippingOptionId: string

  @Column({ type: 'varchar', length: 120, name: 'shipping_option_label' })
  shippingOptionLabel: string

  /** Transportadora, serviço, prazo e preço cotado (null em pedidos do frete fixo antigo) */
  @Column({ type: 'jsonb', name: 'shipping_details', nullable: true })
  shippingDetails: Omit<OrderShipping, 'id' | 'label'> | null

  @Column({ type: 'varchar', length: 40, name: 'coupon_code', nullable: true })
  couponCode: string | null

  @Column({ type: 'boolean', name: 'gift_wrap', default: false })
  giftWrap: boolean

  @Column({ type: 'integer', name: 'subtotal_cents' })
  subtotalCents: number

  @Column({ type: 'integer', name: 'discount_cents' })
  discountCents: number

  @Column({ type: 'integer', name: 'shipping_cents' })
  shippingCents: number

  @Column({ type: 'integer', name: 'total_cents' })
  totalCents: number

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}

@Entity({ name: 'order_items' })
export class OrderItemOrmEntity {
  @PrimaryColumn({ type: 'uuid', name: 'order_id' })
  orderId: string

  @PrimaryColumn({ type: 'uuid', name: 'product_id' })
  productId: string

  @Column({ type: 'varchar', length: 160, name: 'product_name' })
  productName: string

  @Column({ type: 'varchar', length: 60 })
  sku: string

  @Column({ type: 'text', name: 'image_url' })
  imageUrl: string

  @Column({ type: 'integer', name: 'unit_price_cents' })
  unitPriceCents: number

  @Column({ type: 'integer' })
  quantity: number
}
