import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { DiscountType } from '../domain/coupon'

@Entity({ name: 'coupons' })
export class CouponOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 30 })
  code: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 10, name: 'discount_type' })
  type: DiscountType

  @Column({ type: 'integer', name: 'discount_value' })
  value: number

  @Column({ type: 'integer', name: 'min_subtotal_cents', default: 0 })
  minSubtotalCents: number

  @Column({ type: 'timestamptz', name: 'starts_at', nullable: true })
  startsAt: Date | null

  @Column({ type: 'timestamptz', name: 'ends_at', nullable: true })
  endsAt: Date | null

  @Column({ type: 'integer', name: 'max_uses', nullable: true })
  maxUses: number | null

  @Column({ type: 'integer', name: 'used_count', default: 0 })
  usedCount: number

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}
