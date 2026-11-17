import { randomUUID } from 'node:crypto'
import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error'
import { percentOf, type Cents } from '../../../shared/domain/money'

export enum DiscountType {
  /** `value` = % inteiro (10 = 10%) */
  PERCENT = 'percent',
  /** `value` = centavos */
  FIXED = 'fixed',
}

export type CouponStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted'

export interface CouponProps {
  id: string
  code: string
  description: string | null
  type: DiscountType
  value: number
  minSubtotalCents: Cents
  startsAt: Date | null
  endsAt: Date | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type CouponDetails = Omit<CouponProps, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>

const CODE_RE = /^[A-Z0-9_-]{3,30}$/

export class CouponUnavailableError extends BusinessRuleError {
  constructor(message: string, code = 'COUPON_UNAVAILABLE') {
    super(message, code)
  }
}

export class CouponInUseError extends BusinessRuleError {
  constructor() {
    super('Este cupom já foi usado em pedidos: desative-o em vez de excluir', 'COUPON_IN_USE')
  }
}

/** Cupom de desconto válido para todo o site. */
export class Coupon {
  private constructor(private props: CouponProps) {}

  static create(details: CouponDetails): Coupon {
    const normalized = Coupon.normalize(details)
    Coupon.validate(normalized, 0)
    const now = new Date()
    return new Coupon({ ...normalized, id: randomUUID(), usedCount: 0, createdAt: now, updatedAt: now })
  }

  static restore(props: CouponProps): Coupon {
    return new Coupon(props)
  }

  static normalizeCode(code: string) {
    return code.trim().toUpperCase()
  }

  update(changes: Partial<CouponDetails>): void {
    const { id: _i, usedCount, createdAt: _c, updatedAt: _u, ...current } = this.props
    const next = Coupon.normalize({ ...current, ...changes })
    Coupon.validate(next, usedCount)
    this.props = { ...this.props, ...next, updatedAt: new Date() }
  }

  status(now = new Date()): CouponStatus {
    if (!this.props.isActive) return 'inactive'
    if (this.props.startsAt && now < this.props.startsAt) return 'scheduled'
    if (this.props.endsAt && now >= this.props.endsAt) return 'expired'
    if (this.props.maxUses !== null && this.props.usedCount >= this.props.maxUses) return 'exhausted'
    return 'active'
  }

  /** Pode ser aplicado agora (independente do valor da sacola)? Lança com o motivo, pronto para a cliente. */
  assertUsable(now = new Date()): void {
    const messages: Record<Exclude<CouponStatus, 'active'>, string> = {
      inactive: 'Cupom inválido',
      scheduled: 'Este cupom ainda não está valendo',
      expired: 'Este cupom expirou',
      exhausted: 'Este cupom atingiu o limite de usos',
    }
    const s = this.status(now)
    if (s !== 'active') throw new CouponUnavailableError(messages[s], s === 'inactive' ? 'INVALID_COUPON' : 'COUPON_UNAVAILABLE')
  }

  /** Quanto falta na sacola para o cupom valer (0 = já vale). */
  missingForMinimum(subtotalCents: Cents): Cents {
    return Math.max(this.props.minSubtotalCents - subtotalCents, 0)
  }

  /** Desconto sobre o subtotal. Nunca maior que o próprio subtotal. */
  discountFor(subtotalCents: Cents): Cents {
    if (subtotalCents <= 0 || this.missingForMinimum(subtotalCents) > 0) return 0
    const raw = this.props.type === DiscountType.PERCENT ? percentOf(subtotalCents, this.props.value / 100) : this.props.value
    return Math.min(raw, subtotalCents)
  }

  assertDeletable(): void {
    if (this.props.usedCount > 0) throw new CouponInUseError()
  }

  get id() { return this.props.id }
  get code() { return this.props.code }
  get description() { return this.props.description }
  get type() { return this.props.type }
  get value() { return this.props.value }
  get minSubtotalCents() { return this.props.minSubtotalCents }
  get startsAt() { return this.props.startsAt }
  get endsAt() { return this.props.endsAt }
  get maxUses() { return this.props.maxUses }
  get usedCount() { return this.props.usedCount }
  get isActive() { return this.props.isActive }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  toSnapshot(): Readonly<CouponProps> {
    return { ...this.props }
  }

  private static normalize(d: CouponDetails): CouponDetails {
    return { ...d, code: Coupon.normalizeCode(d.code), description: d.description?.trim() || null }
  }

  private static validate(d: CouponDetails, usedCount: number): void {
    const errors: Record<string, string> = {}
    if (!CODE_RE.test(d.code)) errors.code = 'Use de 3 a 30 letras, números, hífen ou _'
    if (!Number.isInteger(d.value) || d.value <= 0) errors.value = 'Informe um desconto maior que zero'
    else if (d.type === DiscountType.PERCENT && d.value > 100) errors.value = 'O percentual vai até 100%'
    if (!Number.isInteger(d.minSubtotalCents) || d.minSubtotalCents < 0) errors.minSubtotal = 'Valor mínimo inválido'
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) errors.endsAt = 'O fim precisa ser depois do início'
    if (d.maxUses !== null) {
      if (!Number.isInteger(d.maxUses) || d.maxUses < 1) errors.maxUses = 'Informe ao menos 1 uso'
      else if (d.maxUses < usedCount) errors.maxUses = `Já foram ${usedCount} usos; o limite não pode ser menor`
    }
    if (Object.keys(errors).length) throw new ValidationError(errors)
  }
}
