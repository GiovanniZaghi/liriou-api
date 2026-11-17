import { Injectable } from '@nestjs/common'
import { ConflictError, UnauthorizedError, ValidationError } from '../../../shared/domain/domain-error'
import type { UseCase } from '../../../shared/application/use-case'
import { AdminUser } from '../domain/admin-user'
import { AdminUserRepository, PasswordHasher, TokenService, type IssuedToken } from '../domain/ports'

const INVALID_CREDENTIALS = () => new UnauthorizedError('E-mail ou senha incorretos', 'INVALID_CREDENTIALS')
export const MIN_PASSWORD_LENGTH = 10

@Injectable()
export class LoginUseCase implements UseCase<{ email: string; password: string }, { admin: AdminUser; access: IssuedToken }> {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: { email: string; password: string }) {
    const admin = await this.admins.findByEmail(AdminUser.normalizeEmail(email))
    // Compara mesmo sem usuário: o tempo de resposta não revela quais e-mails existem
    const ok = await this.hasher.compare(password, admin?.passwordHash ?? DUMMY_HASH)
    if (!admin || !ok || !admin.isActive) throw INVALID_CREDENTIALS()

    admin.recordLogin()
    await this.admins.save(admin)
    const access = await this.tokens.issue({ sub: admin.id, email: admin.email })
    return { admin, access }
  }
}

/** Resolve o admin de um token válido (usado pelo guard e por GET /auth/me). */
@Injectable()
export class AuthenticateTokenUseCase implements UseCase<string, AdminUser> {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(token: string) {
    const payload = await this.tokens.verify(token)
    const admin = await this.admins.findById(payload.sub)
    // Admin desativado perde o acesso na hora, mesmo com token ainda válido
    if (!admin || !admin.isActive) throw new UnauthorizedError()
    return admin
  }
}

/** Cria um admin (usado pelo seed; no futuro, por uma tela de equipe no dashboard). */
@Injectable()
export class CreateAdminUseCase implements UseCase<{ name: string; email: string; password: string }, AdminUser> {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute({ name, email, password }: { name: string; email: string; password: string }) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError({ password: `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres` })
    }
    if (await this.admins.findByEmail(AdminUser.normalizeEmail(email))) {
      throw new ConflictError('Já existe um admin com este e-mail', 'ADMIN_EMAIL_TAKEN')
    }
    const admin = AdminUser.create({ name, email, passwordHash: await this.hasher.hash(password) })
    await this.admins.save(admin)
    return admin
  }
}

// Hash bcrypt de uma senha aleatória descartada: só serve para gastar o mesmo tempo da comparação real
const DUMMY_HASH = '$2b$12$QwqBwfqrFgq.LXw49/4vk.VyDzwDiGlv9bKMPrfGqw5hAwV.B0.dq'
