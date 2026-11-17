import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { PaginationQueryDto } from '../../../../../shared/presentation/http/pagination-query.dto'

/**
 * Validação só de formato/tamanho aqui; as regras (nome e sobrenome, celular com DDD...)
 * ficam no domínio (Lead.register), que devolve mensagens por campo para o formulário.
 */
export class JoinVipListDto {
  @IsString()
  @MaxLength(120)
  name: string

  @IsString()
  @MaxLength(254)
  email: string

  @IsString()
  @MaxLength(30)
  whatsapp: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pain?: string | null

  @IsBoolean()
  consent: boolean

  /** Parâmetros utm_* da URL de origem */
  @IsOptional()
  @IsObject()
  utm?: Record<string, string>
}

export class ListLeadsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  /** Valor da resposta, ou "none" para quem não respondeu */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pain?: string
}

export class ExportLeadsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pain?: string
}
