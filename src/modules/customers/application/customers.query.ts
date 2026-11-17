import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Cents } from '../../../shared/domain/money'
import type { CheckoutStage } from '../../cart/domain/cart'
import type { ShippingAddress } from '../../cart/domain/checkout-data'
import type { OrderStatus } from '../../orders/domain/order'

/**
 * Lado de leitura (CQRS) das clientes no dashboard.
 * Uma cliente = um e-mail: junta todos os pedidos e sacolas dela, sem regras de escrita.
 */

export type CustomerSegment = 'buyers' | 'not_bought'

export interface CustomerFilters {
  /** Nome, e-mail, telefone ou CPF */
  q?: string
  /** buyers = já fez pedido · not_bought = só sacolas, sem pedido */
  segment?: CustomerSegment
}

export interface CustomerRow {
  /** E-mail em minúsculas: a chave da cliente */
  email: string
  name: string
  phone: string
  city: string | null
  state: string | null
  /** Pedidos não cancelados */
  ordersCount: number
  paidOrdersCount: number
  /** Soma dos pedidos pagos */
  totalSpentCents: Cents
  lastOrderAt: Date | null
  /** Sacolas com itens que não viraram pedido (itens × preço atual) */
  openCartsCount: number
  openCartsValueCents: Cents
  firstSeenAt: Date
  lastActivityAt: Date
}

export interface CustomerOrder {
  id: string
  number: number
  status: OrderStatus
  itemCount: number
  totalCents: Cents
  shipmentStatus: string | null
  createdAt: Date
}

export interface CustomerOpenCart {
  cartId: string
  stage: CheckoutStage
  itemCount: number
  valueCents: Cents
  /** Ex.: "Scrunchie Sálvia ×2" */
  items: { name: string; quantity: number; image: string }[]
  lastActivityAt: Date
}

export interface CustomerDetail extends CustomerRow {
  cpf: string | null
  /** Endereço mais recente usado */
  address: ShippingAddress | null
  orders: CustomerOrder[]
  openCarts: CustomerOpenCart[]
}

export interface JourneyFunnel {
  cart: number
  identified: number
  delivery: number
  ordered: number
  orderedValueCents: Cents
  /** Sacolas abertas com itens (potencial de recuperação) */
  openValueCents: Cents
}

export abstract class CustomersQuery {
  /** Funil do checkout (por sessão de compra) */
  abstract funnel(): Promise<JourneyFunnel>
  abstract list(filters: CustomerFilters, page: PageRequest): Promise<Paginated<CustomerRow>>
  abstract detail(email: string): Promise<CustomerDetail | null>
}
