import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class PaginationQueryDto {
  /** Página (começa em 1) */
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1

  /** Itens por página (máx. 100) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20
}
