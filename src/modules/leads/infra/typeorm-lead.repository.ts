import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm'
import { pageOffset, type PageRequest } from '../../../shared/application/pagination'
import { escapeLike } from '../../../shared/infra/persistence/escape-like'
import { Lead, type Pain } from '../domain/lead'
import { LeadRepository, type LeadFilters, type LeadStats } from '../domain/lead.repository'
import { LeadOrmEntity } from './lead.orm-entity'

const STATS_DAYS = 14

@Injectable()
export class TypeOrmLeadRepository extends LeadRepository {
  constructor(@InjectRepository(LeadOrmEntity) private readonly repo: Repository<LeadOrmEntity>) {
    super()
  }

  async addIfNew(lead: Lead) {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values(lead.toSnapshot())
      .orIgnore() // ON CONFLICT DO NOTHING (índice único em email)
      .execute()
  }

  async list(filters: LeadFilters, page: PageRequest) {
    const [rows, total] = await this.filtered(filters)
      .orderBy('l.createdAt', 'DESC')
      .skip(pageOffset(page))
      .take(page.pageSize)
      .getManyAndCount()
    return { items: rows.map(toDomain), total, ...page }
  }

  async listAll(filters: LeadFilters) {
    const rows = await this.filtered(filters).orderBy('l.createdAt', 'DESC').getMany()
    return rows.map(toDomain)
  }

  async stats(timeZone: string): Promise<LeadStats> {
    // Limites de dia calculados no fuso do negócio (não do servidor)
    const dayStart = `date_trunc('day', now() at time zone :tz)`
    const [totals, daily, byPain] = await Promise.all([
      this.repo
        .createQueryBuilder('l')
        .select('count(*)::int', 'total')
        .addSelect(`count(*) filter (where l.created_at >= ${dayStart} at time zone :tz)::int`, 'today')
        .addSelect(
          `count(*) filter (where l.created_at >= (${dayStart} - interval '6 days') at time zone :tz)::int`,
          'last7',
        )
        .addSelect('count(l.pain)::int', 'withPain')
        .setParameter('tz', timeZone)
        .getRawOne<{ total: number; today: number; last7: number; withPain: number }>(),
      this.repo
        .createQueryBuilder('l')
        .select(`to_char(l.created_at at time zone :tz, 'YYYY-MM-DD')`, 'day')
        .addSelect('count(*)::int', 'count')
        .where(`l.created_at >= (${dayStart} - make_interval(days => :days)) at time zone :tz`)
        .groupBy('day')
        .setParameters({ tz: timeZone, days: STATS_DAYS - 1 })
        .getRawMany<{ day: string; count: number }>(),
      this.repo
        .createQueryBuilder('l')
        .select('l.pain', 'pain')
        .addSelect('count(*)::int', 'count')
        .groupBy('l.pain')
        .orderBy('count', 'DESC')
        .getRawMany<{ pain: string | null; count: number }>(),
    ])

    // Preenche com zero os dias sem cadastro
    const counts = new Map(daily.map((r) => [r.day, r.count]))
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone }) // YYYY-MM-DD
    const days = Array.from({ length: STATS_DAYS }, (_, i) => {
      const day = fmt.format(new Date(Date.now() - (STATS_DAYS - 1 - i) * 86_400_000))
      return { day, count: counts.get(day) ?? 0 }
    })

    return { ...(totals ?? { total: 0, today: 0, last7: 0, withPain: 0 }), daily: days, byPain }
  }

  private filtered({ q, pain }: LeadFilters): SelectQueryBuilder<LeadOrmEntity> {
    const qb = this.repo.createQueryBuilder('l')
    const term = q?.trim()
    if (term) {
      const like = `%${escapeLike(term)}%`
      const digits = term.replace(/\D/g, '')
      qb.andWhere(
        new Brackets((w) => {
          w.where('l.name ILIKE :like', { like }).orWhere('l.email ILIKE :like', { like })
          if (digits.length >= 3) w.orWhere('l.whatsapp LIKE :digits', { digits: `%${digits}%` })
        }),
      )
    }
    if (pain === 'none') qb.andWhere('l.pain IS NULL')
    else if (pain) qb.andWhere('l.pain = :pain', { pain })
    return qb
  }
}

function toDomain(row: LeadOrmEntity): Lead {
  return Lead.restore({ ...row, pain: row.pain as Pain | null })
}
