import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Cents } from '../../../shared/domain/money'
import type { ShippingAddress } from '../../cart/domain/checkout-data'
import type { OrderStatus } from '../domain/order'

/**
 * Lado de leitura (CQRS) dos pedidos no dashboard.
 * Junta pedido, último pagamento e envio num modelo pensado para a tela, sem regras de escrita.
 */

export interface AdminOrderFilters {
  /** Número do pedido, nome, e-mail, telefone ou CPF */
  q?: string
  status?: OrderStatus
  /** Só pedidos pagos que ainda não têm etiqueta de envio */
  toShip?: boolean
  /** Todos os pedidos de uma cliente (tela de clientes) */
  email?: string
}

export interface AdminOrderPaymentRef {
  method: string
  status: string
  installments: number
}

export interface AdminOrderShipmentRef {
  status: string
  trackingNumber: string | null
}

export interface AdminOrderRow {
  id: string
  number: number
  status: OrderStatus
  customer: { name: string; email: string; phone: string }
  city: string
  state: string
  itemCount: number
  totalCents: Cents
  /** Tentativa de pagamento mais recente */
  payment: AdminOrderPaymentRef | null
  shipment: AdminOrderShipmentRef | null
  createdAt: Date
}

export interface AdminOrderPayment {
  id: string
  method: string
  status: string
  statusDetail: string
  amountCents: Cents
  installments: number
  createdAt: Date
}

export interface AdminOrderDetail extends AdminOrderRow {
  customer: AdminOrderRow['customer'] & { cpf: string }
  shippingAddress: ShippingAddress
  shippingLabel: string
  couponCode: string | null
  items: { productId: string; name: string; sku: string; image: string; unitPriceCents: Cents; quantity: number }[]
  totals: { subtotalCents: Cents; discountCents: Cents; shippingCents: Cents; totalCents: Cents }
  payments: AdminOrderPayment[]
  updatedAt: Date
}

export interface AdminOrdersSummary {
  total: number
  awaitingPayment: number
  paid: number
  cancelled: number
  /** Pagos sem etiqueta: o que precisa ser despachado */
  toShip: number
  paidValueCents: Cents
  awaitingValueCents: Cents
  today: number
}

export abstract class AdminOrdersQuery {
  abstract summary(): Promise<AdminOrdersSummary>
  abstract list(filters: AdminOrderFilters, page: PageRequest): Promise<Paginated<AdminOrderRow>>
  abstract detail(id: string): Promise<AdminOrderDetail | null>
}
