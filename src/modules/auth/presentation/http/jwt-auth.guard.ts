import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { UnauthorizedError } from '../../../../shared/domain/domain-error'
import { AuthenticateTokenUseCase } from '../../application/auth.use-cases'
import type { AuthenticatedAdmin } from './current-admin.decorator'

/** Exige `Authorization: Bearer <token>` de um admin ativo. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateTokenUseCase) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { admin?: AuthenticatedAdmin }>()
    const [scheme, token] = (request.headers.authorization ?? '').split(' ')
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError()

    const admin = await this.authenticate.execute(token)
    request.admin = { id: admin.id, name: admin.name, email: admin.email }
    return true
  }
}
