import { useEffect, useRef, useState } from 'react'
import { useSonner } from 'sonner'
import type { ToasterProps } from 'sonner'

/**
 * Onde o <Toaster> mostra os toasts (revisão geral do programa, ondas 7–9).
 *
 * - Computador: canto superior direito, como sempre.
 * - Celular (em pé; ou deitado, com toque e menos de 480 px de altura) sem diálogo aberto: embaixo, ao alcance do polegar (o "Desfazer" de 10 s do terminal/painel).
 * - Celular com modal/tela cheia aberta (`[role=dialog][aria-modal=true]`): o toast nunca fica por cima de um controle
 *   do diálogo (X, "Voltar", botões do corpo, "Confirmar Pagamento"/"Cancelar" do rodapé):
 *   - vai para a faixa livre mais alta da tela — no topo, acima do diálogo, quando o cabeçalho não está colado nele;
 *     senão logo abaixo do último controle que estiver no caminho. Sem faixa livre (tela cheia de botões), a que
 *     cobre menos controles, poupando o cabeçalho e o rodapé;
 *   - UM toast por vez (o mais recente): a pilha não cresce para cima do diálogo. Os outros voltam ao fechar o diálogo
 *     se ainda estiverem no tempo;
 *   - a pilha NÃO expande no toque. O sonner expande no mouseenter/mousemove que o navegador gera depois de um toque
 *     e, expandido, para o tempo dos toasts até um mouseleave que o toque não gera — o toast ficava parado na tela.
 *
 * Além disso, no toque: o sonner só recolhe a pilha (e volta a contar o tempo do toast) no mouseleave — depois de um
 * toque no toast (sem diálogo) ele ficava "expanded" e parado para sempre. Um toque fora do toast devolve o estado
 * normal (o tempo volta a correr). Só a área do próprio toast recebe toque (globals.css).
 */
/**
 * Celular: tela estreita (em pé) ou toque com pouca altura (deitado — SPEC-20261027-1311, lacuna da onda 14: no canto
 * superior direito do computador, o toast cobria a barra de cima do "Adicionar jogadores" com o teclado aberto)
 */
const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 479px)'
/** Margem do toast no celular (= padrão do sonner) */
const EDGE = 16
/** Altura de um toast com o botão de ação quando ainda não há nenhum na tela para medir */
const TOAST_HEIGHT = 64
/** Folga mínima entre o toast e um controle do diálogo */
const GAP = 8
/**
 * Peso de um controle do cabeçalho (X/"Voltar"), do rodapé ou de uma barra que faz as vezes de cabeçalho
 * (`data-dialog-toolbar`: a barra de cima do "Adicionar jogadores" no layout mínimo, com o celular deitado e o teclado
 * aberto) quando não há faixa livre: são os últimos a cobrir
 */
const EDGE_CONTROL_WEIGHT = 100

/** O que recebe toque dentro de um diálogo */
const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(',')

type Placement = Pick<ToasterProps, 'position' | 'offset' | 'mobileOffset' | 'visibleToasts'>
/** Faixa vertical da tela (px, coordenadas da janela) */
type Band = { top: number; bottom: number; weight: number }

function isPhone(): boolean {
  return window.matchMedia(PHONE_QUERY).matches
}

function topmostDialog(): HTMLElement | null {
  const open = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
  return open.length > 0 ? open[open.length - 1] : null
}

/** Celular com diálogo aberto: o modo em que o toast precisa desviar dos controles */
function phoneDialog(): HTMLElement | null {
  return isPhone() ? topmostDialog() : null
}

/**
 * Faixas verticais ocupadas pelos controles visíveis do diálogo. Cada controle é recortado pelos ancestrais que
 * rolam/cortam (corpo da modal, tela cheia), para um botão rolado para fora da vista não contar como se estivesse
 * por cima do cabeçalho ou do rodapé.
 */
