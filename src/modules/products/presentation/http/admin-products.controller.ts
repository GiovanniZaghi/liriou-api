import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { PaginationQueryDto } from '../../../../shared/presentation/http/pagination-query.dto'
import { CurrentAdmin, type AuthenticatedAdmin } from '../../../auth/presentation/http/current-admin.decorator'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '../../application/use-cases/manage-products.use-cases'
import { toReais } from '../../../../shared/domain/money'
import {
  GetInventorySummaryUseCase,
  ListStockMovementsUseCase,
  RegisterStockMovementUseCase,
} from '../../application/use-cases/stock.use-cases'
import { CreateProductDto, CreateStockMovementDto, ListProductsQueryDto, UpdateProductDto } from './dto/product.dto'
import {
  presentAdminProduct,
  presentStockMovement,
  toProductChanges,
  toProductDetails,
} from './product.presenter'

/** CRUD de produtos + estoque, para o dashboard. */
@ApiTags('Admin · Produtos e estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly deleteProduct: DeleteProductUseCase,
    private readonly registerMovement: RegisterStockMovementUseCase,
    private readonly listMovements: ListStockMovementsUseCase,
    private readonly getSummary: GetInventorySummaryUseCase,
  ) {}

  @Get()
  async list(@Query() { page, pageSize, ...filters }: ListProductsQueryDto) {
    const result = await this.listProducts.execute({ filters, page: { page, pageSize } })
    return presentPaginated(result, presentAdminProduct)
  }

  /** Indicadores do estoque (declarado antes de :id para não colidir com a rota) */
  @Get('summary')
  async summary() {
    const { inventoryValueCents, ...rest } = await this.getSummary.execute()
    return { ...rest, inventoryValue: toReais(inventoryValueCents) }
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return presentAdminProduct(await this.getProduct.execute(id))
  }

  @Post()
  async create(@Body() dto: CreateProductDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    const product = await this.createProduct.execute({
      details: toProductDetails(dto),
      initialStock: dto.initialStock,
      adminId: admin.id,
    })
    return presentAdminProduct(product)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return presentAdminProduct(await this.updateProduct.execute({ id, changes: toProductChanges(dto) }))
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteProduct.execute(id)
  }

  @Post(':id/stock-movements')
  async moveStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    const { product, movement } = await this.registerMovement.execute({ productId: id, ...dto, adminId: admin.id })
    return { product: presentAdminProduct(product), movement: presentStockMovement(movement) }
  }

  @Get(':id/stock-movements')
  async movements(@Param('id', ParseUUIDPipe) id: string, @Query() page: PaginationQueryDto) {
    const result = await this.listMovements.execute({ productId: id, page })
    return presentPaginated(result, presentStockMovement)
  }
}
