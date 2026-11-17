/**
 * Erros de domínio: sem nenhuma dependência de HTTP/Nest.
 * A camada de apresentação (DomainExceptionFilter) traduz cada tipo para um status HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: 'validation' | 'not_found' | 'conflict' | 'business_rule' | 'unauthorized'

  constructor(
    message: string,
    /** Código estável para o front tratar sem depender do texto */
    readonly code: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Entrada inválida. `fields` traz a mensagem de cada campo, pronta para exibir no formulário. */
export class ValidationError extends DomainError {
  readonly kind = 'validation'

  constructor(
    readonly fields: Record<string, string>,
    message = 'Dados inválidos',
  ) {
    super(message, 'VALIDATION_ERROR')
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found'

  constructor(message = 'Recurso não encontrado', code = 'NOT_FOUND') {
    super(message, code)
  }
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict'
}

/** Regra de negócio violada (ex.: estoque insuficiente). */
export class BusinessRuleError extends DomainError {
  readonly kind = 'business_rule'
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'unauthorized'

  constructor(message = 'Não autorizado', code = 'UNAUTHORIZED') {
    super(message, code)
  }
}
