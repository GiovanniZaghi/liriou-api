import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { isoDate } from '../../../../shared/presentation/http/format'
import { LoginUseCase } from '../../application/auth.use-cases'
import { CurrentAdmin, type AuthenticatedAdmin } from './current-admin.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'
import { LoginDto } from './login.dto'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}

  /** Login do dashboard. Limite: 5 tentativas por minuto por IP. */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signIn(@Body() dto: LoginDto) {
    const { admin, access } = await this.login.execute(dto)
    return {
      accessToken: access.token,
      expiresAt: isoDate(access.expiresAt),
      admin: { id: admin.id, name: admin.name, email: admin.email },
    }
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return admin
  }
}
