/** Prefixo global das rotas (main.ts). */
export const API_PREFIX = '/api/v1'

/**
 * Normaliza o PUBLIC_API_URL para "https://host/api/v1", aceitando as formas comuns de preencher:
 * sem protocolo, sem o prefixo ou com barra no final.
 */
export function normalizePublicApiUrl(raw: string | undefined | null): string | null {
  let url = raw?.trim().replace(/\/+$/, '')
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url.endsWith(API_PREFIX) ? url : `${url}${API_PREFIX}`
}
