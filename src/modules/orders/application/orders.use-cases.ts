import { Injectable } from '@nestjs/common'
import { ValidationError } from '../../../shared/domain/domain-error'
import type { UseCase } from '../../../shared/application/use-case'
import { CartViewAssembler } from '../../cart/application/cart-view.assembler'
import { CartNotFoundError } from '../../cart/domain/cart.errors'
import { CartRepository } from '../../cart/domain/cart.repository'
import { CartShippingQuoter } from '../../cart/application/cart-shipping'
import { shippingLabel } from '../../shipping/domain/shipping-gateway'
import { parseAddress, parseCustomer, type Customer, type ShippingAddress } from '../../cart/domain/checkout-data'
import { CouponUnavailableError } from '../../coupons/domain/coupon'
import { CouponRepository } from '../../coupons/domain/coupon.repository'
import { Order } from '../domain/order'
import {
  CartItemsUnavailableError,
  EmptyCartError,
  OrderNotFoundError,
  ShippingRequiredError,
} from '../domain/order.errors'
import { OrderRepository } from '../domain/order.repository'

export interface PlaceOrderInput {
  cartId: string
  customer: Customer
  address: ShippingAddress
  shippingOptionId: string
}

/**
 * Fecha a sacola em um pedido "aguardando pagamento".
 * Preços, desconto e frete são recalculados aqui a partir do catálogo atual (nunca do front).
 */
@Injectable()
export class PlaceOrderUseCase implements UseCase<PlaceOrderInput, Order> {
  constructor(
    private readonly carts: CartRepository,
    private readonly assembler: CartViewAssembler,
    private readonly quoter: CartShippingQuoter,
    private readonly orders: OrderRepository,
    private readonly coupons: CouponRepository,
  ) {}

  async execute({ cartId, customer, address, shippingOptionId }: PlaceOrderInput) {
    const { customer: buyer, address: destination } = parseCheckoutData(customer, address)

    const cart = await this.carts.findOpenById(cartId)
    if (!cart) throw new CartNotFoundError()

    if (!shippingOptionId) throw new ShippingRequiredError()

    const items = await this.assembler.assemble(cart)
    if (items.items.length === 0) throw new EmptyCartError()
    const unavailable = items.items.filter((i) => !i.available).map((i) => i.product.id)
    if (unavailable.length) throw new CartItemsUnavailableError(unavailable)

    // Frete recotado no CEP final: o preço do pedido é o da transportadora agora
    const shipping = await this.quoter.choose(items, destination.cep, shippingOptionId)
    cart.selectShipping(shipping)
    const view = await this.assembler.assemble(cart)

    // Cupom só entra no pedido se estiver valendo; conta o uso de forma atômica (respeita o limite)
    const coupon = view.coupon?.applied ? view.coupon.coupon : null
    if (coupon && !(await this.coupons.registerUse(coupon.id))) {
      throw new CouponUnavailableError('Este cupom acabou de atingir o limite de usos. Remova-o para continuar.')
    }

    const order = Order.place({
      number: await this.orders.nextNumber(),
      customer: buyer,
      shippingAddress: destination,
      shippingOption: {
        id: shipping.serviceCode,
        label: shippingLabel(shipping),
        carrier: shipping.carrier,
        carrierCode: shipping.carrierCode,
        service: shipping.service,
        deliveryDays: shipping.deliveryDays,
        quotedPriceCents: shipping.priceCents,
      },
      couponCode: coupon?.code ?? null,
      giftWrap: cart.giftWrap,
      items: view.items.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        unitPriceCents: product.priceCents,
        quantity,
      })),
      totals: {
        subtotalCents: view.pricing.subtotalCents,
        discountCents: view.pricing.discountCents,
        shippingCents: view.pricing.shippingCents ?? 0,
        totalCents: view.pricing.totalCents,
      },
    })

    await this.orders.save(order)
    // A sacola fica como histórico da jornada (dashboard > Clientes), ligada ao pedido
    cart.identify(buyer)
    cart.setDelivery(destination, shipping)
    cart.markOrdered(order.id)
    await this.carts.save(cart)
    return order
  }
}

/** Valida cliente e endereço juntos, para o formulário receber todos os erros de uma vez. */
function parseCheckoutData(customer: Customer, address: ShippingAddress) {
  const fields: Record<string, string> = {}
  const attempt = <T>(fn: () => T): T | undefined => {
    try {
      return fn()
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err
      Object.assign(fields, err.fields)
      return undefined
    }
  }
  const c = attempt(() => parseCustomer(customer))
  const a = attempt(() => parseAddress(address))
  if (!c || !a) throw new ValidationError(fields)
  return { customer: c, address: a }
}

/** O id (UUID aleatório) do pedido funciona como credencial, como na sacola. */
@Injectable()
export class GetOrderUseCase implements UseCase<string, Order> {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string) {
    const order = await this.orders.findById(id)
    if (!order) throw new OrderNotFoundError()
    return order
  }
}
