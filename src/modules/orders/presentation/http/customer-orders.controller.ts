import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsString, MaxLength } from 'class-validator'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { LookupCustomerOrdersUseCase } from '../../application/customer-orders.use-cases'

export class LookupCustomerOrdersDto {
  /** CPF usado na compra (com ou sem pontuação) */
  @IsString()
  @MaxLength(20)
  cpf: string
}

/**
 * Área da cliente sem cadastro: consulta pelo CPF.
 * POST (e não GET) para o CPF não ficar em URL, histórico ou logs de acesso.
 * Limite baixo de tentativas para dificultar varredura de CPFs.
 */
@ApiTags('Área da cliente')
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly lookup: LookupCustomerOrdersUseCase) {}

  @Post('lookup')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async find(@Body() { cpf }: LookupCustomerOrdersDto) {
    const { firstName, orders } = await this.lookup.execute(cpf)
    return {
      firstName,
      orders: orders.map((o) => ({
        number: o.number,
        status: o.status,
        stage: o.stage,
        total: toReais(o.totalCents),
        items: o.items,
        shipping: o.shipping,
        tracking: o.tracking,
        giftWrap: o.giftWrap,
        city: o.city,
        state: o.state,
        deliveredAt: o.deliveredAt ? isoDate(new Date(o.deliveredAt)) : null,
        createdAt: isoDate(new Date(o.createdAt)),
      })),
    }
  }
}
