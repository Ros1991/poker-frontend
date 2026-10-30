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

/** Um timebank gasto nesta contagem. `key` = actionId do uso: o "Tentar de novo" manda o mesmo */
export interface TimebankUse {
  key: string
  entry: TournamentEntry
  /** Timebanks do jogador quando o uso começou (antes de o servidor responder, sobram `before − 1`) */
  before: number
  registration: TimebankRegistration
  retrying: boolean
  activityId: string | null
}

/** Fases do cronômetro: tempo de ação → quem está pensando → timebank do jogador → esgotado (de novo, com mais 1) */
export type TimebankPhase = 'action' | 'choose' | 'timebank' | 'expired'

interface TimebankCountdownProps {
  /** Tempo configurado no torneio: o tempo de ação e o tempo de cada timebank */
  seconds: number
  /** Bipe/vibração criados no toque no cronômetro (o som só sai com o AudioContext nascido num gesto) */
  sound: AlertSound
  /** Quem pode estar pensando: os jogadores da mesa escolhida no terminal (sem mesas, todos que estão jogando) */
  candidates: TournamentEntry[]
  /** Mostra o lugar de cada um na lista (com o recurso de mesas) */
  showSeat: boolean
  /** Timebanks gastos nesta contagem (todos do mesmo jogador; o último é o que está contando) */
  uses: TimebankUse[]
  /** Escolheu quem está pensando: gasta 1 timebank dele e conta de novo */
  onChoose: (entry: TournamentEntry) => void
  /** "Usar mais 1 timebank de Fulano" depois de o timebank acabar */
  onUseAgain: () => void
  /** "Tentar de novo" do uso que não foi registrado (o mesmo actionId: o servidor não desconta duas vezes) */
  onRetry: (key: string) => void
  /** "Encerrar" / "Não usar timebank": fecha e volta à mesa */
  onClose: () => void
}

/**
 * Quanto falta da contagem `runKey`, recalculado a cada 100 ms pelo relógio do aparelho a partir do início da contagem
 * (não por ticks: a aba em segundo plano não atrasa). Trocar o `runKey` começa outra contagem do zero.
 */
function useCountdownMs(totalMs: number, runKey: string): number {
  const [run, setRun] = useState({ key: runKey, leftMs: totalMs })
  useEffect(() => {
    const start = performance.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, totalMs - (performance.now() - start))
      setRun({ key: runKey, leftMs: left })
      if (left <= 0) window.clearInterval(id)
    }, 100)
    return () => window.clearInterval(id)
  }, [totalMs, runKey])
  return run.key === runKey ? run.leftMs : totalMs
}

/**
 * Cronômetro do timebank em tela cheia no celular do dealer (SPEC-20261030-1018; antes, SPEC-20261029-1722, a contagem
 * era disparada por jogador). Um botão só no topo do terminal abre o **tempo de ação** (os segundos do torneio), que não
 * gasta nada — "Encerrar" fecha a qualquer momento (o jogador decidiu). Quando o tempo de ação acaba (bipe e vibração),
 * a tela pergunta **"Quem está pensando?"** com os jogadores da mesa e quantos timebanks cada um tem (quem não tem fica
 * desligado) ou "Não usar timebank". Escolher o jogador gasta 1 timebank dele (registrado no servidor em paralelo) e conta
 * de novo os mesmos segundos; acabando também, oferece "Usar mais 1 timebank de Fulano" (se ele tiver) ou avisa que
 * acabou. Nada é gasto antes de o tempo de ação acabar.
 *
 * A contagem é local (D4) e nunca espera a rede: o registro aparece embaixo ("Registrando…", "Registrado · N restantes" ou
 * "Não registrado — Tentar de novo"). Bipe + vibração aos 10 s e no fim de cada contagem; a tela fica acesa. Não fecha
 * por toque fora — só pelos botões.
 */
