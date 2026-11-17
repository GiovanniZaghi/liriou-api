import { ValidationError } from '../../../shared/domain/domain-error'
import { MAX_IMAGE_BYTES, StoredImage, detectImageType } from './image'

const pad = (head: number[] | string) =>
  Buffer.concat([typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head), Buffer.alloc(16)])

describe('detectImageType', () => {
  it.each([
    ['image/jpeg', pad([0xff, 0xd8, 0xff, 0xe0])],
    ['image/png', pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', pad('RIFF\0\0\0\0WEBP')],
    ['image/gif', pad('GIF89a')],
    ['image/avif', pad('\0\0\0\x20ftypavif')],
  ])('reconhece %s pela assinatura', (type, data) => {
    expect(detectImageType(data)).toBe(type)
  })

  it('recusa o que não é imagem, mesmo com nome de imagem', () => {
    expect(detectImageType(pad('%PDF-1.7'))).toBeNull()
    expect(detectImageType(Buffer.from('<svg></svg>'))).toBeNull()
  })
})

describe('StoredImage.upload', () => {
  it('guarda tipo, tamanho e checksum', () => {
    const data = pad([0xff, 0xd8, 0xff, 0xe0])
    const img = StoredImage.upload(data)
    expect(img.mimeType).toBe('image/jpeg')
    expect(img.sizeBytes).toBe(data.length)
    expect(img.checksum).toMatch(/^[0-9a-f]{64}$/)
  })

  it('recusa arquivo vazio, grande demais ou de outro formato', () => {
    expect(() => StoredImage.upload(Buffer.alloc(0))).toThrow(ValidationError)
    expect(() => StoredImage.upload(Buffer.concat([pad([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_IMAGE_BYTES)]))).toThrow(
      ValidationError,
    )
    expect(() => StoredImage.upload(pad('%PDF-1.7'))).toThrow(ValidationError)
  })
})
