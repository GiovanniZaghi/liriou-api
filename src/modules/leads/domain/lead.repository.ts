import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Lead } from './lead'

export interface LeadFilters {
  /** Nome, e-mail ou WhatsApp */
  q?: string
  /** Valor de PAIN_OPTIONS, ou 'none' para "não respondeu" */
  pain?: string
}

/** Modelo de leitura do painel. */
export interface LeadStats {
  total: number
  today: number
  last7: number
  withPain: number
  /** Últimos 14 dias no fuso informado, do mais antigo ao mais recente */
  daily: { day: string; count: number }[]
  byPain: { pain: string | null; count: number }[]
}

export abstract class LeadRepository {
  /** Insere; se o e-mail já existe, mantém o 1º cadastro (para a pessoa o resultado é o mesmo). */
  abstract addIfNew(lead: Lead): Promise<void>
  abstract list(filters: LeadFilters, page: PageRequest): Promise<Paginated<Lead>>
  abstract listAll(filters: LeadFilters): Promise<Lead[]>
  abstract stats(timeZone: string): Promise<LeadStats>
}
