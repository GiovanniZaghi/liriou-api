import type { Order } from './order'

export abstract class OrderRepository {
  /** Próximo número amigável do pedido (#1001...) */
  abstract nextNumber(): Promise<number>
  abstract save(order: Order): Promise<void>
  abstract findById(id: string): Promise<Order | null>
  /** Grava só o status (mudanças vindas do pagamento) */
  abstract updateStatus(order: Order): Promise<void>
}
