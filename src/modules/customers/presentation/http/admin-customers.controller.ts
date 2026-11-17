import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { PaginationQueryDto } from '../../../../shared/presentation/http/pagination-query.dto'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import type { CustomerDetail, CustomerRow, CustomerSegment } from '../../application/customers.query'
import { GetCustomerUseCase, GetJourneyFunnelUseCase, ListCustomersUseCase } from '../../application/customers.use-cases'

const SEGMENTS: CustomerSegment[] = ['buyers', 'not_bought']

export class ListCustomersQueryDto extends PaginationQueryDto {
  /** Nome, e-mail, telefone ou CPF */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsIn(SEGMENTS)
  segment?: CustomerSegment
}

export class CustomerDetailQueryDto {
  @IsEmail()
  email: string
}

const isoOrNull = (d: Date | null) => (d ? isoDate(new Date(d)) : null)

function presentRow(r: CustomerRow) {
  return {
    email: r.email,
    name: r.name,
    phone: r.phone,
    city: r.city,
    state: r.state,
    ordersCount: r.ordersCount,
    paidOrdersCount: r.paidOrdersCount,
    totalSpent: toReais(r.totalSpentCents),
    lastOrderAt: isoOrNull(r.lastOrderAt),
    openCartsCount: r.openCartsCount,
    openCartsValue: toReais(r.openCartsValueCents),
    firstSeenAt: isoDate(new Date(r.firstSeenAt)),
    lastActivityAt: isoDate(new Date(r.lastActivityAt)),
  }
}

function presentDetail(d: CustomerDetail) {
  return {
    ...presentRow(d),
    cpf: d.cpf,
    address: d.address,
    orders: d.orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      itemCount: o.itemCount,
      total: toReais(o.totalCents),
      shipmentStatus: o.shipmentStatus,
      createdAt: isoDate(new Date(o.createdAt)),
    })),
    openCarts: d.openCarts.map((c) => ({
      cartId: c.cartId,
      stage: c.stage,
      itemCount: c.itemCount,
      value: toReais(c.valueCents),
      items: c.items,
      lastActivityAt: isoDate(new Date(c.lastActivityAt)),
    })),
  }
}

/** Clientes: uma por e-mail, com todos os pedidos e sacolas que não viraram pedido. */
@ApiTags('Admin · Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    private readonly funnel: GetJourneyFunnelUseCase,
    private readonly listCustomers: ListCustomersUseCase,
    private readonly getCustomer: GetCustomerUseCase,
  ) {}

  @Get('funnel')
  async getFunnel() {
    const { orderedValueCents, openValueCents, ...counts } = await this.funnel.execute()
    return { ...counts, orderedValue: toReais(orderedValueCents), openValue: toReais(openValueCents) }
  }

  /** E-mail na query (e não no caminho) para não brigar com @, + e pontos na URL */
  @Get('detail')
  async detail(@Query() { email }: CustomerDetailQueryDto) {
    return presentDetail(await this.getCustomer.execute(email))
  }

  @Get()
  async list(@Query() { page, pageSize, ...filters }: ListCustomersQueryDto) {
    return presentPaginated(await this.listCustomers.execute({ filters, page: { page, pageSize } }), presentRow)
  }
}
