/**
 * Catálogo público dos planos (SPEC-20261023-1205) — `GET public/plans`, anônimo.
 *
 * API estável:
 * - `usePlanCatalog(options?): { plans, isLoading, isError, refetch }`
 *   - `plans: PlanDefinition[]` — Mesa, Clube, Liga em `order` (vazio enquanto carrega ou em erro).
 *   - `options.enabled` (default true) — desligue quando já tiver o catálogo de `MyPlan.catalog`.
 *   É a ÚNICA fonte de preços e limites da landing, das boas-vindas, do "Meu plano" e do modal de
 *   upgrade. Funciona sem login (usa o publicClient). Cache longo: o catálogo só muda com deploy.
 * - `PLAN_CATALOG_QUERY_KEY` — `['public', 'plans']`.
 */
import { useQuery } from '@tanstack/react-query'
import * as planApi from '../api/plan.api'
import type { PlanDefinition } from '../types/plan.types'

export const PLAN_CATALOG_QUERY_KEY = ['public', 'plans'] as const

const EMPTY: PlanDefinition[] = []

export interface UsePlanCatalogResult {
  plans: PlanDefinition[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function usePlanCatalog(options?: { enabled?: boolean }): UsePlanCatalogResult {
  const query = useQuery({
    queryKey: PLAN_CATALOG_QUERY_KEY,
    queryFn: planApi.getPublicPlans,
    enabled: options?.enabled ?? true,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  return {
    plans: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  }
}
