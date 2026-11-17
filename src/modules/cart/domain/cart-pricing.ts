import type { Cents } from '../../../shared/domain/money'

export interface PricedLine {
  unitPriceCents: Cents
  quantity: number
}

/** Qualquer regra de desconto sobre o subtotal (implementada pelo cupom). A sacola não conhece o cupom em si. */
export interface DiscountRule {
  discountFor(subtotalCents: Cents): Cents
}

export interface CartPricing {
  subtotalCents: Cents
  discountCents: Cents
  /** null = frete ainda não escolhido */
  shippingCents: Cents | null
  totalCents: Cents
  freeShipping: boolean
  /** Quanto falta para o frete grátis (0 quando já atingiu) */
  missingForFreeShippingCents: Cents
}

/** Cálculo puro dos totais da sacola: sem I/O, fácil de testar. */
export function priceCart(input: {
  lines: PricedLine[]
  discount?: DiscountRule
  /** Frete escolhido (preço cotado); ausente = ainda não escolhido */
  shipping?: { priceCents: Cents } | null
  freeShippingThresholdCents: Cents
}): CartPricing {
  const subtotalCents = input.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
  const discountCents = Math.min(input.discount?.discountFor(subtotalCents) ?? 0, subtotalCents)
  // Frete grátis olha o subtotal dos produtos (antes do desconto)
  const freeShipping = subtotalCents > 0 && subtotalCents >= input.freeShippingThresholdCents
  const shippingCents = input.shipping ? (freeShipping ? 0 : input.shipping.priceCents) : null

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: Math.max(subtotalCents + (shippingCents ?? 0) - discountCents, 0),
    freeShipping,
    missingForFreeShippingCents: Math.max(input.freeShippingThresholdCents - subtotalCents, 0),
  }
}
