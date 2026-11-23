import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import type { KitDetails } from '../../domain/product'
import { ProductCategory } from '../../domain/product-category'

/** Modelo de persistência (TypeORM). O domínio não conhece esta classe: o mapper faz a ponte. */
@Entity({ name: 'products' })
export class ProductOrmEntity {
  @PrimaryColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 120 })
  slug: string

  @Column({ type: 'varchar', length: 60 })
  sku: string

  @Column({ type: 'varchar', length: 160 })
  name: string

  @Column({ type: 'text', default: '' })
  description: string

  @Column({ type: 'varchar', length: 30 })
  category: ProductCategory

  @Column({ type: 'integer', name: 'price_cents' })
  priceCents: number

  @Column({ type: 'integer', name: 'compare_at_price_cents', nullable: true })
  compareAtPriceCents: number | null

  @Column({ type: 'varchar', length: 80, name: 'color_name', nullable: true })
  colorName: string | null

  @Column({ type: 'char', length: 7, name: 'color_hex', nullable: true })
  colorHex: string | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  badge: string | null

  @Column({ type: 'text', name: 'image_url' })
  imageUrl: string

  @Column({ type: 'text', name: 'hover_image_url', nullable: true })
  hoverImageUrl: string | null

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  gallery: string[]

  @Column({ type: 'jsonb', nullable: true })
  kit: KitDetails | null

  @Column({ type: 'integer', default: 0 })
  stock: number

  @Column({ type: 'integer', name: 'min_stock', default: 0 })
  minStock: number

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number

  @Column({ type: 'integer', name: 'weight_grams', default: 100 })
  weightGrams: number

  @Column({ type: 'integer', name: 'length_cm', default: 16 })
  lengthCm: number

  @Column({ type: 'integer', name: 'width_cm', default: 11 })
  widthCm: number

  @Column({ type: 'integer', name: 'height_cm', default: 4 })
  heightCm: number

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null
}
