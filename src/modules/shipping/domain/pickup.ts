import type { ShippingQuote } from './shipping-gateway'

/** Código da opção "Retirada em mãos" (não passa pela Frenet: sem frete e sem etiqueta). */
export const PICKUP_SERVICE_CODE = 'RETIRADA'

/** Retirada direto com a Líriou: grátis, combinada com a cliente pelo WhatsApp. */
export const PICKUP_OPTION: ShippingQuote = {
  serviceCode: PICKUP_SERVICE_CODE,
  carrier: '',
  carrierCode: '',
  service: 'Retirada em mãos',
  priceCents: 0,
  deliveryDays: 0,
}

export const isPickup = (serviceCode: string | null | undefined) => serviceCode === PICKUP_SERVICE_CODE
