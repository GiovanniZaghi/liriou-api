import { join } from 'node:path'
import type { DataSourceOptions } from 'typeorm'

interface DbEnv {
  DATABASE_URL: string
  DATABASE_POOL_MAX?: number
  DATABASE_MIGRATIONS_RUN?: boolean
  DATABASE_LOGGING?: boolean
}

/**
 * Opções únicas do TypeORM, usadas pela API (DatabaseModule) e pela CLI de migrations (data-source.ts).
 * `synchronize` fica SEMPRE desligado: o schema só muda por migration.
 */
export function buildTypeOrmOptions(env: DbEnv): DataSourceOptions {
  const url = new URL(env.DATABASE_URL)
  // Parâmetro do libpq (Neon) que o driver pg não entende
  url.searchParams.delete('channel_binding')

  return {
    type: 'postgres',
    url: url.toString(),
    entities: [join(__dirname, '..', '..', 'modules', '**', '*.orm-entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: env.DATABASE_MIGRATIONS_RUN ?? false,
    synchronize: false,
    logging: env.DATABASE_LOGGING ? ['query', 'error'] : ['error'],
    extra: { max: env.DATABASE_POOL_MAX ?? 10 },
  }
}
