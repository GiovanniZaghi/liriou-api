import { BadRequestException, Logger, ValidationPipe, type ValidationError } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'
import type { Env } from './config/env'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get<ConfigService<Env, true>>(ConfigService)

  app.setGlobalPrefix('api/v1')
  // A API é consumida de outro domínio (loja na Vercel): fotos e respostas não podem ficar presas à mesma origem
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  // Atrás de proxy/load balancer (Render, Railway, Vercel...), para o rate limit ver o IP real
  if (config.get('TRUST_PROXY') > 0) app.set('trust proxy', config.get('TRUST_PROXY'))
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGIN')
      .split(',')
      // O navegador manda o Origin sem barra final; normaliza para "https://site.com/" também casar
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Mesmo formato do ValidationError do domínio: { code, message, errors: { campo: mensagem } }
      exceptionFactory: (errors) => {
        const fields = flattenValidationErrors(errors)
        return new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: Object.values(fields)[0] ?? 'Dados inválidos',
          errors: fields,
        })
      },
    }),
  )
  app.enableShutdownHooks()

  if (config.get('NODE_ENV') !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Líriou API')
      .setDescription('Catálogo, sacola, estoque e lista VIP')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc))
  }

  const port = config.get('APP_PORT')
  await app.listen(port)
  Logger.log(`API em http://localhost:${port}/api/v1 · docs em http://localhost:${port}/docs`, 'Bootstrap')
}

/** Erros aninhados viram chaves com ponto (ex.: "kit.tag"); fica a 1ª mensagem de cada campo. */
function flattenValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of errors) {
    const key = prefix + e.property
    const first = Object.values(e.constraints ?? {})[0]
    if (first) out[key] = first
    if (e.children?.length) Object.assign(out, flattenValidationErrors(e.children, `${key}.`))
  }
  return out
}

void bootstrap()
