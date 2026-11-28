import { Order, OrderStatus, type OrderProps } from './order'
import { OrderNotPaidError } from './order.errors'

const order = (status: OrderStatus, deliveredAt: Date | null = null) =>
  Order.restore({ id: 'o1', number: 1001, status, deliveredAt, createdAt: new Date(), updatedAt: new Date() } as OrderProps)

describe('Order · entregue', () => {
  it('pedido pago pode ser marcado como entregue (uma vez) e desfeito', () => {
    const o = order(OrderStatus.PAGO)
    expect(o.markDelivered()).toBe(true)
    expect(o.deliveredAt).toBeInstanceOf(Date)
    expect(o.markDelivered()).toBe(false)
    expect(o.unmarkDelivered()).toBe(true)
    expect(o.deliveredAt).toBeNull()
    expect(o.unmarkDelivered()).toBe(false)
  })

  it('só pedido pago pode ser marcado como entregue', () => {
    expect(() => order(OrderStatus.AGUARDANDO_PAGAMENTO).markDelivered()).toThrow(OrderNotPaidError)
    expect(() => order(OrderStatus.CANCELADO).markDelivered()).toThrow(OrderNotPaidError)
  })
})
