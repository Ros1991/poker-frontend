import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, RotateCw, Timer } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { lockBodyScroll } from '../../utils/scrollLock'
import type { AlertSound } from '../../utils/alertSound'
import { TIMEBANK_WARNING_SECONDS, timebankCountText, timebanksLeftText } from '../../utils/timebank'
import { useWakeLock } from '../../hooks/useWakeLock'
import type { TournamentEntry } from '../../types/entry.types'
import { playerName } from './terminalFormat'

/** Situação do registro de um uso no servidor (a contagem não depende dela — D4) */
export type TimebankRegistration =
  | { state: 'pending' }
  | { state: 'ok'; remaining: number }
  | { state: 'error'; message: string }

/** Um timebank gasto nesta contagem (um por virada). `key` = actionId do uso: o "Tentar de novo" manda o mesmo */
export interface TimebankUse {
  key: string
  entry: TournamentEntry
  /** A virada que este timebank cobre (1 = a de X segundos, 2 = a de 2X…) */
  turn: number
  /** Timebanks do jogador quando o uso começou (antes de o servidor responder, sobram `before − 1`) */
  before: number
  registration: TimebankRegistration
  retrying: boolean
  activityId: string | null
}

/**
 * Fases do cronômetro contínuo: tempo de ação (antes da 1ª virada) → timebank (toda virada que passou foi coberta) →
 * escolha (virada sem jogador escolhido: a contagem segue pedindo a escolha) ou esgotado (o escolhido não tem mais
 * timebank: a contagem segue em vermelho até "Encerrar")
 */
export type TimebankPhase = 'action' | 'timebank' | 'choose' | 'expired'

interface TimebankCountdownProps {
  /** Tempo configurado no torneio: o tempo de ação e o tempo de cada timebank (as viradas são em X, 2X, 3X…) */
  seconds: number
  /** `performance.now()` do toque em "Tempo": a contagem nunca para nem volta ao começo */
  startedAt: number
  /** Bipe/vibração criados no toque no cronômetro (o som só sai com o AudioContext nascido num gesto) */
  sound: AlertSound
  /** Quem pode estar pensando: os jogadores da mesa escolhida no terminal (sem mesas, todos que estão jogando) */
  candidates: TournamentEntry[]
  /** Mostra o lugar de cada um na lista (com o recurso de mesas) */
  showSeat: boolean
  /** Quem está pensando (null = ninguém escolhido ainda) */
  chosen: TournamentEntry | null
  /** Timebanks que cada um ainda pode gastar, já descontados os usos desta contagem (por id da inscrição) */
  left: Record<string, number>
  /** Timebanks gastos nesta contagem, um por virada, na ordem */
  uses: TimebankUse[]
  /** Passou uma virada: cobra 1 timebank do escolhido (se ele tiver) */
  onTurn: () => void
  /** Escolheu (ou trocou) quem está pensando: as viradas já passadas sem timebank são cobradas dele na hora */
  onChoose: (entry: TournamentEntry) => void
  /** "Tentar de novo" dos usos que não foram registrados (o mesmo actionId: o servidor não desconta duas vezes) */
  onRetry: (keys: string[]) => void
  /** "Encerrar": fecha e volta à mesa */
  onClose: () => void
}

/**
 * Quanto passou desde `startedAt`, recalculado a cada 100 ms pelo relógio do aparelho (não por ticks: a aba em segundo
 * plano não atrasa). Nunca volta ao começo.
 */
function useElapsedMs(startedAt: number): number {
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(id)
  }, [startedAt])
  return Math.max(0, now - startedAt)
}

