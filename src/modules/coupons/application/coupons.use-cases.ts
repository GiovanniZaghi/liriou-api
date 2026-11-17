import { Injectable } from '@nestjs/common'
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error'
import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { UseCase } from '../../../shared/application/use-case'
import { Coupon, type CouponDetails } from '../domain/coupon'
import { CouponRepository } from '../domain/coupon.repository'

const notFound = () => new NotFoundError('Cupom não encontrado', 'COUPON_NOT_FOUND')
const codeTaken = () => new ConflictError('Já existe um cupom com este código', 'COUPON_CODE_TAKEN')

@Injectable()
export class ListCouponsUseCase implements UseCase<{ q?: string; page: PageRequest }, Paginated<Coupon>> {
  constructor(private readonly coupons: CouponRepository) {}

  execute({ q, page }: { q?: string; page: PageRequest }) {
    return this.coupons.list({ q }, page)
  }
}

@Injectable()
export class GetCouponUseCase implements UseCase<string, Coupon> {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(id: string) {
    const coupon = await this.coupons.findById(id)
    if (!coupon) throw notFound()
    return coupon
  }
}

@Injectable()
export class CreateCouponUseCase implements UseCase<CouponDetails, Coupon> {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(details: CouponDetails) {
    const coupon = Coupon.create(details)
    if (await this.coupons.findByCode(coupon.code)) throw codeTaken()
    await this.coupons.save(coupon)
    return coupon
  }
}

@Injectable()
export class UpdateCouponUseCase implements UseCase<{ id: string; changes: Partial<CouponDetails> }, Coupon> {
  constructor(private readonly coupons: CouponRepository) {}

  async execute({ id, changes }: { id: string; changes: Partial<CouponDetails> }) {
    const coupon = await this.coupons.findById(id)
    if (!coupon) throw notFound()
    coupon.update(changes)
    const sameCode = await this.coupons.findByCode(coupon.code)
    if (sameCode && sameCode.id !== coupon.id) throw codeTaken()
    await this.coupons.save(coupon)
    return coupon
  }
}

/** Só exclui cupom nunca usado (o histórico dos pedidos referencia o código). */
@Injectable()
export class DeleteCouponUseCase implements UseCase<string, void> {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(id: string) {
    const coupon = await this.coupons.findById(id)
    if (!coupon) throw notFound()
    coupon.assertDeletable()
    await this.coupons.delete(id)
  }
}
