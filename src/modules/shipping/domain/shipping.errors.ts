import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error'

/** Frete sem credenciais configuradas ou Frenet fora do ar */
export class ShippingUnavailableError extends BusinessRuleError {
  constructor(message = 'Não foi possível calcular o frete agora. Tente de novo em instantes.') {
    super(message, 'SHIPPING_UNAVAILABLE')
  }
}

export class InvalidCepError extends ValidationError {
  constructor() {
    super({ cep: 'CEP inválido' }, 'CEP inválido')
  }
}

/** A opção escolhida não veio na cotação atual (preço/serviço mudou ou CEP não atendido) */
export class ShippingOptionUnavailableError extends ValidationError {
  constructor() {
    super(
      { shippingOptionId: 'Esta opção de envio não está mais disponível para o seu CEP. Escolha outra.' },
      'Opção de envio indisponível',
    )
  }
}

/** Erro ao gerar etiqueta (mensagem pronta para o dashboard) */
export class LabelError extends BusinessRuleError {
  constructor(message: string, code = 'LABEL_ERROR') {
    super(message, code)
  }
}
