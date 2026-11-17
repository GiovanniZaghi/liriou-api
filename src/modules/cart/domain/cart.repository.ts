import type { Cart } from './cart'

export abstract class CartRepository {
  /** Qualquer sacola, inclusive as que já viraram pedido (histórico) */
  abstract findById(id: string): Promise<Cart | null>
  /** Só sacolas ainda abertas (o que a loja pode alterar) */
  abstract findOpenById(id: string): Promise<Cart | null>
  abstract save(cart: Cart): Promise<void>
}
