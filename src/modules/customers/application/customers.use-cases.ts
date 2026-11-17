import { Injectable } from '@nestjs/common'
import { NotFoundError } from '../../../shared/domain/domain-error'
import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { UseCase } from '../../../shared/application/use-case'
import {
  CustomerJourneyQuery,
  type JourneyDetail,
  type JourneyFilters,
  type JourneyFunnel,
  type JourneyRow,
} from './customer-journey.query'

@Injectable()
export class GetJourneyFunnelUseCase implements UseCase<void, JourneyFunnel> {
  constructor(private readonly journeys: CustomerJourneyQuery) {}

  execute() {
    return this.journeys.funnel()
  }
}

@Injectable()
export class ListCustomerJourneysUseCase
  implements UseCase<{ filters: JourneyFilters; page: PageRequest }, Paginated<JourneyRow>>
{
  constructor(private readonly journeys: CustomerJourneyQuery) {}

  execute({ filters, page }: { filters: JourneyFilters; page: PageRequest }) {
    return this.journeys.list(filters, page)
  }
}

@Injectable()
export class GetCustomerJourneyUseCase implements UseCase<string, JourneyDetail> {
  constructor(private readonly journeys: CustomerJourneyQuery) {}

  async execute(cartId: string) {
    const detail = await this.journeys.detail(cartId)
    if (!detail) throw new NotFoundError('Cliente não encontrado', 'JOURNEY_NOT_FOUND')
    return detail
  }
}
