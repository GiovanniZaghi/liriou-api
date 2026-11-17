import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { GetImageUseCase, UploadImageUseCase } from './application/images.use-cases'
import { ImageRepository } from './domain/image.repository'
import { ImageOrmEntity } from './infra/image.orm-entity'
import { TypeOrmImageRepository } from './infra/typeorm-image.repository'
import { AdminImagesController, ImagesController } from './presentation/http/images.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ImageOrmEntity]), AuthModule],
  controllers: [ImagesController, AdminImagesController],
  providers: [
    // Porta → adaptador: trocar para S3/R2 no futuro mexe só nesta linha
    { provide: ImageRepository, useClass: TypeOrmImageRepository },
    UploadImageUseCase,
    GetImageUseCase,
  ],
})
export class MediaModule {}
