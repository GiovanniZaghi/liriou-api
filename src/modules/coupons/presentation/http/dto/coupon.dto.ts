import { PartialType } from '@nestjs/swagger'
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationQueryDto } from '../../../../../shared/presentation/http/pagination-query.dto'
import { DiscountType } from '../../../domain/coupon'

export class CreateCouponDto {
  /** Ex.: LIRIOU10 (salvo em maiúsculas) */
  @IsString()
  @MaxLength(30)
  code: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null

  @IsEnum(DiscountType)
  type: DiscountType

  /** percent: 1–100 (%) · fixed: valor em reais (ex.: 20) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number

  /** Pedido mínimo em reais (0 = sem mínimo) */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minSubtotal?: number

  /** ISO 8601. Vazio = vale desde já */
  @IsOptional()
  @IsDateString()
  startsAt?: string | null

  /** ISO 8601. Vazio = sem data de fim */
  @IsOptional()
  @IsDateString()
  endsAt?: string | null

  /** Vazio = usos ilimitados */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ListCouponsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string
}
