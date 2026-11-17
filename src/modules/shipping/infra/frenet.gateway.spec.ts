import type { ConfigService } from '@nestjs/config'
import { packVolume, normalizeCep } from '../domain/package'
import { LabelError, ShippingUnavailableError } from '../domain/shipping.errors'
import { FrenetGateway } from './frenet.gateway'

const config = (values: Record<string, string>) => ({ get: (k: string) => values[k] }) as unknown as ConfigService<never, true>
const respond = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

const item = { sku: 'SCR', quantity: 2, weightGrams: 60, lengthCm: 16, widthCm: 11, heightCm: 4 }

afterEach(() => jest.restoreAllMocks())

describe('FrenetGateway.quote', () => {
  const gw = new FrenetGateway(config({ FRENET_TOKEN: 't', FRENET_SELLER_CEP: '01001-000' }))

  it('converte a cotação, ignora serviços com erro e ordena pelo preço', async () => {
    const spy = respond(200, {
      ShippingSevicesArray: [
        { ServiceCode: '04014', Carrier: 'Correios', CarrierCode: 'COR', ServiceDescription: 'SEDEX', ShippingPrice: '32.40', DeliveryTime: '2', Error: false },
        { ServiceCode: '04510', Carrier: 'Correios', CarrierCode: 'COR', ServiceDescription: 'PAC', ShippingPrice: '18,90', DeliveryTime: '6', Error: false },
        { ServiceCode: 'X', Carrier: 'Jadlog', ServiceDescription: '.Package', Error: true, Msg: 'CEP não atendido' },
      ],
    })
    const quotes = await gw.quote({ destinationCep: '20040020', invoiceValueCents: 9980, items: [item] })

    expect(quotes.map((q) => [q.service, q.priceCents, q.deliveryDays])).toEqual([['PAC', 1890, 6], ['SEDEX', 3240, 2]])
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body))
    expect(body).toMatchObject({ SellerCEP: '01001000', RecipientCEP: '20040020', ShipmentInvoiceValue: 99.8 })
    expect(body.ShippingItemArray[0]).toMatchObject({ Weight: 0.06, Length: 16, Quantity: 2 })
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).token).toBe('t')
  })

  it('sem token configurado: frete indisponível (sem chamar a Frenet)', async () => {
    const spy = jest.spyOn(global, 'fetch')
    await expect(new FrenetGateway(config({})).quote({ destinationCep: '1', invoiceValueCents: 1, items: [item] })).rejects.toBeInstanceOf(ShippingUnavailableError)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('FrenetGateway.createShipment', () => {
  const request = {
    orderReference: 'pedido-1001',
    orderValueCents: 9980,
    recipient: { name: 'Ana', email: 'a@x.com', phone: '11999998888', cpf: '52998224725', address: { cep: '01310100', street: 'Av', number: '1', complement: null, district: 'B', city: 'SP', state: 'SP' } },
    items: [{ ...item, productId: 'p1', name: 'Scrunchie', unitPriceCents: 4990 }],
    quote: { serviceCode: '04014', carrier: 'Correios', carrierCode: 'COR', service: 'SEDEX', priceCents: 3240, deliveryDays: 2 },
    chargedShippingCents: 0,
    trackingNotificationUrl: null,
  }

  it('exige o token de parceiro para etiquetas', async () => {
    const gw = new FrenetGateway(config({ FRENET_TOKEN: 't' }))
    await expect(gw.createShipment(request)).rejects.toThrow(/token de parceiro/)
  })

  it('lê a resposta em camelCase (como nos exemplos da Frenet) e extrai o código de rastreio', async () => {
    respond(200, {
      statusBatch: 'Processado',
      items: [{ shipmentId: 12682, shipmentStatus: 'SucessoPagamento', trackingUrl: 'http://rastreio/COR/PY943133131BR', labelUrl: 'http://painel/label?id=12682', errors: null }],
    })
    const gw = new FrenetGateway(config({ FRENET_TOKEN: 't', FRENET_PARTNER_TOKEN: 'p' }))
    await expect(gw.createShipment(request)).resolves.toMatchObject({
      providerId: '12682',
      status: 'SucessoPagamento',
      trackingNumber: 'PY943133131BR',
      labelUrl: 'http://painel/label?id=12682',
    })
  })

  it('traduz erro de saldo em mensagem para o dashboard', async () => {
    respond(400, { Error: { Message: 'Saldo insuficiente.' } })
    const gw = new FrenetGateway(config({ FRENET_TOKEN: 't', FRENET_PARTNER_TOKEN: 'p' }))
    await expect(gw.createShipment(request)).rejects.toEqual(new LabelError('Frenet: Saldo insuficiente.'))
  })
})

describe('packVolume / normalizeCep', () => {
  it('empilha itens numa caixa só', () => {
    expect(packVolume([{ ...item, quantity: 3 }, { weightGrams: 250, lengthCm: 20, widthCm: 15, heightCm: 8, quantity: 1 }])).toEqual({
      weightGrams: 430, lengthCm: 20, widthCm: 15, heightCm: 20,
    })
  })

  it('normaliza CEP', () => {
    expect(normalizeCep('01310-100')).toBe('01310100')
    expect(normalizeCep('123')).toBeNull()
  })
})