function controlBands(dialog: HTMLElement, viewHeight: number): Band[] {
  const clips = new Map<Element, { top: number; bottom: number }>()
  const clipOf = (node: Element): { top: number; bottom: number } => {
    const cached = clips.get(node)
    if (cached) return cached
    let clip: { top: number; bottom: number }
    if (node === dialog || !node.parentElement) {
      const rect = node.getBoundingClientRect()
      clip = { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, viewHeight) }
    } else {
      const parent = clipOf(node.parentElement)
      clip = parent
      if (getComputedStyle(node).overflowY !== 'visible') {
        const rect = node.getBoundingClientRect()
        clip = { top: Math.max(parent.top, rect.top), bottom: Math.min(parent.bottom, rect.bottom) }
      }
    }
    clips.set(node, clip)
    return clip
  }

  const bands: Band[] = []
  // Dentro de um controle já contado (ícone, texto do botão) não precisa olhar: está na mesma faixa
  const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode()
  while (node) {
    const element = node as HTMLElement
    const style = getComputedStyle(element)
    const isControl = element.matches(CONTROL_SELECTOR) || style.cursor === 'pointer'
    if (isControl && style.visibility !== 'hidden' && style.pointerEvents !== 'none') {
      const rect = element.getBoundingClientRect()
      const clip = clipOf(element.parentElement ?? dialog)
      const top = Math.max(rect.top, clip.top)
      const bottom = Math.min(rect.bottom, clip.bottom)
      if (rect.width > 0 && bottom > top) {
        const atEdge = element.closest('[data-dialog-header],[data-modal-footer],[data-dialog-toolbar]') !== null
        bands.push({ top, bottom, weight: atEdge ? EDGE_CONTROL_WEIGHT : 1 })
      }
    }
    node = isControl ? nextOutside(walker) : walker.nextNode()
  }
  return bands
}

/** Próximo elemento depois da subárvore do atual (pula os filhos) */
function nextOutside(walker: TreeWalker): Node | null {
  let next = walker.nextSibling()
  while (!next) {
    if (!walker.parentNode()) return null
    next = walker.nextSibling()
  }
  return next
}

/** Altura do toast que vai aparecer: o maior na tela (texto em duas linhas), no mínimo o típico */
function toastHeight(): number {
  const shown = [...document.querySelectorAll<HTMLElement>('[data-sonner-toast]:not([data-removed="true"])')].map(
    (toast) => toast.offsetHeight,
  )
  return Math.max(TOAST_HEIGHT, ...shown)
}

/** Peso dos controles que um toast em [top, top + height] cobriria (com a folga) */
function coveredWeight(bands: Band[], top: number, height: number): number {
  let weight = 0
  for (const band of bands) {
    if (band.bottom + GAP > top && band.top < top + height + GAP) weight += band.weight
  }
  return weight
}

/**
 * Topo do toast no celular com diálogo aberto: a faixa livre mais alta (no topo da tela ou logo abaixo de um
 * controle). Fica onde já está se ali continua livre (rolar o corpo do diálogo não faz o toast pular).
 */
function dialogToastTop(dialog: HTMLElement, current: number | undefined): number {
  const viewHeight = window.innerHeight
  const height = toastHeight()
  const bands = controlBands(dialog, viewHeight)
  const fits = (top: number) => top >= EDGE && top + height + EDGE <= viewHeight
  if (current !== undefined && fits(current) && coveredWeight(bands, current, height) === 0) return current

  const candidates = [EDGE, ...bands.map((band) => Math.ceil(band.bottom + GAP))]
    .filter(fits)
    .sort((a, b) => a - b)
  let best = EDGE
  let bestWeight = Number.POSITIVE_INFINITY
  for (const top of candidates) {
    const weight = coveredWeight(bands, top, height)
    if (weight === 0) return top
    if (weight < bestWeight) {
      best = top
      bestWeight = weight
    }
  }
  return best
}

function topOf(placement: Placement | undefined): number | undefined {
  const offset = placement?.mobileOffset
  return placement?.visibleToasts === 1 && typeof offset === 'object' && typeof offset.top === 'number'
    ? offset.top
    : undefined
}

function computePlacement(prev?: Placement): Placement {
  if (!isPhone()) return { position: 'top-right' }
  const dialog = topmostDialog()
  if (!dialog) return { position: 'bottom-center' }
  const top = dialogToastTop(dialog, topOf(prev))
  return { position: 'top-center', offset: { top }, mobileOffset: { top }, visibleToasts: 1 }
}

