import { Crosshair } from 'lucide-react'
import { Input } from '../ui/Input'
import { cn } from '../../utils/cn'
import { KNOCKOUT_HINTS, KNOCKOUT_LABELS, KNOCKOUT_TYPES, type KnockoutType } from '../../utils/knockout'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface KnockoutFieldsProps {
  /** Prefixo dos ids (estrutura e torneio podem estar na mesma tela de teste) */
  idPrefix: string
  type: KnockoutType
  onTypeChange: (type: KnockoutType) => void
  /** Valor do bounty como texto do campo */
  bounty: string
  onBountyChange: (value: string) => void
  /** Buy-in e rebuy de agora, para a conta "R$ X bounty + R$ Y prize pool" */
  buyIn: number
  rebuy?: number | null
  error?: string | null
  /** Texto de cima (estrutura: "padrão dos torneios criados com esta estrutura") */
  description?: string
}

/**
 * Formato do torneio (SPEC-20261026-1909): Normal, Knockout simples ou Knockout progressivo (PKO) e o valor do bounty —
 * o mesmo bloco na estrutura de blinds (padrão) e no formulário do torneio (herdado, pode trocar). Mostra a conta do
 * buy-in (bounty + prize pool) e as regras do formato escolhido.
 */
export function KnockoutFields({
  idPrefix,
  type,
  onTypeChange,
  bounty,
  onBountyChange,
  buyIn,
  rebuy,
  error,
  description,
}: KnockoutFieldsProps) {
  const value = Number(bounty) || 0
  const knockout = type !== 'None'
  const toPool = Math.max(0, Math.round((buyIn - value) * 100) / 100)
  return (
    <section aria-labelledby={`${idPrefix}-knockout-titulo`} data-knockout-fields>
      <h2
        id={`${idPrefix}-knockout-titulo`}
        className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-secondary"
      >
        Formato do torneio
      </h2>
      {description && <p className="mb-3 text-xs text-text-secondary">{description}</p>}
      {/* Botões do tamanho do texto, crescendo para ocupar a linha (o "Knockout progressivo (PKO)" não quebra em 3 linhas) */}
      <div role="radiogroup" aria-label="Formato do torneio" className="flex flex-wrap gap-2">
        {KNOCKOUT_TYPES.map((k) => {
          const selected = type === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={selected}
              data-knockout-option={k}
              onClick={() => onTypeChange(k)}
              className={cn(
                'flex min-h-[44px] flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-accent-blue bg-accent-blue-soft text-accent-blue'
                  : 'border-border-input bg-bg-input text-text-secondary hover:bg-bg-tertiary',
              )}
            >
              {k !== 'None' && <Crosshair className="h-4 w-4 shrink-0" aria-hidden />}
              {KNOCKOUT_LABELS[k]}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-text-secondary">{KNOCKOUT_HINTS[type]}</p>

      {knockout && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            id={`${idPrefix}-bounty`}
            label="Bounty por entrada (R$) *"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={bounty}
            onChange={(e) => onBountyChange(e.target.value)}
            error={error ?? undefined}
            placeholder="Ex.: 50"
          />
          <div className="rounded-lg border border-border-default bg-bg-primary p-3 text-sm" data-knockout-split>
            {buyIn > 0 && value > 0 ? (
              <p className="text-text-primary">
                Buy-in de <span className="tabular-nums">{formatCurrency(buyIn)}</span>:{' '}
                <span className="font-semibold tabular-nums text-accent-purple-deep">{formatCurrency(value)}</span> de bounty
                + <span className="font-semibold tabular-nums">{formatCurrency(toPool)}</span> para o prize pool.
              </p>
            ) : (
              <p className="text-text-secondary">O bounty sai do buy-in; o resto vai para o prize pool.</p>
            )}
            <p className="mt-1 text-xs text-text-secondary">
              Cada rebuy{(rebuy ?? 0) > 0 ? ` (${formatCurrency(rebuy ?? 0)})` : ''} compra um bounty novo do mesmo valor;
              add-on não tem bounty. O campeão fica com o próprio bounty.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
