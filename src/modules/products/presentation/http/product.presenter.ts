import { toCents, toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { DEFAULT_PACKAGE, type Product, type ProductDetails } from '../../domain/product'
import type { StockMovement } from '../../domain/stock-movement'
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto'

/** Visão pública da vitrine: sem SKU, quantidade em estoque ou dados internos. */
export function presentCatalogProduct(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    price: toReais(p.priceCents),
    colorName: p.colorName,
    colorHex: p.colorHex,
    badge: p.badge,
    image: p.imageUrl,
    hoverImage: p.hoverImageUrl ?? p.imageUrl,
    gallery: p.gallery,
    kit: p.kit,
    inStock: p.inStock,
    /** Para ordenar por "Novidades" na vitrine */
    createdAt: isoDate(p.createdAt),
  }
}

/** Visão completa para o dashboard (estoque). */
export function presentAdminProduct(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    price: toReais(p.priceCents),
    colorName: p.colorName,
    colorHex: p.colorHex,
    badge: p.badge,
    imageUrl: p.imageUrl,
    hoverImageUrl: p.hoverImageUrl,
    gallery: p.gallery,
    kit: p.kit,
    stock: p.stock,
    minStock: p.minStock,
    isLowStock: p.isLowStock,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    ...p.packageSize,
    createdAt: isoDate(p.createdAt),
    updatedAt: isoDate(p.updatedAt),
  }
}

export function presentStockMovement(m: StockMovement) {
  return {
    id: m.id,
    productId: m.productId,
    type: m.type,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    reason: m.reason,
    createdBy: m.createdBy,
    createdAt: isoDate(m.createdAt),
  }
}

/** DTO HTTP (reais) → entrada do domínio (centavos). */
export function toProductDetails(dto: CreateProductDto): ProductDetails {
  return {
    slug: dto.slug,
    sku: dto.sku,
    name: dto.name,
    description: dto.description ?? '',
    category: dto.category,
    priceCents: toCents(dto.price),
    colorName: dto.colorName ?? null,
    colorHex: dto.colorHex ?? null,
    badge: dto.badge ?? null,
    imageUrl: dto.imageUrl,
    hoverImageUrl: dto.hoverImageUrl ?? null,
    gallery: dto.gallery ?? [],
    kit: dto.kit ?? null,
    minStock: dto.minStock ?? 0,
    isActive: dto.isActive ?? true,
    sortOrder: dto.sortOrder ?? 0,
    weightGrams: dto.weightGrams ?? DEFAULT_PACKAGE.weightGrams,
    lengthCm: dto.lengthCm ?? DEFAULT_PACKAGE.lengthCm,
    widthCm: dto.widthCm ?? DEFAULT_PACKAGE.widthCm,
    heightCm: dto.heightCm ?? DEFAULT_PACKAGE.heightCm,
  }
}

/** PATCH: só os campos enviados; `null` limpa campos opcionais. */
export function toProductChanges(dto: UpdateProductDto): Partial<ProductDetails> {
  const { price, description, gallery, ...rest } = dto
  const changes: Partial<ProductDetails> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  ) as Partial<ProductDetails>
  if (price !== undefined) changes.priceCents = toCents(price)
  if (description !== undefined) changes.description = description ?? ''
  if (gallery !== undefined) changes.gallery = gallery ?? []
  return changes
}
