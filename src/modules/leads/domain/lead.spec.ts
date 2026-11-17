import { ValidationError } from '../../../shared/domain/domain-error'
import { Lead } from './lead'

const valid = { name: '  Maria   Silva ', email: ' Maria@Email.COM ', whatsapp: '(11) 91234-5678', consent: true }

describe('Lead.register', () => {
  it('normaliza nome, e-mail e WhatsApp', () => {
    const lead = Lead.register(valid)
    expect(lead).toMatchObject({ name: 'Maria Silva', email: 'maria@email.com', whatsapp: '11912345678', pain: null })
  })

  it('devolve todos os erros por campo', () => {
    try {
      Lead.register({ name: 'Ma', email: 'x', whatsapp: '1133334444', consent: false, pain: 'inexistente' })
      fail('deveria lançar')
    } catch (e) {
      expect((e as ValidationError).fields).toEqual({
        name: expect.any(String),
        email: expect.any(String),
        whatsapp: expect.any(String),
        pain: expect.any(String),
        consent: expect.any(String),
      })
    }
  })

  it('guarda só parâmetros utm_* válidos', () => {
    const lead = Lead.register({ ...valid, utm: { utm_source: 'ig', evil: 'x', utm_medium: 42 } })
    expect(lead.utm).toEqual({ utm_source: 'ig' })
  })
})
