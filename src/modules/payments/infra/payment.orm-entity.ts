import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { PaymentMethod, PaymentStatus } from '../domain/payment'

@Entity('payments')
export class PaymentOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethod

  @Column({ type: 'varchar', length: 20 })
  status: PaymentStatus

  @Column({ name: 'status_detail', type: 'varchar', length: 60 })
  statusDetail: string

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number

  @Column({ type: 'smallint' })
  installments: number

  @Column({ name: 'gateway_order_id', type: 'varchar', length: 60, nullable: true })
  gatewayOrderId: string | null

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string | null

  @Column({ name: 'qr_code_base64', type: 'text', nullable: true })
  qrCodeBase64: string | null

  @Column({ name: 'ticket_url', type: 'text', nullable: true })
  ticketUrl: string | null

  @Column({ name: 'digitable_line', type: 'varchar', length: 80, nullable: true })
  digitableLine: string | null

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
