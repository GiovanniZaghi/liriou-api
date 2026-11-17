import type { Paginated, PageRequest } from '../../../shared/application/pagination'
import type { Product } from './product'
import type { ProductCategory } from './product-category'
import type { StockMovement } from './stock-movement'

export interface ProductFilters {
  q?: string
  category?: ProductCategory
  isActive?: boolean
  /** Só produtos com estoque <= estoque mínimo */
  lowStock?: boolean
}

/** Indicadores do estoque para o painel. */
export interface InventorySummary {
  totalProducts: number
  /** Ativos = visíveis na vitrine */
  activeProducts: number
  lowStock: number
  outOfStock: number
  unitsInStock: number
  /** Σ preço × estoque, em centavos */
  inventoryValueCents: number
}

/**
 * Porta de persistência (DIP): o domínio/aplicação dependem desta abstração,
 * a infraestrutura (TypeORM) fornece a implementação. Classe abstrata = token de DI do Nest.
 */
export abstract class ProductRepository {
  abstract findById(id: string): Promise<Product | null>
  abstract findByIds(ids: string[]): Promise<Product[]>
  abstract findBySlug(slug: string): Promise<Product | null>
  /** Produtos ativos, na ordem da vitrine */
  abstract listCatalog(filters: Pick<ProductFilters, 'q' | 'category'>): Promise<Product[]>
  abstract list(filters: ProductFilters, page: PageRequest): Promise<Paginated<Product>>
  /** Indica quais campos únicos já estão em uso (ignorando o próprio produto numa edição) */
  abstract findTakenUniqueFields(slug: string, sku: string, ignoreId?: string): Promise<{ slug: boolean; sku: boolean }>
  abstract save(product: Product): Promise<void>
  abstract softDelete(id: string): Promise<void>

  /**
   * Carrega o produto com lock de linha, aplica `change` (regra de domínio) e grava
   * produto + movimento na mesma transação. Evita corrida entre duas movimentações simultâneas.
   */
  abstract changeStock(
    productId: string,
    change: (product: Product) => StockMovement,
  ): Promise<{ product: Product; movement: StockMovement }>

  abstract listMovements(productId: string, page: PageRequest): Promise<Paginated<StockMovement>>

  abstract summary(): Promise<InventorySummary>
}
