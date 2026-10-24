import { useSyncExternalStore } from 'react'

/** Área visível de verdade (sem o teclado virtual) em px, relativa ao topo da janela de layout */
export interface VisualViewportBox {
  height: number
  offsetTop: number
}

function subscribe(onChange: () => void): () => void {
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null
  if (!viewport) return () => {}
  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

// useSyncExternalStore exige o mesmo objeto enquanto os números não mudam
let cached: { key: string; box: VisualViewportBox } | null = null

function getSnapshot(): VisualViewportBox | null {
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null
  if (!viewport) return null
  const key = `${viewport.height}|${viewport.offsetTop}`
  if (cached?.key !== key) {
    cached = { key, box: { height: viewport.height, offsetTop: viewport.offsetTop } }
  }
  return cached.box
}

function getServerSnapshot(): VisualViewportBox | null {
  return null
}

/**
 * Altura e deslocamento da área visível (`window.visualViewport`), atualizados em `resize`/`scroll`
 * só enquanto o componente está montado. No Safari do iPhone o teclado não encolhe a janela de
 * layout: modais e telas cheias usam isto para caber acima dele (SPEC-20261023-1216, M6).
 * Sem a API, `null` (quem usa cai no `h-dvh`).
 */
export function useVisualViewport(): VisualViewportBox | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
