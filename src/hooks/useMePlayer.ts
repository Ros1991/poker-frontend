import { useQuery } from '@tanstack/react-query'
import * as mePlayerApi from '../api/mePlayer.api'
import { ME_PLAYER_QUERY_KEY } from '../api/mePlayer.api'
import { useAuth } from './useAuth'

/**
 * Resumo de quem joga (`GET me/player`, SPEC-20261029-1726) — a MESMA consulta para o Início ("Como jogador" e o
 * "Acompanhar" em Agora), o item "Meus torneios" do menu (só aparece com pelo menos uma inscrição) e o filtro de
 * /meus-torneios. Por conta: trocar de conta no mesmo navegador não mostra o resumo da anterior.
 */
export function useMePlayer({ refetchOnMount }: { refetchOnMount?: boolean | 'always' } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...ME_PLAYER_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: mePlayerApi.getSummary,
    enabled: !!user?.id,
    staleTime: 30_000,
    // "Agora" acompanha o torneio que começou ou acabou sem precisar recarregar (como o Início)
    refetchInterval: 60_000,
    refetchOnMount,
  })
}
