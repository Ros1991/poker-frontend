// Apoio da tela "Inteligência artificial" (SPEC-20261027-1312): chave do React Query, formatação de dólar, tokens e
// resultado das chamadas. Datas no mesmo formato do "Meu perfil".
import type { BadgeColor } from '../../components/ui/Badge'
import type { AiUsageItem, AiUsageOutcome } from '../../types/ai.types'

export { formatDayTime } from '../profile/profileFormat'

export const AI_OVERVIEW_QUERY_KEY = ['admin-ai'] as const

const usd2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usd4 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const usd6 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const percent1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "US$ 12,50"; abaixo de US$ 10 mostra até 4 casas para o gasto pequeno não sumir no arredondamento ("US$ 0,0171") */
export function formatUsd(value: number): string {
  return `US$ ${Math.abs(value) < 10 ? usd4.format(value) : usd2.format(value)}`
}

/** Preço por milhão de tokens: até 4 casas ("US$ 0,125") */
export function formatPrice(value: number | null | undefined): string {
  return value == null ? '—' : `US$ ${usd4.format(value)}`
}

/** Custo de uma chamada: até 6 casas, que é a precisão do registro ("US$ 0,0171") */
export function formatCallCost(value: number): string {
  return `US$ ${usd6.format(value)}`
}

/** "12.345" */
export function formatTokens(value: number): string {
  return integer.format(value)
}

export function formatPercent(value: number): string {
  return `${percent1.format(value)} %`
}

export const OUTCOME_LABELS: Record<AiUsageOutcome, string> = {
  Success: 'Ok',
  Error: 'Erro',
  Refused: 'Recusada',
}

export const OUTCOME_COLORS: Record<AiUsageOutcome, BadgeColor> = {
  Success: 'green',
  Error: 'red',
  Refused: 'yellow',
}

/** Tokens de uma chamada em uma linha: "entrada 1.200 · saída 345 · cache 1.000 + 2.000" */
export function tokensLine(item: Pick<AiUsageItem, 'inputTokens' | 'outputTokens' | 'cacheCreationInputTokens' | 'cacheReadInputTokens'>): string {
  const parts = [`entrada ${formatTokens(item.inputTokens)}`, `saída ${formatTokens(item.outputTokens)}`]
  if (item.cacheCreationInputTokens || item.cacheReadInputTokens)
    parts.push(`cache ${formatTokens(item.cacheCreationInputTokens)} escrito + ${formatTokens(item.cacheReadInputTokens)} lido`)
  return parts.join(' · ')
}

/** Converte o texto do campo ("12,50" ou "12.50") em número; null se não for número */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

/** Número para o campo de texto com vírgula ("12,5") */
export function decimalText(value: number | null | undefined): string {
  return value == null ? '' : String(value).replace('.', ',')
}
