// Sugestões do formulário de criação de torneio (SPEC-20261105-1708): o ranking mais recente do clube e a estrutura do
// último torneio criado (ou, sem ela, a estrutura mais recente). Funções puras: o formulário aplica uma vez, só na criação.

/** Instante (ms) de uma data ISO; sem data (ou inválida), 0 — fica por último */
function timeOf(iso: string | null | undefined): number {
  const ms = iso ? new Date(iso).getTime() : 0
  return Number.isFinite(ms) ? ms : 0
}

/** O mais recente pelo `createdAt` (empate: o que veio primeiro na lista) */
function newest<T extends { createdAt?: string | null }>(items: readonly T[]): T | null {
  let best: T | null = null
  for (const item of items) if (!best || timeOf(item.createdAt) > timeOf(best.createdAt)) best = item
  return best
}

/** Ranking pré-selecionado: o último criado entre os que a lista traz (a API só lista os ativos, não excluídos) */
export function suggestedRankingId(rankings: readonly { id: string; createdAt?: string | null }[]): string | null {
  return newest(rankings)?.id ?? null
}

/**
 * Estrutura pré-selecionada: a do último torneio criado no clube, se ela ainda existe (está na lista de estruturas);
 * senão a estrutura mais recente do clube; sem nenhuma do clube, a mais recente da lista (as globais).
 */
export function suggestedStructureId(
  tournaments: readonly { blindStructureId?: string | null; createdAt?: string | null }[],
  structures: readonly { id: string; homeGameId?: string | null; createdAt?: string | null }[],
  homeGameId: string | undefined,
): string | null {
  if (structures.length === 0) return null
  const lastStructureId = newest(tournaments)?.blindStructureId
  if (lastStructureId && structures.some((s) => s.id === lastStructureId)) return lastStructureId
  const own = structures.filter((s) => !!homeGameId && s.homeGameId === homeGameId)
  return newest(own.length > 0 ? own : structures)?.id ?? null
}
