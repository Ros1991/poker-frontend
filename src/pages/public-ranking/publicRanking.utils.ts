import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import * as publicRankingsApi from '../../api/publicRankings.api'
import type {
  PublicRanking,
  PublicRankingPlayer,
  PublicRankingResult,
  PublicRankingStage,
} from '../../types/publicRanking.types'
import { copyToClipboard } from '../../utils/clipboard'

// As duas páginas (classificação e resumo do jogador) leem a mesma query:
// uma requisição só, e o toque no jogador abre sem esperar a rede.
export function usePublicRanking(slug: string | undefined) {
  const query = useQuery({
    queryKey: ['public-ranking', slug],
    queryFn: () => publicRankingsApi.getBySlug(slug!),
    enabled: !!slug,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) =>
      !(isAxiosError(error) && error.response?.status === 404) && failureCount < 2,
  })

  const notFound = isAxiosError(query.error) && query.error.response?.status === 404

  return { ...query, notFound }
}

// Anel de foco do ranking público: azul cheio (6.8:1 no branco) com folga de 2 px na cor da página.
// O azul a 60 % ficava abaixo de 3:1 sobre o fundo claro.
export const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

// Botão secundário do ranking público: branco com borda border-input (≥ 3:1), como o Button secondary do painel.
export const publicButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-input bg-bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary ${focusRingClass}`

export function formatPoints(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// Descartes de fato: o backend mantém max(1, etapas - descarte), então com
// poucas etapas descarta-se menos do que o configurado no ranking.
function discardedSlots(ranking: PublicRanking): number {
  return Math.max(0, ranking.totalStages - ranking.countedSlots)
}

function keptBest(ranking: PublicRanking): string {
  return ranking.countedSlots === 1 ? 'o melhor resultado' : `os ${ranking.countedSlots} melhores resultados`
}

export function stagesSummary(ranking: PublicRanking): string {
  if (ranking.totalStages === 0) return 'Nenhuma etapa finalizada ainda'
  const stages = plural(ranking.totalStages, 'etapa', 'etapas')
  if (discardedSlots(ranking) === 0) return `${stages} · todos os resultados contam`
  if (ranking.countedSlots === 1) return `${stages} · vale o melhor resultado`
  return `${stages} · contam os ${ranking.countedSlots} melhores`
}

export function pointsRule(ranking: PublicRanking): string {
  return ranking.pointsDependOnFieldSize
    ? 'A pontuação de cada etapa depende da colocação e do número de jogadores na mesa.'
    : 'A pontuação de cada etapa depende da colocação.'
}

export function scoringRule(ranking: PublicRanking): string {
  const discarded = discardedSlots(ranking)
  if (discarded === 0) return 'Todos os resultados contam, e falta vale zero.'
  const worst =
    discarded === 1
      ? 'O pior, mesmo que seja uma falta (que vale zero), é descartado.'
      : `Os ${discarded} piores, incluindo faltas (que valem zero), são descartados.`
  const best = ranking.countedSlots === 1 ? 'Vale só o melhor resultado' : `Valem ${keptBest(ranking)}`
  return `${best} de cada jogador. ${worst}`
}

export function playerExplanation(ranking: PublicRanking, player: PublicRankingPlayer): string {
  const total = formatPoints(player.totalPoints)
  if (discardedSlots(ranking) === 0) return `Todos os resultados contam: ${total} pts.`
  const verb = ranking.countedSlots === 1 ? 'Vale' : 'Valem'
  const base = `${verb} ${keptBest(ranking)}: ${total} pts.`
  return player.discardedPoints > 0
    ? `${base} Descartados: ${formatPoints(player.discardedPoints)} pts.`
    : base
}

// Pódio no tema claro: fundo pastel (-soft) + contorno fino na cor da medalha; o texto usa a
// variante -deep, a única de cada cor que passa AA em texto pequeno (dourado puro nunca é texto).
// Prata = cinza neutro dos tokens. Fora do pódio o número fica em text-secondary (text-muted
// reprova AA como texto lido). O contorno é `border` (não `ring-inset`) para o anel de foco
// (ring + offset) continuar do lado de fora; as linhas fora do pódio levam `border-transparent`
// (ver PlayerRow) para todas terem a mesma caixa.
export function positionTone(position: number): { text: string; row: string } {
  if (position === 1)
    return {
      text: 'text-accent-gold-deep',
      row: 'bg-accent-gold-soft border-accent-gold/40',
    }
  if (position === 2)
    return {
      text: 'text-text-secondary',
      row: 'bg-bg-tertiary border-border-default',
    }
  if (position === 3)
    return {
      text: 'text-accent-orange-deep',
      row: 'bg-accent-orange-soft border-accent-orange/40',
    }
  return { text: 'text-text-secondary', row: '' }
}

export type StageStatus = 'counted' | 'discarded' | 'absent'

export interface PlayerStageRow {
  key: string
  stage: PublicRankingStage
  result: PublicRankingResult | null // null = não jogou
}

// Uma linha por etapa do ranking; etapa sem resultado vira "falta".
// Por pontos: os que contaram primeiro, depois descartados, depois faltas —
// deixa visível exatamente onde fica o corte do descarte.
export function buildPlayerRows(
  ranking: PublicRanking,
  player: PublicRankingPlayer,
  sortBy: 'date' | 'points',
): PlayerStageRow[] {
  const rows: PlayerStageRow[] = []
  for (const stage of ranking.stages) {
    const results = player.results.filter((r) => r.stage === stage.number)
    if (results.length === 0) {
      rows.push({ key: `${stage.number}`, stage, result: null })
    } else {
      results.forEach((result, i) => rows.push({ key: `${stage.number}-${i}`, stage, result }))
    }
  }

  const byDateDesc = (a: PlayerStageRow, b: PlayerStageRow) =>
    new Date(b.stage.date).getTime() - new Date(a.stage.date).getTime()

  if (sortBy === 'date') return rows.sort(byDateDesc)

  const group = (row: PlayerStageRow) => (row.result == null ? 2 : row.result.counted ? 0 : 1)
  return rows.sort(
    (a, b) =>
      group(a) - group(b) ||
      (b.result?.points ?? 0) - (a.result?.points ?? 0) ||
      byDateDesc(a, b),
  )
}

export function stageStatus(row: PlayerStageRow): StageStatus {
  if (row.result == null) return 'absent'
  return row.result.counted ? 'counted' : 'discarded'
}

// No celular abre o seletor nativo (WhatsApp etc.); senão copia o link.
export async function shareLink(title: string, url: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const copied = await copyToClipboard(url)
  if (copied) toast.success('Link copiado')
  else toast.error('Não foi possível copiar. Copie o endereço pela barra do navegador.')
}
