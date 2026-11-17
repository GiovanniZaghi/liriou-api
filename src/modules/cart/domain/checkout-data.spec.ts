import { ValidationError } from '../../../shared/domain/domain-error'
import { isValidCpf, parseAddress, parseCustomer } from './checkout-data'

describe('checkout data', () => {
  it('valida dígitos do CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('normaliza a compradora', () => {
    expect(parseCustomer({ name: ' Ana  Souza ', email: 'ANA@X.COM', cpf: '529.982.247-25', phone: '(11) 91234-5678' })).toEqual({
      name: 'Ana Souza',
      email: 'ana@x.com',
      cpf: '52998224725',
      phone: '11912345678',
    })
  })

  it('devolve erros por campo com prefixo', () => {
    try {
      parseAddress({ cep: '123', street: '', number: '', complement: '', district: '', city: '', state: 'XX', recipient: '' })
      fail('deveria lançar')
    } catch (e) {
      expect(Object.keys((e as ValidationError).fields)).toEqual(
        expect.arrayContaining(['address.cep', 'address.street', 'address.number', 'address.state', 'address.recipient']),
      )
    }
  })
})
