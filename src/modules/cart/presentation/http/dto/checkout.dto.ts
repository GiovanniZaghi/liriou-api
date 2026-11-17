import { IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

/** Formato/tamanho aqui; regras (CPF, UF, nome e sobrenome...) no domínio, com mensagens por campo. */
export class CustomerDto {
  @IsString()
  @MaxLength(120)
  name: string

  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @MaxLength(254)
  email: string

  @IsString()
  @MaxLength(20)
  cpf: string

  @IsString()
  @MaxLength(20)
  phone: string
}

export class AddressDto {
  @IsString()
  @MaxLength(9)
  cep: string

  @IsString()
  @MaxLength(160)
  street: string

  @IsString()
  @MaxLength(20)
  number: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complement?: string | null

  @IsString()
  @MaxLength(120)
  district: string

  @IsString()
  @MaxLength(120)
  city: string

  @IsString()
  @MaxLength(2)
  state: string

  @IsString()
  @MaxLength(120)
  recipient: string
}

export class SaveCheckoutCustomerDto extends CustomerDto {}

export class SaveCheckoutDeliveryDto {
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto

  @IsString()
  @MaxLength(40)
  shippingOptionId: string
}
