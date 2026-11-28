import { Injectable } from '@nestjs/common'
import { ValidationError } from '../../../shared/domain/domain-error'
import type { UseCase } from '../../../shared/application/use-case'
import { isValidCpf } from '../../cart/domain/checkout-data'
import { CustomerOrdersQuery, type CustomerOrdersResult } from './customer-orders.query'

/** "Meus pedidos": a cliente informa o CPF usado na compra e vê os pedidos e o andamento. */
@Injectable()
export class LookupCustomerOrdersUseCase implements UseCase<string, CustomerOrdersResult> {
  constructor(private readonly orders: CustomerOrdersQuery) {}

  execute(cpfInput: string) {
    const cpf = cpfInput.replace(/\D/g, '')
    if (!isValidCpf(cpf)) throw new ValidationError({ cpf: 'CPF inválido' })
    return this.orders.byCpf(cpf)
  }
}
