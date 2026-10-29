import type { Tournament } from '../types/tournament.types'

/** Mesmos limites do servidor (TimebankRules) */
export const TIMEBANK_MAX_COUNT = 99
export const TIMEBANK_MIN_SECONDS = 5
export const TIMEBANK_MAX_SECONDS = 300
export const TIMEBANK_DEFAULT_SECONDS = 30
/** Aviso de "acabando" da contagem (bipe + vibração) */
export const TIMEBANK_WARNING_SECONDS = 10

/**
 * Timebank virtual (SPEC-20261029-1722): o torneio usa timebank? Sem ele (null), nenhuma tela de jogo mostra chip, sheet
 * ou campo extra — só o formulário do torneio tem o liga/desliga. Nunca aparece no telão (D5).
 */
export function timebankEnabled(tournament: Pick<Tournament, 'timebankCount'> | null | undefined): boolean {
  return (tournament?.timebankCount ?? 0) > 0
}

/** Segundos de cada timebank do torneio (30 quando não veio) */
export function timebankSeconds(tournament: Pick<Tournament, 'timebankSeconds'> | null | undefined): number {
  return tournament?.timebankSeconds ?? TIMEBANK_DEFAULT_SECONDS
}

/** "3 restantes", "1 restante", "nenhum restante" */
export function timebanksLeftText(n: number): string {
  if (n <= 0) return 'nenhum restante'
  return n === 1 ? '1 restante' : `${n} restantes`
}

/**
 * Id do uso no formato do servidor (Guid "D", com hífens), gerado no celular: o "Tentar de novo" manda o mesmo e o
 * servidor não desconta duas vezes. Sem `crypto.randomUUID` (página por http:// fora de localhost), monta um v4.
 */
export function newTimebankActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Valida o texto dos campos do formulário (torneio e estrutura): mensagem de erro ou null */
export function timebankFieldErrors(count: string, seconds: string): { count: string | null; seconds: string | null } {
  const c = Number(count)
  const s = Number(seconds)
  return {
    count:
      count.trim() === '' || !Number.isInteger(c) || c < 1 || c > TIMEBANK_MAX_COUNT
        ? 'Use de 1 a 99 timebanks'
        : null,
    seconds:
      seconds.trim() === '' || !Number.isInteger(s) || s < TIMEBANK_MIN_SECONDS || s > TIMEBANK_MAX_SECONDS
        ? 'Use de 5 a 300 segundos'
        : null,
  }
}
