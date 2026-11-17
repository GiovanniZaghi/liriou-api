import { OmitType, PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginationQueryDto } from '../../../../../shared/presentation/http/pagination-query.dto'
import { ProductCategory } from '../../../domain/product-category'
import { StockMovementType } from '../../../domain/stock-movement'

/** Query string chega como texto: 'false' viraria true numa conversão ingênua. */
const queryBool = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const v = obj[key]
  return v === undefined || v === '' ? undefined : v === true || v === 'true' || v === '1'
}

const URL_OPTS = { require_tld: false, protocols: ['http', 'https'] }

export class KitDetailsDto {
  @IsString()
  @MaxLength(40)
  tag: string

  @IsString()
  @MaxLength(300)
  contents: string

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  perks: string[]

  @IsString()
  @MaxLength(80)
  note: string
}

export class CreateProductDto {
  /** Identificador amigável na URL (ex.: scrunchie-classica-salvia) */
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug: use só letras minúsculas, números e hífens' })
  @MaxLength(120)
  slug: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sku: string

  @IsString()
  @MaxLength(160)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsEnum(ProductCategory)
  category: ProductCategory

  /** Preço em reais (ex.: 49.9) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number

  @IsOptional()
  @IsString()
  @MaxLength(80)
  colorName?: string | null

  @IsOptional()
  @IsHexColor()
  colorHex?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badge?: string | null

  @IsUrl(URL_OPTS, { message: 'Envie a foto principal' })
  imageUrl: string

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'Link da foto inválido' })
  hoverImageUrl?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12, { message: 'A galeria aceita até 12 fotos' })
  @IsUrl(URL_OPTS, { each: true, message: 'Há um link inválido na galeria' })
  gallery?: string[]

  /** Só para a categoria "kit" */
  @IsOptional()
  @ValidateNested()
  @Type(() => KitDetailsDto)
  kit?: KitDetailsDto | null

  /** Alerta de estoque baixo quando o estoque chegar neste valor */
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  /** Ordem na vitrine (menor aparece primeiro) */
  @IsOptional()
  @IsInt()
  sortOrder?: number

  /** Peso para o frete, em gramas (padrão 100) */
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number

  /** Comprimento da embalagem em cm (padrão 16) */
  @IsOptional()
  @IsInt()
  @Min(1)
  lengthCm?: number

  /** Largura da embalagem em cm (padrão 11) */
  @IsOptional()
  @IsInt()
  @Min(1)
  widthCm?: number

  /** Altura da embalagem em cm (padrão 4) */
  @IsOptional()
  @IsInt()
  @Min(1)
  heightCm?: number

  /** Quantidade inicial em estoque (gera uma movimentação de entrada) */
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number
}

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['initialStock'] as const)) {}

export class ListProductsQueryDto extends PaginationQueryDto {
  /** Busca por nome, SKU ou cor */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  isActive?: boolean

  /** Só itens com estoque <= estoque mínimo */
  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  lowStock?: boolean
}

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory
}

export class CreateStockMovementDto {
  @IsEnum(StockMovementType)
  type: StockMovementType

  @IsInt()
  @Min(1)
  quantity: number

  /** Ex.: "Compra fornecedor", "Venda Instagram", "Avaria" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}
