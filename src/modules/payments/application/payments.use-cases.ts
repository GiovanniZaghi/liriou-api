import { Injectable, Logger } from '@nestjs/common'
import type { UseCase } from '../../../shared/application/use-case'
import { StoreSettings } from '../../cart/domain/store-settings'
import type { Order } from '../../orders/domain/order'
import { OrderNotFoundError } from '../../orders/domain/order.errors'
import { OrderRepository } from '../../orders/domain/order.repository'
import { Payment, PaymentMethod, PaymentStatus } from '../domain/payment'
import { PaymentGateway, type GatewayPayer } from '../domain/payment-gateway'
import { CardDataRequiredError, InvalidInstallmentsError, OrderNotPayableError } from '../domain/payment.errors'
import { PaymentRepository } from '../domain/payment.repository'

export interface StartPaymentInput {
  orderId: string
  method: PaymentMethod
  card?: { token: string; brand: string; installments: number }
}

export interface PaymentResult {
  payment: Payment
  order: Order
}

/** Reflete no pedido o resultado do pagamento (aprovado → pago; estornado → cancelado). */
async function syncOrder(order: Order, payment: Payment, orders: OrderRepository) {
  const changed =
    payment.status === PaymentStatus.APPROVED ? order.markPaid()
    : payment.status === PaymentStatus.REFUNDED ? order.cancel()
    : false
  if (changed) await orders.updateStatus(order)
}

function toPayer(order: Order): GatewayPayer {
  const [firstName, ...rest] = order.customer.name.trim().split(/\s+/)
  const a = order.shippingAddress
  return {
    email: order.customer.email,
    firstName,
    lastName: rest.join(' ') || firstName,
    cpf: order.customer.cpf,
    address: { cep: a.cep, street: a.street, number: a.number, district: a.district, city: a.city, state: a.state },
  }
}

/**
 * Inicia o pagamento de um pedido "aguardando pagamento".
 * O valor é sempre calculado aqui (Pix com desconto da loja), nunca vem do front.
 */
@Injectable()
export class StartPaymentUseCase implements UseCase<StartPaymentInput, PaymentResult> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGateway,
    private readonly settings: StoreSettings,
  ) {}

  async execute({ orderId, method, card }: StartPaymentInput): Promise<PaymentResult> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError()
    if (!order.isAwaitingPayment) throw new OrderNotPayableError()

    // Recarregar a página não gera um novo Pix/boleto: devolve o que ainda está valendo
    const latest = await this.payments.findLatestByOrder(orderId)
    if (latest?.status === PaymentStatus.APPROVED) throw new OrderNotPayableError()
    if (latest && latest.method === method && latest.isReusable()) return { payment: latest, order }

    let installments = 1
    if (method === PaymentMethod.CREDIT_CARD) {
      if (!card?.token || !card.brand) throw new CardDataRequiredError()
      installments = card.installments
      if (!Number.isInteger(installments) || installments < 1 || installments > this.settings.installments) {
        throw new InvalidInstallmentsError(this.settings.installments)
      }
    }

    const total = order.totals.totalCents
    const amountCents = method === PaymentMethod.PIX ? this.settings.pixPriceCents(total) : total
    const payment = Payment.start({ orderId, method, amountCents, installments })

    const snapshot = await this.gateway.charge({
      paymentId: payment.id,
      externalReference: `pedido-${order.number}`,
      description: `Pedido #${order.number} - Liriou`,
      method,
      amountCents,
      payer: toPayer(order),
      card: method === PaymentMethod.CREDIT_CARD ? { ...card!, installments } : undefined,
    })
    payment.apply(snapshot)
    await this.payments.save(payment)
    await syncOrder(order, payment, this.orders)
    return { payment, order }
  }
}

/** Situação do pagamento de um pedido. Pendentes são reconsultados no gateway (fallback do webhook). */
@Injectable()
export class GetOrderPaymentUseCase implements UseCase<string, PaymentResult | null> {
  private readonly logger = new Logger(GetOrderPaymentUseCase.name)

  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(orderId: string): Promise<PaymentResult | null> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError()
    const payment = await this.payments.findLatestByOrder(orderId)
    if (!payment) return null

    if (payment.isPending && payment.gatewayOrderId) {
      try {
        if (payment.apply(await this.gateway.fetch(payment.gatewayOrderId))) {
          await this.payments.save(payment)
          await syncOrder(order, payment, this.orders)
        }
      } catch (err) {
        // Consulta é só atualização: se o gateway falhar, devolve o último estado conhecido
        this.logger.warn(`Falha ao consultar pagamento ${payment.id}: ${(err as Error).message}`)
      }
    }
    return { payment, order }
  }
}

/** Notificação do gateway: busca o estado oficial (nunca confia no corpo do webhook) e sincroniza. */
@Injectable()
export class SyncPaymentUseCase implements UseCase<string, void> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(gatewayOrderId: string): Promise<void> {
    const payment = await this.payments.findByGatewayOrderId(gatewayOrderId)
    if (!payment) return // notificação de algo que não é da loja (ou ainda não salvo)

    if (!payment.apply(await this.gateway.fetch(gatewayOrderId))) return
    await this.payments.save(payment)
    const order = await this.orders.findById(payment.orderId)
    if (order) await syncOrder(order, payment, this.orders)
  }
}
