import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export interface AuthenticatedAdmin {
  id: string
  name: string
  email: string
}

/** Admin autenticado pelo JwtAuthGuard. */
export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedAdmin => ctx.switchToHttp().getRequest().admin,
)
