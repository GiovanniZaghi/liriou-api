import { createHash, randomUUID } from 'node:crypto'
import { ValidationError } from '../../../shared/domain/domain-error'

/** Teto por arquivo. O dashboard já comprime antes de enviar, então o normal fica bem abaixo disso. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif'

export interface ImageProps {
  id: string
  mimeType: ImageMimeType
  sizeBytes: number
  /** SHA-256 do conteúdo: vira o ETag e evita guardar o mesmo arquivo duas vezes */
  checksum: string
  data: Buffer
  createdAt: Date
}

/**
 * Tipo real do arquivo pelos primeiros bytes (assinatura), sem confiar
 * no Content-Type nem na extensão que o navegador mandou.
 */
export function detectImageType(data: Buffer): ImageMimeType | null {
  if (data.length < 12) return null
  const ascii = (start: number, end: number) => data.subarray(start, end).toString('latin1')
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(0, 4) === 'GIF8') return 'image/gif'
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif'
  return null
}

const TOO_BIG = 'Imagem muito grande (máx. 5 MB)'
const UNSUPPORTED = 'Formato não suportado. Use JPG, PNG, WebP, GIF ou AVIF'

/** Imagem guardada no próprio banco (poucos produtos: não compensa um storage externo). */
export class StoredImage {
  private constructor(private readonly props: ImageProps) {}

  static upload(data: Buffer): StoredImage {
    if (!data.length) throw new ValidationError({ file: 'Envie um arquivo de imagem' }, 'Envie um arquivo de imagem')
    if (data.length > MAX_IMAGE_BYTES) throw new ValidationError({ file: TOO_BIG }, TOO_BIG)
    const mimeType = detectImageType(data)
    if (!mimeType) throw new ValidationError({ file: UNSUPPORTED }, UNSUPPORTED)

    return new StoredImage({
      id: randomUUID(),
      mimeType,
      sizeBytes: data.length,
      checksum: createHash('sha256').update(data).digest('hex'),
      data,
      createdAt: new Date(),
    })
  }

  static restore(props: ImageProps): StoredImage {
    return new StoredImage(props)
  }

  get id() { return this.props.id }
  get mimeType() { return this.props.mimeType }
  get sizeBytes() { return this.props.sizeBytes }
  get checksum() { return this.props.checksum }
  get data() { return this.props.data }
  get createdAt() { return this.props.createdAt }

  toSnapshot(): ImageProps {
    return { ...this.props }
  }
}
