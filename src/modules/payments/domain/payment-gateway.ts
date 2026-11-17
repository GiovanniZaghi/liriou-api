import type { Cents } from '../../../shared/domain/money'
import type { GatewaySnapshot, PaymentMethod } from './payment'

export interface GatewayPayer {
  email: string
  firstName: string
  lastName: string
  cpf: string
  address: { cep: string; street: string; number: string; district: string; city: string; state: string }
}

export interface GatewayChargeRequest {
  /** Chave de idempotência: o id do nosso pagamento */
  paymentId: string
  /** Referência do pedido na loja (aparece no painel do gateway) */
  externalReference: string
  description: string
  method: PaymentMethod
  amountCents: Cents
  payer: GatewayPayer
  /** Só para cartão: token gerado no navegador pelo SDK do gateway */
  card?: { token: string; brand: string; installments: number }
}

/**
 * Porta do gateway de pagamento. A aplicação não conhece o Mercado Pago:
 * trocar de gateway é escrever outro adapter.
 */
export abstract class PaymentGateway {
  abstract charge(request: GatewayChargeRequest): Promise<GatewaySnapshot>
  abstract fetch(gatewayOrderId: string): Promise<GatewaySnapshot>
}
