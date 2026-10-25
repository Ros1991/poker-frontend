// Apoio da página "Meu perfil" (SPEC-20261023-1211): chaves do React Query e formatação de datas.
import { format, formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const PROFILE_QUERY_KEY = ['me', 'profile'] as const
export const LOGINS_QUERY_KEY = ['me', 'logins'] as const
export const SESSIONS_QUERY_KEY = ['me', 'sessions'] as const

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "23/10/2026" */
export function formatDay(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

/** "23/10/2026 às 14:05" */
export function formatDayTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'
}

/** "agora há pouco", "há 5 minutos", "há 3 dias" (mais de 30 dias: a data) */
export function formatLastUse(iso: string | null | undefined, now: number = Date.now()): string {
  const date = parse(iso)
  if (!date) return '—'
  const diff = now - date.getTime()
  if (diff < 60_000) return 'agora há pouco'
  if (diff > 30 * 24 * 3600_000) return `em ${formatDay(iso)}`
  return `há ${formatDistanceToNowStrict(date, { locale: ptBR })}`
}
