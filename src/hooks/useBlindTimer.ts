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
}

export function useBlindTimer() {
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_TIMER_STATE)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastServerSyncRef = useRef<number>(Date.now())
  const serverRemainingRef = useRef<number>(0)

  const syncFromServer = useCallback((serverState: TimerState) => {
    setTimerState(serverState)
    lastServerSyncRef.current = Date.now()
    serverRemainingRef.current = serverState.remainingSeconds
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
