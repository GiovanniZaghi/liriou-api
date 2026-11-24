import { ValidationError } from '../../../shared/domain/domain-error'

export interface Customer {
  name: string
  /** minúsculo */
  email: string
  /** 11 dígitos */
  cpf: string
  /** 10 ou 11 dígitos, com DDD */
  phone: string
  /** Aniversário (opcional), AAAA-MM-DD. Ausente em sacolas e pedidos antigos. */
  birthDate?: string | null
}

export interface ShippingAddress {
  /** 8 dígitos */
  cep: string
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  /** UF, 2 letras */
  state: string
  recipient: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))

const digits = (v: string) => v.replace(/\D/g, '')

/** Dígitos verificadores do CPF (rejeita sequências como 111.111.111-11). */
export function isValidCpf(value: string): boolean {
  const cpf = digits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10])
}

/**
 * Data de nascimento: aceita DD/MM/AAAA ou AAAA-MM-DD e devolve AAAA-MM-DD.
 * undefined = vazio; null = inválida.
 */
export function parseBirthDate(raw: string | null | undefined, today = new Date()): string | null | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [d, mo, y] = v.includes('/') ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]]
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  // Rejeita 31/02 e afins (a data "vira" outro dia)
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(mo) - 1) return null
  if (Number(y) < 1900 || date > today) return null
  return `${y}-${mo}-${d}`
}

/** Normaliza e valida os dados da compradora; erros por campo com prefixo "customer.". */
export function parseCustomer(input: Customer): Customer {
  const c: Customer = {
    name: input.name.trim().replace(/\s+/g, ' '),
    email: input.email.trim().toLowerCase(),
    cpf: digits(input.cpf),
    phone: digits(input.phone),
  }
  const errors: Record<string, string> = {}
  const birthDate = parseBirthDate(input.birthDate)
  if (birthDate === null) errors['customer.birthDate'] = 'Data inválida (use DD/MM/AAAA)'
  else if (birthDate) c.birthDate = birthDate
  if (c.name.split(' ').length < 2 || c.name.length < 5) errors['customer.name'] = 'Informe nome e sobrenome'
  if (!EMAIL_RE.test(c.email)) errors['customer.email'] = 'Informe um e-mail válido'
  if (!isValidCpf(c.cpf)) errors['customer.cpf'] = 'CPF inválido'
  if (c.phone.length < 10 || c.phone.length > 11) errors['customer.phone'] = 'Informe um telefone com DDD'
  if (Object.keys(errors).length) throw new ValidationError(errors)
  return c
}

export function parseAddress(input: ShippingAddress): ShippingAddress {
  const a: ShippingAddress = {
    cep: digits(input.cep),
    street: input.street.trim(),
    number: input.number.trim(),
    complement: input.complement?.trim() || null,
    district: input.district.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    recipient: input.recipient.trim().replace(/\s+/g, ' '),
  }
  const errors: Record<string, string> = {}
  if (a.cep.length !== 8) errors['address.cep'] = 'CEP inválido'
  if (!a.street) errors['address.street'] = 'Informe a rua'
  if (!a.number) errors['address.number'] = 'Informe o número (ou "s/n")'
  if (!a.district) errors['address.district'] = 'Informe o bairro'
  if (!a.city) errors['address.city'] = 'Informe a cidade'
  if (!UFS.has(a.state)) errors['address.state'] = 'UF inválida'
  if (a.recipient.length < 3) errors['address.recipient'] = 'Informe quem vai receber'
  if (Object.keys(errors).length) throw new ValidationError(errors)
  return a
}
