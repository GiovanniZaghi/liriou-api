import { ValidationError } from '../../../shared/domain/domain-error'
import { Product, type ProductDetails } from './product'
import { InsufficientStockError } from './product.errors'
import { ProductCategory } from './product-category'
import { StockMovementType } from './stock-movement'

const details = (over: Partial<ProductDetails> = {}): ProductDetails => ({
  slug: 'scrunchie-teste',
  sku: 'scr-tst',
  name: 'Scrunchie Teste',
  description: '',
  category: ProductCategory.SCRUNCHIE,
  priceCents: 4990,
  compareAtPriceCents: null,
  colorName: null,
  colorHex: '#6a7b6c',
  badge: null,
  imageUrl: 'https://img/x.png',
  hoverImageUrl: null,
  gallery: [],
  kit: null,
  minStock: 2,
  isActive: true,
  sortOrder: 0,
  weightGrams: 60,
  lengthCm: 16,
  widthCm: 11,
  heightCm: 4,
  ...over,
})

describe('Product', () => {
  it('nasce sem estoque e normaliza SKU e cor', () => {
    const p = Product.create(details())
    expect(p.stock).toBe(0)
    expect(p.sku).toBe('SCR-TST')
    expect(p.colorHex).toBe('#6A7B6C')
  })

  it('rejeita dados inválidos com mensagem por campo', () => {
    try {
      Product.create(details({ slug: 'Slug Inválido', priceCents: -1 }))
      fail('deveria lançar')
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      expect(Object.keys((e as ValidationError).fields)).toEqual(expect.arrayContaining(['slug', 'price']))
    }
  })

  it('só aceita detalhes de kit na categoria kit', () => {
    const kit = { tag: 't', contents: 'c', perks: [], note: 'n' }
    expect(() => Product.create(details({ kit }))).toThrow(ValidationError)
    expect(() => Product.create(details({ kit, category: ProductCategory.KIT }))).not.toThrow()
  })

  it('entrada e saída atualizam o saldo e geram o movimento', () => {
    const p = Product.create(details())
    p.moveStock(StockMovementType.ENTRADA, 10)
    const out = p.moveStock(StockMovementType.SAIDA, 4, { reason: ' Venda ', by: 'admin-1' })
    expect(p.stock).toBe(6)
    expect(out).toMatchObject({ quantity: 4, balanceAfter: 6, reason: 'Venda', createdBy: 'admin-1' })
  })

  it('nunca deixa o estoque negativo', () => {
    const p = Product.create(details())
    p.moveStock(StockMovementType.ENTRADA, 3)
    expect(() => p.moveStock(StockMovementType.SAIDA, 4)).toThrow(InsufficientStockError)
    expect(p.stock).toBe(3)
  })

  it('sinaliza estoque baixo e disponibilidade', () => {
    const p = Product.create(details({ minStock: 2 }))
    p.moveStock(StockMovementType.ENTRADA, 2)
    expect(p.isLowStock).toBe(true)
    expect(p.canFulfill(2)).toBe(true)
    expect(p.canFulfill(3)).toBe(false)
    p.update({ isActive: false })
    expect(p.canFulfill(1)).toBe(false)
  })

  describe('preço De/Por', () => {
    it('aceita preço "De" maior que o atual e marca como promoção', () => {
      const p = Product.create(details({ compareAtPriceCents: 6990 }))
      expect(p.compareAtPriceCents).toBe(6990)
      expect(p.isOnSale).toBe(true)
    })

    it('recusa preço "De" menor ou igual ao atual', () => {
      expect(() => Product.create(details({ compareAtPriceCents: 4990 }))).toThrow(ValidationError)
      expect(() => Product.create(details({ compareAtPriceCents: 3000 }))).toThrow(ValidationError)
    })

    it('zero ou vazio remove a promoção', () => {
      const p = Product.create(details({ compareAtPriceCents: 6990 }))
      p.update({ compareAtPriceCents: null })
      expect(p.isOnSale).toBe(false)
      expect(Product.create(details({ compareAtPriceCents: 0 })).compareAtPriceCents).toBeNull()
    })

    it('baixar o "De" abaixo do novo preço é bloqueado', () => {
      const p = Product.create(details({ compareAtPriceCents: 6990 }))
      expect(() => p.update({ priceCents: 7990 })).toThrow(ValidationError)
    })
  })
})
