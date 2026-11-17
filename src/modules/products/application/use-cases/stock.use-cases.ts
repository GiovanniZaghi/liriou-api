import { Injectable } from '@nestjs/common'
import type { Paginated, PageRequest } from '../../../../shared/application/pagination'
import type { UseCase } from '../../../../shared/application/use-case'
import type { Product } from '../../domain/product'
import { ProductNotFoundError } from '../../domain/product.errors'
import { ProductRepository, type InventorySummary } from '../../domain/product.repository'
import type { StockMovement, StockMovementType } from '../../domain/stock-movement'

export interface RegisterStockMovementInput {
  productId: string
  type: StockMovementType
  quantity: number
  reason?: string
  adminId?: string
}

@Injectable()
export class RegisterStockMovementUseCase
  implements UseCase<RegisterStockMovementInput, { product: Product; movement: StockMovement }>
{
  constructor(private readonly products: ProductRepository) {}

  execute({ productId, type, quantity, reason, adminId }: RegisterStockMovementInput) {
    return this.products.changeStock(productId, (product) =>
      product.moveStock(type, quantity, { reason, by: adminId }),
    )
  }
}

@Injectable()
export class GetInventorySummaryUseCase implements UseCase<void, InventorySummary> {
  constructor(private readonly products: ProductRepository) {}

  execute() {
    return this.products.summary()
  }
}

@Injectable()
export class ListStockMovementsUseCase
  implements UseCase<{ productId: string; page: PageRequest }, Paginated<StockMovement>>
{
  constructor(private readonly products: ProductRepository) {}

  async execute({ productId, page }: { productId: string; page: PageRequest }) {
    if (!(await this.products.findById(productId))) throw new ProductNotFoundError()
    return this.products.listMovements(productId, page)
  }
}
