import { Injectable } from '@nestjs/common'
import type { Coupon } from '../../coupons/domain/coupon'
import { CouponUnavailableError } from '../../coupons/domain/coupon'
import { CouponRepository } from '../../coupons/domain/coupon.repository'
import type { Product } from '../../products/domain/product'
import { ProductRepository } from '../../products/domain/product.repository'
import type { Cart } from '../domain/cart'
import { CartRepository } from '../domain/cart.repository'
import { priceCart, type CartPricing } from '../domain/cart-pricing'
import { StoreSettings } from '../domain/store-settings'

export interface CartViewItem {
  product: Product
  quantity: number
  lineTotalCents: number
  /** false quando o estoque atual não cobre a quantidade (checkout deve bloquear) */
  available: boolean
}

export interface CartViewCoupon {
  coupon: Coupon
  /** O desconto está valendo nesta sacola agora? */
  applied: boolean
  /** Por que não está valendo (expirou, falta valor mínimo...) */
  notice: string | null
  missingForMinimumCents: number
}

export interface CartView {
  cart: Cart
  items: CartViewItem[]
  coupon: CartViewCoupon | null
  pricing: CartPricing
}

/**
 * Monta a visão da sacola com preços SEMPRE do catálogo atual (nunca confia em preço vindo do front).
 * Itens de produtos excluídos/inativos são removidos e a sacola é regravada.
 * O cupom é revalidado a cada leitura: se expirar ou esgotar, o desconto some e a sacola avisa o motivo.
 */
@Injectable()
export class CartViewAssembler {
  constructor(
    private readonly products: ProductRepository,
    private readonly carts: CartRepository,
    private readonly coupons: CouponRepository,
    private readonly settings: StoreSettings,
  ) {}

  async assemble(cart: Cart): Promise<CartView> {
    const [found, coupon] = await Promise.all([
      this.products.findByIds(cart.lines.map((l) => l.productId)),
      cart.couponCode ? this.coupons.findByCode(cart.couponCode) : Promise.resolve(null),
    ])
    const byId = new Map(found.filter((p) => p.isActive).map((p) => [p.id, p]))

    if (cart.pruneUnavailable((id) => byId.has(id))) await this.carts.save(cart)

    const items = cart.lines.map((line) => {
      const product = byId.get(line.productId)!
      return {
        product,
        quantity: line.quantity,
        lineTotalCents: product.priceCents * line.quantity,
        available: product.canFulfill(line.quantity),
      }
    })
    const lines = items.map((i) => ({ unitPriceCents: i.product.priceCents, quantity: i.quantity }))
    const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)

    const couponView = coupon ? describeCoupon(coupon, subtotalCents) : null
    const pricing = priceCart({
      lines,
      discount: couponView?.applied ? coupon! : undefined,
      shipping: cart.shipping,
      freeShippingThresholdCents: this.settings.freeShippingThresholdCents,
    })

    return { cart, items, coupon: couponView, pricing }
  }
}

function describeCoupon(coupon: Coupon, subtotalCents: number): CartViewCoupon {
  const missing = coupon.missingForMinimum(subtotalCents)
  try {
    coupon.assertUsable()
  } catch (err) {
    if (!(err instanceof CouponUnavailableError)) throw err
    return { coupon, applied: false, notice: err.message, missingForMinimumCents: missing }
  }
  if (missing > 0) {
    const reais = (missing / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return { coupon, applied: false, notice: `Faltam ${reais} para usar este cupom`, missingForMinimumCents: missing }
  }
  return { coupon, applied: true, notice: null, missingForMinimumCents: 0 }
}
