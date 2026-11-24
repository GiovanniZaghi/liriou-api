import { Injectable } from '@nestjs/common'
import { ValidationError } from '../../../shared/domain/domain-error'
import type { UseCase } from '../../../shared/application/use-case'
import { InsufficientStockError } from '../../products/domain/product.errors'
import { ProductRepository } from '../../products/domain/product.repository'
import { Cart, MAX_QUANTITY_PER_ITEM } from '../domain/cart'
import { CartNotFoundError, InvalidCouponError, ProductUnavailableError } from '../domain/cart.errors'
import { CartRepository } from '../domain/cart.repository'
import { parseAddress, parseCustomer, type Customer, type ShippingAddress } from '../domain/checkout-data'
import { CartShippingQuoter, type CartShippingQuote } from './cart-shipping'
import { CartViewAssembler, type CartView } from './cart-view.assembler'
import { CouponUnavailableError } from '../../coupons/domain/coupon'
import { CouponRepository } from '../../coupons/domain/coupon.repository'

/** Fluxo comum das alterações: carrega → aplica a regra → grava → devolve a visão precificada. */
@Injectable()
export class CartMutator {
  constructor(
    private readonly carts: CartRepository,
    private readonly assembler: CartViewAssembler,
  ) {}

  async mutate(cartId: string, change: (cart: Cart) => void | Promise<void>): Promise<CartView> {
    const cart = await this.carts.findOpenById(cartId)
    if (!cart) throw new CartNotFoundError()
    await change(cart)
    await this.carts.save(cart)
    return this.assembler.assemble(cart)
  }
}

/** Garante que o produto existe, está ativo e tem estoque para a quantidade pedida. */
@Injectable()
export class CartItemPolicy {
  constructor(private readonly products: ProductRepository) {}

  async assertCanHold(productId: string, quantity: number) {
    const product = await this.products.findById(productId)
    if (!product || !product.isActive) throw new ProductUnavailableError()
    if (!product.canFulfill(quantity)) throw new InsufficientStockError(product.stock, quantity)
  }
}

export interface CartItemInput {
  productId: string
  quantity: number
}

@Injectable()
export class CreateCartUseCase implements UseCase<{ items?: CartItemInput[] }, CartView> {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductRepository,
    private readonly assembler: CartViewAssembler,
  ) {}

  /** Itens opcionais: permitem migrar uma sacola antiga do navegador. Itens indisponíveis são ignorados. */
  async execute({ items = [] }: { items?: CartItemInput[] }) {
    const cart = Cart.create()
    const available = new Map(
      (await this.products.findByIds(items.map((i) => i.productId))).filter((p) => p.isActive).map((p) => [p.id, p]),
    )
    for (const { productId, quantity } of items) {
      const product = available.get(productId)
      if (!product || product.stock <= 0) continue
      cart.setQuantity(productId, Math.min(quantity, product.stock, MAX_QUANTITY_PER_ITEM))
    }
    await this.carts.save(cart)
    return this.assembler.assemble(cart)
  }
}

@Injectable()
export class GetCartUseCase implements UseCase<string, CartView> {
  constructor(
    private readonly carts: CartRepository,
    private readonly assembler: CartViewAssembler,
  ) {}

  async execute(cartId: string) {
    const cart = await this.carts.findOpenById(cartId)
    if (!cart) throw new CartNotFoundError()
    return this.assembler.assemble(cart)
  }
}

@Injectable()
export class AddCartItemUseCase implements UseCase<{ cartId: string } & CartItemInput, CartView> {
  constructor(
    private readonly mutator: CartMutator,
    private readonly policy: CartItemPolicy,
  ) {}

  execute({ cartId, productId, quantity }: { cartId: string } & CartItemInput) {
    return this.mutator.mutate(cartId, async (cart) => {
      const next = cart.quantityOf(productId) + quantity
      await this.policy.assertCanHold(productId, next)
      cart.setQuantity(productId, next)
    })
  }
}

@Injectable()
export class SetCartItemQuantityUseCase implements UseCase<{ cartId: string } & CartItemInput, CartView> {
  constructor(
    private readonly mutator: CartMutator,
    private readonly policy: CartItemPolicy,
  ) {}

  execute({ cartId, productId, quantity }: { cartId: string } & CartItemInput) {
    return this.mutator.mutate(cartId, async (cart) => {
      if (quantity > 0) await this.policy.assertCanHold(productId, quantity)
      cart.setQuantity(productId, quantity)
    })
  }
}

@Injectable()
export class RemoveCartItemUseCase implements UseCase<{ cartId: string; productId: string }, CartView> {
  constructor(private readonly mutator: CartMutator) {}

  execute({ cartId, productId }: { cartId: string; productId: string }) {
    return this.mutator.mutate(cartId, (cart) => cart.removeItem(productId))
  }
}

