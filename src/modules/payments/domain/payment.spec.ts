import { createHmac } from 'node:crypto'
import { isValidMercadoPagoSignature } from '../infra/mercado-pago-signature'
import { EMPTY_INSTRUCTIONS, Payment, PaymentMethod, PaymentStatus } from './payment'

const pix = () => Payment.start({ orderId: 'o1', method: PaymentMethod.PIX, amountCents: 14051, installments: 1 })

describe('Payment', () => {
  it('nasce pendente e sem instruções', () => {
    const p = pix()
    expect(p.status).toBe(PaymentStatus.PENDING)
    expect(p.isReusable()).toBe(false)
  })

  it('aplica o retorno do gateway e informa se mudou', () => {
    const p = pix()
    const changed = p.apply({
      gatewayOrderId: 'ORD1',
      status: PaymentStatus.PENDING,
      statusDetail: 'waiting_transfer',
      instructions: { ...EMPTY_INSTRUCTIONS, qrCode: '000201', expiresAt: new Date(Date.now() + 3_600_000) },
    })
    expect(changed).toBe(true)
    expect(p.gatewayOrderId).toBe('ORD1')
    expect(p.isReusable()).toBe(true)
  })

  it('mantém o QR Code quando a consulta seguinte não o repete', () => {
    const p = pix()
    p.apply({ gatewayOrderId: 'ORD1', status: PaymentStatus.PENDING, statusDetail: 'waiting_transfer', instructions: { ...EMPTY_INSTRUCTIONS, qrCode: '000201' } })
    p.apply({ gatewayOrderId: 'ORD1', status: PaymentStatus.APPROVED, statusDetail: 'accredited', instructions: EMPTY_INSTRUCTIONS })
    expect(p.instructions.qrCode).toBe('000201')
    expect(p.status).toBe(PaymentStatus.APPROVED)
    expect(p.isReusable()).toBe(false)
  })

  it('Pix vencido não é reaproveitado', () => {
    const p = pix()
    p.apply({ gatewayOrderId: 'ORD1', status: PaymentStatus.PENDING, statusDetail: 'waiting_transfer', instructions: { ...EMPTY_INSTRUCTIONS, qrCode: 'x', expiresAt: new Date(Date.now() - 1000) } })
    expect(p.isReusable()).toBe(false)
  })
})

describe('isValidMercadoPagoSignature', () => {
  const secret = 'segredo'
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex')

  it('aceita assinatura correta (id alfanumérico em minúsculas)', () => {
    const v1 = sign('id:ord01abc;request-id:req-1;ts:1700000000;')
    expect(isValidMercadoPagoSignature({ secret, signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: 'ORD01ABC' })).toBe(true)
  })

  it('recusa assinatura adulterada ou ausente', () => {
    expect(isValidMercadoPagoSignature({ secret, signature: 'ts=1,v1=abc', requestId: 'r', dataId: 'x' })).toBe(false)
    expect(isValidMercadoPagoSignature({ secret, signature: undefined, requestId: 'r', dataId: 'x' })).toBe(false)
  })
})
