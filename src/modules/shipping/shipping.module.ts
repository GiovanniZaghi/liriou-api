import { Module } from '@nestjs/common'
import { ShippingGateway } from './domain/shipping-gateway'
import { FrenetGateway } from './infra/frenet.gateway'

/** Gateway de frete (Frenet). Usado pela sacola/checkout (cotação) e pelos envios (etiqueta/rastreio). */
@Module({
  providers: [{ provide: ShippingGateway, useClass: FrenetGateway }],
  exports: [ShippingGateway],
})
export class ShippingModule {}
