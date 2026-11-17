import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CustomersQuery } from './application/customers.query'
import { GetCustomerUseCase, GetJourneyFunnelUseCase, ListCustomersUseCase } from './application/customers.use-cases'
import { SqlCustomersQuery } from './infra/sql-customers.query'
import { AdminCustomersController } from './presentation/http/admin-customers.controller'

@Module({
  imports: [AuthModule],
  controllers: [AdminCustomersController],
  providers: [
    { provide: CustomersQuery, useClass: SqlCustomersQuery },
    GetJourneyFunnelUseCase,
    ListCustomersUseCase,
    GetCustomerUseCase,
  ],
})
export class CustomersModule {}
