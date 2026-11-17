import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaymentMethod } from '../../../domain/payment'

export class CardDataDto {
  /** Token do cartão gerado no navegador pelo MercadoPago.js (o número do cartão nunca passa pela API) */
  @IsString()
  @IsNotEmpty({ message: 'Token do cartão ausente' })
  @MaxLength(100)
  token: string

  /** Bandeira (payment_method_id do Mercado Pago: visa, master, elo...) */
  @IsString()
  @Matches(/^[a-z_]{2,30}$/, { message: 'Bandeira inválida' })
  brand: string

  @IsInt({ message: 'Parcelas inválidas' })
  @Min(1)
  @Max(24)
  installments: number
}

export class StartPaymentDto {
  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida' })
  method: PaymentMethod

  @IsOptional()
  @ValidateNested()
  @Type(() => CardDataDto)
  card?: CardDataDto
}
