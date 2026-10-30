import { Timer } from 'lucide-react'
import { Input } from '../ui/Input'
import { TIMEBANK_MAX_COUNT, TIMEBANK_MAX_SECONDS, TIMEBANK_MIN_SECONDS } from '../../utils/timebank'

interface TimebankFieldsProps {
  /** Prefixo dos ids (estrutura e torneio) */
  idPrefix: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** Texto dos campos */
  count: string
  onCountChange: (value: string) => void
  seconds: string
  onSecondsChange: (value: string) => void
  countError?: string | null
  secondsError?: string | null
  /** Texto de cima (estrutura: "padrão dos torneios criados com esta estrutura") */
  description?: string
  /** Aviso embaixo dos campos (edição do rascunho com inscritos: a quantidade nova vale para todos) */
  note?: string | null
}

/**
 * Cartão "Timebank" (SPEC-20261029-1722, D3) no formulário do torneio (herdado da estrutura, pode trocar) e no da
 * estrutura de blinds (padrão): liga/desliga e, ligado, "Timebanks por jogador" (1 a 99) e "Tempo de ação (segundos)" (5 a
 * 300 — desde a SPEC-20261030-1018 o mesmo valor é o tempo de ação do cronômetro do terminal e o tempo que cada timebank
 * dá a mais). Desligado por padrão; desligado, só o liga/desliga aparece. Em todos os planos (é controle do jogo).
 */
export function TimebankFields({
  idPrefix,
  enabled,
  onEnabledChange,
  count,
  onCountChange,
  seconds,
  onSecondsChange,
  countError,
  secondsError,
  description,
  note,
}: TimebankFieldsProps) {
  return (
    <section aria-labelledby={`${idPrefix}-timebank-titulo`} data-timebank-fields>
      <h2
        id={`${idPrefix}-timebank-titulo`}
        className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-secondary"
      >
        Timebank
      </h2>
      <p className="mb-2 text-xs text-text-secondary">
        {description ??
          'Cada jogador começa com alguns timebanks para pedir mais tempo numa decisão. O dealer conta o tempo no celular, pelo cronômetro do terminal.'}
      </p>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
        <input
          id={`${idPrefix}-timebank-ligado`}
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
          data-timebank-toggle
        />
        <Timer className="h-4 w-4 shrink-0 text-accent-orange-deep" aria-hidden />
        <span className="text-sm text-text-primary">Usar timebank</span>
      </label>
      {enabled && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Input
            id={`${idPrefix}-timebank-quantidade`}
            label="Timebanks por jogador"
            type="number"
            min={1}
            max={TIMEBANK_MAX_COUNT}
            step={1}
            inputMode="numeric"
            value={count}
            onChange={(e) => onCountChange(e.target.value)}
            error={countError ?? undefined}
            placeholder="Ex.: 3"
          />
          <Input
            id={`${idPrefix}-timebank-segundos`}
            label="Tempo de ação (segundos)"
            type="number"
            min={TIMEBANK_MIN_SECONDS}
            max={TIMEBANK_MAX_SECONDS}
            step={5}
            inputMode="numeric"
            value={seconds}
            onChange={(e) => onSecondsChange(e.target.value)}
            error={secondsError ?? undefined}
            placeholder="30"
            helperText="O dealer dispara o cronômetro; passado esse tempo, cada timebank dá mais esse tempo ao jogador."
          />
        </div>
      )}
      {enabled && note && <p className="mt-2 text-xs text-text-secondary" data-timebank-note>{note}</p>}
    </section>
  )
}
