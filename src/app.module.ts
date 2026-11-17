import { Controller, Get, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ApiTags } from '@nestjs/swagger'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { validateEnv } from './config/env'
import { DatabaseModule } from './infra/database/database.module'
import { AuthModule } from './modules/auth/auth.module'
import { CartModule } from './modules/cart/cart.module'
import { LeadsModule } from './modules/leads/leads.module'
import { CouponsModule } from './modules/coupons/coupons.module'
import { OrdersModule } from './modules/orders/orders.module'
import { CustomersModule } from './modules/customers/customers.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { ProductsModule } from './modules/products/products.module'
import { ShipmentsModule } from './modules/shipping/shipments.module'
import { DomainExceptionFilter } from './shared/presentation/http/domain-exception.filter'

@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async check() {
    await this.db.query('SELECT 1')
    return { status: 'ok' }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // Limite padrão por IP; rotas sensíveis (login, lista VIP) têm limites próprios via @Throttle
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    ProductsModule,
    CartModule,
    LeadsModule,
    OrdersModule,
    CustomersModule,
    CouponsModule,
    PaymentsModule,
    ShipmentsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
