import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'leads' })
export class LeadOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'text' })
  name: string

  @Column({ type: 'text' })
  email: string

  @Column({ type: 'text' })
  whatsapp: string

  @Column({ type: 'text', nullable: true })
  pain: string | null

  @Column({ type: 'timestamptz', name: 'consent_at' })
  consentAt: Date

  @Column({ type: 'jsonb', nullable: true })
  utm: Record<string, string> | null

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date
}
