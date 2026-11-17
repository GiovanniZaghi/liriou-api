import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import {
  CreateCouponUseCase,
  DeleteCouponUseCase,
  GetCouponUseCase,
  ListCouponsUseCase,
  UpdateCouponUseCase,
} from './application/coupons.use-cases'
import { CouponRepository } from './domain/coupon.repository'
import { CouponOrmEntity } from './infra/coupon.orm-entity'
import { TypeOrmCouponRepository } from './infra/typeorm-coupon.repository'
import { AdminCouponsController } from './presentation/http/admin-coupons.controller'

@Module({
  imports: [TypeOrmModule.forFeature([CouponOrmEntity]), AuthModule],
  controllers: [AdminCouponsController],
  providers: [
    { provide: CouponRepository, useClass: TypeOrmCouponRepository },
    ListCouponsUseCase,
    GetCouponUseCase,
    CreateCouponUseCase,
    UpdateCouponUseCase,
    DeleteCouponUseCase,
  ],
  // A sacola e o checkout validam/aplicam cupons por aqui
  exports: [CouponRepository],
})
export class CouponsModule {}
