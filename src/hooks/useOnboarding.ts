/**
 * Boas-vindas no primeiro acesso (SPEC-20261023-1212): a conta logada ainda precisa passar por `/boas-vindas`?
 *
 * API estável:
 * - `useOnboardingStatus({ enabled? }): { needsOnboarding, isChecking, profile, isError, refetch }`
 *   - lê `GET me` (campo `needsOnboarding`) uma vez por conta e guarda (sem refazer a cada navegação);
 *   - `isChecking` = logado e a resposta ainda não chegou (o `RootGate`/`ProtectedRoute` mostram o carregando);
 *   - falha do `GET me` (rede, servidor) NUNCA prende ninguém fora do painel: vale como "não precisa".
 * - `onboardingQueryKey(userId)` — chave do React Query; quem conclui as boas-vindas grava a resposta nela.
 */
import { useQuery } from '@tanstack/react-query'
import * as onboardingApi from '../api/onboarding.api'
import type { Profile } from '../types/profile.types'
import { useAuth } from './useAuth'

export const ONBOARDING_QUERY_KEY = ['me', 'onboarding'] as const

export function onboardingQueryKey(userId: string | null | undefined) {
  return [...ONBOARDING_QUERY_KEY, userId ?? 'anon'] as const
}

export interface OnboardingStatus {
  needsOnboarding: boolean
  isChecking: boolean
  profile: Profile | undefined
  /** O GET me falhou (a tela das boas-vindas oferece tentar de novo) */
  isError: boolean
  refetch: () => void
}

export function useOnboardingStatus(options?: { enabled?: boolean }): OnboardingStatus {
  const { isAuthenticated, user } = useAuth()
  const enabled = (options?.enabled ?? true) && isAuthenticated && !!user?.id
  const query = useQuery({
    queryKey: onboardingQueryKey(user?.id),
    queryFn: onboardingApi.getOnboardingStatus,
    enabled,
    // A situação só muda pelas próprias boas-vindas (que gravam a resposta aqui)
    staleTime: Infinity,
    retry: 1,
  })

  return {
    needsOnboarding: enabled && query.data?.needsOnboarding === true,
    isChecking: enabled && query.isPending,
    profile: query.data,
    isError: enabled && query.isError,
    refetch: () => void query.refetch(),
  }
}
