import { Product } from '../../domain/product'
import { StockMovement } from '../../domain/stock-movement'
import { ProductOrmEntity } from './product.orm-entity'
import { StockMovementOrmEntity } from './stock-movement.orm-entity'

export const ProductMapper = {
  toDomain(row: ProductOrmEntity): Product {
    const { deletedAt: _deleted, ...props } = row
    return Product.restore({ ...props, gallery: row.gallery ?? [] })
  },

  toOrm(product: Product): ProductOrmEntity {
    return Object.assign(new ProductOrmEntity(), product.toSnapshot())
  },
}

export const StockMovementMapper = {
  toDomain(row: StockMovementOrmEntity): StockMovement {
    return StockMovement.restore({ ...row })
  },

  toOrm(m: StockMovement): StockMovementOrmEntity {
    return Object.assign(new StockMovementOrmEntity(), {
      id: m.id,
      productId: m.productId,
      type: m.type,
      quantity: m.quantity,
      balanceAfter: m.balanceAfter,
      reason: m.reason,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
    })
  },
}
