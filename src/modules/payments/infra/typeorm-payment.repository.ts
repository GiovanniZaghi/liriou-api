import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Payment } from '../domain/payment'
import { PaymentRepository } from '../domain/payment.repository'
import { PaymentOrmEntity } from './payment.orm-entity'

@Injectable()
export class TypeOrmPaymentRepository extends PaymentRepository {
  constructor(@InjectRepository(PaymentOrmEntity) private readonly repo: Repository<PaymentOrmEntity>) {
    super()
  }

  async save(p: Payment) {
    await this.repo.save({
      id: p.id,
      orderId: p.orderId,
      method: p.method,
      status: p.status,
      statusDetail: p.statusDetail,
      amountCents: p.amountCents,
      installments: p.installments,
      gatewayOrderId: p.gatewayOrderId,
      ...p.instructions,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })
  }

  async findLatestByOrder(orderId: string) {
    const row = await this.repo.findOne({ where: { orderId }, order: { createdAt: 'DESC' } })
    return row ? toDomain(row) : null
  }

  async findByGatewayOrderId(gatewayOrderId: string) {
    const row = await this.repo.findOneBy({ gatewayOrderId })
    return row ? toDomain(row) : null
  }
}

function toDomain(r: PaymentOrmEntity): Payment {
  return Payment.restore({
    id: r.id,
    orderId: r.orderId,
    method: r.method,
    status: r.status,
    statusDetail: r.statusDetail,
    amountCents: r.amountCents,
    installments: r.installments,
    gatewayOrderId: r.gatewayOrderId,
    instructions: {
      qrCode: r.qrCode,
      qrCodeBase64: r.qrCodeBase64,
      ticketUrl: r.ticketUrl,
      digitableLine: r.digitableLine,
      expiresAt: r.expiresAt,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })
}
