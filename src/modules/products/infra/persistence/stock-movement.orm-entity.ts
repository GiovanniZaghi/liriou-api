import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'
import { StockMovementType } from '../../domain/stock-movement'

@Entity({ name: 'stock_movements' })
export class StockMovementOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string

  @Column({ type: 'varchar', length: 10 })
  type: StockMovementType

  @Column({ type: 'integer' })
  quantity: number

  @Column({ type: 'integer', name: 'balance_after' })
  balanceAfter: number

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date
}
