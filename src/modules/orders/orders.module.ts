import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { AdminOrdersQuery } from './application/admin-orders.query'
import {
  GetAdminOrderUseCase,
  GetOrdersSummaryUseCase,
  ListAdminOrdersUseCase,
} from './application/admin-orders.use-cases'
import { GetOrderUseCase, PlaceOrderUseCase } from './application/orders.use-cases'
import { OrderRepository } from './domain/order.repository'
import { OrderItemOrmEntity, OrderOrmEntity } from './infra/order.orm-entity'
import { SqlAdminOrdersQuery } from './infra/sql-admin-orders.query'
import { TypeOrmOrderRepository } from './infra/typeorm-order.repository'
import { AdminOrdersController } from './presentation/http/admin-orders.controller'
import { OrdersController } from './presentation/http/orders.controller'

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]), CartModule, AuthModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    // Leitura do dashboard (SQL direto, sem passar pelo agregado)
    { provide: AdminOrdersQuery, useClass: SqlAdminOrdersQuery },
    PlaceOrderUseCase,
    GetOrderUseCase,
    GetOrdersSummaryUseCase,
    ListAdminOrdersUseCase,
    GetAdminOrderUseCase,
  ],
  exports: [OrderRepository],
})
export class OrdersModule {}
