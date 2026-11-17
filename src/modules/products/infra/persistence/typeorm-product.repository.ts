import { Injectable } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { Brackets, DataSource, In, QueryFailedError, Repository, type SelectQueryBuilder } from 'typeorm'
import { pageOffset, type Paginated, type PageRequest } from '../../../../shared/application/pagination'
import { escapeLike } from '../../../../shared/infra/persistence/escape-like'
import type { Product } from '../../domain/product'
import { ProductAlreadyExistsError, ProductNotFoundError } from '../../domain/product.errors'
import { ProductRepository, type InventorySummary, type ProductFilters } from '../../domain/product.repository'
import type { StockMovement } from '../../domain/stock-movement'
import { ProductMapper, StockMovementMapper } from './product.mapper'
import { ProductOrmEntity } from './product.orm-entity'
import { StockMovementOrmEntity } from './stock-movement.orm-entity'

const PG_UNIQUE_VIOLATION = '23505'

@Injectable()
export class TypeOrmProductRepository extends ProductRepository {
  constructor(
    @InjectRepository(ProductOrmEntity) private readonly repo: Repository<ProductOrmEntity>,
    @InjectRepository(StockMovementOrmEntity) private readonly movements: Repository<StockMovementOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super()
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id })
    return row ? ProductMapper.toDomain(row) : null
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return []
    const rows = await this.repo.findBy({ id: In(ids) })
    return rows.map(ProductMapper.toDomain)
  }

  async findBySlug(slug: string) {
    const row = await this.repo.findOneBy({ slug: slug.toLowerCase() })
    return row ? ProductMapper.toDomain(row) : null
  }

  async listCatalog(filters: Pick<ProductFilters, 'q' | 'category'>) {
    const qb = this.filtered({ ...filters, isActive: true })
      .orderBy('p.sortOrder', 'ASC')
      .addOrderBy('p.createdAt', 'ASC')
    return (await qb.getMany()).map(ProductMapper.toDomain)
  }

  async list(filters: ProductFilters, page: PageRequest): Promise<Paginated<Product>> {
    const [rows, total] = await this.filtered(filters)
      .orderBy('p.sortOrder', 'ASC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip(pageOffset(page))
      .take(page.pageSize)
      .getManyAndCount()
    return { items: rows.map(ProductMapper.toDomain), total, ...page }
  }

  async findTakenUniqueFields(slug: string, sku: string, ignoreId?: string) {
    const qb = this.repo
      .createQueryBuilder('p')
      .select(['p.slug', 'p.sku'])
      .where(new Brackets((w) => w.where('p.slug = :slug', { slug }).orWhere('p.sku = :sku', { sku })))
    if (ignoreId) qb.andWhere('p.id <> :ignoreId', { ignoreId })
    const rows = await qb.getMany()
    return { slug: rows.some((r) => r.slug === slug), sku: rows.some((r) => r.sku === sku) }
  }

  async save(product: Product) {
    try {
      await this.repo.save(ProductMapper.toOrm(product))
    } catch (err) {
      throw translateUniqueViolation(err)
    }
  }

  async softDelete(id: string) {
    await this.repo.softDelete({ id })
  }

  changeStock(productId: string, change: (product: Product) => StockMovement) {
    return this.dataSource.transaction(async (em) => {
      // SELECT ... FOR UPDATE: segura a linha até o commit, serializando movimentações do mesmo produto
      const row = await em
        .getRepository(ProductOrmEntity)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :productId', { productId })
        .getOne()
      if (!row) throw new ProductNotFoundError()

      const product = ProductMapper.toDomain(row)
      const movement = change(product)

      await em.getRepository(ProductOrmEntity).update({ id: product.id }, { stock: product.stock })
      await em.getRepository(StockMovementOrmEntity).insert(StockMovementMapper.toOrm(movement))
      return { product, movement }
    })
  }

  async listMovements(productId: string, page: PageRequest): Promise<Paginated<StockMovement>> {
    const [rows, total] = await this.movements.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      skip: pageOffset(page),
      take: page.pageSize,
    })
    return { items: rows.map(StockMovementMapper.toDomain), total, ...page }
  }

  async summary(): Promise<InventorySummary> {
    const row = await this.repo
      .createQueryBuilder('p')
      .select('count(*)::int', 'totalProducts')
      .addSelect('count(*) filter (where p.is_active)::int', 'activeProducts')
      .addSelect('count(*) filter (where p.stock <= p.min_stock)::int', 'lowStock')
      .addSelect('count(*) filter (where p.stock = 0)::int', 'outOfStock')
      .addSelect('coalesce(sum(p.stock), 0)::int', 'unitsInStock')
      .addSelect('coalesce(sum(p.stock::bigint * p.price_cents), 0)::bigint', 'inventoryValueCents')
      .getRawOne<Record<keyof InventorySummary, number | string>>()
    return {
      totalProducts: Number(row?.totalProducts ?? 0),
      activeProducts: Number(row?.activeProducts ?? 0),
      lowStock: Number(row?.lowStock ?? 0),
      outOfStock: Number(row?.outOfStock ?? 0),
      unitsInStock: Number(row?.unitsInStock ?? 0),
      inventoryValueCents: Number(row?.inventoryValueCents ?? 0),
    }
  }

  private filtered({ q, category, isActive, lowStock }: ProductFilters): SelectQueryBuilder<ProductOrmEntity> {
    const qb = this.repo.createQueryBuilder('p')
    if (q?.trim()) {
      const term = `%${escapeLike(q.trim())}%`
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('p.name ILIKE :term', { term })
            .orWhere('p.sku ILIKE :term', { term })
            .orWhere('p.colorName ILIKE :term', { term }),
        ),
      )
    }
    if (category) qb.andWhere('p.category = :category', { category })
    if (isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive })
    if (lowStock) qb.andWhere('p.stock <= p.minStock')
    return qb
  }
}

function translateUniqueViolation(err: unknown) {
  if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
    const constraint = (err.driverError as { constraint?: string }).constraint ?? ''
    return new ProductAlreadyExistsError(constraint.includes('sku') ? 'sku' : 'slug')
  }
  return err
}
