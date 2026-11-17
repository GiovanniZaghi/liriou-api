import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { MAX_DISTINCT_ITEMS, MAX_QUANTITY_PER_ITEM } from '../../../domain/cart'

export class CartItemDto {
  @IsUUID()
  productId: string

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity: number = 1
}

export class CreateCartDto {
  /** Itens iniciais (opcional) — ex.: migrar uma sacola salva só no navegador */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DISTINCT_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items?: CartItemDto[]
}

export class SetQuantityDto {
  /** 0 remove o item */
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity: number
}

export class ApplyCouponDto {
  @IsString()
  @MaxLength(40)
  code: string
}

export class QuoteShippingDto {
  /** CEP de destino (com ou sem hífen) */
  @IsString()
  @MaxLength(9)
  cep: string
}

export class SelectShippingDto extends QuoteShippingDto {
  /** Código do serviço retornado na cotação */
  @IsString()
  @MaxLength(40)
  serviceCode: string
}
