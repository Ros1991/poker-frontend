import { useSyncExternalStore } from 'react'

/** Encolhimento mínimo da área visível para contar como teclado virtual (a barra de endereço do celular fica abaixo) */
const KEYBOARD_MIN_PX = 120

/** Tipos de `<input>` que não abrem o teclado de texto */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

/**
 * Maior altura da janela de layout já vista nesta largura (orientação). No Android com
 * `interactive-widget=resizes-content` (index.html) o teclado encolhe a própria janela de layout, então é com ela que
 * se compara; a largura mudou (girou o celular, redimensionou a janela) → recomeça da altura atual.
 */
let tallest = { width: 0, height: 0 }

function track() {
  if (typeof window === 'undefined') return
  if (window.innerWidth !== tallest.width) tallest = { width: window.innerWidth, height: window.innerHeight }
  else if (window.innerHeight > tallest.height) tallest = { ...tallest, height: window.innerHeight }
}

if (typeof window !== 'undefined') {
  track()
  window.addEventListener('resize', track, { passive: true })
}

function editableFocused(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled
  return false
}

/** Último resultado: o teclado só "fecha" quando a área visível volta a crescer (ver getSnapshot) */
let open = false

function shrunk(): boolean {
  const viewport = window.visualViewport
  const layout = window.innerHeight
  const visible = viewport ? viewport.height * (viewport.scale || 1) : layout
  // iPhone (e Android sem resizes-content): a janela de layout fica e só a área visível encolhe
  if (layout - visible > KEYBOARD_MIN_PX) return true
  // Android com resizes-content: a janela de layout encolheu em relação à maior altura vista nesta largura — só em
  // aparelho de toque (no computador uma janela redimensionada não é teclado)
  return navigator.maxTouchPoints > 0 && tallest.height - layout > KEYBOARD_MIN_PX
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  track()
  if (!shrunk()) {
    open = false
  } else if (editableFocused()) {
    // Só abre com um campo de texto em foco: altura baixa sem digitar (computador com a janela baixa, celular deitado)
    // não é teclado
    open = true
  }
  // Área ainda encolhida e o foco saiu do campo (tocou num botão): mantém como estava até a área visível crescer — virar
  // o layout entre o "mousedown" e o "click" mudaria o que está debaixo do dedo
  return open
}

function getServerSnapshot(): boolean {
  return false
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport
  // Ao trocar de campo o focusout chega antes do focusin: espera a troca terminar para não piscar o layout
  let pending: ReturnType<typeof setTimeout> | null = null
  const onFocusOut = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      onChange()
    }, 0)
  }
  viewport?.addEventListener('resize', onChange)
  window.addEventListener('resize', onChange)
  document.addEventListener('focusin', onChange)
  document.addEventListener('focusout', onFocusOut)
  return () => {
    if (pending) clearTimeout(pending)
    viewport?.removeEventListener('resize', onChange)
    window.removeEventListener('resize', onChange)
    document.removeEventListener('focusin', onChange)
    document.removeEventListener('focusout', onFocusOut)
  }
}

/**
 * Teclado virtual aberto (SPEC-20261027-1311, revisão): a área visível encolheu pelo menos 120 px — menor que a janela
 * de layout (iPhone) ou a janela de layout menor que a maior altura vista nesta largura (Android com resizes-content, só
 * em aparelho de toque) — com um campo de texto em foco ao abrir; fecha quando a área visível volta a crescer. Altura
 * baixa sozinha (computador com a janela baixa, celular deitado) NÃO é teclado.
 */
export function useVirtualKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
