import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/domain/domain-error'

export class ProductNotFoundError extends NotFoundError {
  constructor() {
    super('Produto não encontrado', 'PRODUCT_NOT_FOUND')
  }
}

export class ProductAlreadyExistsError extends ConflictError {
  constructor(field: 'slug' | 'sku') {
    super(`Já existe um produto com este ${field}`, field === 'slug' ? 'PRODUCT_SLUG_TAKEN' : 'PRODUCT_SKU_TAKEN')
  }
}

export class InsufficientStockError extends BusinessRuleError {
  constructor(
    readonly available: number,
    readonly requested: number,
  ) {
    super(`Estoque insuficiente: disponível ${available}, solicitado ${requested}`, 'INSUFFICIENT_STOCK')
  }
}
