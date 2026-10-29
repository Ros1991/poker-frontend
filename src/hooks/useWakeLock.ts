import { useEffect, useState } from 'react'

// Tela sempre acesa (SPEC-20261029-1721): o telão no celular pede `navigator.wakeLock.request('screen')` enquanto a página
// está visível. O navegador solta a trava sozinho quando a aba vai para o segundo plano (ou a tela é bloqueada): ao voltar
// (`visibilitychange`), a página pede de novo. Só existe em HTTPS (e em localhost); no iPhone, a partir do iOS 16.4.
// Navegador sem a API, ou que recusa o pedido (economia de bateria, sem gesto do usuário), não trava nada: a página segue
// e tenta de novo no próximo toque ou na próxima volta para a frente.

/** Situação da trava: sem a API no navegador, pedida e ativa, ou solta (recusada, ou o navegador soltou) */
export type WakeLockStatus = 'unsupported' | 'active' | 'released'

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
  removeEventListener: (type: 'release', listener: () => void) => void
}
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

function wakeLockApi() {
  if (typeof navigator === 'undefined') return null
  return (navigator as WakeLockNavigator).wakeLock ?? null
}

/** Mantém a tela acesa enquanto o componente está montado e `enabled` */
export function useWakeLock(enabled = true): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>(() => (wakeLockApi() ? 'released' : 'unsupported'))

  useEffect(() => {
    const api = wakeLockApi()
    if (!enabled || !api) return
    let sentinel: WakeLockSentinelLike | null = null
    let requesting = false
    let disposed = false

    const onRelease = () => {
      sentinel?.removeEventListener('release', onRelease)
      sentinel = null
      if (!disposed) setStatus('released')
    }

    const acquire = async () => {
      if (disposed || requesting || (sentinel && !sentinel.released) || document.visibilityState !== 'visible') return
      requesting = true
      try {
        const lock = await api.request('screen')
        if (disposed) {
          void lock.release().catch(() => undefined)
          return
        }
        sentinel = lock
        lock.addEventListener('release', onRelease)
        setStatus('active')
      } catch {
        // Recusado (sem gesto, bateria fraca, aba escondida): fica solto e tenta de novo no próximo toque ou na volta
        if (!disposed) setStatus('released')
      } finally {
        requesting = false
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    // Alguns navegadores só aceitam o pedido depois de um toque na página
    const onTouch = () => void acquire()

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pointerdown', onTouch)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('pointerdown', onTouch)
      const lock = sentinel
      sentinel = null
      if (lock) {
        lock.removeEventListener('release', onRelease)
        void lock.release().catch(() => undefined)
      }
    }
  }, [enabled])

  return status
}
