// Recursos de IA ligados (SPEC-20261027-1312): a caixa "Tirar o fundo" só aparece com a IA e o recurso ligados na tela de
// IA da Administração. No terminal do dealer (/dealer/:torneio) a consulta usa a rota do torneio — é só nela que o app
// manda o token do QR; no resto, a rota geral com a sessão da conta.
import { useQuery } from '@tanstack/react-query'
import { getAvailableFeatures } from '../../api/ai.api'

export const AI_FEATURES_QUERY_KEY = ['ai', 'features'] as const

/** Torneio do terminal do dealer aberto nesta página (rota /dealer/:tournamentId), ou null */
export function dealerTournamentFromPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): string | null {
  const match = /^\/dealer\/([0-9a-fA-F-]{36})(?:\/|$)/.exec(pathname)
  return match ? match[1] : null
}

/** O recurso de IA está ligado agora (falha na consulta = desligado: a caixa não aparece) */
export function useAiFeature(feature: string): boolean {
  const tournamentId = dealerTournamentFromPath()
  const { data } = useQuery({
    queryKey: [...AI_FEATURES_QUERY_KEY, tournamentId],
    queryFn: () => getAvailableFeatures(tournamentId),
    staleTime: 60_000,
    retry: false,
  })
  return !!data?.features.includes(feature)
}
