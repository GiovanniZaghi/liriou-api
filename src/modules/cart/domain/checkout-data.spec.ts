import { ValidationError } from '../../../shared/domain/domain-error'
import { isValidCpf, parseAddress, parseBirthDate, parseCustomer } from './checkout-data'

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

  it('aniversário é opcional e aceita DD/MM/AAAA', () => {
    const base = { name: 'Ana Souza', email: 'ana@x.com', cpf: '529.982.247-25', phone: '11912345678' }
    expect(parseCustomer(base).birthDate).toBeUndefined()
    expect(parseCustomer({ ...base, birthDate: '' }).birthDate).toBeUndefined()
    expect(parseCustomer({ ...base, birthDate: '07/03/1995' }).birthDate).toBe('1995-03-07')
    expect(parseCustomer({ ...base, birthDate: '1995-03-07' }).birthDate).toBe('1995-03-07')
  })

  it('recusa aniversário impossível ou no futuro', () => {
    const today = new Date('2026-11-24T12:00:00Z')
    expect(parseBirthDate('31/02/1990', today)).toBeNull()
    expect(parseBirthDate('10/10/2030', today)).toBeNull()
    expect(parseBirthDate('01/01/1800', today)).toBeNull()
    expect(parseBirthDate('7/3/95', today)).toBeNull()
    expect(() =>
      parseCustomer({ name: 'Ana Souza', email: 'ana@x.com', cpf: '529.982.247-25', phone: '11912345678', birthDate: '99/99/9999' }),
    ).toThrow(ValidationError)
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
