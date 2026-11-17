/**
 * Dinheiro trafega em centavos (inteiro) dentro do domínio para evitar erro de ponto flutuante.
 * Na borda HTTP convertemos para reais (number com 2 casas).
 */
export type Cents = number

export const toCents = (reais: number): Cents => Math.round(reais * 100)

export const toReais = (cents: Cents): number => Math.round(cents) / 100

/** Percentual aplicado em centavos, sempre arredondando para o centavo mais próximo. */
export const percentOf = (cents: Cents, rate: number): Cents => Math.round(cents * rate)
