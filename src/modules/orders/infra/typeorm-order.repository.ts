import { Injectable } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Order } from '../domain/order'
import { OrderRepository } from '../domain/order.repository'
import { OrderItemOrmEntity, OrderOrmEntity } from './order.orm-entity'

@Injectable()
export class TypeOrmOrderRepository extends OrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity) private readonly orders: Repository<OrderOrmEntity>,
    @InjectRepository(OrderItemOrmEntity) private readonly items: Repository<OrderItemOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super()
  }

  async nextNumber() {
    const [{ n }] = await this.dataSource.query(`SELECT nextval('order_number_seq')::int AS n`)
    return n as number
  }

  async save(order: Order) {
    await this.dataSource.transaction(async (em) => {
      await em.getRepository(OrderOrmEntity).save({
        id: order.id,
        number: order.number,
        status: order.status,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        customerCpf: order.customer.cpf,
        customerPhone: order.customer.phone,
        shippingAddress: order.shippingAddress,
        shippingOptionId: order.shippingOption.id,
        shippingOptionLabel: order.shippingOption.label,
        shippingDetails: (({ id: _id, label: _label, ...details }) => details)(order.shippingOption),
        couponCode: order.couponCode,
        giftWrap: order.giftWrap,
        ...order.totals,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })
      await em.getRepository(OrderItemOrmEntity).delete({ orderId: order.id })
      await em.getRepository(OrderItemOrmEntity).insert(order.items.map((i) => ({ ...i, orderId: order.id })))
    })
  }

  async updateStatus(order: Order) {
    await this.orders.update({ id: order.id }, { status: order.status, updatedAt: order.updatedAt })
  }

  async findById(id: string) {
    const [row, lines] = await Promise.all([this.orders.findOneBy({ id }), this.items.findBy({ orderId: id })])
    if (!row) return null
    return Order.restore({
      id: row.id,
      number: row.number,
      status: row.status,
      customer: { name: row.customerName, email: row.customerEmail, cpf: row.customerCpf, phone: row.customerPhone },
      shippingAddress: row.shippingAddress,
      shippingOption: {
        id: row.shippingOptionId,
        label: row.shippingOptionLabel,
        carrier: row.shippingDetails?.carrier ?? null,
        carrierCode: row.shippingDetails?.carrierCode ?? null,
        service: row.shippingDetails?.service ?? null,
        deliveryDays: row.shippingDetails?.deliveryDays ?? null,
        quotedPriceCents: row.shippingDetails?.quotedPriceCents ?? null,
      },
      couponCode: row.couponCode,
      giftWrap: row.giftWrap,
      items: lines.map(({ orderId: _o, ...item }) => item),
      totals: {
        subtotalCents: row.subtotalCents,
        discountCents: row.discountCents,
        shippingCents: row.shippingCents,
        totalCents: row.totalCents,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
