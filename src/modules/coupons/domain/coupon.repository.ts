import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Coupon } from './coupon'

export abstract class CouponRepository {
  abstract findById(id: string): Promise<Coupon | null>
  abstract findByCode(code: string): Promise<Coupon | null>
  abstract list(filters: { q?: string }, page: PageRequest): Promise<Paginated<Coupon>>
  abstract save(coupon: Coupon): Promise<void>
  abstract delete(id: string): Promise<void>
  /**
   * Conta um uso de forma atômica. false = limite já atingido (duas compras ao mesmo tempo
   * não conseguem passar do máximo).
   */
  abstract registerUse(id: string): Promise<boolean>
}
