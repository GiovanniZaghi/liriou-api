import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  AddCartItemUseCase,
  ApplyCouponUseCase,
  CreateCartUseCase,
  GetCartUseCase,
  QuoteShippingUseCase,
  RemoveCartItemUseCase,
  RemoveCouponUseCase,
  SaveCheckoutCustomerUseCase,
  SaveCheckoutDeliveryUseCase,
  SelectShippingUseCase,
  SetCartItemQuantityUseCase,
  SetGiftWrapUseCase,
} from '../../application/cart.use-cases'
import { SaveCheckoutCustomerDto, SaveCheckoutDeliveryDto } from './dto/checkout.dto'
import { StoreSettings } from '../../domain/store-settings'
import { presentCart, presentShippingQuote, presentStoreSettings } from './cart.presenter'
import { ApplyCouponDto, CartItemDto, CreateCartDto, QuoteShippingDto, SelectShippingDto, SetGiftWrapDto, SetQuantityDto } from './dto/cart.dto'

/**
 * Sacola anônima. O id (UUID v4, impossível de adivinhar) funciona como credencial:
 * o front guarda no localStorage e recupera a sacola quando a cliente volta ao site.
 */
@ApiTags('Sacola')
@Controller('carts')
export class CartsController {
  constructor(
    private readonly createCart: CreateCartUseCase,
    private readonly getCart: GetCartUseCase,
    private readonly addItem: AddCartItemUseCase,
    private readonly setQuantity: SetCartItemQuantityUseCase,
    private readonly removeItem: RemoveCartItemUseCase,
    private readonly applyCoupon: ApplyCouponUseCase,
    private readonly removeCoupon: RemoveCouponUseCase,
    private readonly selectShipping: SelectShippingUseCase,
    private readonly quoteShippingUseCase: QuoteShippingUseCase,
    private readonly saveCustomer: SaveCheckoutCustomerUseCase,
    private readonly saveDelivery: SaveCheckoutDeliveryUseCase,
    private readonly setGiftWrap: SetGiftWrapUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@Body() dto: CreateCartDto) {
    return presentCart(await this.createCart.execute(dto))
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return presentCart(await this.getCart.execute(id))
  }

  /** Soma `quantity` à quantidade atual do produto */
  @Post(':id/items')
  async add(@Param('id', ParseUUIDPipe) cartId: string, @Body() dto: CartItemDto) {
    return presentCart(await this.addItem.execute({ cartId, ...dto }))
  }

  /** Define a quantidade exata (0 remove) */
  @Put(':id/items/:productId')
  async set(
    @Param('id', ParseUUIDPipe) cartId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() { quantity }: SetQuantityDto,
  ) {
    return presentCart(await this.setQuantity.execute({ cartId, productId, quantity }))
  }

  @Delete(':id/items/:productId')
  async remove(@Param('id', ParseUUIDPipe) cartId: string, @Param('productId', ParseUUIDPipe) productId: string) {
    return presentCart(await this.removeItem.execute({ cartId, productId }))
  }

  @Put(':id/coupon')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async coupon(@Param('id', ParseUUIDPipe) cartId: string, @Body() { code }: ApplyCouponDto) {
    return presentCart(await this.applyCoupon.execute({ cartId, code }))
  }

  @Delete(':id/coupon')
  async dropCoupon(@Param('id', ParseUUIDPipe) cartId: string) {
    return presentCart(await this.removeCoupon.execute(cartId))
  }

  /** Embalagem de Natal (sim/não) */
  @Put(':id/gift-wrap')
  async giftWrap(@Param('id', ParseUUIDPipe) cartId: string, @Body() { giftWrap }: SetGiftWrapDto) {
    return presentCart(await this.setGiftWrap.execute({ cartId, giftWrap }))
  }

  /** Opções de frete (transportadora, preço e prazo) para o CEP, com o peso real da sacola */
  @Post(':id/shipping/quote')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async quoteShipping(@Param('id', ParseUUIDPipe) cartId: string, @Body() { cep }: QuoteShippingDto) {
    const { cep: normalized, options, view } = await this.quoteShippingUseCase.execute({ cartId, cep })
    const free = view.pricing.freeShipping
    return { cep: normalized, freeShipping: free, options: options.map((o) => presentShippingQuote(o, free)) }
  }

  /** Escolhe o frete (a API recota e grava o preço da transportadora) */
  @Put(':id/shipping')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async shipping(@Param('id', ParseUUIDPipe) cartId: string, @Body() { cep, serviceCode }: SelectShippingDto) {
    return presentCart(await this.selectShipping.execute({ cartId, cep, serviceCode }))
  }

  /** Checkout etapa 1 concluída (registra quem é a cliente para o acompanhamento no dashboard) */
  @Put(':id/checkout/customer')
  async checkoutCustomer(@Param('id', ParseUUIDPipe) cartId: string, @Body() customer: SaveCheckoutCustomerDto) {
    return presentCart(await this.saveCustomer.execute({ cartId, customer }))
  }

  /** Checkout etapa 2 concluída (endereço + frete) */
  @Put(':id/checkout/delivery')
  async checkoutDelivery(@Param('id', ParseUUIDPipe) cartId: string, @Body() dto: SaveCheckoutDeliveryDto) {
    return presentCart(
      await this.saveDelivery.execute({
        cartId,
        address: { ...dto.address, complement: dto.address.complement ?? null },
        shippingOptionId: dto.shippingOptionId,
      }),
    )
  }
}

/** Regras públicas da loja que o front exibe (frete grátis, parcelas, opções de envio). */
@ApiTags('Loja')
@Controller('store')
export class StoreController {
  constructor(private readonly settings: StoreSettings) {}

  @Get('settings')
  @Header('Cache-Control', 'public, max-age=300')
  get() {
    return presentStoreSettings(this.settings)
  }
}
