import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '../../utils/cn'
import {
  blindsSizeClass,
  blindsText,
  formatChips,
  isLastLevel,
  isStructureFinished,
  nextBreakText,
  timerUrgencyClass,
} from '../../utils/timerDisplay'
import type { BlindsSizes } from '../../utils/timerDisplay'
import type { TimerState } from '../../types/blind.types'

// Blinds pelo comprimento do texto (a regra do telão, SPEC-20261029-1720: até 13 caracteres, 14–16, 17+), numa linha só; em
// tela baixa (celular deitado) um degrau abaixo. O ante acompanha o degrau dos blinds; o "Próximo" usa o texto dele. Classes
// literais inteiras: o Tailwind só gera a classe que aparece completa no código.
const BLINDS_SIZES: BlindsSizes = [
  'text-5xl [@media(max-height:480px)]:text-4xl',
  'text-4xl [@media(max-height:480px)]:text-3xl',
  'text-3xl [@media(max-height:480px)]:text-2xl',
]
const ANTE_SIZES: BlindsSizes = [
  'text-4xl [@media(max-height:480px)]:text-3xl',
  'text-3xl [@media(max-height:480px)]:text-2xl',
  'text-2xl [@media(max-height:480px)]:text-xl',
]
const NEXT_SIZES: BlindsSizes = ['text-xl', 'text-lg', 'text-base']

interface CompactClockTileProps {
  label: string
  children: ReactNode
  className?: string
  /** Classe de fonte (e cor) do valor; padrão text-xl */
  valueClassName?: string
  /** Vai em `data-compact-tile` (conferência das suítes) */
  tileId?: string
}

/** Um bloco "rótulo + valor" do relógio compacto (Próximo, Próximo intervalo e os que a tela acrescenta) */
export function CompactClockTile({ label, children, className, valueClassName = 'text-xl', tileId }: CompactClockTileProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border-default bg-bg-card px-3 py-2 [@media(max-height:480px)]:py-1.5',
        className,
      )}
      data-compact-tile={tileId}
    >
      <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{label}</dt>
      <dd className={cn('mt-0.5 whitespace-nowrap font-bold leading-tight tabular-nums text-text-primary', valueClassName)}>
        {children}
      </dd>
    </div>
  )
}

interface CompactClockProps {
  timerState: TimerState
  /** "MM:SS" do useBlindTimer */
  formattedTime: string
  /** 0–100 do useBlindTimer */
  progressPercentage: number
  /**
   * Segundos até o próximo intervalo (`secondsToBreak` de utils/timerDisplay). Sem a prop (tela sem os níveis da
   * estrutura) o bloco "Próximo intervalo" não aparece.
   */
  secondsToBreak?: number | null
  /** Blocos a mais (CompactClockTile) depois do "Próximo" e do "Próximo intervalo": jogando, fichas, premiação… */
  children?: ReactNode
  className?: string
}

/**
 * Relógio compacto (SPEC-20261029-1721) do telão no celular, reutilizável pela área do jogador: "Nível N" / "INTERVALO" /
 * "Último nível", o relógio grande com a cor de urgência da TV, a barra, Blinds / Ante e os blocos Próximo e Próximo
 * intervalo. Em pé, tudo numa coluna; deitado (e no computador), o relógio à esquerda e os números à direita.
 */
export function CompactClock({
  timerState,
  formattedTime,
  progressPercentage,
  secondsToBreak,
  children,
  className,
}: CompactClockProps) {
  // Fim da estrutura (D2): último nível com o tempo esgotado — 00:00, os blinds do último nível e o selo "Último nível"
  const structureFinished = isStructureFinished(timerState)
  const lastLevel = isLastLevel(timerState)
  const currentBlinds = blindsText(timerState.smallBlind, timerState.bigBlind)
  // Intervalo com blinds zerados (o comum): sem a linha "0 / 0"; o "Próximo" já mostra os blinds da volta
  const showBlinds = !timerState.isBreak || timerState.bigBlind > 0
  const nextBlinds =
    !lastLevel && timerState.nextSmallBlind != null
      ? blindsText(timerState.nextSmallBlind, timerState.nextBigBlind ?? 0)
      : null
  // Sem próximo nível de blinds: ou acabou a estrutura, ou o próximo é um intervalo
  const nextText = nextBlinds ?? (lastLevel ? 'Último nível' : 'Intervalo')
  const stopped = !timerState.isRunning && !structureFinished

  return (
    <div
      className={cn('grid w-full gap-4 landscape:grid-cols-2 landscape:items-center landscape:gap-6', className)}
      data-compact-clock
    >
      <section className="flex min-w-0 flex-col items-center gap-2" aria-label="Relógio">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {structureFinished ? (
            <span
              className="rounded-full bg-accent-red-soft px-4 py-1 text-sm font-semibold uppercase tracking-wider text-accent-red-deep"
              data-compact-label="last"
            >
              Último nível
            </span>
          ) : timerState.isBreak ? (
            <span
              className="rounded-full bg-accent-gold-soft px-4 py-1 text-sm font-semibold text-accent-gold-deep"
              data-compact-label="break"
            >
              INTERVALO
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-lg font-medium text-accent-blue" data-compact-label="level">
              <Clock className="h-5 w-5" aria-hidden />
              Nível {timerState.currentLevel}
            </span>
          )}
          {stopped && (
            <span
              className="rounded-full bg-bg-tertiary px-2.5 py-0.5 text-xs font-semibold text-text-secondary"
              data-compact-stopped
            >
              Pausado
            </span>
          )}
        </div>

        {/* Relógio: em pé pela largura do celular, deitado pela altura; a cor muda no último minuto e nos 30 s finais */}
        <p
          className={cn(
            'font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-500',
            'text-[length:min(30vw,10rem)] landscape:text-[length:min(30vh,14vw)]',
            timerUrgencyClass(timerState.remainingSeconds),
          )}
          data-compact-time
        >
          {formattedTime}
        </p>

        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-border-default" data-compact-progress>
          <div
            className="h-full rounded-full bg-accent-blue transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-label="Blinds">
        {showBlinds && (
          // Blinds e ante cada um numa linha (whitespace-nowrap); se não couberem lado a lado, o ante desce
          <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-1 text-center">
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Blinds</span>
              <span
                className={cn(
                  'whitespace-nowrap font-bold leading-tight tabular-nums text-accent-blue',
                  blindsSizeClass(currentBlinds, BLINDS_SIZES),
                )}
                data-compact-blinds
              >
                {currentBlinds}
              </span>
            </div>
            {timerState.ante > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Ante</span>
                <span
                  className={cn(
                    'whitespace-nowrap font-bold leading-tight tabular-nums text-accent-orange-deep',
                    blindsSizeClass(currentBlinds, ANTE_SIZES),
                  )}
                  data-compact-ante
                >
                  {formatChips(timerState.ante)}
                </span>
              </div>
            )}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2">
          <CompactClockTile
            label="Próximo"
            tileId="next"
            valueClassName={cn(nextBlinds ? blindsSizeClass(nextBlinds, NEXT_SIZES) : 'text-lg', 'text-text-secondary')}
          >
            {nextText}
          </CompactClockTile>
          {secondsToBreak !== undefined && (
            <CompactClockTile label="Próximo intervalo" tileId="break" valueClassName="font-mono text-xl text-accent-gold-deep">
              {nextBreakText(timerState.isBreak, secondsToBreak)}
            </CompactClockTile>
          )}
          {children}
        </dl>
      </section>
    </div>
  )
}
