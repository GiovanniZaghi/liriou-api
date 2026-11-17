import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import type { TrackingEvent } from '../domain/shipping-gateway'

@Entity('shipments')
export class ShipmentOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string

  @Column({ name: 'provider_id', type: 'varchar', length: 40 })
  providerId: string

  @Column({ type: 'varchar', length: 40 })
  status: string

  @Column({ name: 'tracking_number', type: 'varchar', length: 60, nullable: true })
  trackingNumber: string | null

  @Column({ name: 'tracking_url', type: 'text', nullable: true })
  trackingUrl: string | null

  @Column({ name: 'label_url', type: 'text', nullable: true })
  labelUrl: string | null

  @Column({ name: 'declaration_url', type: 'text', nullable: true })
  declarationUrl: string | null

  @Column({ name: 'last_event', type: 'jsonb', nullable: true })
  lastEvent: TrackingEvent | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
