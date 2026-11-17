import type { Cents } from '../../../shared/domain/money'

/** Medidas de envio de um produto */
export interface PackageSize {
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export interface QuoteItem extends PackageSize {
  sku: string
  quantity: number
}

export interface QuoteRequest {
  destinationCep: string
  /** Valor dos produtos (seguro/valor declarado) */
  invoiceValueCents: Cents
  items: QuoteItem[]
}

/** Uma opção de frete cotada (transportadora + serviço). */
export interface ShippingQuote {
  serviceCode: string
  carrier: string
  carrierCode: string
  /** Nome do serviço (ex.: PAC, SEDEX, Jadlog .Package) */
  service: string
  priceCents: Cents
  /** Prazo em dias úteis */
  deliveryDays: number
}

/** Rótulo amigável da opção: "Correios · SEDEX" */
export const shippingLabel = (q: Pick<ShippingQuote, 'carrier' | 'service'>) =>
  [q.carrier, q.service].filter(Boolean).join(' · ')

export interface ShipmentAddress {
  cep: string
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  state: string
}

export interface ShipmentRequest {
  orderReference: string
  orderValueCents: Cents
  recipient: { name: string; email: string; phone: string; cpf: string; address: ShipmentAddress }
  items: (QuoteItem & { productId: string; name: string; unitPriceCents: Cents })[]
  quote: ShippingQuote
  /** O que a cliente pagou de frete (0 quando foi grátis) */
  chargedShippingCents: Cents
  trackingNotificationUrl: string | null
}

export interface ShipmentResult {
  providerId: string
  status: string
  trackingNumber: string | null
  trackingUrl: string | null
  labelUrl: string | null
  declarationUrl: string | null
}

export interface TrackingEvent {
  /** dd/MM/yyyy HH:mm, como a transportadora informa */
  at: string
  description: string
  location: string
  type: string
}

/**
 * Porta do gateway de frete (cotação, etiqueta e rastreio).
 * Hoje a implementação é a Frenet; outra transportadora = outro adapter.
 */
export abstract class ShippingGateway {
  abstract quote(request: QuoteRequest): Promise<ShippingQuote[]>
  abstract createShipment(request: ShipmentRequest): Promise<ShipmentResult>
  abstract refreshShipment(providerId: string): Promise<ShipmentResult>
  abstract track(serviceCode: string, trackingNumber: string): Promise<TrackingEvent[]>
}
