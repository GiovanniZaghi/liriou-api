import { Injectable } from '@nestjs/common'
import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { UseCase } from '../../../shared/application/use-case'
import { Lead, type RegisterLeadInput } from '../domain/lead'
import { LeadRepository, type LeadFilters, type LeadStats } from '../domain/lead.repository'

/** Fuso usado para "hoje" e para o gráfico diário do painel. */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'

@Injectable()
export class JoinVipListUseCase implements UseCase<RegisterLeadInput, void> {
  constructor(private readonly leads: LeadRepository) {}

  async execute(input: RegisterLeadInput) {
    await this.leads.addIfNew(Lead.register(input))
  }
}

@Injectable()
export class ListLeadsUseCase implements UseCase<{ filters: LeadFilters; page: PageRequest }, Paginated<Lead>> {
  constructor(private readonly leads: LeadRepository) {}

  execute({ filters, page }: { filters: LeadFilters; page: PageRequest }) {
    return this.leads.list(filters, page)
  }
}

@Injectable()
export class ExportLeadsUseCase implements UseCase<LeadFilters, Lead[]> {
  constructor(private readonly leads: LeadRepository) {}

  execute(filters: LeadFilters) {
    return this.leads.listAll(filters)
  }
}

@Injectable()
export class GetLeadStatsUseCase implements UseCase<void, LeadStats> {
  constructor(private readonly leads: LeadRepository) {}

  execute() {
    return this.leads.stats(BUSINESS_TIME_ZONE)
  }
}
