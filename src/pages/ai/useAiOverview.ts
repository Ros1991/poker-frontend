import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as aiApi from '../../api/ai.api'
import type { AiOverview } from '../../types/ai.types'
import { AI_FEATURES_QUERY_KEY } from '../../components/photo/aiFeatures'
import { AI_OVERVIEW_QUERY_KEY } from './aiFormat'

/** Dados da tela de IA (GET admin/ai) */
export function useAiOverview() {
  return useQuery({ queryKey: AI_OVERVIEW_QUERY_KEY, queryFn: aiApi.getOverview })
}

/**
 * Toda alteração devolve a tela inteira: grava no cache e faz o app reconsultar os recursos ligados (a caixa
 * "Tirar o fundo" acompanha na hora).
 */
export function useApplyOverview() {
  const queryClient = useQueryClient()
  return (next: AiOverview) => {
    queryClient.setQueryData(AI_OVERVIEW_QUERY_KEY, next)
    void queryClient.invalidateQueries({ queryKey: AI_FEATURES_QUERY_KEY })
  }
}
