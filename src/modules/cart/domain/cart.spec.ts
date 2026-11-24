import { ValidationError } from '../../../shared/domain/domain-error'
import { Cart, CartAlreadyOrderedError, CheckoutStage, MAX_QUANTITY_PER_ITEM, type SelectedShipping } from './cart'
import { priceCart } from './cart-pricing'
import { StoreSettings } from './store-settings'

const SEDEX: SelectedShipping = {
  serviceCode: '04014',
  carrier: 'Correios',
  carrierCode: 'COR',
  service: 'SEDEX',
  priceCents: 2500,
  deliveryDays: 2,
  cep: '01310100',
}

describe('Cart', () => {
  it('embalagem de Natal: começa desmarcada, liga/desliga e mantém o frete', () => {
    const cart = Cart.create()
    cart.setQuantity('a', 1)
    cart.selectShipping(SEDEX)
    expect(cart.giftWrap).toBe(false)
    cart.setGiftWrap(true)
    expect(cart.giftWrap).toBe(true)
    expect(cart.shipping).toEqual(SEDEX)
    cart.setGiftWrap(false)
    expect(cart.giftWrap).toBe(false)
  })

  it('embalagem de Natal não muda depois que a sacola virou pedido', () => {
    const cart = Cart.create()
    cart.markOrdered('pedido-1')
    expect(() => cart.setGiftWrap(true)).toThrow(CartAlreadyOrderedError)
  })

  it('define, atualiza e remove (quantidade 0) itens', () => {
    const cart = Cart.create()
    cart.setQuantity('a', 2)
    cart.setQuantity('b', 1)
    cart.setQuantity('a', 5)
    expect(cart.itemCount).toBe(6)
    cart.setQuantity('a', 0)
    expect(cart.lines.map((l) => l.productId)).toEqual(['b'])
  })

  it('respeita o limite por item', () => {
    expect(() => Cart.create().setQuantity('a', MAX_QUANTITY_PER_ITEM + 1)).toThrow(ValidationError)
  })

  it('remove itens de produtos que saíram do catálogo', () => {
    const cart = Cart.create()
    cart.setQuantity('a', 1)
    cart.setQuantity('b', 1)
    expect(cart.pruneUnavailable((id) => id === 'a')).toBe(true)
    expect(cart.pruneUnavailable(() => true)).toBe(false)
    expect(cart.lines).toHaveLength(1)
  })
})

describe('priceCart', () => {
  const settings = StoreSettings.default()
  const sedex = { priceCents: 2500 }
  const base = { freeShippingThresholdCents: settings.freeShippingThresholdCents }

  it('sem frete escolhido abaixo do mínimo → frete "a calcular" (null)', () => {
    const r = priceCart({ ...base, lines: [{ unitPriceCents: 4990, quantity: 1 }] })
    expect(r).toMatchObject({ subtotalCents: 4990, shippingCents: null, totalCents: 4990, missingForFreeShippingCents: 10010 })
  })

  it('soma o frete escolhido e aplica o cupom sobre o subtotal', () => {
    const r = priceCart({
      ...base,
      lines: [{ unitPriceCents: 4990, quantity: 2 }],
      discount: { discountFor: (s: number) => Math.round(s * 0.1) },
      shipping: sedex,
    })
    expect(r).toMatchObject({ subtotalCents: 9980, discountCents: 998, shippingCents: 2500, totalCents: 11482 })
  })

  it('frete grátis a partir do mínimo, mesmo com opção escolhida', () => {
    const r = priceCart({ ...base, lines: [{ unitPriceCents: 15000, quantity: 1 }], shipping: sedex })
    expect(r).toMatchObject({ freeShipping: true, shippingCents: 0, totalCents: 15000 })
  })

  it('sacola vazia não ganha frete grátis', () => {
    expect(priceCart({ ...base, lines: [] }).freeShipping).toBe(false)
  })
})

describe('Cart · checkout', () => {
  const customer = { name: 'Ana Souza', email: 'ana@x.com', cpf: '52998224725', phone: '11912345678' }
  const address = { cep: '01310100', street: 'Av. Paulista', number: '1000', complement: null, district: 'Bela Vista', city: 'São Paulo', state: 'SP', recipient: 'Ana' }

  it('avança cliente → entrega → pedido e registra as datas', () => {
    const cart = Cart.create()
    expect(cart.stage).toBe(CheckoutStage.CART)
    cart.identify(customer)
    expect(cart.stage).toBe(CheckoutStage.IDENTIFIED)
    cart.setDelivery(address, SEDEX)
    expect(cart.stage).toBe(CheckoutStage.DELIVERY)
    expect(cart.shippingOptionId).toBe('04014')
    cart.markOrdered('order-1')
    expect(cart.isOrdered).toBe(true)
    expect(cart.toSnapshot()).toMatchObject({ orderId: 'order-1' })
    expect(cart.identifiedAt && cart.deliveryAt && cart.orderedAt).toBeTruthy()
  })

  it('reenviar a identificação não faz a etapa regredir', () => {
    const cart = Cart.create()
    cart.identify(customer)
    cart.setDelivery(address, SEDEX)
    cart.identify({ ...customer, phone: '11999998888' })
    expect(cart.stage).toBe(CheckoutStage.DELIVERY)
  })

  it('exige identificação antes da entrega', () => {
    expect(() => Cart.create().setDelivery(address, SEDEX)).toThrow(ValidationError)
  })

  it('sacola que virou pedido fica congelada', () => {
    const cart = Cart.create()
    cart.identify(customer)
    cart.setDelivery(address, SEDEX)
    cart.markOrdered('o1')
    expect(() => cart.setQuantity('p', 1)).toThrow(CartAlreadyOrderedError)
    expect(cart.pruneUnavailable(() => false)).toBe(false)
  })
})

describe('Cart · frete', () => {
  it('mudar os itens invalida o frete cotado (peso e valor mudaram)', () => {
    const cart = Cart.create()
    cart.setQuantity('a', 1)
    cart.selectShipping(SEDEX)
    expect(cart.shipping).toEqual(SEDEX)
    cart.setQuantity('a', 2)
    expect(cart.shipping).toBeNull()
  })

  it('cupom não mexe no frete escolhido', () => {
    const cart = Cart.create()
    cart.setQuantity('a', 1)
    cart.selectShipping(SEDEX)
    cart.applyCoupon('X')
    expect(cart.shippingOptionId).toBe('04014')
  })
})
