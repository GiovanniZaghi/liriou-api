import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { toCents, toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import {
  CreateCouponUseCase,
  DeleteCouponUseCase,
  GetCouponUseCase,
  ListCouponsUseCase,
  UpdateCouponUseCase,
} from '../../application/coupons.use-cases'
import { DiscountType, type Coupon, type CouponDetails } from '../../domain/coupon'
import { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from './dto/coupon.dto'

export function presentCoupon(c: Coupon) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    /** percent: % · fixed: reais */
    value: c.type === DiscountType.FIXED ? toReais(c.value) : c.value,
    minSubtotal: toReais(c.minSubtotalCents),
    startsAt: c.startsAt ? isoDate(c.startsAt) : null,
    endsAt: c.endsAt ? isoDate(c.endsAt) : null,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    isActive: c.isActive,
    status: c.status(),
    createdAt: isoDate(c.createdAt),
    updatedAt: isoDate(c.updatedAt),
  }
}

/** DTO (reais, ISO) → domínio (centavos, Date). Só os campos enviados. */
function toDetails(dto: UpdateCouponDto, type: DiscountType | undefined): Partial<CouponDetails> {
  const d: Partial<CouponDetails> = {}
  if (dto.code !== undefined) d.code = dto.code
  if (dto.description !== undefined) d.description = dto.description
  if (dto.type !== undefined) d.type = dto.type
  if (dto.value !== undefined) d.value = (dto.type ?? type) === DiscountType.FIXED ? toCents(dto.value) : Math.round(dto.value)
  if (dto.minSubtotal !== undefined) d.minSubtotalCents = toCents(dto.minSubtotal)
  if (dto.startsAt !== undefined) d.startsAt = dto.startsAt ? new Date(dto.startsAt) : null
  if (dto.endsAt !== undefined) d.endsAt = dto.endsAt ? new Date(dto.endsAt) : null
  if (dto.maxUses !== undefined) d.maxUses = dto.maxUses ?? null
  if (dto.isActive !== undefined) d.isActive = dto.isActive
  return d
}

@ApiTags('Admin · Cupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(
    private readonly listCoupons: ListCouponsUseCase,
    private readonly getCoupon: GetCouponUseCase,
    private readonly createCoupon: CreateCouponUseCase,
    private readonly updateCoupon: UpdateCouponUseCase,
    private readonly deleteCoupon: DeleteCouponUseCase,
  ) {}

  @Get()
  async list(@Query() { page, pageSize, q }: ListCouponsQueryDto) {
    return presentPaginated(await this.listCoupons.execute({ q, page: { page, pageSize } }), presentCoupon)
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return presentCoupon(await this.getCoupon.execute(id))
  }

  @Post()
  async create(@Body() dto: CreateCouponDto) {
    const details = toDetails(dto, dto.type)
    return presentCoupon(
      await this.createCoupon.execute({
        code: dto.code,
        type: dto.type,
        value: details.value!,
        description: details.description ?? null,
        minSubtotalCents: details.minSubtotalCents ?? 0,
        startsAt: details.startsAt ?? null,
        endsAt: details.endsAt ?? null,
        maxUses: details.maxUses ?? null,
        isActive: details.isActive ?? true,
      }),
    )
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    const current = await this.getCoupon.execute(id)
    return presentCoupon(await this.updateCoupon.execute({ id, changes: toDetails(dto, current.type) }))
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteCoupon.execute(id)
  }
}
