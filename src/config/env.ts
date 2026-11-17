import { plainToInstance, Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MinLength, validateSync } from 'class-validator'

/** Lê o valor bruto (`obj[key]`): a conversão implícita já teria transformado "false" em true. */
const toBool = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key]
  return raw === true || raw === 'true' || raw === '1'
}

/** Variáveis de ambiente aceitas pela API — validadas no boot (falha cedo se faltar algo). */
export class Env {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development'

  @IsInt()
  APP_PORT: number = 3333

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3000'

  /** Nº de proxies à frente da API (0 = acesso direto) */
  @IsInt()
  TRUST_PROXY: number = 0

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  @IsInt()
  DATABASE_POOL_MAX: number = 10

  @Transform(toBool)
  @IsBoolean()
  DATABASE_MIGRATIONS_RUN: boolean = false

  @Transform(toBool)
  @IsBoolean()
  DATABASE_LOGGING: boolean = false

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET precisa de pelo menos 32 caracteres' })
  JWT_SECRET: string

  @IsString()
  JWT_EXPIRES_IN: string = '8h'

  @IsOptional()
  @IsString()
  ADMIN_NAME?: string

  @IsOptional()
  @IsString()
  ADMIN_EMAIL?: string

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string

  /** Access Token do Mercado Pago (sem ele, a API recusa pagamentos com 503) */
  @IsOptional()
  @IsString()
  MP_ACCESS_TOKEN?: string

  /** Assinatura secreta dos webhooks do Mercado Pago (valida o header x-signature) */
  @IsOptional()
  @IsString()
  MP_WEBHOOK_SECRET?: string

  /** Token da conta Frenet (cotação e rastreio). Sem ele o checkout não calcula frete. */
  @IsOptional()
  @IsString()
  FRENET_TOKEN?: string

  /** Token de parceiro da Frenet (x-partner-token): necessário só para gerar etiquetas */
  @IsOptional()
  @IsString()
  FRENET_PARTNER_TOKEN?: string

  /** CEP de origem dos envios (de onde a loja posta) */
  @IsOptional()
  @IsString()
  FRENET_SELLER_CEP?: string

  /** Chave secreta na URL do webhook de rastreio (?key=...) */
  @IsOptional()
  @IsString()
  FRENET_WEBHOOK_KEY?: string

  /** Base da API da Frenet (padrão: https://api.frenet.com.br) */
  @IsOptional()
  @IsString()
  FRENET_API_URL?: string

  /** Base da API de etiquetas da Frenet (padrão: https://whitelabel.frenet.com.br/v1) */
  @IsOptional()
  @IsString()
  FRENET_WHITELABEL_URL?: string

  /** URL pública da API (ex.: https://api.liriou.com.br/api/v1), usada nos webhooks */
  @IsOptional()
  @IsString()
  PUBLIC_API_URL?: string
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true })
  const errors = validateSync(env, { skipMissingProperties: false })
  if (errors.length) {
    const detail = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n  ')
    throw new Error(`Variáveis de ambiente inválidas:\n  ${detail}`)
  }
  return env
}
