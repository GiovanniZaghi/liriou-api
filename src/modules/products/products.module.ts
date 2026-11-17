import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { GetCatalogProductUseCase, ListCatalogProductsUseCase } from './application/use-cases/catalog.use-cases'
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from './application/use-cases/manage-products.use-cases'
import {
  GetInventorySummaryUseCase,
  ListStockMovementsUseCase,
  RegisterStockMovementUseCase,
} from './application/use-cases/stock.use-cases'
import { ProductRepository } from './domain/product.repository'
import { ProductOrmEntity } from './infra/persistence/product.orm-entity'
import { StockMovementOrmEntity } from './infra/persistence/stock-movement.orm-entity'
import { TypeOrmProductRepository } from './infra/persistence/typeorm-product.repository'
import { AdminProductsController } from './presentation/http/admin-products.controller'
import { CatalogController } from './presentation/http/catalog.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ProductOrmEntity, StockMovementOrmEntity]), AuthModule],
  controllers: [CatalogController, AdminProductsController],
  providers: [
    // Porta → adaptador: trocar de ORM/banco mexe só nesta linha
    { provide: ProductRepository, useClass: TypeOrmProductRepository },
    ListCatalogProductsUseCase,
    GetCatalogProductUseCase,
    ListProductsUseCase,
    GetProductUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    DeleteProductUseCase,
    RegisterStockMovementUseCase,
    ListStockMovementsUseCase,
    GetInventorySummaryUseCase,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
