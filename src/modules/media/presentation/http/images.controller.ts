import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import type { Env } from '../../../../config/env'
import { ValidationError } from '../../../../shared/domain/domain-error'
import { API_PREFIX, normalizePublicApiUrl } from '../../../../shared/infra/public-api-url'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import { GetImageUseCase, UploadImageUseCase } from '../../application/images.use-cases'
import { MAX_IMAGE_BYTES } from '../../domain/image'

/** Só o que usamos do arquivo do multer (evita depender de @types/multer). */
interface UploadedImageFile {
  buffer: Buffer
}

/** Upload de fotos pelo dashboard. */
@ApiTags('Admin · Imagens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/images')
export class AdminImagesController {
  constructor(
    private readonly upload: UploadImageUseCase,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  // Acima do limite o multer recusa (413) antes de ler o arquivo inteiro na memória
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async create(@UploadedFile() file: UploadedImageFile | undefined, @Req() req: Request) {
    if (!file) throw new ValidationError({ file: 'Envie um arquivo de imagem' }, 'Envie um arquivo de imagem')
    const image = await this.upload.execute(file.buffer)
    return {
      id: image.id,
      url: `${this.publicBase(req)}/images/${image.id}`,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
    }
  }

  /** URL absoluta: o produto guarda o link pronto e a vitrine usa direto no <img>. */
  private publicBase(req: Request) {
    return (
      normalizePublicApiUrl(this.config.get('PUBLIC_API_URL', { infer: true })) ??
      `${req.protocol}://${req.get('host')}${API_PREFIX}`
    )
  }
}

/** Entrega pública das fotos (vitrine e dashboard). */
@ApiTags('Imagens')
@SkipThrottle()
@Controller('images')
export class ImagesController {
  constructor(private readonly getImage: GetImageUseCase) {}

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const image = await this.getImage.execute(id)
    const etag = `"${image.checksum}"`
    // O conteúdo de um id nunca muda: navegador e CDN podem guardar para sempre
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('ETag', etag)
    // O helmet bloqueia por padrão o uso em outro domínio; a loja (Vercel) precisa exibir a foto
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    if (ifNoneMatch === etag) {
      res.status(304)
      return
    }
    return new StreamableFile(image.data, { type: image.mimeType, length: image.sizeBytes })
  }
}
