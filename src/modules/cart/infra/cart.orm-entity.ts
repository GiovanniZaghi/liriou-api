import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import type { Customer, ShippingAddress } from '../domain/checkout-data'
import { CheckoutStage, type SelectedShipping } from '../domain/cart'

@Entity({ name: 'carts' })
export class CartOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 40, name: 'coupon_code', nullable: true })
  couponCode: string | null

  /** Código do serviço de frete escolhido (espelho de shipping.serviceCode, usado em consultas SQL) */
  @Column({ type: 'varchar', length: 40, name: 'shipping_option_id', nullable: true })
  shippingOptionId: string | null

  /** Cotação escolhida (transportadora, preço, prazo, CEP) */
  @Column({ type: 'jsonb', name: 'shipping_quote', nullable: true })
  shipping: SelectedShipping | null

  @Column({ type: 'boolean', name: 'gift_wrap', default: false })
  giftWrap: boolean

  @Column({ type: 'varchar', length: 20, name: 'checkout_stage', default: CheckoutStage.CART })
  stage: CheckoutStage

  @Column({ type: 'jsonb', nullable: true })
  customer: Customer | null

  @Column({ type: 'jsonb', name: 'shipping_address', nullable: true })
  shippingAddress: ShippingAddress | null

  @Column({ type: 'timestamptz', name: 'identified_at', nullable: true })
  identifiedAt: Date | null

  @Column({ type: 'timestamptz', name: 'delivery_at', nullable: true })
  deliveryAt: Date | null

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null

  @Column({ type: 'timestamptz', name: 'ordered_at', nullable: true })
  orderedAt: Date | null

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}

@Entity({ name: 'cart_items' })
export class CartItemOrmEntity {
  @PrimaryColumn({ type: 'uuid', name: 'cart_id' })
  cartId: string

  @PrimaryColumn({ type: 'uuid', name: 'product_id' })
  productId: string

  @Column({ type: 'integer' })
  quantity: number

  @Column({ type: 'timestamptz', name: 'added_at' })
  addedAt: Date
}
