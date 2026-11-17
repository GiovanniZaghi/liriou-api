import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../../../app.module'
import type { Env } from '../../../config/env'
import { CreateAdminUseCase } from '../../../modules/auth/application/auth.use-cases'
import { AdminUserRepository } from '../../../modules/auth/domain/ports'
import { CreateProductUseCase } from '../../../modules/products/application/use-cases/manage-products.use-cases'
import { ProductRepository } from '../../../modules/products/domain/product.repository'
import { CATALOG_SEED } from './catalog.seed'

/**
 * Seeds idempotentes (pode rodar várias vezes): cria só o que ainda não existe.
 * Usa os próprios casos de uso, então as regras de domínio valem aqui também.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] })
  const log = new Logger('Seed')
  try {
    const config = app.get<ConfigService<Env, true>>(ConfigService)

    const email = config.get('ADMIN_EMAIL', { infer: true })
    const password = config.get('ADMIN_PASSWORD', { infer: true })
    if (!email || !password) {
      log.warn('ADMIN_EMAIL/ADMIN_PASSWORD não definidos: admin não criado')
    } else if (await app.get(AdminUserRepository).findByEmail(email.toLowerCase())) {
      log.log(`Admin ${email} já existe`)
    } else {
      await app.get(CreateAdminUseCase).execute({ name: config.get('ADMIN_NAME') ?? 'Admin', email, password })
      log.log(`Admin ${email} criado`)
    }

    const products = app.get(ProductRepository)
    const createProduct = app.get(CreateProductUseCase)
    for (const { details, initialStock } of CATALOG_SEED) {
      if (await products.findBySlug(details.slug)) continue
      await createProduct.execute({ details, initialStock })
      log.log(`Produto "${details.name}" criado com ${initialStock} un.`)
    }
    log.log('Seed concluído')
  } finally {
    await app.close()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
