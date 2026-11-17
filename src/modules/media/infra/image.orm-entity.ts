import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'images' })
export class ImageOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'text', name: 'mime_type' })
  mimeType: string

  @Column({ type: 'integer', name: 'size_bytes' })
  sizeBytes: number

  @Column({ type: 'text' })
  checksum: string

  @Column({ type: 'bytea' })
  data: Buffer

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date
}
