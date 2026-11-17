import { randomUUID } from 'node:crypto'
import { ValidationError } from '../../../shared/domain/domain-error'

export interface AdminUserProps {
  id: string
  name: string
  email: string
  passwordHash: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Usuário do dashboard (equipe Líriou). */
export class AdminUser {
  private constructor(private props: AdminUserProps) {}

  static create(input: { name: string; email: string; passwordHash: string }): AdminUser {
    const email = AdminUser.normalizeEmail(input.email)
    const errors: Record<string, string> = {}
    if (input.name.trim().length < 2) errors.name = 'Informe o nome'
    if (!EMAIL_RE.test(email)) errors.email = 'Informe um e-mail válido'
    if (Object.keys(errors).length) throw new ValidationError(errors)

    const now = new Date()
    return new AdminUser({
      id: randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: input.passwordHash,
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: AdminUserProps): AdminUser {
    return new AdminUser(props)
  }

  static normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  recordLogin(): void {
    this.props = { ...this.props, lastLoginAt: new Date() }
  }

  get id() { return this.props.id }
  get name() { return this.props.name }
  get email() { return this.props.email }
  get passwordHash() { return this.props.passwordHash }
  get isActive() { return this.props.isActive }
  get lastLoginAt() { return this.props.lastLoginAt }
  get createdAt() { return this.props.createdAt }
  get updatedAt() { return this.props.updatedAt }

  toSnapshot(): Readonly<AdminUserProps> {
    return { ...this.props }
  }
}
