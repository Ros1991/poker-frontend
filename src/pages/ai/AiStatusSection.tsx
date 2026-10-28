import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import * as aiApi from '../../api/ai.api'
import type { AiOverview } from '../../types/ai.types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { errorMessage } from '../../utils/httpErrors'
import { cn } from '../../utils/cn'
import { AiSection } from './AiSection'
import { AiSwitch } from './AiSwitch'
import { decimalText, formatPercent, formatUsd, parseDecimal } from './aiFormat'
import { useApplyOverview } from './useAiOverview'

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Liga/desliga geral, modelo padrão, limite mensal e o gasto do mês (aviso a partir de 80 %) */
export function AiStatusSection({ overview }: { overview: AiOverview }) {
  const apply = useApplyOverview()
  const [model, setModel] = useState(overview.defaultModel)
  const [limit, setLimit] = useState(decimalText(overview.monthlyLimitUsd))
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  const parsedLimit = parseDecimal(limit)
  const limitError =
    parsedLimit === null || parsedLimit > 100000 || !/^\d+([.,]\d{1,2})?$/.test(limit.trim())
      ? 'Informe um valor de US$ 0 a US$ 100.000 (até 2 casas decimais).'
      : undefined
  const dirty = model !== overview.defaultModel || (parsedLimit !== null && parsedLimit !== overview.monthlyLimitUsd)

  async function save(enabled: boolean, defaultModel: string, monthlyLimitUsd: number, okMessage: string) {
    const next = await aiApi.updateSettings({ enabled, defaultModel, monthlyLimitUsd })
    apply(next)
    toast.success(okMessage)
    return next
  }

  async function toggle(next: boolean) {
    setToggling(true)
    try {
      await save(next, overview.defaultModel, overview.monthlyLimitUsd, next ? 'IA ligada' : 'IA desligada')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar.')
    } finally {
      setToggling(false)
    }
  }

  async function saveModelAndLimit() {
    if (limitError || parsedLimit === null) return
    setSaving(true)
    try {
      const next = await save(overview.enabled, model, parsedLimit, 'Modelo e limite salvos')
      setModel(next.defaultModel)
      setLimit(decimalText(next.monthlyLimitUsd))
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const month = overview.month
  const monthName = MONTHS[new Date(month.start).getUTCMonth()] ?? ''
  const pct = month.percent ?? 0
  const barTone = month.blocked ? 'bg-accent-red-deep' : month.warning ? 'bg-accent-orange-deep' : 'bg-accent-blue'

  return (
    <AiSection id="ia-situacao" title="Situação e limite" description="Liga ou desliga toda a IA, escolhe o modelo padrão e o limite de gasto do mês.">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2">
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{overview.enabled ? 'IA ligada' : 'IA desligada'}</p>
          <p className="text-sm text-text-secondary">
            {overview.enabled
              ? 'Os recursos ligados abaixo funcionam no app.'
              : 'Nenhum recurso de IA funciona, nem o "Tirar o fundo".'}
          </p>
        </div>
        <AiSwitch checked={overview.enabled} onChange={(next) => void toggle(next)} label="IA ligada" disabled={toggling} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="ia-modelo-padrao"
          label="Modelo padrão"
          options={overview.prices.map((p) => ({ value: p.model, label: p.displayName }))}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Input
          id="ia-limite"
          label="Limite mensal (US$)"
          inputMode="decimal"
          autoComplete="off"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          error={limit.trim() && limitError ? limitError : undefined}
          helperText="0 = nenhum uso pago. Acima do limite, toda chamada paga é recusada."
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => void saveModelAndLimit()} loading={saving} disabled={!dirty || !!limitError}>
          Salvar modelo e limite
        </Button>
      </div>

      <div className="flex flex-col gap-2" data-ia-gasto>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-text-primary">Gasto em {monthName}</p>
          <p className="text-sm text-text-secondary">
            {formatUsd(month.spentUsd)} de {formatUsd(month.limitUsd)}
            {month.percent !== null && ` (${formatPercent(month.percent)})`}
          </p>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-bg-tertiary"
          role="progressbar"
          aria-label="Gasto do mês em relação ao limite"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(pct))}
        >
          <div className={cn('h-full rounded-full transition-all', barTone)} style={{ width: `${Math.min(100, Math.max(month.spentUsd > 0 ? 2 : 0, pct))}%` }} />
        </div>
        {month.limitUsd <= 0 ? (
          <p className="text-sm text-text-secondary">Limite US$ 0: nenhuma chamada paga é feita. O "Tirar o fundo" (no aparelho) não tem custo.</p>
        ) : month.blocked ? (
          <p className="flex items-start gap-2 rounded-lg bg-accent-red-soft px-3 py-2 text-sm text-accent-red-deep" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Limite do mês atingido: as chamadas pagas estão recusadas até o próximo mês ou até você aumentar o limite.
          </p>
        ) : month.warning ? (
          <p className="flex items-start gap-2 rounded-lg bg-accent-yellow-soft px-3 py-2 text-sm text-text-primary" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Atenção: o gasto do mês já passou de 80 % do limite.
          </p>
        ) : null}
      </div>
    </AiSection>
  )
}
