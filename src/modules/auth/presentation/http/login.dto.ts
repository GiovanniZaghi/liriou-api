import { IsEmail, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @MaxLength(254)
  email: string

  @IsString()
  @MaxLength(200)
  password: string
}
