/**
 * Bipe e vibração da contagem do timebank (SPEC-20261029-1722). O som é gerado em código (oscilador do Web Audio, sem
 * arquivo) e a vibração usa `navigator.vibrate` quando existe (o iOS não vibra: fica só o bipe).
 *
 * O `AudioContext` precisa nascer num toque do usuário (iOS e Chrome só liberam o som assim): quem usa chama
 * `createAlertSound()` no toque em "Usar timebank" e passa o objeto para a contagem. Sem Web Audio, os bipes não fazem
 * nada e a contagem segue igual.
 */
export interface AlertSound {
  /** Bipe curto (aviso dos 10 s) */
  warn: () => void
  /** Bipe mais longo, duas vezes (tempo esgotado) */
  end: () => void
  close: () => void
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function createAlertSound(): AlertSound {
  let ctx: AudioContext | null = null
  try {
    const Ctor = audioContextCtor()
    ctx = Ctor ? new Ctor() : null
    // No toque: retoma o contexto que nasce suspenso (política de autoplay)
    void ctx?.resume?.().catch(() => undefined)
  } catch {
    ctx = null
  }

  /** Um bipe: onda quadrada com ataque/queda curtos (sem estalo), `at` segundos a partir de agora */
  function tone(freq: number, durationMs: number, at = 0) {
    if (!ctx) return
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      const start = ctx.currentTime + at
      const end = start + durationMs / 1000
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01)
      gain.gain.setValueAtTime(0.25, Math.max(start + 0.01, end - 0.03))
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(end + 0.02)
    } catch {
      // Sem som não trava a contagem
    }
  }

  function vibrate(pattern: number | number[]) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
    } catch {
      // Navegador sem vibração (iOS): só o bipe
    }
  }

  return {
    warn: () => {
      tone(880, 180)
      vibrate(200)
    },
    end: () => {
      tone(660, 450)
      tone(660, 450, 0.6)
      vibrate([400, 150, 400])
    },
    close: () => {
      try {
        void ctx?.close?.().catch(() => undefined)
      } catch {
        // já fechado
      }
      ctx = null
    },
  }
}
