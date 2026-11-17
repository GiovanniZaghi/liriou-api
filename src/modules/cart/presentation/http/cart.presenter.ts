import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import type { CartView } from '../../application/cart-view.assembler'
import type { StoreSettings } from '../../domain/store-settings'
import { DiscountType, type Coupon } from '../../../coupons/domain/coupon'
import { shippingLabel, type ShippingQuote } from '../../../shipping/domain/shipping-gateway'

export function presentCart({ cart, items, coupon, pricing }: CartView) {
  return {
    id: cart.id,
    items: items.map(({ product, quantity, lineTotalCents, available }) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      colorName: product.colorName,
      image: product.imageUrl,
      unitPrice: toReais(product.priceCents),
      quantity,
      lineTotal: toReais(lineTotalCents),
      available,
    })),
    itemCount: cart.itemCount,
    coupon: coupon
      ? {
          code: coupon.coupon.code,
          /** Ex.: "10% OFF" ou "R$ 20,00 OFF" */
          label: couponLabel(coupon.coupon),
          applied: coupon.applied,
          notice: coupon.notice,
          minSubtotal: toReais(coupon.coupon.minSubtotalCents),
        }
      : null,
    shippingOptionId: cart.shippingOptionId,
    shipping: cart.shipping ? presentShippingQuote(cart.shipping, pricing.freeShipping, cart.shipping.cep) : null,
    totals: {
      subtotal: toReais(pricing.subtotalCents),
      discount: toReais(pricing.discountCents),
      shipping: pricing.shippingCents === null ? null : toReais(pricing.shippingCents),
      total: toReais(pricing.totalCents),
      freeShipping: pricing.freeShipping,
      missingForFreeShipping: toReais(pricing.missingForFreeShippingCents),
    },
    updatedAt: isoDate(cart.updatedAt),
  }
}

export function couponLabel(c: Coupon) {
  return c.type === DiscountType.PERCENT
    ? `${c.value}% OFF`
    : `${(c.value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} OFF`
}

/** Opção de frete como a cliente vê (preço 0 quando a sacola tem frete grátis). */
export function presentShippingQuote(q: ShippingQuote, freeShipping: boolean, cep?: string) {
  return {
    serviceCode: q.serviceCode,
    carrier: q.carrier,
    service: q.service,
    label: shippingLabel(q),
    price: freeShipping ? 0 : toReais(q.priceCents),
    originalPrice: toReais(q.priceCents),
    deliveryDays: q.deliveryDays,
    ...(cep ? { cep } : {}),
  }
}

export function presentStoreSettings(s: StoreSettings) {
  return {
    freeShippingThreshold: toReais(s.freeShippingThresholdCents),
    installments: s.installments,
    pixDiscountPercent: s.pixDiscountPercent,
  }
}
