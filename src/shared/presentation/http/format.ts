/** Datas sempre em ISO 8601 (UTC) na API; o front formata no fuso do usuário. */
export const isoDate = (d: Date) => d.toISOString()
