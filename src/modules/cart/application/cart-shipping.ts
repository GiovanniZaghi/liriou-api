import { Injectable } from '@nestjs/common'
import { normalizeCep } from '../../shipping/domain/package'
import { ShippingGateway, type ShippingQuote } from '../../shipping/domain/shipping-gateway'
import { InvalidCepError, ShippingOptionUnavailableError } from '../../shipping/domain/shipping.errors'
import type { SelectedShipping } from '../domain/cart'
import type { CartView } from './cart-view.assembler'

export interface CartShippingQuote {
  cep: string
  options: ShippingQuote[]
}

/**
 * Cota o frete da sacola na transportadora com o peso/medidas reais dos produtos.
 * Escolher uma opção sempre recota: o preço gravado é o da transportadora, nunca o que o front enviou.
 */
@Injectable()
export class CartShippingQuoter {
  constructor(private readonly gateway: ShippingGateway) {}

  async quote(view: CartView, cepInput: string): Promise<CartShippingQuote> {
    const cep = normalizeCep(cepInput)
    if (!cep) throw new InvalidCepError()
    if (view.items.length === 0) return { cep, options: [] }

    const options = await this.gateway.quote({
      destinationCep: cep,
      invoiceValueCents: view.pricing.subtotalCents,
      items: view.items.map((i) => ({ sku: i.product.sku, quantity: i.quantity, ...i.product.packageSize })),
    })
    return { cep, options }
  }

  async choose(view: CartView, cepInput: string, serviceCode: string): Promise<SelectedShipping> {
    const { cep, options } = await this.quote(view, cepInput)
    const option = options.find((o) => o.serviceCode === serviceCode)
    if (!option) throw new ShippingOptionUnavailableError()
    return { ...option, cep }
  }
}
