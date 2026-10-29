import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, RotateCw, Timer } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { lockBodyScroll } from '../../utils/scrollLock'
import type { AlertSound } from '../../utils/alertSound'
import { TIMEBANK_WARNING_SECONDS, timebanksLeftText } from '../../utils/timebank'
import { useWakeLock } from '../../hooks/useWakeLock'
import type { TournamentEntry } from '../../types/entry.types'
import { playerName } from './terminalFormat'

/** Situação do registro do uso no servidor (a contagem não depende dela — D4) */
export type TimebankRegistration =
  | { state: 'pending' }
  | { state: 'ok'; remaining: number }
  | { state: 'error'; message: string }

interface TimebankCountdownProps {
  entry: TournamentEntry
  /** Duração do timebank (segundos do torneio) */
  seconds: number
  /** Bipe/vibração criados no toque em "Usar" (o som só sai com o AudioContext nascido num gesto) */
  sound: AlertSound
  registration: TimebankRegistration
  /** "Tentar de novo" — reenvia o mesmo uso (mesmo actionId: o servidor não desconta duas vezes) */
  onRetry: () => void
  retrying?: boolean
  /** "Encerrar": fecha e volta à mesa (no meio da contagem ou depois do zero) */
  onClose: () => void
}

/**
 * Contagem do timebank em tela cheia no celular do dealer (SPEC-20261029-1722, D4): foto e nome do jogador, o número
 * grande dos segundos, a barra, bipe + vibração aos 10 s e no zero, e "Encerrar". A contagem é local — começa no toque e
 * não espera a rede; o registro do uso aparece embaixo ("Registrando…", "Registrado · N restantes" ou "Não registrado —
 * Tentar de novo"), sem nunca parar o relógio. O tempo é medido pelo relógio do aparelho (não por ticks), então a aba
 * em segundo plano não atrasa a contagem. A tela fica acesa enquanto conta.
 */
export function TimebankCountdown({ entry, seconds, sound, registration, onRetry, retrying = false, onClose }: TimebankCountdownProps) {
  const totalMs = seconds * 1000
  // Quanto falta, recalculado a cada 100 ms pelo relógio do aparelho a partir do início (montagem)
  const [leftMs, setLeftMs] = useState(totalMs)
  const warned = useRef(false)
  const ended = useRef(false)

  useWakeLock(true)
  useEffect(() => lockBodyScroll(), [])

  useEffect(() => {
    const start = performance.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, totalMs - (performance.now() - start))
      setLeftMs(left)
      if (left <= 0) window.clearInterval(id)
    }, 100)
    return () => window.clearInterval(id)
  }, [totalMs])

  const left = Math.ceil(leftMs / 1000)
  const done = leftMs <= 0
  const warning = !done && left <= TIMEBANK_WARNING_SECONDS
  const pct = totalMs > 0 ? (leftMs / totalMs) * 100 : 0

  // Bipe + vibração: uma vez ao chegar nos 10 s (só quando o timebank é maior que isso) e uma no zero
  useEffect(() => {
    if (!warned.current && seconds > TIMEBANK_WARNING_SECONDS && !done && left <= TIMEBANK_WARNING_SECONDS) {
      warned.current = true
      sound.warn()
    }
    if (!ended.current && done) {
      ended.current = true
      sound.end()
    }
  }, [left, done, seconds, sound])

  const name = playerName(entry)
  return createPortal(
    <div
      className={cn('fixed inset-0 z-[60] flex h-dvh flex-col', done ? 'bg-accent-red-soft' : 'bg-bg-primary')}
      role="dialog"
      aria-modal="true"
      aria-label={`Timebank de ${name}`}
      data-timebank-countdown={done ? 'done' : warning ? 'warning' : 'running'}
    >
      <header className="flex shrink-0 items-center justify-center gap-2 border-b border-border-default bg-bg-secondary px-3 py-2.5">
        <Timer className="h-5 w-5 text-accent-orange-deep" aria-hidden />
        <span className="text-base font-semibold text-text-primary">Timebank · {seconds} s</span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-4 text-center">
        <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="3xl" className="max-h-[22dvh] max-w-[22dvh]" />
        <p className="max-w-full break-words text-2xl font-bold leading-tight text-text-primary" data-timebank-countdown-name>
          {name}
        </p>
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
            className={cn('h-full rounded-full', warning || done ? 'bg-accent-red-deep' : 'bg-accent-orange')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </main>

      <footer className="shrink-0 border-t border-border-default bg-bg-secondary px-3 pt-2.5" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mb-2.5 flex min-h-[44px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm" data-timebank-registration={registration.state}>
          {registration.state === 'pending' && (
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Registrando o uso…
            </span>
          )}
          {registration.state === 'ok' && (
            <span className="inline-flex items-center gap-1.5 text-accent-green-deep">
              <Check className="h-4 w-4" aria-hidden /> Registrado · {timebanksLeftText(registration.remaining)}
            </span>
          )}
          {registration.state === 'error' && (
            <>
              <span role="alert" className="font-semibold text-accent-red-deep" title={registration.message}>
                Não registrado —
              </span>
              <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} data-timebank-retry>
                {!retrying && <RotateCw className="h-4 w-4" aria-hidden />} Tentar de novo
              </Button>
            </>
          )}
        </div>
        <Button size="lg" variant={done ? 'danger' : 'primary'} className="w-full" onClick={onClose} data-timebank-close>
          Encerrar
        </Button>
      </footer>
    </div>,
    document.body,
  )
}
