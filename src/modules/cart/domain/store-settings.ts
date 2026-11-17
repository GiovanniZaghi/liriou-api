import type { Cents } from '../../../shared/domain/money'

/**
 * Regras comerciais da loja (frete grátis, parcelamento e desconto no Pix).
 * As opções e preços de frete vêm da cotação da transportadora (módulo `shipping`); cupons ficam no módulo `coupons`.
 * Hoje vêm de `StoreSettings.default()`; para geri-las pelo dashboard basta trocar o provider no CartModule.
 */
export class StoreSettings {
  constructor(
    readonly freeShippingThresholdCents: Cents,
    /** Parcelas sem juros no cartão */
    readonly installments: number,
    /** Desconto extra (%) para pagamento à vista no Pix */
    readonly pixDiscountPercent: number = 0,
  ) {}

  static default(): StoreSettings {
    return new StoreSettings(15_000, 3, 5)
  }

  /** Total com o desconto do Pix à vista (arredondado ao centavo). */
  pixPriceCents(totalCents: Cents): Cents {
    return Math.round((totalCents * (100 - this.pixDiscountPercent)) / 100)
  }
}
