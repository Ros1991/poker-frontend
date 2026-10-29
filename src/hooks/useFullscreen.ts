import { useEffect, useState } from 'react'

// Tela cheia do telão (SPEC-20261029-1720, D16): a tecla F e o botão discreto usam o mesmo código. Inclui os nomes
// com prefixo webkit, que alguns navegadores de TV (WebKit antigo) ainda usam.
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => Promise<void> | void
}
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const FULLSCREEN_QUERY = '(display-mode: fullscreen)'

function doc(): FullscreenDocument {
  return document as FullscreenDocument
}

/** O navegador deixa a página entrar em tela cheia (no iPhone, por exemplo, não deixa) */
export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const d = doc()
  const el = document.documentElement as FullscreenElement
  return (
    (d.fullscreenEnabled === true && typeof el.requestFullscreen === 'function') ||
    (d.webkitFullscreenEnabled === true && typeof el.webkitRequestFullscreen === 'function')
  )
}

/**
 * A página já ocupa a tela inteira: tela cheia pelo navegador (`fullscreenElement`) ou a janela em tela cheia (F11 /
 * modo quiosque, que o CSS vê como `display-mode: fullscreen`)
 */
export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const d = doc()
  if (d.fullscreenElement ?? d.webkitFullscreenElement) return true
  return typeof window.matchMedia === 'function' && window.matchMedia(FULLSCREEN_QUERY).matches
}

/** Entra na tela cheia (ou sai, se a página já está nela) — tecla F e botão do telão */
export function toggleFullscreen(): void {
  const d = doc()
  const el = document.documentElement as FullscreenElement
  try {
    if (d.fullscreenElement ?? d.webkitFullscreenElement) {
      const exit = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.()
      void Promise.resolve(exit).catch(() => undefined)
    } else {
      const enter = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.()
      void Promise.resolve(enter).catch(() => undefined)
    }
  } catch {
    // navegador sem tela cheia: nada a fazer
  }
}

/** Estado da tela cheia, atualizado pelos eventos do navegador */
export function useFullscreen(): { active: boolean; supported: boolean } {
  const [active, setActive] = useState(() => isFullscreen())
  const [supported] = useState(() => fullscreenSupported())

  useEffect(() => {
    const update = () => setActive(isFullscreen())
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('webkitfullscreenchange', update)
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(FULLSCREEN_QUERY) : null
    media?.addEventListener?.('change', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('webkitfullscreenchange', update)
      media?.removeEventListener?.('change', update)
    }
  }, [])

  return { active, supported }
}
