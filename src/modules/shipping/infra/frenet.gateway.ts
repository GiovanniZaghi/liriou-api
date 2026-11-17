import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../../config/env'
import { packVolume } from '../domain/package'
import {
  ShippingGateway,
  type QuoteRequest,
  type ShipmentRequest,
  type ShipmentResult,
  type ShippingQuote,
  type TrackingEvent,
} from '../domain/shipping-gateway'
import { LabelError, ShippingUnavailableError } from '../domain/shipping.errors'

const DEFAULT_API = 'https://api.frenet.com.br'
const DEFAULT_WHITELABEL = 'https://whitelabel.frenet.com.br/v1'
const TIMEOUT_MS = 15_000

type Json = Record<string, unknown>

/** A Frenet mistura PascalCase (schema) e camelCase (exemplos): lê a chave em qualquer caixa. */
function pick<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const lower = key.toLowerCase()
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower)
  return found ? ((obj as Json)[found] as T) : undefined
}

const toCents = (value: unknown) => Math.round(Number(String(value ?? '').replace(',', '.')) * 100)
const toReais = (cents: number) => Math.round(cents) / 100
const kg = (grams: number) => Math.round(grams) / 1000

/** Código de rastreio = último trecho da URL de rastreio (ex.: .../COR/PY943133131BR) */
const trackingFromUrl = (url: string | null) => (url ? (url.split('/').filter(Boolean).pop() ?? null) : null)

/** Adapter da Frenet: cotação e rastreio (api.frenet.com.br) e etiquetas (Whitelabel API). */
@Injectable()
export class FrenetGateway extends ShippingGateway {
  private readonly logger = new Logger(FrenetGateway.name)
  private readonly token?: string
  private readonly partnerToken?: string
  private readonly sellerCep?: string
  private readonly api: string
  private readonly whitelabel: string

  constructor(config: ConfigService<Env, true>) {
    super()
    this.token = config.get('FRENET_TOKEN', { infer: true }) || undefined
    this.partnerToken = config.get('FRENET_PARTNER_TOKEN', { infer: true }) || undefined
    this.sellerCep = config.get('FRENET_SELLER_CEP', { infer: true })?.replace(/\D/g, '') || undefined
    // Sobrescrevíveis para homologação/testes; padrão = produção da Frenet
    this.api = (config.get('FRENET_API_URL', { infer: true }) || DEFAULT_API).replace(/\/$/, '')
    this.whitelabel = (config.get('FRENET_WHITELABEL_URL', { infer: true }) || DEFAULT_WHITELABEL).replace(/\/$/, '')
  }

  async quote(req: QuoteRequest): Promise<ShippingQuote[]> {
    if (!this.token || !this.sellerCep) {
      this.logger.error('FRENET_TOKEN ou FRENET_SELLER_CEP não configurados')
      throw new ShippingUnavailableError()
    }
    const data = await this.call('POST', `${this.api}/shipping/quote`, {
      SellerCEP: this.sellerCep,
      RecipientCEP: req.destinationCep,
      ShipmentInvoiceValue: toReais(req.invoiceValueCents),
      RecipientCountry: 'BR',
      ShippingItemArray: req.items.map((i) => ({
        SKU: i.sku,
        Quantity: i.quantity,
        Weight: kg(i.weightGrams),
        Length: i.lengthCm,
        Width: i.widthCm,
        Height: i.heightCm,
      })),
    })
    const services = pick<Json[]>(data, 'ShippingSevicesArray') ?? pick<Json[]>(data, 'ShippingServicesArray') ?? []
    return services
      .filter((s) => !pick<boolean>(s, 'Error') && pick(s, 'ShippingPrice') != null)
      .map((s) => ({
        serviceCode: String(pick(s, 'ServiceCode')),
        carrier: String(pick(s, 'Carrier') ?? ''),
        carrierCode: String(pick(s, 'CarrierCode') ?? ''),
        service: String(pick(s, 'ServiceDescription') ?? ''),
        priceCents: toCents(pick(s, 'ShippingPrice')),
        deliveryDays: Number.parseInt(String(pick(s, 'DeliveryTime') ?? '0'), 10) || 0,
      }))
      .filter((q) => q.serviceCode && Number.isFinite(q.priceCents) && q.priceCents >= 0)
      .sort((a, b) => a.priceCents - b.priceCents)
  }

