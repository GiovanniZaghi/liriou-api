import type { AdminUser } from './admin-user'

export abstract class AdminUserRepository {
  abstract findById(id: string): Promise<AdminUser | null>
  abstract findByEmail(email: string): Promise<AdminUser | null>
  abstract save(user: AdminUser): Promise<void>
}

/** Hash de senha (implementação: bcrypt). */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>
  abstract compare(plain: string, hash: string): Promise<boolean>
}

export interface AccessTokenPayload {
  sub: string
  email: string
}

export interface IssuedToken {
  token: string
  expiresAt: Date
}

/** Emissão/validação de tokens de acesso (implementação: JWT). */
export abstract class TokenService {
  abstract issue(payload: AccessTokenPayload): Promise<IssuedToken>
  /** Lança UnauthorizedError se o token for inválido ou expirado */
  abstract verify(token: string): Promise<AccessTokenPayload>
}
