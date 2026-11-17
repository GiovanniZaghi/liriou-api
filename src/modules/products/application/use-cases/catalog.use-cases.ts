import { Injectable } from '@nestjs/common'
import type { UseCase } from '../../../../shared/application/use-case'
import type { Product } from '../../domain/product'
import { ProductNotFoundError } from '../../domain/product.errors'
import type { ProductCategory } from '../../domain/product-category'
import { ProductRepository } from '../../domain/product.repository'

/** Vitrine pública: só produtos ativos, na ordem definida no dashboard. */
@Injectable()
export class ListCatalogProductsUseCase implements UseCase<{ q?: string; category?: ProductCategory }, Product[]> {
  constructor(private readonly products: ProductRepository) {}

  execute(filters: { q?: string; category?: ProductCategory }) {
    return this.products.listCatalog(filters)
  }
}

@Injectable()
export class GetCatalogProductUseCase implements UseCase<string, Product> {
  constructor(private readonly products: ProductRepository) {}

  async execute(slug: string) {
    const product = await this.products.findBySlug(slug)
    if (!product || !product.isActive) throw new ProductNotFoundError()
    return product
  }
}
