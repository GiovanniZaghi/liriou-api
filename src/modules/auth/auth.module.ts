import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { Env } from '../../config/env'
import { AuthenticateTokenUseCase, CreateAdminUseCase, LoginUseCase } from './application/auth.use-cases'
import { AdminUserRepository, PasswordHasher, TokenService } from './domain/ports'
import { AdminUserOrmEntity } from './infra/admin-user.orm-entity'
import { BcryptPasswordHasher, JwtTokenService, TypeOrmAdminUserRepository } from './infra/auth.adapters'
import { AuthController } from './presentation/http/auth.controller'
import { JwtAuthGuard } from './presentation/http/jwt-auth.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUserOrmEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AdminUserRepository, useClass: TypeOrmAdminUserRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    { provide: TokenService, useClass: JwtTokenService },
    LoginUseCase,
    AuthenticateTokenUseCase,
    CreateAdminUseCase,
    JwtAuthGuard,
  ],
  // Guard (e o caso de uso de que depende) ficam disponíveis para os módulos com rotas /admin
  exports: [JwtAuthGuard, AuthenticateTokenUseCase, CreateAdminUseCase],
})
export class AuthModule {}
