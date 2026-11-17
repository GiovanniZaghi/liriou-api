import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { GetOrderUseCase, PlaceOrderUseCase } from '../../application/orders.use-cases'
import type { Order } from '../../domain/order'
import { PlaceOrderDto } from './dto/checkout.dto'

/** CPF mascarado na resposta pública: só os 2 últimos dígitos aparecem */
const maskCpf = (cpf: string) => `***.***.***-${cpf.slice(-2)}`

export function presentOrder(o: Order) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    customer: { name: o.customer.name, email: o.customer.email, cpf: maskCpf(o.customer.cpf), phone: o.customer.phone },
    shippingAddress: o.shippingAddress,
    // Preço cotado na transportadora é dado interno: a cliente vê só rótulo e prazo
    shippingOption: { id: o.shippingOption.id, label: o.shippingOption.label, deliveryDays: o.shippingOption.deliveryDays },
    couponCode: o.couponCode,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      image: i.imageUrl,
      unitPrice: toReais(i.unitPriceCents),
      quantity: i.quantity,
      lineTotal: toReais(i.unitPriceCents * i.quantity),
    })),
    itemCount: o.itemCount,
    totals: {
      subtotal: toReais(o.totals.subtotalCents),
      discount: toReais(o.totals.discountCents),
      shipping: toReais(o.totals.shippingCents),
      total: toReais(o.totals.totalCents),
    },
    createdAt: isoDate(o.createdAt),
  }
}

@ApiTags('Checkout')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
  ) {}

  /** Finaliza a sacola em pedido "aguardando pagamento" (a sacola é removida). */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async place(@Body() dto: PlaceOrderDto) {
    return presentOrder(
      await this.placeOrder.execute({ ...dto, address: { ...dto.address, complement: dto.address.complement ?? null } }),
    )
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return presentOrder(await this.getOrder.execute(id))
  }
}
