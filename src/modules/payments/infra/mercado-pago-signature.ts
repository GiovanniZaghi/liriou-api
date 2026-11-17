import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida o header `x-signature` dos webhooks do Mercado Pago.
 * Manifesto assinado (HMAC-SHA256 com a assinatura secreta): `id:{data.id};request-id:{x-request-id};ts:{ts};`
 */
export function isValidMercadoPagoSignature(input: {
  secret: string
  signature: string | undefined
  requestId: string | undefined
  dataId: string | undefined
}): boolean {
  const { secret, signature, requestId, dataId } = input
  if (!signature) return false

  const parts = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  let manifest = ''
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`

  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  return a.length === b.length && timingSafeEqual(a, b)
}