const same = (a: Placement, b: Placement) => JSON.stringify(a) === JSON.stringify(b)

/** Está dentro da pilha de toasts do sonner? */
function inToaster(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest('[data-sonner-toaster]') !== null
}

export function useToasterPlacement(): Placement {
  const [placement, setPlacement] = useState<Placement>(() => computePlacement())
  const placementRef = useRef(placement)
  const updateRef = useRef<() => void>(() => {})
  const { toasts } = useSonner()

  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  useEffect(() => {
    let frame = 0
    // Diálogo aberto: acompanha o tamanho dele (modal que cresce/encolhe) e o fim da animação de entrada
    let watched: HTMLElement | null = null
    const resize = new ResizeObserver(() => update())

    function watchDialog() {
      const dialog = topmostDialog()
      if (dialog === watched) return
      if (watched) {
        resize.unobserve(watched)
        watched.removeEventListener('animationend', update)
      }
      watched = dialog
      if (dialog) {
        resize.observe(dialog)
        dialog.addEventListener('animationend', update)
      }
    }

    function update() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = computePlacement(placementRef.current)
        placementRef.current = same(placementRef.current, next) ? placementRef.current : next
        setPlacement((prev) => (same(prev, next) ? prev : next))
        watchDialog()
      })
    }
    updateRef.current = update

    // Modal e tela cheia são portais filhos diretos do <body>: abrir/fechar = filho entra/sai
    const portals = new MutationObserver(update)
    portals.observe(document.body, { childList: true })
    const phone = window.matchMedia(PHONE_QUERY)
    phone.addEventListener('change', update)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    // Corpo do diálogo rolou com toast na tela: um controle pode ter entrado embaixo dele (sem toast, o próximo que
    // aparecer recalcula pelo useSonner lá embaixo)
    const onScroll = () => {
      if (document.querySelector('[data-sonner-toast]') && phoneDialog()) update()
    }
    document.addEventListener('scroll', onScroll, true)
    update()

    // Último tipo de ponteiro: os eventos de mouse que o navegador gera depois de um toque não dizem que vieram dele
    let lastPointer = 'mouse'
    const collapse = (list: HTMLElement) => {
      list.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      list.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    }

    // Toque fora do toast: recolhe a pilha e solta o "interagindo" do sonner (o mouseleave que o toque não dispara)
    const onPointerDown = (event: PointerEvent) => {
      lastPointer = event.pointerType
      if (event.pointerType === 'mouse') return
      const target = event.target instanceof Node ? event.target : null
      document.querySelectorAll<HTMLElement>('[data-sonner-toaster]').forEach((list) => {
        if (target && list.contains(target)) return
        collapse(list)
      })
    }

    // Celular com diálogo aberto: o mouseover/mousemove gerado pelo toque não chega ao sonner (que expandiria a pilha
    // por cima do diálogo e pararia o tempo dos toasts). Captura no document = antes do React, que escuta na raiz.
    const blockTouchExpand = (event: MouseEvent) => {
      if (lastPointer === 'mouse' || !phoneDialog()) return
      const entering =
        event.type === 'mouseout' ? inToaster(event.relatedTarget) && !inToaster(event.target) : inToaster(event.target)
      if (entering) event.stopPropagation()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('mouseover', blockTouchExpand, true)
    document.addEventListener('mousemove', blockTouchExpand, true)
    document.addEventListener('mouseout', blockTouchExpand, true)

    return () => {
      cancelAnimationFrame(frame)
      portals.disconnect()
      resize.disconnect()
      watched?.removeEventListener('animationend', update)
      phone.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('mouseover', blockTouchExpand, true)
      document.removeEventListener('mousemove', blockTouchExpand, true)
      document.removeEventListener('mouseout', blockTouchExpand, true)
      updateRef.current = () => {}
    }
  }, [])

  // Toast entrou/saiu (ou mudou de texto): a altura dele muda a faixa que precisa ficar livre
  useEffect(() => {
    updateRef.current()
  }, [toasts])

  return placement
}
