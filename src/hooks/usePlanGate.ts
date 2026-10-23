/**
 * Abre o UpgradeModal único por código (SPEC-20261023-1205).
 *
 * API estável:
 * - `usePlanGate(): { open, openFeature }` (funções estáveis entre renders)
 *   - `open(detail: PlanLimitDetail)` — mesmo caminho do 402: dispara o evento `poker:plan-limit`
 *     que o `UpgradeModal` (montado uma vez no AppLayout) escuta. `detail.code` é obrigatório; o
 *     resto (plano atual/exigido, mensagem) o modal deduz pelo catálogo e pelo `GET me/plan`.
 *   - `openFeature(feature, extra?)` — atalho para cadeado de recurso: `code: 'feature_locked'`.
 *     `extra` aceita `currentPlan` (ex.: `tournament.ownerPlan`), `homeGameName` (vai na mensagem
 *     pronta do WhatsApp) e `message`.
 *
 * Exemplo: `const gate = usePlanGate(); gate.openFeature('Tables', { currentPlan:
 * tournament.ownerPlan, homeGameName: tournament.homeGameName })`.
 * Fora do AppLayout (telão, terminal do dealer) não há modal montado: o evento não abre nada.
 */
import { useMemo } from 'react'
import { notifyPlanLimit } from '../api/client'
import type { PlanFeature, PlanLimitDetail } from '../types/plan.types'

export interface UsePlanGateResult {
  open: (detail: PlanLimitDetail) => void
  openFeature: (
    feature: PlanFeature,
    extra?: Omit<PlanLimitDetail, 'code' | 'feature'>,
  ) => void
}

const gate: UsePlanGateResult = {
  open: (detail) => notifyPlanLimit(detail),
  openFeature: (feature, extra) => notifyPlanLimit({ ...extra, code: 'feature_locked', feature }),
}

export function usePlanGate(): UsePlanGateResult {
  return useMemo(() => gate, [])
}
