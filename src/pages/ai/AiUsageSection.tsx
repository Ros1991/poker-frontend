import { Activity } from 'lucide-react'
import type { AiOverview, AiUsageSummary } from '../../types/ai.types'
import { Badge } from '../../components/ui/Badge'
import { AiSection } from './AiSection'
import { formatCallCost, formatDayTime, formatTokens, formatUsd, OUTCOME_COLORS, OUTCOME_LABELS, tokensLine } from './aiFormat'

function SummaryList({ title, items, empty, attr }: { title: string; items: AiUsageSummary[]; empty: string; attr: string }) {
  return (
    <div className="flex flex-col gap-2" data-ia-uso={attr}>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((u) => (
            <li key={u.key} className="rounded-lg border border-border-default px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium text-text-primary">{u.name}</p>
                <p className="text-sm font-semibold text-text-primary">{formatUsd(u.costUsd)}</p>
              </div>
              <p className="text-sm text-text-secondary">
                {u.calls === 1 ? '1 chamada' : `${formatTokens(u.calls)} chamadas`}
                {u.errors > 0 && ` · ${u.errors === 1 ? '1 com erro' : `${formatTokens(u.errors)} com erro`}`}
                {u.refused > 0 && ` · ${u.refused === 1 ? '1 recusada' : `${formatTokens(u.refused)} recusadas`}`}
              </p>
              {(u.inputTokens > 0 || u.outputTokens > 0 || u.cacheCreationInputTokens > 0 || u.cacheReadInputTokens > 0) && (
                <p className="text-xs text-text-secondary">Tokens: {tokensLine(u)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Uso do mês por recurso e por modelo e as últimas chamadas (nunca o conteúdo: ele não é guardado) */
export function AiUsageSection({ overview }: { overview: AiOverview }) {
  return (
    <AiSection id="ia-uso" title="Uso do mês" description="Chamadas, tokens e custo em US$ pela tabela de preços. O conteúdo das chamadas não é guardado.">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryList title="Por recurso" items={overview.usageByFeature} empty="Nenhum uso neste mês." attr="recurso" />
        <SummaryList title="Por modelo" items={overview.usageByModel} empty="Nenhuma chamada neste mês." attr="modelo" />
      </div>

      <div className="flex flex-col gap-2" data-ia-ultimas>
        <h3 className="text-sm font-semibold text-text-primary">Últimas chamadas</h3>
        {overview.recentCalls.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Activity className="h-4 w-4 text-text-muted" aria-hidden="true" /> Nenhuma chamada ainda.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.recentCalls.map((c) => (
              <li key={c.id} className="rounded-lg border border-border-default px-3 py-2" data-ia-chamada>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-text-primary">{c.featureName}</p>
                  <Badge color={OUTCOME_COLORS[c.outcome] ?? 'gray'}>{OUTCOME_LABELS[c.outcome] ?? c.outcome}</Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  {formatDayTime(c.at)} · {c.actorName ?? 'Sistema'}
                  {c.homeGameName && ` · ${c.homeGameName}`}
                </p>
                <p className="text-sm text-text-secondary">
                  {c.onDevice ? 'No aparelho · sem custo' : `${c.modelName ?? c.model} · ${formatCallCost(c.costUsd)}`}
                </p>
                {!c.onDevice && (c.inputTokens > 0 || c.outputTokens > 0) && (
                  <p className="text-xs text-text-secondary">Tokens: {tokensLine(c)}</p>
                )}
                {c.errorMessage && <p className="mt-1 text-sm text-accent-red-deep">{c.errorMessage}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AiSection>
  )
}
