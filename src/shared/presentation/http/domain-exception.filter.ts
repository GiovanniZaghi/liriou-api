import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { DomainError } from '../../domain/domain-error'

const STATUS_BY_KIND: Record<DomainError['kind'], HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  business_rule: HttpStatus.UNPROCESSABLE_ENTITY,
  unauthorized: HttpStatus.UNAUTHORIZED,
}

/** Traduz erros de domínio para respostas HTTP no mesmo formato das exceções do Nest. */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name)

  catch(error: DomainError, host: ArgumentsHost) {
    const status = STATUS_BY_KIND[error.kind]
    if (status >= 500) this.logger.error(error)

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        code: error.code,
        message: error.message,
        ...('fields' in error ? { errors: error.fields } : {}),
      })
  }
}
