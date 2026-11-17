import { Injectable } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Cart } from '../domain/cart'
import { CartRepository } from '../domain/cart.repository'
import { CartItemOrmEntity, CartOrmEntity } from './cart.orm-entity'

@Injectable()
export class TypeOrmCartRepository extends CartRepository {
  constructor(
    @InjectRepository(CartOrmEntity) private readonly carts: Repository<CartOrmEntity>,
    @InjectRepository(CartItemOrmEntity) private readonly items: Repository<CartItemOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super()
  }

  async findById(id: string) {
    const [row, lines] = await Promise.all([
      this.carts.findOneBy({ id }),
      this.items.find({ where: { cartId: id }, order: { addedAt: 'ASC' } }),
    ])
    if (!row) return null
    const { id: cartId, shippingOptionId: _code, ...rest } = row
    return Cart.restore({
      ...rest,
      // Sacolas antigas (frete fixo) só têm o código: sem cotação, a cliente escolhe de novo
      shipping: row.shipping ?? null,
      id: cartId,
      lines: lines.map(({ productId, quantity, addedAt }) => ({ productId, quantity, addedAt })),
    })
  }

  async findOpenById(id: string) {
    const cart = await this.findById(id)
    return cart && !cart.isOrdered ? cart : null
  }

  /** Grava o agregado inteiro (cabeçalho + itens) numa transação. */
  async save(cart: Cart) {
    const { lines, ...header } = cart.toSnapshot()
    await this.dataSource.transaction(async (em) => {
      await em.getRepository(CartOrmEntity).save({ ...header, shippingOptionId: header.shipping?.serviceCode ?? null })
      await em.getRepository(CartItemOrmEntity).delete({ cartId: cart.id })
      if (lines.length) {
        await em
          .getRepository(CartItemOrmEntity)
          .insert(lines.map((l) => ({ cartId: cart.id, productId: l.productId, quantity: l.quantity, addedAt: l.addedAt })))
      }
    })
  }
}
