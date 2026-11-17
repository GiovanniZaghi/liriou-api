import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error'

export class OrderNotPayableError extends BusinessRuleError {
  constructor() {
    super('Este pedido não está mais aguardando pagamento.', 'ORDER_NOT_PAYABLE')
  }
}

export class InvalidInstallmentsError extends ValidationError {
  constructor(max: number) {
    super({ installments: `Escolha de 1 a ${max} parcelas.` }, 'Parcelamento inválido')
  }
}

export class CardDataRequiredError extends ValidationError {
  constructor() {
    super({ card: 'Dados do cartão ausentes.' }, 'Dados do cartão ausentes')
  }
}

/** O gateway recusou ou falhou ao processar a requisição. A mensagem já vem pronta para a cliente. */
export class GatewayError extends BusinessRuleError {
  constructor(message = 'Não foi possível processar o pagamento agora. Tente de novo em instantes.', code = 'PAYMENT_GATEWAY_ERROR') {
    super(message, code)
  }
}

/** Gateway sem credenciais configuradas */
export class GatewayUnavailableError extends BusinessRuleError {
  constructor() {
    super('Pagamento indisponível no momento. Seu pedido continua reservado.', 'PAYMENT_UNAVAILABLE')
  }
}
