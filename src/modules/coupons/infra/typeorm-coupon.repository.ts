import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { pageOffset, type PageRequest } from '../../../shared/application/pagination'
import { escapeLike } from '../../../shared/infra/persistence/escape-like'
import { Coupon } from '../domain/coupon'
import { CouponRepository } from '../domain/coupon.repository'
import { CouponOrmEntity } from './coupon.orm-entity'

@Injectable()
export class TypeOrmCouponRepository extends CouponRepository {
  constructor(@InjectRepository(CouponOrmEntity) private readonly repo: Repository<CouponOrmEntity>) {
    super()
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id })
    return row ? Coupon.restore({ ...row }) : null
  }

  async findByCode(code: string) {
    const row = await this.repo.findOneBy({ code: Coupon.normalizeCode(code) })
    return row ? Coupon.restore({ ...row }) : null
  }

  async list({ q }: { q?: string }, page: PageRequest) {
    const qb = this.repo.createQueryBuilder('c')
    if (q?.trim()) {
      const like = `%${escapeLike(q.trim())}%`
      qb.where('(c.code ILIKE :like OR c.description ILIKE :like)', { like })
    }
    const [rows, total] = await qb
      .orderBy('c.isActive', 'DESC')
      .addOrderBy('c.createdAt', 'DESC')
      .skip(pageOffset(page))
      .take(page.pageSize)
      .getManyAndCount()
    return { items: rows.map((r) => Coupon.restore({ ...r })), total, ...page }
  }

  async save(coupon: Coupon) {
    await this.repo.save(Object.assign(new CouponOrmEntity(), coupon.toSnapshot()))
  }

  async delete(id: string) {
    await this.repo.delete({ id })
  }

  async registerUse(id: string) {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ usedCount: () => 'used_count + 1' })
      .where('id = :id', { id })
      .andWhere('(max_uses IS NULL OR used_count < max_uses)')
      .execute()
    return (result.affected ?? 0) > 0
  }
}
