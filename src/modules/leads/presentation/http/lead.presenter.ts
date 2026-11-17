import { isoDate } from '../../../../shared/presentation/http/format'
import { BUSINESS_TIME_ZONE } from '../../application/leads.use-cases'
import { painLabel, type Lead } from '../../domain/lead'

export function presentLead(l: Lead) {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    whatsapp: l.whatsapp,
    pain: l.pain,
    utm: l.utm,
    consentAt: isoDate(l.consentAt),
    createdAt: isoDate(l.createdAt),
  }
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatPhone = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d)

/** CSV que abre direto no Excel pt-BR: separador `;` + BOM UTF-8. */
export function leadsToCsv(leads: Lead[]): string {
  const header = ['Data', 'Nome', 'E-mail', 'WhatsApp', 'Pesadelo ao acordar', 'utm_source', 'utm_medium', 'utm_campaign', 'Consentimento']
  const lines = leads.map((l) =>
    [
      dateTime.format(l.createdAt),
      l.name,
      l.email,
      formatPhone(l.whatsapp),
      painLabel(l.pain),
      l.utm?.utm_source ?? '',
      l.utm?.utm_medium ?? '',
      l.utm?.utm_campaign ?? '',
      l.consentAt.toISOString(),
    ]
      .map(csvCell)
      .join(';'),
  )
  return '﻿' + [header.join(';'), ...lines].join('\r\n')
}

function csvCell(value: string) {
  // Neutraliza fórmulas (=, +, -, @) que o Excel executaria
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
