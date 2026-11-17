import type { StoredImage } from './image'

export abstract class ImageRepository {
  abstract save(image: StoredImage): Promise<void>
  abstract findById(id: string): Promise<StoredImage | null>
  /** Mesmo conteúdo já enviado antes (reaproveita em vez de duplicar) */
  abstract findByChecksum(checksum: string): Promise<StoredImage | null>
}
