import { randomUUID } from 'node:crypto'
import { ValidationError } from '../../../shared/domain/domain-error'
import type { Cents } from '../../../shared/domain/money'
import { InsufficientStockError } from './product.errors'
import { ProductCategory } from './product-category'
import { StockMovement, StockMovementType } from './stock-movement'

/** Conteúdo de vitrine extra dos kits (seção "Rituais Completos"). */
export interface KitDetails {
  tag: string
  contents: string
  perks: string[]
  note: string
}

export interface ProductProps {
  id: string
  slug: string
  sku: string
  name: string
  description: string
  category: ProductCategory
  priceCents: Cents
  colorName: string | null
  colorHex: string | null
  badge: string | null
  imageUrl: string
  hoverImageUrl: string | null
  gallery: string[]
  kit: KitDetails | null
  stock: number
  minStock: number
  isActive: boolean
  sortOrder: number
  /** Medidas de envio (cotação de frete e etiqueta) */
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
  createdAt: Date
  updatedAt: Date
}

/** Medidas padrão: pacote mínimo dos Correios */
export const DEFAULT_PACKAGE = { weightGrams: 100, lengthCm: 16, widthCm: 11, heightCm: 4 } as const

/** Campos editáveis pelo dashboard. Estoque NÃO entra aqui: só muda via movimentação. */
export type ProductDetails = Omit<ProductProps, 'id' | 'stock' | 'createdAt' | 'updatedAt'>

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export class Product {
  private constructor(private props: ProductProps) {}

  static create(details: ProductDetails): Product {
    Product.validate(details)
    const now = new Date()
    return new Product({ ...Product.normalize(details), id: randomUUID(), stock: 0, createdAt: now, updatedAt: now })
  }

  /** Reconstrói a partir da persistência (sem revalidar). */
  static restore(props: ProductProps): Product {
    return new Product(props)
  }

  update(changes: Partial<ProductDetails>): void {
    const next = { ...this.details(), ...changes }
    Product.validate(next)
    this.props = { ...this.props, ...Product.normalize(next), updatedAt: new Date() }
  }

  /**
   * Aplica uma entrada/saída e devolve o registro do movimento.
   * Regra: o estoque nunca fica negativo.
   */
  moveStock(type: StockMovementType, quantity: number, meta: { reason?: string | null; by?: string | null } = {}) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError({ quantity: 'Informe uma quantidade inteira maior que zero' })
    }
    const delta = type === StockMovementType.ENTRADA ? quantity : -quantity
    if (this.props.stock + delta < 0) throw new InsufficientStockError(this.props.stock, quantity)

    this.props = { ...this.props, stock: this.props.stock + delta, updatedAt: new Date() }
    return StockMovement.record({
      productId: this.id,
      type,
      quantity,
      balanceAfter: this.props.stock,
      reason: meta.reason?.trim() || null,
      createdBy: meta.by ?? null,
    })
  }

  /** Pode ser vendido nesta quantidade agora? */
  canFulfill(quantity: number): boolean {
    return this.props.isActive && this.props.stock >= quantity
  }

  get id() { return this.props.id }
  get slug() { return this.props.slug }
  get sku() { return this.props.sku }
  get name() { return this.props.name }
  get description() { return this.props.description }
  get category() { return this.props.category }
  get priceCents() { return this.props.priceCents }
  get colorName() { return this.props.colorName }
  get colorHex() { return this.props.colorHex }
  get badge() { return this.props.badge }
  get imageUrl() { return this.props.imageUrl }
  get hoverImageUrl() { return this.props.hoverImageUrl }
  get gallery() { return [...this.props.gallery] }
  get kit() { return this.props.kit }
  get stock() { return this.props.stock }
  get minStock() { return this.props.minStock }
  get isActive() { return this.props.isActive }
  get sortOrder() { return this.props.sortOrder }
  get packageSize() {
    const { weightGrams, lengthCm, widthCm, heightCm } = this.props
    return { weightGrams, lengthCm, widthCm, heightCm }
  }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }
  get inStock() { return this.props.stock > 0 }
  get isLowStock() { return this.props.stock <= this.props.minStock }

  toSnapshot(): Readonly<ProductProps> {
    return { ...this.props, gallery: [...this.props.gallery] }
  }

  private details(): ProductDetails {
    const { id: _id, stock: _s, createdAt: _c, updatedAt: _u, ...details } = this.props
    return details
  }

  private static normalize(d: ProductDetails): ProductDetails {
    return {
      ...d,
      slug: d.slug.trim().toLowerCase(),
      sku: d.sku.trim().toUpperCase(),
      name: d.name.trim(),
      description: d.description.trim(),
      colorName: d.colorName?.trim() || null,
      colorHex: d.colorHex?.toUpperCase() || null,
      badge: d.badge?.trim() || null,
      hoverImageUrl: d.hoverImageUrl || null,
    }
  }

  private static validate(d: ProductDetails): void {
    const errors: Record<string, string> = {}
    if (!SLUG_RE.test(d.slug.trim().toLowerCase())) errors.slug = 'Use só letras minúsculas, números e hífens'
    if (!d.sku.trim()) errors.sku = 'Informe o SKU'
    if (d.name.trim().length < 3) errors.name = 'Informe o nome do produto'
    if (!Number.isInteger(d.priceCents) || d.priceCents < 0) errors.price = 'Preço inválido'
    if (d.colorHex && !HEX_RE.test(d.colorHex)) errors.colorHex = 'Use o formato #RRGGBB'
    if (!Number.isInteger(d.minStock) || d.minStock < 0) errors.minStock = 'Estoque mínimo inválido'
    if (!d.imageUrl.trim()) errors.imageUrl = 'Informe a imagem principal'
    const int = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max
    if (!int(d.weightGrams, 1, 30_000)) errors.weightGrams = 'Peso entre 1 g e 30 kg'
    if (!int(d.lengthCm, 1, 200)) errors.lengthCm = 'Comprimento entre 1 e 200 cm'
    if (!int(d.widthCm, 1, 200)) errors.widthCm = 'Largura entre 1 e 200 cm'
    if (!int(d.heightCm, 1, 200)) errors.heightCm = 'Altura entre 1 e 200 cm'
    if (d.kit && d.category !== ProductCategory.KIT) errors.kit = 'Detalhes de kit só valem para a categoria "kit"'
    if (Object.keys(errors).length) throw new ValidationError(errors)
  }
}
