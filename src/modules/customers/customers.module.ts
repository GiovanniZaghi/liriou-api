import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { CustomerJourneyQuery } from './application/customer-journey.query'
import {
  GetCustomerJourneyUseCase,
  GetJourneyFunnelUseCase,
  ListCustomerJourneysUseCase,
} from './application/customers.use-cases'
import { SqlCustomerJourneyQuery } from './infra/sql-customer-journey.query'
import { AdminCustomersController } from './presentation/http/admin-customers.controller'

@Module({
  imports: [AuthModule, CartModule],
  controllers: [AdminCustomersController],
  providers: [
    { provide: CustomerJourneyQuery, useClass: SqlCustomerJourneyQuery },
    GetJourneyFunnelUseCase,
    ListCustomerJourneysUseCase,
    GetCustomerJourneyUseCase,
  ],
})
export class CustomersModule {}
