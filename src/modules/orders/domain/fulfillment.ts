import { OrderStatus } from './order'

/**
 * Etapa do pedido que a cliente acompanha:
 * Recebido → Pago → Separando → Enviado → Entregue (ou Cancelado).
 */
export enum FulfillmentStage {
  RECEBIDO = 'recebido',
  PAGO = 'pago',
  SEPARANDO = 'separando',
  ENVIADO = 'enviado',
  ENTREGUE = 'entregue',
  CANCELADO = 'cancelado',
}

export interface FulfillmentInput {
  status: OrderStatus
  /** Marcado no dashboard ("Entregue / Recebido pela cliente") */
  deliveredAt: Date | null
  /** Envio na transportadora (null = etiqueta ainda não gerada) */
  shipment: { status: string; trackingNumber: string | null; lastEventDescription: string | null } | null
}

/** Status da Frenet que significam "já saiu da loja" (código ou nome, conforme a origem). */
const POSTED_STATUS = new Set(['5', 'Postado', '18'])

const isDeliveredEvent = (description: string) => /entregue/i.test(description) && !/n[ãa]o entregue/i.test(description)

/**
 * Deriva a etapa a partir do que a loja já registra (pagamento, etiqueta, rastreio e o check de entregue).
 * Gerar a etiqueta = "Separando"; postado ou com movimentação = "Enviado".
 */
export function fulfillmentStage({ status, deliveredAt, shipment }: FulfillmentInput): FulfillmentStage {
  if (status === OrderStatus.CANCELADO) return FulfillmentStage.CANCELADO
  if (status === OrderStatus.AGUARDANDO_PAGAMENTO) return FulfillmentStage.RECEBIDO
  if (deliveredAt) return FulfillmentStage.ENTREGUE
  if (!shipment) return FulfillmentStage.PAGO

  const event = shipment.lastEventDescription
  if (event && isDeliveredEvent(event)) return FulfillmentStage.ENTREGUE
  if (event || POSTED_STATUS.has(shipment.status)) return FulfillmentStage.ENVIADO
  return FulfillmentStage.SEPARANDO
}
