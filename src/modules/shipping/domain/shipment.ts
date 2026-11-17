import { randomUUID } from 'node:crypto'
import type { ShipmentResult, TrackingEvent } from './shipping-gateway'

export interface ShipmentProps {
  id: string
  orderId: string
  /** Id do envio na Frenet */
  providerId: string
  /** Status na Frenet (Criado, SucessoPagamento, Postado...) */
  status: string
  trackingNumber: string | null
  trackingUrl: string | null
  labelUrl: string | null
  declarationUrl: string | null
  /** Último evento de rastreio conhecido */
  lastEvent: TrackingEvent | null
  createdAt: Date
  updatedAt: Date
}

/** Envio de um pedido: etiqueta gerada na transportadora + rastreio. */
export class Shipment {
  private constructor(private props: ShipmentProps) {}

  static fromResult(orderId: string, result: ShipmentResult): Shipment {
    const now = new Date()
    return new Shipment({ id: randomUUID(), orderId, ...result, lastEvent: null, createdAt: now, updatedAt: now })
  }

  static restore(props: ShipmentProps): Shipment {
    return new Shipment(props)
  }

  /** Atualiza dados da etiqueta (links expiram e são renovados pela Frenet). */
  refresh(result: ShipmentResult): void {
    this.props = {
      ...this.props,
      status: result.status || this.props.status,
      trackingNumber: result.trackingNumber ?? this.props.trackingNumber,
      trackingUrl: result.trackingUrl ?? this.props.trackingUrl,
      labelUrl: result.labelUrl ?? this.props.labelUrl,
      declarationUrl: result.declarationUrl ?? this.props.declarationUrl,
      updatedAt: new Date(),
    }
  }

  /** Registra o evento de rastreio mais recente. Retorna true se mudou. */
  track(event: TrackingEvent | undefined, tracking?: { number?: string | null; url?: string | null }): boolean {
    const changed = Boolean(event) && JSON.stringify(event) !== JSON.stringify(this.props.lastEvent)
    this.props = {
      ...this.props,
      lastEvent: event ?? this.props.lastEvent,
      trackingNumber: tracking?.number || this.props.trackingNumber,
      trackingUrl: tracking?.url || this.props.trackingUrl,
      updatedAt: changed ? new Date() : this.props.updatedAt,
    }
    return changed
  }

  get id() { return this.props.id }
  get orderId() { return this.props.orderId }
  get providerId() { return this.props.providerId }
  get status() { return this.props.status }
  get trackingNumber() { return this.props.trackingNumber }
  get trackingUrl() { return this.props.trackingUrl }
  get labelUrl() { return this.props.labelUrl }
  get declarationUrl() { return this.props.declarationUrl }
  get lastEvent() { return this.props.lastEvent }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  toSnapshot(): Readonly<ShipmentProps> {
    return { ...this.props }
  }
}

export abstract class ShipmentRepository {
  abstract save(shipment: Shipment): Promise<void>
  abstract findByOrder(orderId: string): Promise<Shipment | null>
  abstract findByProviderId(providerId: string): Promise<Shipment | null>
}
