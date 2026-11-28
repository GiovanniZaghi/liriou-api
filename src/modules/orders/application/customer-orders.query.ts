import type { Cents } from '../../../shared/domain/money'
import type { TrackingEvent } from '../../shipping/domain/shipping-gateway'
import type { FulfillmentStage } from '../domain/fulfillment'
import type { OrderStatus } from '../domain/order'

/**
 * Lado de leitura (CQRS) da área da cliente: "meus pedidos" pelo CPF.
 * Hoje o CPF basta para consultar; por isso a resposta NÃO traz e-mail, telefone nem endereço
 * (só cidade/UF). Quando houver verificação (SMS/e-mail), dá para mostrar mais.
 */
export interface CustomerOrderView {
  number: number
  status: OrderStatus
  stage: FulfillmentStage
  totalCents: Cents
  items: { name: string; quantity: number; image: string }[]
  shipping: { label: string; pickup: boolean; deliveryDays: number | null }
  tracking: { number: string | null; url: string | null; lastEvent: TrackingEvent | null } | null
  giftWrap: boolean
  city: string | null
  state: string | null
  deliveredAt: Date | null
  createdAt: Date
}

export interface CustomerOrdersResult {
  /** Primeiro nome da compra mais recente (para a saudação) */
  firstName: string | null
  orders: CustomerOrderView[]
}

export abstract class CustomerOrdersQuery {
  /** Pedidos do CPF (11 dígitos), mais recentes primeiro */
  abstract byCpf(cpf: string): Promise<CustomerOrdersResult>
}
