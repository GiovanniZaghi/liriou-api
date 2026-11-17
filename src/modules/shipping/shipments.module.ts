import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { OrdersModule } from '../orders/orders.module'
import { ProductsModule } from '../products/products.module'
import {
  CreateShipmentUseCase,
  GetShipmentUseCase,
  RecordTrackingUseCase,
  RefreshLabelUseCase,
  ShipmentsConfig,
} from './application/shipments.use-cases'
import { ShipmentRepository } from './domain/shipment'
import { ShipmentOrmEntity } from './infra/shipment.orm-entity'
import { TypeOrmShipmentRepository } from './infra/typeorm-shipment.repository'
import { AdminShipmentsController, FrenetWebhookController } from './presentation/http/shipments.controller'
import { ShippingModule } from './shipping.module'

/** Envios dos pedidos: etiqueta (Frenet) e rastreio. */
@Module({
  imports: [TypeOrmModule.forFeature([ShipmentOrmEntity]), ShippingModule, OrdersModule, ProductsModule, AuthModule],
  controllers: [AdminShipmentsController, FrenetWebhookController],
  providers: [
    { provide: ShipmentRepository, useClass: TypeOrmShipmentRepository },
    ShipmentsConfig,
    GetShipmentUseCase,
    CreateShipmentUseCase,
    RefreshLabelUseCase,
    RecordTrackingUseCase,
  ],
})
export class ShipmentsModule {}
