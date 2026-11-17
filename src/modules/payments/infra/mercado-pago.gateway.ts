import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../../config/env'
import { PaymentMethod, PaymentStatus, type GatewaySnapshot } from '../domain/payment'
import { PaymentGateway, type GatewayChargeRequest } from '../domain/payment-gateway'
import { GatewayError, GatewayUnavailableError } from '../domain/payment.errors'

const API = 'https://api.mercadopago.com/v1/orders'
const TIMEOUT_MS = 20_000

interface MpErrorBody {
  id?: string
  errors?: { code?: string; message?: string; details?: string[] }[]
}

/** Formato (parcial) de uma order da Orders API do Mercado Pago */
interface MpOrder {
  /** null quando a transação é recusada (402): o MP não devolve a order */
  id: string | null
  status: string
  status_detail: string
  transactions?: {
    payments?: {
      status?: string
      status_detail?: string
      date_of_expiration?: string
      expiration_time?: string
      payment_method?: {
        ticket_url?: string
        qr_code?: string
        qr_code_base64?: string
        digitable_line?: string
      }
    }[]
  }
}

const toAmount = (cents: number) => (cents / 100).toFixed(2)

/** Status da order no Mercado Pago → status do nosso domínio */
function mapStatus(status: string): PaymentStatus {
  switch (status) {
    case 'processed':
      return PaymentStatus.APPROVED
    case 'refunded':
      return PaymentStatus.REFUNDED
    case 'failed':
      return PaymentStatus.REJECTED
    case 'canceled':
    case 'expired':
      return PaymentStatus.CANCELLED
    default: // created, processing, action_required
      return PaymentStatus.PENDING
  }
}

function toSnapshot(o: MpOrder): GatewaySnapshot {
  const tx = o.transactions?.payments?.[0]
  const pm = tx?.payment_method
  const exp = tx?.date_of_expiration ?? tx?.expiration_time
  const expiresAt = exp && !Number.isNaN(Date.parse(exp)) ? new Date(exp) : null
  return {
    gatewayOrderId: o.id,
    status: mapStatus(o.status),
    // O detalhe da transação é mais específico (ex.: rejected_by_issuer); cai para o da order
    statusDetail: (tx?.status_detail ?? o.status_detail ?? o.status).slice(0, 60),
    instructions: {
      qrCode: pm?.qr_code ?? null,
      qrCodeBase64: pm?.qr_code_base64 || null,
      ticketUrl: pm?.ticket_url ?? null,
      digitableLine: pm?.digitable_line ?? null,
      expiresAt,
    },
  }
}

/** Adapter do Checkout Transparente via Orders API (POST/GET /v1/orders). */
@Injectable()
export class MercadoPagoGateway extends PaymentGateway {
  private readonly logger = new Logger(MercadoPagoGateway.name)
  private readonly token?: string

  constructor(config: ConfigService<Env, true>) {
    super()
    this.token = config.get('MP_ACCESS_TOKEN', { infer: true }) || undefined
  }

  async charge(req: GatewayChargeRequest): Promise<GatewaySnapshot> {
    const amount = toAmount(req.amountCents)
    const { payer } = req
    const body = {
      type: 'online',
      processing_mode: 'automatic',
      external_reference: req.externalReference,
      description: req.description,
      total_amount: amount,
      payer: {
        email: payer.email,
        first_name: payer.firstName,
        last_name: payer.lastName,
        identification: { type: 'CPF', number: payer.cpf },
        // Endereço é obrigatório no boleto; nos outros métodos ajuda na análise antifraude
        address: {
          street_name: payer.address.street,
          street_number: payer.address.number || 'S/N',
          zip_code: payer.address.cep,
          neighborhood: payer.address.district,
          city: payer.address.city,
          state: payer.address.state,
        },
      },
      transactions: { payments: [{ amount, payment_method: this.paymentMethod(req) }] },
    }
    return toSnapshot(await this.request<MpOrder>('POST', API, body, req.paymentId))
  }

  async fetch(gatewayOrderId: string): Promise<GatewaySnapshot> {
    return toSnapshot(await this.request<MpOrder>('GET', `${API}/${encodeURIComponent(gatewayOrderId)}`))
  }

  private paymentMethod(req: GatewayChargeRequest) {
    switch (req.method) {
      case PaymentMethod.PIX:
        return { id: 'pix', type: 'bank_transfer' }
      case PaymentMethod.BOLETO:
        return { id: 'boleto', type: 'ticket' }
      case PaymentMethod.CREDIT_CARD:
        return { id: req.card!.brand, type: 'credit_card', token: req.card!.token, installments: req.card!.installments }
    }
  }

  private async request<T>(method: 'GET' | 'POST', url: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    if (!this.token) throw new GatewayUnavailableError()

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (err) {
      this.logger.error(`Mercado Pago indisponível: ${(err as Error).message}`)
      throw new GatewayError()
    }

    const data = (await res.json().catch(() => null)) as (T & MpErrorBody) | null
    if (res.ok && data) return data

    // Transação recusada (ex.: cartão sem limite): 402 com o motivo em errors[0].details
    if (res.status === 402) {
      const detail = data?.errors?.[0]?.details?.[0]?.split(':').pop()?.trim() || 'rejected'
      return { id: data?.id ?? null, status: 'failed', status_detail: detail } as T
    }

    const code = data?.errors?.[0]?.code
    this.logger.error(`Mercado Pago ${method} ${res.status}: ${JSON.stringify(data?.errors ?? data)}`)
    if (res.status === 429) throw new GatewayError('Muitas tentativas seguidas. Aguarde um instante e tente de novo.')
    if (code === 'invalid_transaction_amount') {
      throw new GatewayError('Este parcelamento não está disponível para o seu cartão. Escolha outra quantidade de parcelas.', 'PAYMENT_REJECTED')
    }
    if (code === 'payment_method_not_allowed_for_collector') {
      throw new GatewayError('Esta bandeira de cartão não é aceita. Use outro cartão ou pague com Pix.', 'PAYMENT_REJECTED')
    }
    if (res.status >= 400 && res.status < 500) {
      throw new GatewayError('O pagamento não foi aceito. Confira os dados ou escolha outra forma de pagamento.', 'PAYMENT_REJECTED')
    }
    throw new GatewayError()
  }
}
