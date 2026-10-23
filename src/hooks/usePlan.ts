/**
 * Plano da conta logada (SPEC-20261023-1205).
 *
 * API estável:
 * - `usePlan(): { myPlan, isLoading, isError, refetch, bypassLimits }`
 *   - `myPlan: MyPlan | undefined` — `GET me/plan` (React Query, `staleTime` 60 s). Só busca com
 *     usuário logado.
 *   - `bypassLimits: boolean` — Admin do sistema ignora limites (não mostre pré-bloqueio para ele).
 *   Use para a página "Meu plano", o banner de vencimento e pré-checagens da CONTA (ex.: "Novo
 *   torneio" com "Próximo libera em X dias" usando `nextTournamentAllowedAt(myPlan)`).
 *   Para cadeado de recurso dentro de um home game/torneio NÃO use o plano do usuário: use o do
 *   dono, que vem em `homeGame.planFeatures` / `tournament.planFeatures`.
 * - `hasFeature(features, feature): boolean` — `features` é `planFeatures` de HomeGame/Tournament
 *   ou `MyPlan.features`. `undefined`/`null` = desconhecido → `true` (não trava a tela; o backend é a
 *   autoridade e responde 402, que abre o UpgradeModal).
 * - `nextTournamentAllowedAt(myPlan): string | null` — ISO de quando libera o próximo torneio, só se
 *   estiver no futuro.
 * - `MY_PLAN_QUERY_KEY` — `['me', 'plan']`; invalide depois de criar home game/torneio/membro:
 *   `queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })`.
 */
import { useQuery } from '@tanstack/react-query'
import * as planApi from '../api/plan.api'
import { useAuth } from './useAuth'
import type { MyPlan, PlanFeature } from '../types/plan.types'

export const MY_PLAN_QUERY_KEY = ['me', 'plan'] as const

export interface UsePlanResult {
  myPlan: MyPlan | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  /** Admin do sistema: nenhum limite se aplica */
  bypassLimits: boolean
}

export function usePlan(): UsePlanResult {
  const { user, isAuthenticated } = useAuth()

  const query = useQuery({
    queryKey: [...MY_PLAN_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: planApi.getMyPlan,
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60 * 1000,
  })

  return {
    myPlan: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    bypassLimits: user?.role === 'Admin',
  }
}

/** O plano (do dono) libera o recurso? Lista ausente = desconhecido → true (o backend decide). */
export function hasFeature(
  features: readonly string[] | null | undefined,
  feature: PlanFeature,
): boolean {
  if (features == null) return true
  return features.includes(feature)
}

/** Quando libera o próximo torneio (ISO), só se ainda estiver no futuro. */
export function nextTournamentAllowedAt(myPlan: MyPlan | undefined): string | null {
  const iso = myPlan?.usage?.tournamentsLast7Days?.nextAllowedAt
  if (!iso) return null
  return new Date(iso).getTime() > Date.now() ? iso : null
}
