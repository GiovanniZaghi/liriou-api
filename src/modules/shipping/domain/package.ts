import type { PackageSize } from './shipping-gateway'

const MAX_SIDE_CM = 100

/**
 * Junta os itens em uma única caixa para a etiqueta:
 * itens empilhados (altura somada), base do maior item, peso total.
 * Simples e conservador para peças pequenas como scrunchies e toucas.
 */
export function packVolume(items: (PackageSize & { quantity: number })[]): PackageSize {
  const weightGrams = items.reduce((s, i) => s + i.weightGrams * i.quantity, 0)
  const lengthCm = Math.max(...items.map((i) => i.lengthCm))
  const widthCm = Math.max(...items.map((i) => i.widthCm))
  const heightCm = Math.min(
    items.reduce((s, i) => s + i.heightCm * i.quantity, 0),
    MAX_SIDE_CM,
  )
  return { weightGrams, lengthCm, widthCm, heightCm }
}

/** CEP só com dígitos; null se não tiver 8 dígitos */
export function normalizeCep(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}
