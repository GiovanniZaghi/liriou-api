import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { timingSafeEqual } from 'node:crypto'
import type { Env } from '../../../../config/env'
import { toReais } from '../../../../shared/domain/money'
import { isoDate } from '../../../../shared/presentation/http/format'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import {
  CreateShipmentUseCase,
  GetShipmentUseCase,
  RecordTrackingUseCase,
  RefreshLabelUseCase,
  type ShipmentView,
} from '../../application/shipments.use-cases'
import { toEvent } from '../../infra/frenet.gateway'

function presentShipmentView({ order, shipment, canCreate, blockedReason, labelsEnabled }: ShipmentView) {
  const s = order.shippingOption
  return {
    orderId: order.id,
    orderNumber: order.number,
    shipping: {
      label: s.label,
      carrier: s.carrier,
      service: s.service,
      deliveryDays: s.deliveryDays,
      /** O que a cliente pagou */
      charged: toReais(order.totals.shippingCents),
      /** Custo cotado na transportadora */
      quoted: s.quotedPriceCents === null ? null : toReais(s.quotedPriceCents),
    },
    labelsEnabled,
    canCreate,
    blockedReason,
    shipment: shipment && {
      id: shipment.id,
      providerId: shipment.providerId,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      labelUrl: shipment.labelUrl,
      declarationUrl: shipment.declarationUrl,
      lastEvent: shipment.lastEvent,
      createdAt: isoDate(shipment.createdAt),
      updatedAt: isoDate(shipment.updatedAt),
    },
  }
}

@ApiTags('Admin · Envios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/orders/:orderId/shipment')
export class AdminShipmentsController {
  constructor(
    private readonly getShipment: GetShipmentUseCase,
    private readonly createShipment: CreateShipmentUseCase,
    private readonly refreshLabel: RefreshLabelUseCase,
  ) {}

  /** Frete do pedido, etiqueta e último evento de rastreio */
  @Get()
  async get(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return presentShipmentView(await this.getShipment.execute(orderId))
  }

  /** Gera a etiqueta na Frenet (usa o saldo da conta Frenet) */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return presentShipmentView(await this.createShipment.execute(orderId))
  }

  /** Renova os links da etiqueta/declaração */
  @Post('refresh')
  async refresh(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return presentShipmentView(await this.refreshLabel.execute(orderId))
  }
}

interface FrenetTrackingPayload {
  ShipmentId?: number | string
  TrackingNumber?: string
  TrackingUrl?: string
  TrackingEvents?: Record<string, unknown>[]
}

/** Webhook de rastreio da Frenet (URL enviada na criação da etiqueta, com ?key= secreta). */
@Controller('webhooks/frenet')
@SkipThrottle()
export class FrenetWebhookController {
  private readonly key?: string

  constructor(
    private readonly record: RecordTrackingUseCase,
    config: ConfigService<Env, true>,
  ) {
    this.key = config.get('FRENET_WEBHOOK_KEY', { infer: true }) || undefined
  }

  @Post('tracking')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async tracking(@Query('key') key: string | undefined, @Body() body: FrenetTrackingPayload) {
    if (!this.key || !key || key.length !== this.key.length || !timingSafeEqual(Buffer.from(key), Buffer.from(this.key))) {
      throw new ForbiddenException()
    }
    if (body?.ShipmentId == null) return { received: true }
    await this.record.execute({
      shipmentId: String(body.ShipmentId),
      trackingNumber: body.TrackingNumber ?? null,
      trackingUrl: body.TrackingUrl ?? null,
      event: body.TrackingEvents?.length ? toEvent(body.TrackingEvents.at(-1)!) : undefined,
    })
    return { received: true }
  }
}
