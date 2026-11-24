import { randomUUID } from 'node:crypto'
import type { Cents } from '../../../shared/domain/money'
import type { Customer, ShippingAddress } from '../../cart/domain/checkout-data'

export enum OrderStatus {
  AGUARDANDO_PAGAMENTO = 'aguardando_pagamento',
  PAGO = 'pago',
  CANCELADO = 'cancelado',
}

/** Foto do item no momento da compra */
export interface OrderItem {
  productId: string
  productName: string
  sku: string
  imageUrl: string
  unitPriceCents: Cents
  quantity: number
}

export interface OrderTotals {
  subtotalCents: Cents
  discountCents: Cents
  shippingCents: Cents
  totalCents: Cents
}

/** Frete do pedido. Os detalhes são null em pedidos anteriores à Frenet (frete fixo). */
export interface OrderShipping {
  /** Código do serviço na transportadora */
  id: string
  label: string
  carrier: string | null
  carrierCode: string | null
  service: string | null
  deliveryDays: number | null
  /** Preço cotado na transportadora (o que a loja paga; a cliente pode ter tido frete grátis) */
  quotedPriceCents: Cents | null
}

export interface OrderProps {
  id: string
  number: number
  status: OrderStatus
  customer: Customer
  shippingAddress: ShippingAddress
  shippingOption: OrderShipping
  couponCode: string | null
  /** Cliente pediu embalagem de Natal */
  giftWrap: boolean
  items: OrderItem[]
  totals: OrderTotals
  createdAt: Date
  updatedAt: Date
}

/** Pedido (agregado). Nasce aguardando pagamento; o gateway muda o status depois. */
export class Order {
  private constructor(private readonly props: OrderProps) {}

  static place(input: Omit<OrderProps, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Order {
    const now = new Date()
    return new Order({ ...input, id: randomUUID(), status: OrderStatus.AGUARDANDO_PAGAMENTO, createdAt: now, updatedAt: now })
  }

  static restore(props: OrderProps): Order {
    return new Order(props)
  }

  get id() { return this.props.id }
  get number() { return this.props.number }
  get status() { return this.props.status }
  get customer() { return this.props.customer }
  get shippingAddress() { return this.props.shippingAddress }
  get shippingOption() { return this.props.shippingOption }
  get couponCode() { return this.props.couponCode }
  get giftWrap() { return this.props.giftWrap }
  get items(): readonly OrderItem[] { return this.props.items }
  get totals() { return this.props.totals }
  get itemCount() { return this.props.items.reduce((s, i) => s + i.quantity, 0) }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  get isAwaitingPayment() { return this.props.status === OrderStatus.AGUARDANDO_PAGAMENTO }

  /** Pagamento confirmado pelo gateway. Idempotente; pedido cancelado não volta a ser pago. */
  markPaid(): boolean {
    if (!this.isAwaitingPayment) return false
    this.props.status = OrderStatus.PAGO
    this.props.updatedAt = new Date()
    return true
  }

  /** Pagamento estornado/devolvido: o pedido deixa de valer. */
  cancel(): boolean {
    if (this.props.status === OrderStatus.CANCELADO) return false
    this.props.status = OrderStatus.CANCELADO
    this.props.updatedAt = new Date()
    return true
  }
}
