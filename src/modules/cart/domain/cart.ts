import { randomUUID } from 'node:crypto'
import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error'
import type { Customer, ShippingAddress } from './checkout-data'

export const MAX_QUANTITY_PER_ITEM = 20
export const MAX_DISTINCT_ITEMS = 30

/** Até onde a cliente chegou no checkout (ordem importa: cada etapa pressupõe a anterior). */
export enum CheckoutStage {
  /** Só montou a sacola */
  CART = 'cart',
  /** Concluiu a identificação (nome, e-mail, CPF, telefone) */
  IDENTIFIED = 'identified',
  /** Concluiu a entrega (endereço + frete) e está na revisão */
  DELIVERY = 'delivery',
  /** Finalizou: virou pedido */
  ORDERED = 'ordered',
}

export interface CartLine {
  productId: string
  quantity: number
  addedAt: Date
}

/** Frete cotado e escolhido pela cliente (o preço vem da transportadora, nunca do front). */
export interface SelectedShipping {
  serviceCode: string
  carrier: string
  carrierCode: string
  service: string
  priceCents: number
  deliveryDays: number
  /** CEP usado na cotação */
  cep: string
}

export interface CartProps {
  id: string
  lines: CartLine[]
  couponCode: string | null
  shipping: SelectedShipping | null
  stage: CheckoutStage
  customer: Customer | null
  shippingAddress: ShippingAddress | null
  identifiedAt: Date | null
  deliveryAt: Date | null
  orderId: string | null
  orderedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export class CartAlreadyOrderedError extends BusinessRuleError {
  constructor() {
    super('Esta sacola já virou um pedido', 'CART_ALREADY_ORDERED')
  }
}

/**
 * Sacola de compras + sessão de checkout (agregado).
 * Sabe só de ids/quantidades; preço vem do catálogo na hora de exibir.
 */
export class Cart {
  private constructor(private props: CartProps) {}

  static create(): Cart {
    const now = new Date()
    return new Cart({
      id: randomUUID(),
      lines: [],
      couponCode: null,
      shipping: null,
      stage: CheckoutStage.CART,
      customer: null,
      shippingAddress: null,
      identifiedAt: null,
      deliveryAt: null,
      orderId: null,
      orderedAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: CartProps): Cart {
    return new Cart(props)
  }

  quantityOf(productId: string): number {
    return this.props.lines.find((l) => l.productId === productId)?.quantity ?? 0
  }

  /** Define a quantidade exata; 0 remove o item. */
  setQuantity(productId: string, quantity: number): void {
    this.assertOpen()
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError({ quantity: `Quantidade deve ser entre 0 e ${MAX_QUANTITY_PER_ITEM}` })
    }
    if (quantity === 0) return this.removeItem(productId)

    const existing = this.props.lines.find((l) => l.productId === productId)
    if (!existing && this.props.lines.length >= MAX_DISTINCT_ITEMS) {
      throw new ValidationError({ productId: 'A sacola atingiu o limite de itens' })
    }
    const lines = existing
      ? this.props.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l))
      : [...this.props.lines, { productId, quantity, addedAt: new Date() }]
    this.changeLines(lines)
  }

  removeItem(productId: string): void {
    this.assertOpen()
    this.changeLines(this.props.lines.filter((l) => l.productId !== productId))
  }

  /** Remove itens cujo produto saiu do catálogo. Retorna true se algo mudou. */
  pruneUnavailable(isAvailable: (productId: string) => boolean): boolean {
    if (this.isOrdered) return false
    const lines = this.props.lines.filter((l) => isAvailable(l.productId))
    if (lines.length === this.props.lines.length) return false
    this.changeLines(lines)
    return true
  }

  applyCoupon(code: string): void {
    this.assertOpen()
    this.touch({ couponCode: code })
  }

  removeCoupon(): void {
    this.assertOpen()
    this.touch({ couponCode: null })
  }

  selectShipping(shipping: SelectedShipping): void {
    this.assertOpen()
    this.touch({ shipping })
  }

  // ─── Checkout ───────────────────────────────────────────────────────────────

  /** Etapa 1 concluída. Reenviar a identificação não faz a etapa regredir. */
  identify(customer: Customer): void {
    this.assertOpen()
    this.touch({
      customer,
      identifiedAt: this.props.identifiedAt ?? new Date(),
      stage: this.stageAtLeast(CheckoutStage.IDENTIFIED),
    })
  }

  /** Etapa 2 concluída (exige identificação). */
  setDelivery(address: ShippingAddress, shipping: SelectedShipping): void {
    this.assertOpen()
    if (!this.props.customer) throw new ValidationError({ customer: 'Identifique-se antes de informar a entrega' })
    this.touch({
      shippingAddress: address,
      shipping,
      deliveryAt: this.props.deliveryAt ?? new Date(),
      stage: this.stageAtLeast(CheckoutStage.DELIVERY),
    })
  }

  /** Virou pedido: a sacola fica congelada como histórico da compra. */
  markOrdered(orderId: string): void {
    this.assertOpen()
    this.touch({ orderId, orderedAt: new Date(), stage: CheckoutStage.ORDERED })
  }

  get id() { return this.props.id }
  get lines(): readonly CartLine[] { return this.props.lines }
  get couponCode() { return this.props.couponCode }
  get shipping() { return this.props.shipping }
  get shippingOptionId() { return this.props.shipping?.serviceCode ?? null }
  get itemCount() { return this.props.lines.reduce((sum, l) => sum + l.quantity, 0) }
  get stage() { return this.props.stage }
  get customer() { return this.props.customer }
  get shippingAddress() { return this.props.shippingAddress }
  get identifiedAt() { return this.props.identifiedAt }
  get deliveryAt() { return this.props.deliveryAt }
  get orderId() { return this.props.orderId }
  get orderedAt() { return this.props.orderedAt }
  get isOrdered() { return this.props.stage === CheckoutStage.ORDERED }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  toSnapshot(): Readonly<CartProps> {
    return { ...this.props, lines: [...this.props.lines] }
  }

  private stageAtLeast(stage: CheckoutStage): CheckoutStage {
    const order = [CheckoutStage.CART, CheckoutStage.IDENTIFIED, CheckoutStage.DELIVERY, CheckoutStage.ORDERED]
    return order.indexOf(this.props.stage) > order.indexOf(stage) ? this.props.stage : stage
  }

  private assertOpen() {
    if (this.isOrdered) throw new CartAlreadyOrderedError()
  }

  /** Itens mudaram: peso e valor mudam, então a cotação de frete deixa de valer. */
  private changeLines(lines: CartLine[]) {
    this.touch({ lines, shipping: null })
  }

  private touch(changes: Partial<CartProps>) {
    this.props = { ...this.props, ...changes, updatedAt: new Date() }
  }
}
