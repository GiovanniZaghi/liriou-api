import { Injectable } from '@nestjs/common'
import type { UseCase } from '../../../shared/application/use-case'
import { NotFoundError } from '../../../shared/domain/domain-error'
import { StoredImage } from '../domain/image'
import { ImageRepository } from '../domain/image.repository'

@Injectable()
export class UploadImageUseCase implements UseCase<Buffer, StoredImage> {
  constructor(private readonly images: ImageRepository) {}

  async execute(data: Buffer) {
    const image = StoredImage.upload(data)
    const existing = await this.images.findByChecksum(image.checksum)
    if (existing) return existing
    await this.images.save(image)
    return image
  }
}

@Injectable()
export class GetImageUseCase implements UseCase<string, StoredImage> {
  constructor(private readonly images: ImageRepository) {}

  async execute(id: string) {
    const image = await this.images.findById(id)
    if (!image) throw new NotFoundError('Imagem não encontrada', 'IMAGE_NOT_FOUND')
    return image
  }
}