  async createShipment(req: ShipmentRequest): Promise<ShipmentResult> {
    const volume = packVolume(req.items)
    const shipment = {
      TrackingNotificationUrl: req.trackingNotificationUrl ?? undefined,
      Order: {
        Id: req.orderReference,
        Value: toReais(req.orderValueCents),
        UseFrenetRegistration: true, // remetente = endereço cadastrado na conta Frenet
        Items: req.items.map((i) => ({
          ItemId: i.productId,
          ProductId: i.productId,
          ProductName: i.name,
          SKU: i.sku,
          Quantity: i.quantity,
          Price: toReais(i.unitPriceCents),
          Weight: kg(i.weightGrams),
          Length: i.lengthCm,
          Width: i.widthCm,
          Height: i.heightCm,
        })),
        To: {
          Name: req.recipient.name,
          Email: req.recipient.email,
          Cellphone: req.recipient.phone,
          Phone: req.recipient.phone,
          Document: req.recipient.cpf,
          Address: {
            ZipCode: req.recipient.address.cep,
            Street: req.recipient.address.street,
            AddressNumber: req.recipient.address.number,
            AddressComplement: req.recipient.address.complement ?? '',
            AddressQuarter: req.recipient.address.district,
            City: req.recipient.address.city,
            AddressState: req.recipient.address.state,
            Country: 'BR',
          },
        },
      },
      Volumes: [
        {
          Weight: kg(volume.weightGrams),
          Length: volume.lengthCm,
          Width: volume.widthCm,
          Height: volume.heightCm,
          DeclaredValue: toReais(req.orderValueCents),
          OrderItemsId: req.items.map((i) => i.productId),
        },
      ],
      Quotation: {
        ShippingServiceCode: req.quote.serviceCode,
        ShippingServiceName: req.quote.service,
        Carrier: req.quote.carrier,
        CarrierCode: req.quote.carrierCode,
        DeliveryTime: req.quote.deliveryDays,
        ShippingPrice: toReais(req.quote.priceCents),
        PlatformShippingPrice: toReais(req.chargedShippingCents),
        Services: { DeclaredValue: true, ReceiptNotification: false, OwnHand: false },
      },
    }

    const data = await this.call('POST', `${this.whitelabel}/shipments`, [shipment], true)
    const item = pick<Json[]>(data, 'Items')?.[0]
    const batchError = pick<Json>(data, 'Error')
    if (!item) throw new LabelError(String(pick(batchError, 'Message') ?? 'A Frenet não retornou a etiqueta.'))
    return this.toResult(item)
  }

  async refreshShipment(providerId: string): Promise<ShipmentResult> {
    const data = await this.call('GET', `${this.whitelabel}/shipments/${encodeURIComponent(providerId)}/label`, undefined, true)
    return this.toResult(data as Json)
  }

  async track(serviceCode: string, trackingNumber: string): Promise<TrackingEvent[]> {
    const data = await this.call('POST', `${this.api}/tracking/trackinginfo`, {
      ShippingServiceCode: serviceCode,
      TrackingNumber: trackingNumber,
    })
    return (pick<Json[]>(data, 'TrackingEvents') ?? []).map(toEvent)
  }

  private toResult(item: Json): ShipmentResult {
    const errors = pick<Json[]>(item, 'Errors')
    const labelUrl = pick<string>(item, 'LabelUrl') ?? null
    if (errors?.length && !labelUrl) {
      throw new LabelError(errors.map((e) => String(pick(e, 'Message') ?? pick(e, 'Details') ?? '')).filter(Boolean).join(' · ') || 'Falha ao gerar etiqueta.')
    }
    const trackingUrl = pick<string>(item, 'TrackingUrl') ?? null
    return {
      providerId: String(pick(item, 'ShipmentId')),
      status: String(pick(item, 'ShipmentStatus') ?? 'Criado'),
      trackingNumber: trackingFromUrl(trackingUrl),
      trackingUrl,
      labelUrl,
      declarationUrl: pick<string>(item, 'DeclarationUrl') ?? null,
    }
  }

  private async call(method: 'GET' | 'POST', url: string, body?: unknown, whitelabel = false): Promise<unknown> {
    if (!this.token) throw new ShippingUnavailableError()
    if (whitelabel && !this.partnerToken) {
      throw new LabelError(
        'Geração de etiqueta ainda não liberada: falta o token de parceiro da Frenet (FRENET_PARTNER_TOKEN).',
        'LABEL_NOT_CONFIGURED',
      )
    }

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          token: this.token,
          ...(whitelabel ? { 'x-partner-token': this.partnerToken! } : {}),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (err) {
      this.logger.error(`Frenet indisponível (${url}): ${(err as Error).message}`)
      throw whitelabel ? new LabelError('A Frenet não respondeu. Tente de novo em instantes.') : new ShippingUnavailableError()
    }

    const data = await res.json().catch(() => null)
    if (res.ok) return data

    this.logger.error(`Frenet ${method} ${url} → ${res.status}: ${JSON.stringify(data)}`)
    if (!whitelabel) throw new ShippingUnavailableError()
    const message = pick<string>(pick(data, 'Error'), 'Message') ?? pick<string>(data, 'Message')
    if (res.status === 401) throw new LabelError('Token da Frenet inválido. Confira FRENET_TOKEN e FRENET_PARTNER_TOKEN.')
    throw new LabelError(message ? `Frenet: ${message}` : 'A Frenet recusou a criação da etiqueta.')
  }
}

export function toEvent(e: Json): TrackingEvent {
  return {
    at: String(pick(e, 'EventDateTime') ?? ''),
    description: String(pick(e, 'EventDescription') ?? ''),
    location: String(pick(e, 'EventLocation') ?? ''),
    type: String(pick(e, 'EventType') ?? ''),
  }
}
