import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error'

export class OrderNotFoundError extends NotFoundError {
  constructor() {
    super('Pedido não encontrado', 'ORDER_NOT_FOUND')
  }
}

export class EmptyCartError extends BusinessRuleError {
  constructor() {
    super('Sua sacola está vazia', 'EMPTY_CART')
  }
}

export class CartItemsUnavailableError extends BusinessRuleError {
  constructor(readonly productIds: string[]) {
    super('Alguns itens não têm estoque suficiente. Ajuste a sacola para continuar.', 'CART_ITEMS_UNAVAILABLE')
  }
}

export class ShippingRequiredError extends ValidationError {
  constructor() {
    super({ shippingOptionId: 'Escolha uma opção de envio' }, 'Escolha uma opção de envio')
  }
}

export class OrderNotPaidError extends BusinessRuleError {
  constructor() {
    super('Só pedidos pagos podem ser marcados como entregues', 'ORDER_NOT_PAID')
  }
}
