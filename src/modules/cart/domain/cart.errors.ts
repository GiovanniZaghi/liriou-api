import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error'

export class CartNotFoundError extends NotFoundError {
  constructor() {
    super('Sacola não encontrada', 'CART_NOT_FOUND')
  }
}

export class InvalidCouponError extends BusinessRuleError {
  constructor() {
    super('Cupom inválido', 'INVALID_COUPON')
  }
}

export class InvalidShippingOptionError extends ValidationError {
  constructor() {
    super({ optionId: 'Opção de envio inválida' }, 'Opção de envio inválida')
  }
}

export class ProductUnavailableError extends BusinessRuleError {
  constructor() {
    super('Produto indisponível no momento', 'PRODUCT_UNAVAILABLE')
  }
}
