import { Type } from 'class-transformer'
import { IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator'
import { AddressDto, CustomerDto } from '../../../../cart/presentation/http/dto/checkout.dto'

export class PlaceOrderDto {
  @IsUUID()
  cartId: string

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto

  @IsString()
  @MaxLength(40)
  shippingOptionId: string
}
