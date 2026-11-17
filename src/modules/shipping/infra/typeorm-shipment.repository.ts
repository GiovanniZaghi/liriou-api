import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Shipment, ShipmentRepository } from '../domain/shipment'
import { ShipmentOrmEntity } from './shipment.orm-entity'

@Injectable()
export class TypeOrmShipmentRepository extends ShipmentRepository {
  constructor(@InjectRepository(ShipmentOrmEntity) private readonly repo: Repository<ShipmentOrmEntity>) {
    super()
  }

  async save(shipment: Shipment) {
    await this.repo.save(shipment.toSnapshot())
  }

  async findByOrder(orderId: string) {
    const row = await this.repo.findOneBy({ orderId })
    return row ? Shipment.restore(row) : null
  }

  async findByProviderId(providerId: string) {
    const row = await this.repo.findOneBy({ providerId })
    return row ? Shipment.restore(row) : null
  }
}
