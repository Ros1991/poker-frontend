/**
 * Planos (SPEC-20261023-1205).
 *
 * API estável:
 * - `getMyPlan(): Promise<MyPlan>` — `GET me/plan` com a sessão do usuário (apiClient). Token de
 *   dealer não acessa (403).
 * - `getPublicPlans(): Promise<PlanDefinition[]>` — `GET public/plans` anônimo (publicClient, não
 *   mexe na sessão), ordenado por `order`. É o catálogo da landing, das boas-vindas e da tabela
 *   comparativa; o backend guarda em cache por 5 min.
 *
 * Nas telas prefira os hooks `usePlan()` e `usePlanCatalog()` (React Query) a chamar direto.
 */
import apiClient from './client'
import publicClient from './publicClient'
import type { MyPlan, PlanDefinition } from '../types/plan.types'

function byOrder(plans: PlanDefinition[]): PlanDefinition[] {
  return [...plans].sort((a, b) => a.order - b.order)
}

export async function getMyPlan(): Promise<MyPlan> {
  const response = await apiClient.get<MyPlan>('/me/plan')
  const data = response.data
  return { ...data, catalog: byOrder(data.catalog ?? []) }
}

export async function getPublicPlans(): Promise<PlanDefinition[]> {
  const response = await publicClient.get<PlanDefinition[]>('/public/plans')
  return byOrder(response.data ?? [])
}
