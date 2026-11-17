import 'reflect-metadata'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { buildTypeOrmOptions } from './typeorm.options'

config({ quiet: true })

/** DataSource usado só pela CLI do TypeORM (npm run migration:*) e pelos seeds. */
export default new DataSource(
  buildTypeOrmOptions({
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    DATABASE_LOGGING: process.env.DATABASE_LOGGING === 'true',
  }),
)
