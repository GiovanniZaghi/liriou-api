import { Injectable } from '@nestjs/common'
import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { UseCase } from '../../../shared/application/use-case'
import { OrderNotFoundError } from '../domain/order.errors'
import { OrderRepository } from '../domain/order.repository'
import {
  AdminOrdersQuery,
  type AdminOrderDetail,
  type AdminOrderFilters,
  type AdminOrderRow,
  type AdminOrdersSummary,
} from './admin-orders.query'

@Injectable()
export class GetOrdersSummaryUseCase implements UseCase<void, AdminOrdersSummary> {
  constructor(private readonly orders: AdminOrdersQuery) {}

  execute() {
    return this.orders.summary()
  }
}

@Injectable()
export class ListAdminOrdersUseCase
  implements UseCase<{ filters: AdminOrderFilters; page: PageRequest }, Paginated<AdminOrderRow>>
{
  constructor(private readonly orders: AdminOrdersQuery) {}

  execute({ filters, page }: { filters: AdminOrderFilters; page: PageRequest }) {
    return this.orders.list(filters, page)
  }
}

@Injectable()
export class GetAdminOrderUseCase implements UseCase<string, AdminOrderDetail> {
  constructor(private readonly orders: AdminOrdersQuery) {}

  async execute(id: string) {
    const order = await this.orders.detail(id)
    if (!order) throw new OrderNotFoundError()
    return order
  }
}

/** Check "Entregue / Recebido pela cliente": oculta o pedido da fila principal. */
@Injectable()
export class MarkOrderDeliveredUseCase implements UseCase<string, void> {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string) {
    const order = await this.orders.findById(id)
    if (!order) throw new OrderNotFoundError()
    if (order.markDelivered()) await this.orders.updateDelivery(order)
  }
}

/** "Desocultar": desfaz o entregue e o pedido volta para a fila. */
@Injectable()
export class UnhideOrderUseCase implements UseCase<string, void> {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string) {
    const order = await this.orders.findById(id)
    if (!order) throw new OrderNotFoundError()
    if (order.unmarkDelivered()) await this.orders.updateDelivery(order)
  }
}
