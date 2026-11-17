import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CartModule } from '../cart/cart.module'
import { OrdersModule } from '../orders/orders.module'
import { GetOrderPaymentUseCase, StartPaymentUseCase, SyncPaymentUseCase } from './application/payments.use-cases'
import { PaymentGateway } from './domain/payment-gateway'
import { PaymentRepository } from './domain/payment.repository'
import { MercadoPagoGateway } from './infra/mercado-pago.gateway'
import { PaymentOrmEntity } from './infra/payment.orm-entity'
import { TypeOrmPaymentRepository } from './infra/typeorm-payment.repository'
import { MercadoPagoWebhookController, PaymentsController } from './presentation/http/payments.controller'

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOrmEntity]), OrdersModule, CartModule],
  controllers: [PaymentsController, MercadoPagoWebhookController],
  providers: [
    { provide: PaymentRepository, useClass: TypeOrmPaymentRepository },
    { provide: PaymentGateway, useClass: MercadoPagoGateway },
    StartPaymentUseCase,
    GetOrderPaymentUseCase,
    SyncPaymentUseCase,
  ],
})
export class PaymentsModule {}
