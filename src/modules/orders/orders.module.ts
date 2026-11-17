import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CartModule } from '../cart/cart.module'
import { GetOrderUseCase, PlaceOrderUseCase } from './application/orders.use-cases'
import { OrderRepository } from './domain/order.repository'
import { OrderItemOrmEntity, OrderOrmEntity } from './infra/order.orm-entity'
import { TypeOrmOrderRepository } from './infra/typeorm-order.repository'
import { OrdersController } from './presentation/http/orders.controller'

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]), CartModule],
  controllers: [OrdersController],
  providers: [{ provide: OrderRepository, useClass: TypeOrmOrderRepository }, PlaceOrderUseCase, GetOrderUseCase],
  exports: [OrderRepository],
})
export class OrdersModule {}
