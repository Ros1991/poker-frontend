import { useEffect, useRef, useState } from 'react'
import type { TimerState } from '../types/blind.types'

/**
 * Folga para o fim do nível não ficar trocando de minuto a cada segundo: o tempo que falta anda aos saltos de 1 s,
 * fora de fase com este relógio, então "agora + o que falta" oscila até ~1 s para os dois lados
 */
const JITTER_MS = 2500

type TimerFields = Pick<TimerState, 'currentLevel' | 'remainingSeconds' | 'isRunning' | 'isPaused'>
type Anchor = { at: number; key: string }

/** Muda quando o relógio muda de verdade (outro nível, pausou ou voltou): aí o fim do nível é recalculado na hora */
const keyOf = (state: TimerFields) => `${state.currentLevel}|${state.isRunning && !state.isPaused}`
const endOf = (state: TimerFields, now: number) => now + Math.max(0, state.remainingSeconds) * 1000

/**
 * Instante (ms) em que o nível atual acaba: agora + o que falta dele. Com o relógio parado (pausado ou ainda não ligado),
 * é como se ele voltasse agora — o instante anda junto com o relógio de verdade. Atualiza sozinho a cada segundo
 * (SPEC-20261105-1708: a coluna "Início" da aba Blinds parte daqui).
 */
export function useCurrentLevelEnd(state: TimerFields): number {
  const stateRef = useRef(state)
  const [tick, setTick] = useState(() => Date.now())
  const [anchor, setAnchor] = useState<Anchor>(() => ({ at: endOf(state, tick), key: keyOf(state) }))

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      const current = stateRef.current
      const next = { at: endOf(current, now), key: keyOf(current) }
      setTick(now)
      setAnchor((prev) => (prev.key === next.key && Math.abs(prev.at - next.at) <= JITTER_MS ? prev : next))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Relógio acabou de mudar (o intervalo ainda não passou): calcula com o último segundo, sem esperar o próximo
  return anchor.key === keyOf(state) ? anchor.at : endOf(state, tick)
}