/** "0:47", "12:05" */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Cronômetro do timebank em tela cheia no celular do dealer — contínuo desde a SPEC-20261103-1928 (antes, SPEC-20261030-1018,
 * cada escolha começava outra contagem do zero). Um relógio só, do toque no "Tempo" do topo do terminal até "Encerrar":
 * nunca para nem volta ao começo. Os primeiros X segundos são o tempo de ação (não gasta nada); em X, 2X, 3X… acontecem
 * as viradas, e cada uma gasta 1 timebank de quem está pensando.
 *
 * A lista "Quem está pensando?" fica na tela o tempo todo: o dealer escolhe o jogador já nos primeiros segundos, ou na
 * virada, ou depois — e pode trocar antes de qualquer virada. Virada sem ninguém escolhido não para nada: a tela pede a
 * escolha e, ao escolher, as viradas que passaram são cobradas na hora (até o que o jogador tem). Sem timebank (ou quando
 * os dele acabam), a contagem segue em vermelho como "tempo esgotado" até "Encerrar".
 *
 * Grande: o tempo até a próxima virada (no esgotado, quanto passou dele); menor: o total desde o toque. Bipe + vibração
 * 10 s antes de cada virada (só com tempo maior que 10 s) e na virada; depois de esgotado, silêncio. A contagem é local
 * (D4) e nunca espera a rede: o registro aparece embaixo ("Registrando…", "Registrado · N restantes" ou "Não registrado —
 * Tentar de novo"). A tela fica acesa e não fecha por toque fora nem por Esc — só por "Encerrar".
 */
export function TimebankCountdown({
  seconds,
  startedAt,
  sound,
  candidates,
  showSeat,
  chosen,
  left,
  uses,
  onTurn,
  onChoose,
  onRetry,
  onClose,
}: TimebankCountdownProps) {
  const elapsedMs = useElapsedMs(startedAt)
  const periodMs = Math.max(1, seconds * 1000)
  const turns = Math.floor(elapsedMs / periodMs)
  const covered = uses.length
  const chosenLeft = chosen ? (left[chosen.id] ?? 0) : 0
  // A virada que acabou de passar ainda vai ser cobrada (o onTurn roda logo depois desta renderização)
  const pendingCharge = chosen ? Math.min(chosenLeft, Math.max(0, turns - covered)) : 0
  const coveredNow = covered + pendingCharge
  const remainingNow = chosenLeft - pendingCharge
  const phase: TimebankPhase = turns === 0 ? 'action' : turns <= coveredNow ? 'timebank' : chosen ? 'expired' : 'choose'
  const expired = phase === 'expired'
  const toNextMs = (turns + 1) * periodMs - elapsedMs
  const toNext = Math.ceil(toNextMs / 1000)
  // Esgotado: quanto passou do fim do último tempo coberto
  const overSeconds = Math.floor((elapsedMs - (coveredNow + 1) * periodMs) / 1000)
  const warning = !expired && toNext <= TIMEBANK_WARNING_SECONDS && seconds > TIMEBANK_WARNING_SECONDS
  const pct = expired ? 100 : (toNextMs / periodMs) * 100
  const unpaid = phase === 'choose' ? turns - covered : 0
  // Bipe/vibração já tocados (por virada)
  const warnedTurn = useRef(0)
  const endedTurn = useRef(0)

  useWakeLock(true)
  useEffect(() => lockBodyScroll(), [])

  // Cada virada cobra o timebank do escolhido (e a escolha feita depois cobra as que passaram — no onChoose)
  useEffect(() => {
    if (turns > 0) onTurn()
  }, [turns, onTurn])

  // Bipe + vibração aos 10 s antes de cada virada e na virada; depois que o tempo esgotou de vez, silêncio
  useEffect(() => {
    const audible = (k: number) => !chosen || k <= coveredNow + 1
    const next = turns + 1
    if (seconds > TIMEBANK_WARNING_SECONDS && warnedTurn.current < next && toNextMs <= TIMEBANK_WARNING_SECONDS * 1000) {
      warnedTurn.current = next
      if (audible(next)) sound.warn()
    }
    if (turns > endedTurn.current) {
      endedTurn.current = turns
      if (audible(turns)) sound.end()
    }
  }, [turns, toNextMs, seconds, chosen, coveredNow, sound])

  const name = chosen ? playerName(chosen) : ''
  const title =
    phase === 'action'
      ? `Tempo de ação · ${seconds} s`
      : phase === 'choose'
        ? 'Tempo de ação esgotado'
        : phase === 'timebank'
          ? `Timebank de ${name} (${timebanksLeftText(remainingNow)})`
          : `Tempo esgotado · ${name}`

  // Registro: erro primeiro (com "Tentar de novo"), depois pendente, senão o último registrado
  const errored = uses.filter((u) => u.registration.state === 'error')
  const pendingUses = uses.filter((u) => u.registration.state === 'pending')
  const last = uses.length > 0 ? uses[uses.length - 1] : null
  const registration = errored.length > 0 ? 'error' : pendingUses.length > 0 ? 'pending' : last ? 'ok' : null
  const retrying = errored.some((u) => u.retrying)

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] flex h-dvh flex-col',
        expired || phase === 'choose' ? 'bg-accent-red-soft' : 'bg-bg-primary',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-timebank-countdown={phase}
      data-timebank-warning={warning ? '' : undefined}
      data-timebank-turns={turns}
    >
      <header className="flex shrink-0 items-center justify-center gap-2 border-b border-border-default bg-bg-secondary px-3 py-2.5">
        <Timer className="h-5 w-5 shrink-0 text-accent-orange-deep" aria-hidden />
        <span className="min-w-0 truncate text-base font-semibold text-text-primary" data-timebank-countdown-title>
          {title}
        </span>
      </header>

      {/* O relógio: nunca para nem volta ao começo */}
      <section className="flex shrink-0 flex-col items-center gap-1.5 px-4 pb-2 pt-3 text-center" aria-label="Contagem">
        <p
          className={cn(
            'font-bold leading-none tabular-nums',
            'text-[min(30vw,19dvh,10rem)]',
            expired || warning ? 'text-accent-red-deep' : 'text-text-primary',
          )}
          aria-live="off"
          data-timebank-countdown-left={expired ? overSeconds : toNext}
        >
          {expired ? `+${overSeconds}` : toNext}
        </p>
        <p
          className={cn('text-base font-semibold', expired || warning ? 'text-accent-red-deep' : 'text-text-secondary')}
          aria-live="assertive"
        >
          {expired
            ? 'Tempo esgotado!'
            : warning
              ? 'Acabando…'
              : phase === 'action'
                ? 'segundos de tempo de ação'
                : phase === 'timebank'
                  ? 'segundos do timebank'
                  : 'segundos até a próxima virada'}
        </p>
        <div
          className="h-3 w-full max-w-md overflow-hidden rounded-full bg-bg-tertiary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={seconds}
          aria-valuenow={expired ? 0 : toNext}
          aria-label="Tempo até a próxima virada"
          data-timebank-countdown-bar
        >
          <div
            className={cn(
              'h-full rounded-full',
              warning || expired ? 'bg-accent-red-deep' : phase === 'action' ? 'bg-accent-blue' : 'bg-accent-orange',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-text-secondary">
          <span className="tabular-nums" data-timebank-elapsed={Math.floor(elapsedMs / 1000)}>
            Total {clock(elapsedMs / 1000)}
          </span>
          {chosen && (
            <span>
              · <span className="font-semibold text-text-primary" data-timebank-countdown-name>{name}</span> pensando
            </span>
          )}
        </p>
      </section>

      {/* Quem está pensando: aberta o tempo todo (escolher antes, na virada ou depois; trocar antes de qualquer virada) */}
      <main className="flex min-h-0 flex-1 flex-col border-t border-border-default px-3 pt-2.5">
        {phase === 'choose' ? (
          <div
            className="mb-2 rounded-lg border border-accent-red-deep/40 bg-bg-card px-3 py-2 text-center"
            role="alert"
            data-timebank-choose-alert
          >
            <p className="text-base font-bold text-accent-red-deep">Quem está pensando?</p>
            <p className="text-sm text-text-secondary">
              {unpaid === 1
                ? 'Passou 1 virada sem jogador: ao escolher, gasta 1 timebank dele.'
                : `Passaram ${unpaid} viradas sem jogador: ao escolher, gasta ${unpaid} timebanks dele (até o que ele tem).`}
            </p>
          </div>
        ) : (
          <div className="mb-2 text-center">
            <h2 className="text-lg font-bold text-text-primary">Quem está pensando?</h2>
            <p className="text-xs text-text-secondary">
              Escolha a qualquer momento: cada virada de {seconds} s gasta 1 timebank dele.
            </p>
          </div>
        )}
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-text-secondary">Ninguém jogando nesta mesa.</p>
        ) : (
          <ul
            className="-mx-1 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-1.5 overflow-y-auto px-1 pb-3"
            data-timebank-candidates
          >
            {candidates.map((entry) => {
              const isChosen = chosen?.id === entry.id
              const count = Math.max(0, (left[entry.id] ?? entry.timebanksRemaining ?? 0) - (isChosen ? pendingCharge : 0))
              const off = count <= 0
              const seat = showSeat ? entry.seatNumber : null
              return (
                <li key={entry.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onChoose(entry)}
                    aria-pressed={isChosen}
                    className={cn(
                      'flex min-h-[52px] w-full touch-manipulation items-center gap-2 rounded-lg border p-1.5 text-left active:scale-[0.99]',
                      isChosen
                        ? 'border-accent-orange-deep bg-accent-orange-soft ring-2 ring-accent-orange-deep'
                        : off
                          ? 'border-border-default bg-bg-zebra'
                          : 'border-border-input bg-bg-card',
                    )}
                    aria-label={`${playerName(entry)}: ${timebankCountText(count)}${isChosen ? ' (pensando)' : ''}`}
                    data-timebank-pick={entry.id}
                    data-timebank-pick-left={count}
                    data-timebank-pick-chosen={isChosen ? '' : undefined}
                  >
                    {seat != null && (
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary" aria-hidden>
                        {seat}
                      </span>
                    )}
                    <span className="relative shrink-0">
                      <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="sm" />
                      {/* Marca de "pensando" sobre a foto (sem roubar a largura do nome e da contagem) */}
                      {isChosen && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-accent-orange-deep bg-bg-card">
                          <Check className="h-3 w-3 text-accent-orange-deep" strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          'truncate text-sm font-semibold leading-tight',
                          off && !isChosen ? 'text-text-secondary' : 'text-text-primary',
                        )}
                        data-timebank-pick-name
                      >
                        {playerName(entry)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums',
                          off ? 'text-text-secondary' : 'text-accent-orange-deep',
                        )}
                      >
                        {!off && <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        {timebankCountText(count)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <footer
        className="shrink-0 border-t border-border-default bg-bg-secondary px-3 pt-2.5"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {registration && (
          <div
            className="mb-2 flex min-h-[40px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm"
            data-timebank-registration={registration}
          >
            {registration === 'pending' && (
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Registrando o uso…
              </span>
            )}
            {registration === 'ok' && last?.registration.state === 'ok' && (
              <span className="inline-flex items-center gap-1.5 text-accent-green-deep">
                <Check className="h-4 w-4" aria-hidden />
                {uses.length === 1
                  ? `Registrado · ${timebanksLeftText(last.registration.remaining)}`
                  : `${uses.length} registrados · ${playerName(last.entry)}: ${timebanksLeftText(last.registration.remaining)}`}
              </span>
            )}
            {registration === 'error' && (
              <>
                <span
                  role="alert"
                  className="font-semibold text-accent-red-deep"
                  title={errored[0].registration.state === 'error' ? errored[0].registration.message : undefined}
                >
                  {errored.length === 1 ? 'Não registrado —' : `${errored.length} não registrados —`}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetry(errored.map((u) => u.key))}
                  loading={retrying}
                  data-timebank-retry
                >
                  {!retrying && <RotateCw className="h-4 w-4" aria-hidden />} Tentar de novo
                </Button>
              </>
            )}
          </div>
        )}

        {expired && (
          <p className="mb-2 text-center text-base font-semibold text-accent-red-deep" role="status" data-timebank-none>
            {uses.some((u) => u.entry.id === chosen?.id) ? `Os timebanks de ${name} acabaram` : `${name} não tem timebank`} —
            tempo esgotado
          </p>
        )}

        <Button
          size="lg"
          variant={expired ? 'danger' : phase === 'choose' ? 'secondary' : 'primary'}
          className="w-full"
          onClick={onClose}
          data-timebank-close
        >
          Encerrar
        </Button>
      </footer>
    </div>,
    document.body,
  )
}
