import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcryptjs'
import { Repository } from 'typeorm'
import { UnauthorizedError } from '../../../shared/domain/domain-error'
import { AdminUser } from '../domain/admin-user'
import {
  AdminUserRepository,
  PasswordHasher,
  TokenService,
  type AccessTokenPayload,
  type IssuedToken,
} from '../domain/ports'
import { AdminUserOrmEntity } from './admin-user.orm-entity'

const BCRYPT_COST = 12

@Injectable()
export class TypeOrmAdminUserRepository extends AdminUserRepository {
  constructor(@InjectRepository(AdminUserOrmEntity) private readonly repo: Repository<AdminUserOrmEntity>) {
    super()
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id })
    return row ? AdminUser.restore({ ...row }) : null
  }

  async findByEmail(email: string) {
    const row = await this.repo.findOneBy({ email })
    return row ? AdminUser.restore({ ...row }) : null
  }

  async save(user: AdminUser) {
    await this.repo.save(Object.assign(new AdminUserOrmEntity(), user.toSnapshot()))
  }
}

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  hash(plain: string) {
    return bcrypt.hash(plain, BCRYPT_COST)
  }

  compare(plain: string, hash: string) {
    return bcrypt.compare(plain, hash)
  }
}

@Injectable()
export class JwtTokenService extends TokenService {
  constructor(private readonly jwt: JwtService) {
    super()
  }

  async issue(payload: AccessTokenPayload): Promise<IssuedToken> {
    const token = await this.jwt.signAsync(payload)
    const { exp } = this.jwt.decode<{ exp: number }>(token)
    return { token, expiresAt: new Date(exp * 1000) }
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const { sub, email } = await this.jwt.verifyAsync<AccessTokenPayload>(token)
      return { sub, email }
    } catch {
      throw new UnauthorizedError('Sessão inválida ou expirada', 'INVALID_TOKEN')
    }
  }
}
