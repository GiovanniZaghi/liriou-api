import { Injectable } from '@nestjs/common'
import type { Paginated, PageRequest } from '../../../../shared/application/pagination'
import type { UseCase } from '../../../../shared/application/use-case'
import { Product, type ProductDetails } from '../../domain/product'
import { ProductAlreadyExistsError, ProductNotFoundError } from '../../domain/product.errors'
import { ProductRepository, type ProductFilters } from '../../domain/product.repository'
import { StockMovementType } from '../../domain/stock-movement'

@Injectable()
export class ListProductsUseCase implements UseCase<{ filters: ProductFilters; page: PageRequest }, Paginated<Product>> {
  constructor(private readonly products: ProductRepository) {}

  execute({ filters, page }: { filters: ProductFilters; page: PageRequest }) {
    return this.products.list(filters, page)
  }
}

@Injectable()
export class GetProductUseCase implements UseCase<string, Product> {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string) {
    const product = await this.products.findById(id)
    if (!product) throw new ProductNotFoundError()
    return product
  }
}

export interface CreateProductInput {
  details: ProductDetails
  /** Estoque inicial: vira uma movimentação de entrada (histórico desde o 1º dia) */
  initialStock?: number
  adminId?: string
}

@Injectable()
export class CreateProductUseCase implements UseCase<CreateProductInput, Product> {
  constructor(private readonly products: ProductRepository) {}

  async execute({ details, initialStock, adminId }: CreateProductInput) {
    const product = Product.create(details)
    await assertUnique(this.products, product.slug, product.sku)
    await this.products.save(product)

    if (!initialStock) return product
    const { product: stocked } = await this.products.changeStock(product.id, (p) =>
      p.moveStock(StockMovementType.ENTRADA, initialStock, { reason: 'Estoque inicial', by: adminId }),
    )
    return stocked
  }
}

@Injectable()
export class UpdateProductUseCase implements UseCase<{ id: string; changes: Partial<ProductDetails> }, Product> {
  constructor(private readonly products: ProductRepository) {}

  async execute({ id, changes }: { id: string; changes: Partial<ProductDetails> }) {
    const product = await this.products.findById(id)
    if (!product) throw new ProductNotFoundError()

    product.update(changes)
    if (changes.slug !== undefined || changes.sku !== undefined) {
      await assertUnique(this.products, product.slug, product.sku, product.id)
    }
    await this.products.save(product)
    return product
  }
}

/** Exclusão lógica: preserva o histórico de estoque e some da vitrine e das sacolas. */
@Injectable()
export class DeleteProductUseCase implements UseCase<string, void> {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string) {
    if (!(await this.products.findById(id))) throw new ProductNotFoundError()
    await this.products.softDelete(id)
  }
}

async function assertUnique(repo: ProductRepository, slug: string, sku: string, ignoreId?: string) {
  const taken = await repo.findTakenUniqueFields(slug, sku, ignoreId)
  if (taken.slug) throw new ProductAlreadyExistsError('slug')
  if (taken.sku) throw new ProductAlreadyExistsError('sku')
}
