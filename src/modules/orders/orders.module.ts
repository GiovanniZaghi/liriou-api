import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { AdminOrdersQuery } from './application/admin-orders.query'
import {
  GetAdminOrderUseCase,
  GetOrdersSummaryUseCase,
  ListAdminOrdersUseCase,
  MarkOrderDeliveredUseCase,
  UnhideOrderUseCase,
} from './application/admin-orders.use-cases'
import { CustomerOrdersQuery } from './application/customer-orders.query'
import { LookupCustomerOrdersUseCase } from './application/customer-orders.use-cases'
import { GetOrderUseCase, PlaceOrderUseCase } from './application/orders.use-cases'
import { OrderRepository } from './domain/order.repository'
import { OrderItemOrmEntity, OrderOrmEntity } from './infra/order.orm-entity'
import { SqlAdminOrdersQuery } from './infra/sql-admin-orders.query'
import { SqlCustomerOrdersQuery } from './infra/sql-customer-orders.query'
import { TypeOrmOrderRepository } from './infra/typeorm-order.repository'
import { AdminOrdersController } from './presentation/http/admin-orders.controller'
import { CustomerOrdersController } from './presentation/http/customer-orders.controller'
import { OrdersController } from './presentation/http/orders.controller'

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]), CartModule, AuthModule],
  controllers: [OrdersController, AdminOrdersController, CustomerOrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    // Leitura do dashboard (SQL direto, sem passar pelo agregado)
    { provide: AdminOrdersQuery, useClass: SqlAdminOrdersQuery },
    // Área da cliente (consulta por CPF)
    { provide: CustomerOrdersQuery, useClass: SqlCustomerOrdersQuery },
    LookupCustomerOrdersUseCase,
    PlaceOrderUseCase,
    GetOrderUseCase,
    GetOrdersSummaryUseCase,
    ListAdminOrdersUseCase,
    GetAdminOrderUseCase,
    MarkOrderDeliveredUseCase,
    UnhideOrderUseCase,
  ],
  exports: [OrderRepository],
})
export class OrdersModule {}
