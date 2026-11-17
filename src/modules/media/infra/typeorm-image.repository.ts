import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StoredImage, type ImageMimeType } from '../domain/image'
import { ImageRepository } from '../domain/image.repository'
import { ImageOrmEntity } from './image.orm-entity'

const toDomain = (row: ImageOrmEntity) => StoredImage.restore({ ...row, mimeType: row.mimeType as ImageMimeType })

@Injectable()
export class TypeOrmImageRepository extends ImageRepository {
  constructor(@InjectRepository(ImageOrmEntity) private readonly repo: Repository<ImageOrmEntity>) {
    super()
  }

  async save(image: StoredImage) {
    await this.repo.insert(image.toSnapshot())
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id })
    return row ? toDomain(row) : null
  }

  async findByChecksum(checksum: string) {
    const row = await this.repo.findOneBy({ checksum })
    return row ? toDomain(row) : null
  }
}
