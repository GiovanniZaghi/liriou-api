import type { ValueTransformer } from 'typeorm'

/** `bigint`/`numeric` chegam do pg como string; aqui viram number. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
}
