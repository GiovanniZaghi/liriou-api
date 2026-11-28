import { FulfillmentStage, fulfillmentStage } from './fulfillment'
import { OrderStatus } from './order'

const shipment = (status: string, lastEventDescription: string | null = null) => ({ status, trackingNumber: null, lastEventDescription })

describe('fulfillmentStage', () => {
  it('aguardando pagamento = recebido; cancelado = cancelado', () => {
    expect(fulfillmentStage({ status: OrderStatus.AGUARDANDO_PAGAMENTO, deliveredAt: null, shipment: null })).toBe(FulfillmentStage.RECEBIDO)
    expect(fulfillmentStage({ status: OrderStatus.CANCELADO, deliveredAt: new Date(), shipment: null })).toBe(FulfillmentStage.CANCELADO)
  })

  it('pago sem etiqueta = pago; com etiqueta = separando', () => {
    expect(fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: null })).toBe(FulfillmentStage.PAGO)
    expect(fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: shipment('SucessoPagamento') })).toBe(
      FulfillmentStage.SEPARANDO,
    )
  })

  it('postado ou com rastreio = enviado', () => {
    expect(fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: shipment('Postado') })).toBe(FulfillmentStage.ENVIADO)
    expect(
      fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: shipment('4', 'Objeto em trânsito') }),
    ).toBe(FulfillmentStage.ENVIADO)
    expect(
      fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: shipment('5', 'Objeto não entregue - carteiro não atendido') }),
    ).toBe(FulfillmentStage.ENVIADO)
  })

  it('entregue pelo rastreio ou pelo check do dashboard (inclui retirada em mãos)', () => {
    expect(
      fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: null, shipment: shipment('5', 'Objeto entregue ao destinatário') }),
    ).toBe(FulfillmentStage.ENTREGUE)
    expect(fulfillmentStage({ status: OrderStatus.PAGO, deliveredAt: new Date(), shipment: null })).toBe(FulfillmentStage.ENTREGUE)
  })
})
