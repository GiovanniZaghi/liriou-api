import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CouponsModule } from '../coupons/coupons.module'
import { ProductsModule } from '../products/products.module'
import { ShippingModule } from '../shipping/shipping.module'
import { CartShippingQuoter } from './application/cart-shipping'
import { CartViewAssembler } from './application/cart-view.assembler'
import {
  AddCartItemUseCase,
  ApplyCouponUseCase,
  CartItemPolicy,
  CartMutator,
  CreateCartUseCase,
  GetCartUseCase,
  QuoteShippingUseCase,
  RemoveCartItemUseCase,
  RemoveCouponUseCase,
  SetGiftWrapUseCase,
  SaveCheckoutCustomerUseCase,
  SaveCheckoutDeliveryUseCase,
  SelectShippingUseCase,
  SetCartItemQuantityUseCase,
} from './application/cart.use-cases'
import { CartRepository } from './domain/cart.repository'
import { StoreSettings } from './domain/store-settings'
import { CartItemOrmEntity, CartOrmEntity } from './infra/cart.orm-entity'
import { TypeOrmCartRepository } from './infra/typeorm-cart.repository'
import { CartsController, StoreController } from './presentation/http/carts.controller'

@Module({
  imports: [TypeOrmModule.forFeature([CartOrmEntity, CartItemOrmEntity]), ProductsModule, CouponsModule, ShippingModule],
  controllers: [CartsController, StoreController],
  providers: [
    { provide: CartRepository, useClass: TypeOrmCartRepository },
    { provide: StoreSettings, useValue: StoreSettings.default() },
    CartViewAssembler,
    CartMutator,
    CartItemPolicy,
    CreateCartUseCase,
    GetCartUseCase,
    AddCartItemUseCase,
    SetCartItemQuantityUseCase,
    RemoveCartItemUseCase,
    ApplyCouponUseCase,
    RemoveCouponUseCase,
    SetGiftWrapUseCase,
    SelectShippingUseCase,
    QuoteShippingUseCase,
    CartShippingQuoter,
    SaveCheckoutCustomerUseCase,
    SaveCheckoutDeliveryUseCase,
  ],
  // O checkout (OrdersModule) lê a sacola precificada, recota o frete e marca a sacola como convertida
  exports: [CartRepository, CartViewAssembler, CartShippingQuoter, StoreSettings, CouponsModule, ShippingModule],
})
export class CartModule {}
