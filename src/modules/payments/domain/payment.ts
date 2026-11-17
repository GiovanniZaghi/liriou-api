import { randomUUID } from 'node:crypto'
import type { Cents } from '../../../shared/domain/money'

/** Métodos aceitos no checkout (Checkout Transparente do Mercado Pago). */
export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  BOLETO = 'boleto',
}

/** Status próprio, independente do gateway (o adapter traduz o status do Mercado Pago). */
export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/** O que a cliente precisa para concluir um Pix ou boleto. */
export interface PaymentInstructions {
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
  digitableLine: string | null
  expiresAt: Date | null
}

/** Estado do pagamento como o gateway informa. */
export interface GatewaySnapshot {
  /** null quando o gateway recusa sem criar a transação */
  gatewayOrderId: string | null
  status: PaymentStatus
  statusDetail: string
  instructions: PaymentInstructions
}

export interface PaymentProps {
  id: string
  orderId: string
  method: PaymentMethod
  status: PaymentStatus
  statusDetail: string
  amountCents: Cents
  installments: number
  gatewayOrderId: string | null
  instructions: PaymentInstructions
  createdAt: Date
  updatedAt: Date
}

export const EMPTY_INSTRUCTIONS: PaymentInstructions = {
  qrCode: null,
  qrCodeBase64: null,
  ticketUrl: null,
  digitableLine: null,
  expiresAt: null,
}

/** Uma tentativa de pagamento de um pedido. Um pedido pode ter várias (ex.: cartão recusado e depois Pix). */
export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  static start(input: { orderId: string; method: PaymentMethod; amountCents: Cents; installments: number }): Payment {
    const now = new Date()
    return new Payment({
      ...input,
      id: randomUUID(),
      status: PaymentStatus.PENDING,
      statusDetail: 'created',
      gatewayOrderId: null,
      instructions: EMPTY_INSTRUCTIONS,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: PaymentProps): Payment {
    return new Payment(props)
  }

  get id() { return this.props.id }
  get orderId() { return this.props.orderId }
  get method() { return this.props.method }
  get status() { return this.props.status }
  get statusDetail() { return this.props.statusDetail }
  get amountCents() { return this.props.amountCents }
  get installments() { return this.props.installments }
  get gatewayOrderId() { return this.props.gatewayOrderId }
  get instructions() { return this.props.instructions }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  get isPending() { return this.props.status === PaymentStatus.PENDING }

  /** Pix/boleto ainda pagável: pendente, com instruções e dentro do prazo. */
  isReusable(now = new Date()): boolean {
    const { expiresAt, ticketUrl, qrCode } = this.props.instructions
    return (
      this.isPending &&
      this.props.method !== PaymentMethod.CREDIT_CARD &&
      Boolean(ticketUrl || qrCode) &&
      (!expiresAt || expiresAt > now)
    )
  }

  /** Aplica o que o gateway respondeu. Retorna true se o status mudou. */
  apply(snapshot: GatewaySnapshot): boolean {
    const changed = snapshot.status !== this.props.status || snapshot.statusDetail !== this.props.statusDetail
    this.props.gatewayOrderId = snapshot.gatewayOrderId ?? this.props.gatewayOrderId
    this.props.status = snapshot.status
    this.props.statusDetail = snapshot.statusDetail
    // O gateway às vezes não repete as instruções em consultas posteriores: mantém as que já temos
    const prev = this.props.instructions
    const next = snapshot.instructions
    this.props.instructions = {
      qrCode: next.qrCode ?? prev.qrCode,
      qrCodeBase64: next.qrCodeBase64 ?? prev.qrCodeBase64,
      ticketUrl: next.ticketUrl ?? prev.ticketUrl,
      digitableLine: next.digitableLine ?? prev.digitableLine,
      expiresAt: next.expiresAt ?? prev.expiresAt,
    }
    this.props.updatedAt = new Date()
    return changed
  }
}
