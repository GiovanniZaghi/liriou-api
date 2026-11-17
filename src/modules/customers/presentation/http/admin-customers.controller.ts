import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { PaginationQueryDto } from '../../../../shared/presentation/http/pagination-query.dto'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import { CheckoutStage } from '../../../cart/domain/cart'
import type { JourneyDetail, JourneyRow } from '../../application/customer-journey.query'
import {
  GetCustomerJourneyUseCase,
  GetJourneyFunnelUseCase,
  ListCustomerJourneysUseCase,
} from '../../application/customers.use-cases'

export class ListJourneysQueryDto extends PaginationQueryDto {
  /** Nome, e-mail, telefone ou CPF */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsEnum(CheckoutStage)
  stage?: CheckoutStage
}

const isoOrNull = (d: Date | null) => (d ? isoDate(new Date(d)) : null)

function presentRow(r: JourneyRow) {
  return {
    cartId: r.cartId,
    stage: r.stage,
    customer: r.customer,
    city: r.city,
    state: r.state,
    itemCount: r.itemCount,
    value: toReais(r.valueCents),
    order: r.order ? { id: r.order.id, number: r.order.number, status: r.order.status, total: toReais(r.order.totalCents) } : null,
    createdAt: isoDate(new Date(r.createdAt)),
    lastActivityAt: isoDate(new Date(r.lastActivityAt)),
  }
}

/** Acompanhamento das clientes: funil do checkout, onde cada uma parou e o que tinha na sacola. */
@ApiTags('Admin · Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    private readonly funnel: GetJourneyFunnelUseCase,
    private readonly listJourneys: ListCustomerJourneysUseCase,
    private readonly getJourney: GetCustomerJourneyUseCase,
  ) {}

  @Get('funnel')
  async getFunnel() {
    const { orderedValueCents, openValueCents, ...counts } = await this.funnel.execute()
    return { ...counts, orderedValue: toReais(orderedValueCents), openValue: toReais(openValueCents) }
  }

  @Get()
  async list(@Query() { page, pageSize, ...filters }: ListJourneysQueryDto) {
    return presentPaginated(await this.listJourneys.execute({ filters, page: { page, pageSize } }), presentRow)
  }

  @Get(':cartId')
  async get(@Param('cartId', ParseUUIDPipe) cartId: string) {
    const d: JourneyDetail = await this.getJourney.execute(cartId)
    const subtotalCents = d.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0)
    return {
      ...presentRow(d),
      shippingAddress: d.shippingAddress,
      shippingOption: d.orderShippingLabel ?? d.cartShippingLabel,
      couponCode: d.couponCode,
      items: d.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        sku: i.sku,
        image: i.image,
        unitPrice: toReais(i.unitPriceCents),
        quantity: i.quantity,
        lineTotal: toReais(i.unitPriceCents * i.quantity),
      })),
      totals: d.orderTotals
        ? {
            subtotal: toReais(d.orderTotals.subtotalCents),
            discount: toReais(d.orderTotals.discountCents),
            shipping: toReais(d.orderTotals.shippingCents),
            total: toReais(d.orderTotals.totalCents),
          }
        : { subtotal: toReais(subtotalCents), discount: 0, shipping: null, total: toReais(subtotalCents) },
      timeline: {
        createdAt: isoDate(new Date(d.timeline.createdAt)),
        identifiedAt: isoOrNull(d.timeline.identifiedAt),
        deliveryAt: isoOrNull(d.timeline.deliveryAt),
        orderedAt: isoOrNull(d.timeline.orderedAt),
      },
      otherSessions: d.otherSessions.map((s) => ({
        cartId: s.cartId,
        stage: s.stage,
        value: toReais(s.valueCents),
        order: s.order ? { id: s.order.id, number: s.order.number, status: s.order.status } : null,
        lastActivityAt: isoDate(new Date(s.lastActivityAt)),
      })),
    }
  }
}