export function TimebankCountdown({
  seconds,
  sound,
  candidates,
  showSeat,
  uses,
  onChoose,
  onUseAgain,
  onRetry,
  onClose,
}: TimebankCountdownProps) {
  const current = uses.length > 0 ? uses[uses.length - 1] : null
  // Cada contagem tem a sua chave: o tempo de ação e cada timebank usado
  const runKey = current?.key ?? 'tempo-de-acao'
  const totalMs = seconds * 1000
  const leftMs = useCountdownMs(totalMs, runKey)
  const left = Math.ceil(leftMs / 1000)
  const done = leftMs <= 0
  const phase: TimebankPhase = current ? (done ? 'expired' : 'timebank') : done ? 'choose' : 'action'
  const warning = !done && left <= TIMEBANK_WARNING_SECONDS
  const pct = totalMs > 0 ? (leftMs / totalMs) * 100 : 0
  // Bipe/vibração já tocados (por contagem)
  const warnedFor = useRef<string | null>(null)
  const endedFor = useRef<string | null>(null)

  useWakeLock(true)
  useEffect(() => lockBodyScroll(), [])

  // Bipe + vibração: uma vez ao chegar nos 10 s (só quando o tempo é maior que isso) e uma no fim de cada contagem
  useEffect(() => {
    if (warnedFor.current !== runKey && seconds > TIMEBANK_WARNING_SECONDS && !done && left <= TIMEBANK_WARNING_SECONDS) {
      warnedFor.current = runKey
      sound.warn()
    }
    if (endedFor.current !== runKey && done) {
      endedFor.current = runKey
      sound.end()
    }
  }, [left, done, runKey, seconds, sound])

  const name = current ? playerName(current.entry) : ''
  // Quantos sobram ao jogador depois do uso que está contando (o do servidor quando ele já respondeu)
  const remainingAfter = current
    ? current.registration.state === 'ok'
      ? current.registration.remaining
      : Math.max(0, current.before - 1)
    : 0
  const canUseAgain = current?.registration.state === 'ok' && current.registration.remaining > 0
  const title =
    phase === 'action'
      ? `Tempo de ação · ${seconds} s`
      : phase === 'choose'
        ? 'Tempo de ação esgotado'
        : `Timebank de ${name} (${timebanksLeftText(remainingAfter)})`

  const counting = phase === 'action' || phase === 'timebank'
  const timebankRun = phase === 'timebank' || phase === 'expired'

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] flex h-dvh flex-col',
        phase === 'expired' || phase === 'choose' ? 'bg-accent-red-soft' : 'bg-bg-primary',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-timebank-countdown={phase}
      data-timebank-warning={warning ? '' : undefined}
    >
      <header className="flex shrink-0 items-center justify-center gap-2 border-b border-border-default bg-bg-secondary px-3 py-2.5">
        <Timer className="h-5 w-5 shrink-0 text-accent-orange-deep" aria-hidden />
        <span className="min-w-0 truncate text-base font-semibold text-text-primary" data-timebank-countdown-title>
          {title}
        </span>
      </header>

      {phase === 'choose' ? (
        <main className="flex min-h-0 flex-1 flex-col px-3 pt-3">
          <h2 className="text-center text-2xl font-bold text-text-primary">Quem está pensando?</h2>
          <p className="mb-3 text-center text-sm text-text-secondary">
            Toque no jogador: gasta 1 timebank dele e conta mais {seconds} s.
          </p>
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-text-secondary">Ninguém jogando nesta mesa.</p>
          ) : (
            <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-3" data-timebank-candidates>
              {candidates.map((entry) => {
                const count = entry.timebanksRemaining ?? 0
                const off = count <= 0
                const seat = showSeat ? entry.seatNumber : null
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onChoose(entry)}
                      disabled={off}
                      className={cn(
                        'flex min-h-[56px] w-full touch-manipulation items-center gap-2.5 rounded-lg border p-2 text-left',
                        off
                          ? 'cursor-not-allowed border-border-default bg-bg-zebra'
                          : 'border-border-input bg-bg-card active:scale-[0.99]',
                      )}
                      aria-label={`${playerName(entry)}: ${timebankCountText(count)}`}
                      data-timebank-pick={entry.id}
                      data-timebank-pick-left={count}
                    >
                      {seat != null && (
                        <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary" aria-hidden>
                          {seat}
                        </span>
                      )}
                      <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="md" />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-base font-semibold',
                          off ? 'text-text-secondary' : 'text-text-primary',
                        )}
                        data-timebank-pick-name
                      >
                        {playerName(entry)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums',
                          off ? 'text-text-secondary' : 'text-accent-orange-deep',
                        )}
                      >
                        {!off && <Timer className="h-4 w-4" aria-hidden />}
                        {timebankCountText(count)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-4 text-center">
          {timebankRun && current ? (
            <>
              <Avatar
                src={current.entry.person.photoUrl}
                name={current.entry.person.fullName}
                size="3xl"
                className="max-h-[22dvh] max-w-[22dvh]"
              />
              <p className="max-w-full break-words text-2xl font-bold leading-tight text-text-primary" data-timebank-countdown-name>
                {name}
              </p>
            </>
          ) : (
            <p className="max-w-sm text-sm text-text-secondary" data-timebank-action-hint>
              Sem gastar timebank. Se o tempo acabar, escolha quem está pensando para dar mais {seconds} s.
            </p>
          )}
          <p
            className={cn(
              'font-bold leading-none tabular-nums',
              'text-[min(42vw,32dvh,14rem)]',
              done || warning ? 'text-accent-red-deep' : 'text-text-primary',
            )}
            aria-live="off"
            data-timebank-countdown-left={left}
          >
            {left}
          </p>
          <p className={cn('text-lg font-semibold', done ? 'text-accent-red-deep' : 'text-text-secondary')} aria-live="assertive">
            {done ? 'Tempo esgotado!' : warning ? 'Acabando…' : 'segundos'}
          </p>
          <div
            className="h-3 w-full max-w-md overflow-hidden rounded-full bg-bg-tertiary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={seconds}
            aria-valuenow={left}
            aria-label="Tempo que falta"
            data-timebank-countdown-bar
          >
            <div
              className={cn(
                'h-full rounded-full',
                warning || done ? 'bg-accent-red-deep' : timebankRun ? 'bg-accent-orange' : 'bg-accent-blue',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </main>
      )}

      <footer
        className="shrink-0 border-t border-border-default bg-bg-secondary px-3 pt-2.5"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {current && (
          <div
            className="mb-2.5 flex min-h-[44px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm"
            data-timebank-registration={current.registration.state}
          >
            {current.registration.state === 'pending' && (
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Registrando o uso…
              </span>
            )}
            {current.registration.state === 'ok' && (
              <span className="inline-flex items-center gap-1.5 text-accent-green-deep">
                <Check className="h-4 w-4" aria-hidden /> Registrado · {timebanksLeftText(current.registration.remaining)}
              </span>
            )}
            {current.registration.state === 'error' && (
              <>
                <span role="alert" className="font-semibold text-accent-red-deep" title={current.registration.message}>
                  Não registrado —
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetry(current.key)}
                  loading={current.retrying}
                  data-timebank-retry
                >
                  {!current.retrying && <RotateCw className="h-4 w-4" aria-hidden />} Tentar de novo
                </Button>
              </>
            )}
          </div>
        )}

        {phase === 'expired' &&
          (canUseAgain || current?.registration.state !== 'ok' ? (
            <Button
              size="lg"
              className="mb-2 w-full"
              onClick={onUseAgain}
              disabled={!canUseAgain}
              data-timebank-again
            >
              <Timer className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">Usar mais 1 timebank de {name}</span>
            </Button>
          ) : (
            <p className="mb-2 text-center text-base font-semibold text-accent-red-deep" role="status" data-timebank-none>
              Sem timebank — tempo esgotado
            </p>
          ))}

        {phase === 'choose' ? (
          <Button size="lg" variant="secondary" className="w-full" onClick={onClose} data-timebank-skip>
            Não usar timebank
          </Button>
        ) : (
          <Button
            size="lg"
            variant={counting ? 'primary' : phase === 'expired' && canUseAgain ? 'secondary' : 'danger'}
            className="w-full"
            onClick={onClose}
            data-timebank-close
          >
            Encerrar
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  )
}
