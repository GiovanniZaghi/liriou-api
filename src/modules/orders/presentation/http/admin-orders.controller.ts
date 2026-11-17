import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { PaginationQueryDto } from '../../../../shared/presentation/http/pagination-query.dto'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import type { AdminOrderDetail, AdminOrderRow } from '../../application/admin-orders.query'
import {
  GetAdminOrderUseCase,
  GetOrdersSummaryUseCase,
  ListAdminOrdersUseCase,
} from '../../application/admin-orders.use-cases'
import { OrderStatus } from '../../domain/order'

export class ListAdminOrdersQueryDto extends PaginationQueryDto {
  /** Número do pedido, nome, e-mail, telefone ou CPF */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus

  /** true = pagos que ainda não têm etiqueta */
  @IsOptional()
  @Transform(({ obj }) => obj.toShip === true || obj.toShip === 'true')
  @IsBoolean()
  toShip?: boolean

  @IsOptional()
  @IsEmail()
  email?: string
}

export function presentAdminOrderRow(o: AdminOrderRow) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    customer: o.customer,
    city: o.city,
    state: o.state,
    itemCount: o.itemCount,
    total: toReais(o.totalCents),
    payment: o.payment,
    shipment: o.shipment,
    createdAt: isoDate(new Date(o.createdAt)),
  }
}

function presentAdminOrderDetail(o: AdminOrderDetail) {
  return {
    ...presentAdminOrderRow(o),
    customer: o.customer,
    shippingAddress: o.shippingAddress,
    shippingLabel: o.shippingLabel,
    couponCode: o.couponCode,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      image: i.image,
      unitPrice: toReais(i.unitPriceCents),
      quantity: i.quantity,
      lineTotal: toReais(i.unitPriceCents * i.quantity),
    })),
    totals: {
      subtotal: toReais(o.totals.subtotalCents),
      discount: toReais(o.totals.discountCents),
      shipping: toReais(o.totals.shippingCents),
      total: toReais(o.totals.totalCents),
    },
    payments: o.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      statusDetail: p.statusDetail,
      amount: toReais(p.amountCents),
      installments: p.installments,
      createdAt: isoDate(new Date(p.createdAt)),
    })),
    updatedAt: isoDate(new Date(o.updatedAt)),
  }
}

/** Pedidos para o dashboard: indicadores, lista com filtros e detalhe completo. */
@ApiTags('Admin · Pedidos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly getSummary: GetOrdersSummaryUseCase,
    private readonly listOrders: ListAdminOrdersUseCase,
    private readonly getOrder: GetAdminOrderUseCase,
  ) {}

  /** Declarado antes de :id para não colidir com a rota */
  @Get('summary')
  async summary() {
    const { paidValueCents, awaitingValueCents, ...counts } = await this.getSummary.execute()
    return { ...counts, paidValue: toReais(paidValueCents), awaitingValue: toReais(awaitingValueCents) }
  }

  @Get()
  async list(@Query() { page, pageSize, ...filters }: ListAdminOrdersQueryDto) {
    return presentPaginated(await this.listOrders.execute({ filters, page: { page, pageSize } }), presentAdminOrderRow)
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return presentAdminOrderDetail(await this.getOrder.execute(id))
  }
}
