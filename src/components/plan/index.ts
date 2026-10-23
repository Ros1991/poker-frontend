/**
 * Planos Mesa / Clube / Liga — ponto de importação único dos componentes e utilidades de plano
 * (SPEC-20261023-1205). A documentação de cada peça está no topo do próprio arquivo.
 *
 * - `UpgradeModal` — modal único (já montado no AppLayout; não monte de novo).
 * - `PlanLock` — cadeado de recurso `{ feature, title?, description?, currentPlan?, homeGameName?, children? }`.
 * - `PoweredByBadge` — selo `{ variant: 'qr' | 'discreta', className?, qrSize? }`.
 * - `PlanComparisonTable` — `{ highlightCurrent?, onChoose?, plans?, chooseLabel?, showTestPhaseNote? }`.
 * - `PlanUsageBar` — `{ label, used, limit, hint? }`.
 * - `PlanExpiryBanner` — banner de vencimento (já montado no AppLayout).
 * - utilidades de `planUtils` (rótulos, preços, contagem regressiva, mensagem do suporte).
 *
 * Hooks ficam em `src/hooks`: `usePlan` (+ `hasFeature`, `nextTournamentAllowedAt`,
 * `MY_PLAN_QUERY_KEY`), `usePlanGate`, `usePlanCatalog`.
 */
export { UpgradeModal } from './UpgradeModal'
export { PlanLock } from './PlanLock'
export type { PlanLockProps } from './PlanLock'
export { PoweredByBadge } from './PoweredByBadge'
export type { PoweredByBadgeProps, PoweredByBadgeVariant } from './PoweredByBadge'
export { PlanComparisonTable } from './PlanComparisonTable'
export type { PlanComparisonTableProps } from './PlanComparisonTable'
export { PlanUsageBar } from './PlanUsageBar'
export type { PlanUsageBarProps } from './PlanUsageBar'
export { PlanExpiryBanner } from './PlanExpiryBanner'
export * from './planUtils'
