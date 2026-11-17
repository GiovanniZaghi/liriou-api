import { Controller, Get, Header, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetCatalogProductUseCase, ListCatalogProductsUseCase } from '../../application/use-cases/catalog.use-cases'
import { CatalogQueryDto } from './dto/product.dto'
import { presentCatalogProduct } from './product.presenter'

/** Vitrine pública da loja. */
@ApiTags('Catálogo')
@Controller('catalog/products')
export class CatalogController {
  constructor(
    private readonly listCatalog: ListCatalogProductsUseCase,
    private readonly getCatalogProduct: GetCatalogProductUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  async list(@Query() query: CatalogQueryDto) {
    const products = await this.listCatalog.execute(query)
    return { data: products.map(presentCatalogProduct) }
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  async get(@Param('slug') slug: string) {
    return presentCatalogProduct(await this.getCatalogProduct.execute(slug))
  }
}