/** Aplica um cupom do site: precisa existir, estar valendo agora e a sacola atingir o pedido mínimo. */
@Injectable()
export class ApplyCouponUseCase implements UseCase<{ cartId: string; code: string }, CartView> {
  constructor(
    private readonly mutator: CartMutator,
    private readonly coupons: CouponRepository,
    private readonly assembler: CartViewAssembler,
  ) {}

  execute({ cartId, code }: { cartId: string; code: string }) {
    return this.mutator.mutate(cartId, async (cart) => {
      const coupon = await this.coupons.findByCode(code)
      if (!coupon) throw new InvalidCouponError()
      coupon.assertUsable()

      const { pricing } = await this.assembler.assemble(cart)
      const missing = coupon.missingForMinimum(pricing.subtotalCents)
      if (missing > 0) {
        const min = (coupon.minSubtotalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        throw new CouponUnavailableError(`Este cupom vale para compras a partir de ${min}`, 'COUPON_MIN_SUBTOTAL')
      }
      cart.applyCoupon(coupon.code)
    })
  }
}

@Injectable()
export class SetGiftWrapUseCase implements UseCase<{ cartId: string; giftWrap: boolean }, CartView> {
  constructor(private readonly mutator: CartMutator) {}

  execute({ cartId, giftWrap }: { cartId: string; giftWrap: boolean }) {
    return this.mutator.mutate(cartId, (cart) => cart.setGiftWrap(giftWrap))
  }
}

@Injectable()
export class RemoveCouponUseCase implements UseCase<string, CartView> {
  constructor(private readonly mutator: CartMutator) {}

  execute(cartId: string) {
    return this.mutator.mutate(cartId, (cart) => cart.removeCoupon())
  }
}

/** Opções de frete para um CEP (não altera a sacola). */
@Injectable()
export class QuoteShippingUseCase implements UseCase<{ cartId: string; cep: string }, CartShippingQuote & { view: CartView }> {
  constructor(
    private readonly carts: CartRepository,
    private readonly assembler: CartViewAssembler,
    private readonly quoter: CartShippingQuoter,
  ) {}

  async execute({ cartId, cep }: { cartId: string; cep: string }) {
    const cart = await this.carts.findOpenById(cartId)
    if (!cart) throw new CartNotFoundError()
    const view = await this.assembler.assemble(cart)
    return { ...(await this.quoter.quote(view, cep)), view }
  }
}

/** Escolhe o frete: recota no CEP e grava o preço que a transportadora devolveu. */
@Injectable()
export class SelectShippingUseCase implements UseCase<{ cartId: string; cep: string; serviceCode: string }, CartView> {
  constructor(
    private readonly mutator: CartMutator,
    private readonly assembler: CartViewAssembler,
    private readonly quoter: CartShippingQuoter,
  ) {}

  execute({ cartId, cep, serviceCode }: { cartId: string; cep: string; serviceCode: string }) {
    return this.mutator.mutate(cartId, async (cart) => {
      cart.selectShipping(await this.quoter.choose(await this.assembler.assemble(cart), cep, serviceCode))
    })
  }
}

// ─── Progresso do checkout ──────────────────────────────────────────────────────

/** Etapa "Identificação" concluída: a cliente passa a aparecer no dashboard com nome e contato. */
@Injectable()
export class SaveCheckoutCustomerUseCase implements UseCase<{ cartId: string; customer: Customer }, CartView> {
  constructor(private readonly mutator: CartMutator) {}

  execute({ cartId, customer }: { cartId: string; customer: Customer }) {
    const parsed = stripPrefix(() => parseCustomer(customer), 'customer.')
    return this.mutator.mutate(cartId, (cart) => cart.identify(parsed))
  }
}

/** Etapa "Entrega" concluída (endereço + frete). */
@Injectable()
export class SaveCheckoutDeliveryUseCase
  implements UseCase<{ cartId: string; address: ShippingAddress; shippingOptionId: string }, CartView>
{
  constructor(
    private readonly mutator: CartMutator,
    private readonly assembler: CartViewAssembler,
    private readonly quoter: CartShippingQuoter,
  ) {}

  execute({ cartId, address, shippingOptionId }: { cartId: string; address: ShippingAddress; shippingOptionId: string }) {
    const parsed = stripPrefix(() => parseAddress(address), 'address.')
    return this.mutator.mutate(cartId, async (cart) => {
      // Recota no CEP do endereço final: garante preço e prazo atuais
      const shipping = await this.quoter.choose(await this.assembler.assemble(cart), parsed.cep, shippingOptionId)
      cart.setDelivery(parsed, shipping)
    })
  }
}

/** Nestas rotas o corpo já é o próprio cliente/endereço: devolve os campos sem o prefixo. */
function stripPrefix<T>(fn: () => T, prefix: string): T {
  try {
    return fn()
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err
    throw new ValidationError(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.replace(prefix, ''), v])))
  }
}
