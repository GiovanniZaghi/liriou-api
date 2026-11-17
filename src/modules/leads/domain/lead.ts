import { randomUUID } from 'node:crypto'
import { ValidationError } from '../../../shared/domain/domain-error'

/** Respostas da pergunta "pesadelo ao acordar" (TODO: validar opções com a cliente). */
export const PAIN_OPTIONS = [
  { value: 'frizz', label: 'Frizz' },
  { value: 'marca-elastico', label: 'Marca de elástico' },
  { value: 'nos', label: 'Nós e fios embaraçados' },
  { value: 'quebra', label: 'Fios quebrados' },
  { value: 'volume', label: 'Cabelo amassado ou sem forma' },
] as const

export type Pain = (typeof PAIN_OPTIONS)[number]['value']

export const painLabel = (pain: string | null) =>
  pain ? (PAIN_OPTIONS.find((o) => o.value === pain)?.label ?? pain) : 'Não respondeu'

export interface LeadProps {
  id: string
  name: string
  /** Sempre minúsculo: um cadastro por e-mail */
  email: string
  /** Só dígitos, com DDD (ex.: 11912345678) */
  whatsapp: string
  pain: Pain | null
  consentAt: Date
  utm: Record<string, string> | null
  createdAt: Date
}

export interface RegisterLeadInput {
  name: string
  email: string
  whatsapp: string
  pain?: string | null
  consent: boolean
  utm?: Record<string, unknown> | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Cadastro da lista VIP. */
export class Lead {
  private constructor(private readonly props: LeadProps) {}

  static register(input: RegisterLeadInput): Lead {
    const name = input.name.trim().replace(/\s+/g, ' ')
    const email = input.email.trim().toLowerCase()
    const whatsapp = input.whatsapp.replace(/\D/g, '')
    const pain = input.pain || null

    const errors: Record<string, string> = {}
    if (name.split(' ').length < 2 || name.length < 5) errors.name = 'Informe nome e sobrenome'
    if (!EMAIL_RE.test(email)) errors.email = 'Informe um e-mail válido'
    if (whatsapp.length !== 11 || whatsapp[2] !== '9') errors.whatsapp = 'Informe um celular com DDD'
    if (pain && !PAIN_OPTIONS.some((o) => o.value === pain)) errors.pain = 'Opção inválida'
    if (!input.consent) errors.consent = 'Marque para continuar'
    if (Object.keys(errors).length) throw new ValidationError(errors)

    const now = new Date()
    return new Lead({
      id: randomUUID(),
      name,
      email,
      whatsapp,
      pain: pain as Pain | null,
      consentAt: now,
      utm: sanitizeUtm(input.utm),
      createdAt: now,
    })
  }

  static restore(props: LeadProps): Lead {
    return new Lead(props)
  }

  get id() { return this.props.id }
  get name() { return this.props.name }
  get email() { return this.props.email }
  get whatsapp() { return this.props.whatsapp }
  get pain() { return this.props.pain }
  get consentAt() { return this.props.consentAt }
  get utm() { return this.props.utm }
  get createdAt() { return this.props.createdAt }

  toSnapshot(): Readonly<LeadProps> {
    return { ...this.props }
  }
}

/** Aceita só chaves utm_* com valores curtos (vêm da URL, logo são entrada do usuário). */
function sanitizeUtm(utm?: Record<string, unknown> | null): Record<string, string> | null {
  if (!utm || typeof utm !== 'object') return null
  const clean = Object.fromEntries(
    Object.entries(utm)
      .filter((e): e is [string, string] => /^utm_[a-z_]{1,20}$/.test(e[0]) && typeof e[1] === 'string')
      .slice(0, 10)
      .map(([k, v]) => [k, v.slice(0, 200)]),
  )
  return Object.keys(clean).length ? clean : null
}
