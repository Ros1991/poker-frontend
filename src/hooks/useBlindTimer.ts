import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimerState } from '../types/blind.types'

const DEFAULT_TIMER_STATE: TimerState = {
  currentLevel: 1,
  smallBlind: 0,
  bigBlind: 0,
  ante: 0,
  remainingSeconds: 0,
  totalSeconds: 0,
  isRunning: false,
  isPaused: false,
  nextSmallBlind: null,
  nextBigBlind: null,
  nextAnte: null,
  isBreak: false,
  isLastLevel: false,
}

/** Formato que a API manda (`TimerStateResponse`): duração em minutos e o próximo nível num objeto à parte */
interface ServerTimerState {
  currentLevel?: number | null
  smallBlind?: number
  bigBlind?: number
  ante?: number
  durationMinutes?: number
  remainingSeconds?: number
  totalSeconds?: number
  isRunning?: boolean
  isPaused?: boolean
  isBreak?: boolean
  isLastLevel?: boolean
  nextSmallBlind?: number | null
  nextBigBlind?: number | null
  nextAnte?: number | null
  nextLevel?: { smallBlind?: number; bigBlind?: number; ante?: number; isBreak?: boolean } | null
}

/**
 * Converte o estado do relógio que veio da API (REST ou SignalR) no `TimerState` da tela. A API não manda
 * `totalSeconds` nem `nextSmallBlind`/`nextBigBlind`/`nextAnte` (manda `durationMinutes` e `nextLevel`): sem isto a
 * aba Blinds mostrava "Próximo: NaN/NaN" e a barra de progresso ficava em 0%. Aceita também um `TimerState` pronto
 * (o telão já converte antes), sem mudar nada nele.
 */
export function normalizeTimerState(raw: unknown): TimerState {
  const r = (raw ?? {}) as ServerTimerState
  const next = r.nextLevel && !r.nextLevel.isBreak ? r.nextLevel : null
  return {
    currentLevel: r.currentLevel ?? 1,
    smallBlind: r.smallBlind ?? 0,
    bigBlind: r.bigBlind ?? 0,
    ante: r.ante ?? 0,
    remainingSeconds: r.remainingSeconds ?? 0,
    totalSeconds: r.totalSeconds ?? (r.durationMinutes ?? 0) * 60,
    isRunning: r.isRunning ?? false,
    isPaused: r.isPaused ?? false,
    nextSmallBlind: r.nextSmallBlind !== undefined ? r.nextSmallBlind : (next?.smallBlind ?? null),
    nextBigBlind: r.nextBigBlind !== undefined ? r.nextBigBlind : (next?.bigBlind ?? null),
    nextAnte: r.nextAnte !== undefined ? r.nextAnte : (next?.ante ?? null),
    isBreak: r.isBreak ?? false,
    // SPEC-20261029-1720: sem nível depois do atual (API antiga sem o campo → como antes)
    isLastLevel: r.isLastLevel ?? false,
  }
}

export function useBlindTimer(onExpire?: () => void) {
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_TIMER_STATE)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Instante (Date.now) da última sincronização com o servidor. Começa em 0 sem ler o relógio no
  // render (react-hooks/purity): o intervalo só roda com o relógio andando, e isso só acontece
  // depois de um syncFromServer, que grava o instante real aqui antes.
  const lastServerSyncRef = useRef<number>(0)
  const serverRemainingRef = useRef<number>(0)
  const expiredRef = useRef<boolean>(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const syncFromServer = useCallback((serverState: TimerState) => {
    const state = normalizeTimerState(serverState)
    setTimerState(state)
    lastServerSyncRef.current = Date.now()
    serverRemainingRef.current = state.remainingSeconds
    if (state.remainingSeconds > 0) expiredRef.current = false
  }, [])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!timerState.isRunning || timerState.isPaused) {
      return
    }

    intervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        if (!prev.isRunning || prev.isPaused) return prev

        const elapsedSinceSync = Math.floor(
          (Date.now() - lastServerSyncRef.current) / 1000,
        )
        const correctedRemaining = Math.max(
          0,
          serverRemainingRef.current - elapsedSinceSync,
        )

        // B4: ao zerar (nível acabou), dispara onExpire uma vez para ressincronizar
        // com o servidor, que auto-avança o nível (server-authoritative).
        if (correctedRemaining === 0 && !expiredRef.current) {
          expiredRef.current = true
          setTimeout(() => onExpireRef.current?.(), 0)
        }

        return {
          ...prev,
          remainingSeconds: correctedRemaining,
        }
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerState.isRunning, timerState.isPaused])

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const progressPercentage =
    timerState.totalSeconds > 0
      ? ((timerState.totalSeconds - timerState.remainingSeconds) /
          timerState.totalSeconds) *
        100
      : 0

  return {
    timerState,
    syncFromServer,
    formattedTime,
    minutes,
    seconds,
    progressPercentage,
  }
}
