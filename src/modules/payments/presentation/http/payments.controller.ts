import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import type { Env } from '../../../../config/env'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import {
  GetOrderPaymentUseCase,
  StartPaymentUseCase,
  SyncPaymentUseCase,
  type PaymentResult,
} from '../../application/payments.use-cases'
import { isValidMercadoPagoSignature } from '../../infra/mercado-pago-signature'
import { StartPaymentDto } from './dto/start-payment.dto'

function presentPayment({ payment: p, order }: PaymentResult) {
  return {
    id: p.id,
    orderId: p.orderId,
    orderStatus: order.status,
    method: p.method,
    status: p.status,
    statusDetail: p.statusDetail,
    amount: toReais(p.amountCents),
    installments: p.installments,
    pix: p.instructions.qrCode
      ? { qrCode: p.instructions.qrCode, qrCodeBase64: p.instructions.qrCodeBase64, ticketUrl: p.instructions.ticketUrl }
      : null,
    boleto:
      p.method === 'boleto' && p.instructions.ticketUrl
        ? { ticketUrl: p.instructions.ticketUrl, digitableLine: p.instructions.digitableLine }
        : null,
    expiresAt: p.instructions.expiresAt ? isoDate(p.instructions.expiresAt) : null,
    createdAt: isoDate(p.createdAt),
  }
}

@ApiTags('Checkout')
@Controller('orders/:orderId/payment')
export class PaymentsController {
  constructor(
    private readonly startPayment: StartPaymentUseCase,
    private readonly getPayment: GetOrderPaymentUseCase,
  ) {}

  /** Inicia o pagamento do pedido (Pix, cartão ou boleto) no Mercado Pago. */
  @Post()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async start(@Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: StartPaymentDto) {
    return presentPayment(await this.startPayment.execute({ orderId, method: dto.method, card: dto.card }))
  }

  /** Pagamento mais recente do pedido (a tela consulta enquanto aguarda o Pix). */
  @Get()
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async latest(@Param('orderId', ParseUUIDPipe) orderId: string) {
    const result = await this.getPayment.execute(orderId)
    return result ? presentPayment(result) : null
  }
}

/** Notificações do Mercado Pago (tópico "Order"). Configure a URL pública no painel da aplicação. */
@Controller('webhooks/mercadopago')
@SkipThrottle()
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name)
  private readonly secret?: string

  constructor(
    private readonly sync: SyncPaymentUseCase,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('MP_WEBHOOK_SECRET', { infer: true }) || undefined
  }

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async receive(
    @Body() body: { type?: string; data?: { id?: string } },
    @Query('data.id') queryDataId: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const dataId = queryDataId ?? body?.data?.id
    if (this.secret && !isValidMercadoPagoSignature({ secret: this.secret, signature, requestId, dataId })) {
      this.logger.warn('Webhook com assinatura inválida recusado')
      throw new ForbiddenException()
    }
    if (body?.type !== 'order' || !dataId) return { received: true }

    // O estado oficial é buscado no Mercado Pago; o corpo do webhook serve só como aviso
    await this.sync.execute(dataId)
    return { received: true }
  }
}
