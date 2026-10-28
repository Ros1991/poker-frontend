import { useState } from 'react'
import { toast } from 'sonner'
import * as aiApi from '../../api/ai.api'
import type { AiOverview } from '../../types/ai.types'
import { Badge } from '../../components/ui/Badge'
import { errorMessage } from '../../utils/httpErrors'
import { AiSection } from './AiSection'
import { AiSwitch } from './AiSwitch'
import { formatTokens } from './aiFormat'
import { useApplyOverview } from './useAiOverview'

/** Recursos de IA com liga/desliga próprio (o catálogo vem do servidor: cada recurso declara nome, descrição e custo) */
export function AiFeaturesSection({ overview }: { overview: AiOverview }) {
  const apply = useApplyOverview()
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(key: string, enabled: boolean) {
    setBusy(key)
    try {
      apply(await aiApi.setFeature(key, enabled))
      toast.success(enabled ? 'Recurso ligado' : 'Recurso desligado')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AiSection id="ia-recursos" title="Recursos" description="Cada recurso liga e desliga sozinho. Com a IA desligada, nenhum funciona.">
      <ul className="flex flex-col gap-3">
        {overview.features.map((f) => (
          <li key={f.key} className="flex items-start justify-between gap-3 rounded-lg border border-border-default px-3 py-3" data-ia-recurso={f.key}>
            <div className="min-w-0">
              <p className="font-medium text-text-primary">{f.name}</p>
              <p className="mt-0.5 text-sm text-text-secondary">{f.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {f.isPaid ? <Badge color="blue">Pago</Badge> : <Badge color="green">Sem custo</Badge>}
                {f.runsOnDevice && <Badge color="gray">No aparelho</Badge>}
                <span className="text-xs text-text-secondary" data-ia-recurso-usos>
                  {f.monthUses === 1
                    ? `1 ${f.runsOnDevice ? 'uso' : 'chamada'} neste mês`
                    : `${formatTokens(f.monthUses)} ${f.runsOnDevice ? 'usos' : 'chamadas'} neste mês`}
                </span>
              </div>
            </div>
            <AiSwitch
              checked={f.enabled}
              onChange={(next) => void toggle(f.key, next)}
              label={`${f.name}: ${f.enabled ? 'ligado' : 'desligado'}`}
              disabled={busy === f.key}
            />
          </li>
        ))}
      </ul>
    </AiSection>
  )
}
