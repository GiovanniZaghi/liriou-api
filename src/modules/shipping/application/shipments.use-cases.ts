import { normalizePublicApiUrl } from '../../../shared/infra/public-api-url'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../../config/env'
import type { UseCase } from '../../../shared/application/use-case'
import { OrderStatus, type Order } from '../../orders/domain/order'
import { OrderNotFoundError } from '../../orders/domain/order.errors'
import { OrderRepository } from '../../orders/domain/order.repository'
import { DEFAULT_PACKAGE } from '../../products/domain/product'
import { ProductRepository } from '../../products/domain/product.repository'
import { Shipment, ShipmentRepository } from '../domain/shipment'
import { ShippingGateway, type TrackingEvent } from '../domain/shipping-gateway'
import { LabelError } from '../domain/shipping.errors'

export interface ShipmentView {
  order: Order
  shipment: Shipment | null
  /** Pode gerar etiqueta agora? (pedido pago, frete da Frenet e sem etiqueta) */
  canCreate: boolean
  /** Motivo quando não pode */
  blockedReason: string | null
  /** Token de parceiro configurado? */
  labelsEnabled: boolean
}

@Injectable()
export class ShipmentsConfig {
  readonly labelsEnabled: boolean
  readonly trackingNotificationUrl: string | null

  constructor(config: ConfigService<Env, true>) {
    this.labelsEnabled = Boolean(config.get('FRENET_TOKEN', { infer: true }) && config.get('FRENET_PARTNER_TOKEN', { infer: true }))
    const base = normalizePublicApiUrl(config.get('PUBLIC_API_URL', { infer: true }))
    const key = config.get('FRENET_WEBHOOK_KEY', { infer: true })
    this.trackingNotificationUrl = base && key ? `${base}/webhooks/frenet/tracking?key=${encodeURIComponent(key)}` : null
  }
}

function blockedReason(order: Order, shipment: Shipment | null): string | null {
  if (shipment) return 'Etiqueta já gerada para este pedido.'
  if (order.status !== OrderStatus.PAGO) return 'A etiqueta é liberada depois que o pagamento é aprovado.'
  if (!order.shippingOption.carrier) return 'Pedido com frete fixo antigo: gere a etiqueta direto no painel da Frenet.'
  return null
}

/** Situação do envio do pedido; atualiza o rastreio na transportadora quando já há código. */
@Injectable()
export class GetShipmentUseCase implements UseCase<string, ShipmentView> {
  private readonly logger = new Logger(GetShipmentUseCase.name)

  constructor(
    private readonly orders: OrderRepository,
    private readonly shipments: ShipmentRepository,
    private readonly gateway: ShippingGateway,
    private readonly config: ShipmentsConfig,
  ) {}

  async execute(orderId: string): Promise<ShipmentView> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError()
    const shipment = await this.shipments.findByOrder(orderId)

    if (shipment?.trackingNumber) {
      try {
        const events = await this.gateway.track(order.shippingOption.id, shipment.trackingNumber)
        if (shipment.track(events.at(-1))) await this.shipments.save(shipment)
      } catch (err) {
        // Rastreio é complementar: sem resposta, mostra o último estado salvo
        this.logger.warn(`Rastreio indisponível (${shipment.trackingNumber}): ${(err as Error).message}`)
      }
    }

    const reason = blockedReason(order, shipment)
    return { order, shipment, canCreate: !reason && this.config.labelsEnabled, blockedReason: reason, labelsEnabled: this.config.labelsEnabled }
  }
}

/** Gera a etiqueta do pedido na Frenet (debita o saldo da conta Frenet). */
@Injectable()
export class CreateShipmentUseCase implements UseCase<string, ShipmentView> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly shipments: ShipmentRepository,
    private readonly gateway: ShippingGateway,
    private readonly config: ShipmentsConfig,
  ) {}

  async execute(orderId: string): Promise<ShipmentView> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError()
    const existing = await this.shipments.findByOrder(orderId)
    const reason = blockedReason(order, existing)
    if (reason) throw new LabelError(reason, 'LABEL_BLOCKED')

    // Medidas atuais do cadastro (produto excluído usa o pacote padrão)
    const products = new Map((await this.products.findByIds(order.items.map((i) => i.productId))).map((p) => [p.id, p]))
    const s = order.shippingOption
    const a = order.shippingAddress

    const result = await this.gateway.createShipment({
      orderReference: `pedido-${order.number}`,
      orderValueCents: order.totals.subtotalCents - order.totals.discountCents,
      recipient: {
        name: a.recipient || order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        cpf: order.customer.cpf,
        address: { cep: a.cep, street: a.street, number: a.number, complement: a.complement, district: a.district, city: a.city, state: a.state },
      },
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        ...(products.get(i.productId)?.packageSize ?? DEFAULT_PACKAGE),
      })),
      quote: {
        serviceCode: s.id,
        carrier: s.carrier ?? '',
        carrierCode: s.carrierCode ?? '',
        service: s.service ?? s.label,
        priceCents: s.quotedPriceCents ?? order.totals.shippingCents,
        deliveryDays: s.deliveryDays ?? 0,
      },
      chargedShippingCents: order.totals.shippingCents,
      trackingNotificationUrl: this.config.trackingNotificationUrl,
    })

    const shipment = Shipment.fromResult(order.id, result)
    await this.shipments.save(shipment)
    return { order, shipment, canCreate: false, blockedReason: 'Etiqueta já gerada para este pedido.', labelsEnabled: true }
  }
}

/** Renova os links da etiqueta (a Frenet os expira após um tempo). */
@Injectable()
export class RefreshLabelUseCase implements UseCase<string, ShipmentView> {
  constructor(
    private readonly shipments: ShipmentRepository,
    private readonly gateway: ShippingGateway,
    private readonly get: GetShipmentUseCase,
  ) {}

  async execute(orderId: string): Promise<ShipmentView> {
    const shipment = await this.shipments.findByOrder(orderId)
    if (!shipment) throw new LabelError('Este pedido ainda não tem etiqueta.', 'LABEL_NOT_FOUND')
    shipment.refresh(await this.gateway.refreshShipment(shipment.providerId))
    await this.shipments.save(shipment)
    return this.get.execute(orderId)
  }
}

export interface TrackingNotification {
  shipmentId: string
  trackingNumber?: string | null
  trackingUrl?: string | null
  event?: TrackingEvent
}

/** Webhook de rastreio da Frenet: guarda o último evento do envio. */
@Injectable()
export class RecordTrackingUseCase implements UseCase<TrackingNotification, void> {
  constructor(private readonly shipments: ShipmentRepository) {}

  async execute({ shipmentId, trackingNumber, trackingUrl, event }: TrackingNotification) {
    const shipment = await this.shipments.findByProviderId(shipmentId)
    if (!shipment) return
    shipment.track(event, { number: trackingNumber, url: trackingUrl })
    await this.shipments.save(shipment)
  }
}
