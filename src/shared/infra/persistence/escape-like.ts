/** Escapa curingas do LIKE/ILIKE para buscar o texto literal digitado pelo usuário. */
export const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&')
