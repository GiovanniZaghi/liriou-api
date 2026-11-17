import { Injectable } from '@nestjs/common'
import { NotFoundError } from '../../../shared/domain/domain-error'
import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { UseCase } from '../../../shared/application/use-case'
import {
  CustomersQuery,
  type CustomerDetail,
  type CustomerFilters,
  type CustomerRow,
  type JourneyFunnel,
} from './customers.query'

@Injectable()
export class GetJourneyFunnelUseCase implements UseCase<void, JourneyFunnel> {
  constructor(private readonly customers: CustomersQuery) {}

  execute() {
    return this.customers.funnel()
  }
}

@Injectable()
export class ListCustomersUseCase implements UseCase<{ filters: CustomerFilters; page: PageRequest }, Paginated<CustomerRow>> {
  constructor(private readonly customers: CustomersQuery) {}

  execute({ filters, page }: { filters: CustomerFilters; page: PageRequest }) {
    return this.customers.list(filters, page)
  }
}

@Injectable()
export class GetCustomerUseCase implements UseCase<string, CustomerDetail> {
  constructor(private readonly customers: CustomersQuery) {}

  async execute(email: string) {
    const detail = await this.customers.detail(email.trim().toLowerCase())
    if (!detail) throw new NotFoundError('Cliente não encontrada', 'CUSTOMER_NOT_FOUND')
    return detail
  }
}
