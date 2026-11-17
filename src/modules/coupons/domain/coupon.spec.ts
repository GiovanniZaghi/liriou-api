import { ValidationError } from '../../../shared/domain/domain-error'
import { Coupon, CouponInUseError, CouponUnavailableError, DiscountType, type CouponDetails } from './coupon'

const details = (over: Partial<CouponDetails> = {}): CouponDetails => ({
  code: ' bemvinda15 ',
  description: null,
  type: DiscountType.PERCENT,
  value: 15,
  minSubtotalCents: 0,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  isActive: true,
  ...over,
})

describe('Coupon', () => {
  it('normaliza o código para maiúsculas', () => {
    expect(Coupon.create(details()).code).toBe('BEMVINDA15')
  })

  it('valida percentual, período e limite', () => {
    expect(() => Coupon.create(details({ value: 150 }))).toThrow(ValidationError)
    expect(() => Coupon.create(details({ code: 'x' }))).toThrow(ValidationError)
    const start = new Date('2026-12-01')
    expect(() => Coupon.create(details({ startsAt: start, endsAt: new Date('2026-11-01') }))).toThrow(ValidationError)
    expect(() => Coupon.create(details({ maxUses: 0 }))).toThrow(ValidationError)
  })

  it('calcula desconto percentual e fixo, nunca acima do subtotal', () => {
    expect(Coupon.create(details()).discountFor(10_000)).toBe(1_500)
    const fixed = Coupon.create(details({ type: DiscountType.FIXED, value: 2_000 }))
    expect(fixed.discountFor(10_000)).toBe(2_000)
    expect(fixed.discountFor(1_500)).toBe(1_500)
  })

  it('respeita o pedido mínimo', () => {
    const c = Coupon.create(details({ minSubtotalCents: 10_000 }))
    expect(c.discountFor(9_999)).toBe(0)
    expect(c.missingForMinimum(9_000)).toBe(1_000)
    expect(c.discountFor(10_000)).toBe(1_500)
  })

  it('status: agendado, expirado, esgotado, inativo', () => {
    const now = new Date('2026-11-15T12:00:00Z')
    expect(Coupon.create(details({ startsAt: new Date('2026-11-20') })).status(now)).toBe('scheduled')
    expect(Coupon.create(details({ endsAt: new Date('2026-11-10') })).status(now)).toBe('expired')
    expect(Coupon.restore({ ...Coupon.create(details({ maxUses: 2 })).toSnapshot(), usedCount: 2 }).status(now)).toBe('exhausted')
    expect(Coupon.create(details({ isActive: false })).status(now)).toBe('inactive')
    expect(() => Coupon.create(details({ endsAt: new Date('2026-11-10') })).assertUsable(now)).toThrow(CouponUnavailableError)
  })

  it('cupom já usado não pode ser excluído nem ter limite abaixo dos usos', () => {
    const used = Coupon.restore({ ...Coupon.create(details()).toSnapshot(), usedCount: 5 })
    expect(() => used.assertDeletable()).toThrow(CouponInUseError)
    expect(() => used.update({ maxUses: 3 })).toThrow(ValidationError)
  })
})
