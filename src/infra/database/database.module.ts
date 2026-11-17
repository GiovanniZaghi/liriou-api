import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { Env } from '../../config/env'
import { buildTypeOrmOptions } from './typeorm.options'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildTypeOrmOptions({
          DATABASE_URL: config.get('DATABASE_URL'),
          DATABASE_POOL_MAX: config.get('DATABASE_POOL_MAX'),
          DATABASE_MIGRATIONS_RUN: config.get('DATABASE_MIGRATIONS_RUN'),
          DATABASE_LOGGING: config.get('DATABASE_LOGGING'),
        }),
    }),
  ],
})
export class DatabaseModule {}
