import type { Payment } from './payment'

export abstract class PaymentRepository {
  abstract save(payment: Payment): Promise<void>
  /** Tentativa mais recente do pedido */
  abstract findLatestByOrder(orderId: string): Promise<Payment | null>
  abstract findByGatewayOrderId(gatewayOrderId: string): Promise<Payment | null>
}
