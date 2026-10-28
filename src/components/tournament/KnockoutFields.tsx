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
 * o mesmo bloco na estrutura de blinds (padrão) e no formulário do torneio (herdado, pode trocar). Cada formato é um
 * cartão com o nome e a regra dentro (SPEC-20261027-1311); mostra a conta do buy-in (bounty + prize pool).
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
  // Bounty que não é menor que o buy-in (revisão geral 2): no lugar da conta, o aviso no estilo de erro do campo — a
  // conta "R$ 150 de bounty + R$ 0 para o prize pool" não fechava. O servidor recusa com 400 do mesmo jeito.
  const bountyTooBig = buyIn > 0 && value > 0 && value >= buyIn
  return (
    <section aria-labelledby={`${idPrefix}-knockout-titulo`} data-knockout-fields>
      <h2
        id={`${idPrefix}-knockout-titulo`}
        className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-secondary"
      >
        Formato do torneio
      </h2>
      {description && <p className="mb-3 text-xs text-text-secondary">{description}</p>}
      {/* Cartões de seleção (SPEC-20261027-1311): nome + descrição curta DENTRO do cartão, texto quebrando linha (nunca
          passa da borda). Empilhados e de largura total no celular; lado a lado a partir de 640 px, onde cabem. */}
      <div role="radiogroup" aria-label="Formato do torneio" className="grid gap-2 sm:grid-cols-3">
        {KNOCKOUT_TYPES.map((k) => {
          const selected = type === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-labelledby={`${idPrefix}-knockout-${k}-nome`}
              aria-describedby={`${idPrefix}-knockout-${k}-desc`}
              data-knockout-option={k}
              onClick={() => onTypeChange(k)}
              className={cn(
                'flex min-h-[44px] w-full min-w-0 items-start gap-3 rounded-lg border-2 px-3 py-3 text-left transition-colors',
                selected
                  ? 'border-accent-blue bg-accent-blue-soft'
                  : 'border-border-input bg-bg-input hover:bg-bg-tertiary',
              )}
            >
              {/* Bolinha de rádio: o escolhido fica marcado também sem depender só da cor */}
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  selected ? 'border-accent-blue' : 'border-border-input bg-bg-card',
                )}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent-blue" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn(
                    'flex min-w-0 items-start gap-1.5 break-words text-sm font-semibold leading-snug',
                    selected ? 'text-accent-blue-deep' : 'text-text-primary',
                  )}
                  data-knockout-option-name
                >
                  {k !== 'None' && <Crosshair className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                  <span id={`${idPrefix}-knockout-${k}-nome`} className="min-w-0">
                    {KNOCKOUT_LABELS[k]}
                  </span>
                </span>
                <span
                  id={`${idPrefix}-knockout-${k}-desc`}
                  className="break-words text-xs leading-snug text-text-secondary"
                  data-knockout-option-desc
                >
                  {KNOCKOUT_HINTS[k]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

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
            {bountyTooBig ? (
              <p role="alert" className="text-xs text-accent-red-deep" data-knockout-bounty-error>
                O bounty precisa ser menor que o buy-in ({formatCurrency(buyIn)}).
              </p>
            ) : buyIn > 0 && value > 0 ? (
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
