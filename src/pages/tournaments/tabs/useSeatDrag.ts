import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** Um lugar de uma mesa (o destino de quem é arrastado) */
export interface SeatRef {
  tableId: string
  seatNumber: number
}

/** Quem está sendo arrastado: a inscrição e o lugar de onde saiu */
export interface SeatDragSource extends SeatRef {
  entryId: string
  name: string
  photo: string | null
}

export interface SeatDragState {
  source: SeatDragSource
  /** Ponto do dedo/mouse (viewport) */
  x: number
  y: number
  /** Lugar sob o dedo (outro que não o de origem); null = fora de um lugar (soltar cancela) */
  target: SeatRef | null
}

/** Segurar este tempo (toque) para começar a arrastar */
export const LONG_PRESS_MS = 300
/** Toque que anda mais que isto antes do tempo é rolagem: não arrasta */
export const TOUCH_SLOP_PX = 8
/** Mouse: arrasta quando anda mais que isto com o botão apertado (sem esperar) */
export const MOUSE_SLOP_PX = 5
/** Faixa perto da borda (janela ou contêiner com rolagem) em que a tela rola sozinha */
const EDGE_PX = 56
/** Velocidade máxima da rolagem automática (px por quadro) */
const MAX_SCROLL_PX = 18

interface Pending {
  source: SeatDragSource
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  x: number
  y: number
  /** Elemento de origem (os contêineres com rolagem dele entram na rolagem automática) */
  origin: HTMLElement
  timer: ReturnType<typeof setTimeout> | null
  dragging: boolean
}

function seatAt(x: number, y: number): SeatRef | null {
  const el = document.elementFromPoint(x, y)
  const seat = el instanceof Element ? el.closest<HTMLElement>('[data-seat]') : null
  const tableId = seat?.dataset.tableId
  const seatNumber = Number(seat?.dataset.seat)
  return tableId && seatNumber > 0 ? { tableId, seatNumber } : null
}

function scrollable(el: Element): { y: boolean; x: boolean } {
  const s = getComputedStyle(el)
  return {
    y: /(auto|scroll|overlay)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1,
    x: /(auto|scroll|overlay)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1,
  }
}

/** Contêineres com rolagem de dentro para fora a partir de `el` (sem a página) */
function scrollersOf(el: Element | null, into: Set<Element>) {
  for (let cur = el; cur && cur !== document.documentElement && cur !== document.body; cur = cur.parentElement) {
    const s = scrollable(cur)
    if (s.x || s.y) into.add(cur)
  }
}

/** Folga mínima entre o fantasma e as bordas da tela */
export const GHOST_MARGIN_PX = 8
/** Distância entre o dedo/mouse e a parte de baixo do fantasma (acima do dedo: o dedo não cobre) */
export const GHOST_GAP_PX = 24

/**
 * Posição (canto de cima à esquerda, viewport) do fantasma de quem é arrastado: centrado no dedo e acima dele, mas sempre
 * DENTRO da tela (revisão da onda 15) — perto da borda esquerda/direita ele encosta na margem em vez de sair (a foto e o
 * nome não somem), e perto do topo não sai por cima. `w`/`h`: tamanho do fantasma; `vw`/`vh`: tamanho da tela.
 */
export function ghostPosition(x: number, y: number, w: number, h: number, vw: number, vh: number): { left: number; top: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  return {
    left: Math.round(clamp(x - w / 2, GHOST_MARGIN_PX, vw - w - GHOST_MARGIN_PX)),
    top: Math.round(clamp(y - h - GHOST_GAP_PX, GHOST_MARGIN_PX, vh - h - GHOST_MARGIN_PX)),
  }
}

/** Velocidade conforme a distância da borda (0 longe, MAX colado nela) */
const speed = (depth: number) => Math.ceil(MAX_SCROLL_PX * Math.min(1, Math.max(0, depth / EDGE_PX)))

/**
 * Arrastar jogadores entre lugares e mesas da aba Mesas (SPEC-20261027-2133), com Pointer Events (sem biblioteca):
 * - toque: SEGURAR ~300 ms (vibração curta onde houver) e arrastar; se o dedo anda mais de ~8 px antes do tempo é
 *   rolagem e nada acontece (a tela rola normal). Arrastando, a rolagem da página fica bloqueada (touchmove com
 *   preventDefault, não passivo) e a tela rola sozinha perto das bordas — da janela e dos contêineres com rolagem (o
 *   `main` do painel rola por dentro);
 * - mouse: arrasta ao andar ~5 px com o botão apertado (o mesmo fantasma, destaque e rolagem);
 * - o lugar sob o dedo (elementFromPoint em `[data-seat][data-table-id]`) fica destacado; soltar num lugar chama
 *   `onDrop` (quem usa decide: vazio move, ocupado troca); soltar fora ou no próprio lugar cancela;
 * - toque simples / clique sem arrastar segue sendo clique (abre "Mover jogador"); o clique que vem logo depois de
 *   um arrasto é engolido (`consumeClick`).
 */
export function useSeatDrag(onDrop: (source: SeatDragSource, target: SeatRef) => void) {
  const [drag, setDrag] = useState<SeatDragState | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const onDropRef = useRef(onDrop)
  const suppressClickUntil = useRef(0)
  const rafRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const stop = useCallback(() => {
    const p = pendingRef.current
    if (p?.timer) clearTimeout(p.timer)
    pendingRef.current = null
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    cleanupRef.current?.()
    cleanupRef.current = null
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('-webkit-user-select')
    setDrag(null)
  }, [])

  useEffect(() => stop, [stop])

  const update = useCallback(() => {
    const p = pendingRef.current
    if (!p?.dragging) return
    const hit = seatAt(p.x, p.y)
    const target = hit && !(hit.tableId === p.source.tableId && hit.seatNumber === p.source.seatNumber) ? hit : null
    setDrag({ source: p.source, x: p.x, y: p.y, target })
  }, [])

  // Rolagem automática perto das bordas (um passo; begin() chama a cada quadro enquanto arrasta)
  const scrollStep = useCallback(() => {
    const p = pendingRef.current
    if (!p?.dragging) return
    const vh = window.visualViewport?.height ?? window.innerHeight
    const vw = window.visualViewport?.width ?? window.innerWidth
    const set = new Set<Element>()
    scrollersOf(document.elementFromPoint(p.x, p.y), set)
    scrollersOf(p.origin, set)
    let moved = false
    for (const el of set) {
      const r = el.getBoundingClientRect()
      const top = Math.max(r.top, 0)
      const bottom = Math.min(r.bottom, vh)
      const left = Math.max(r.left, 0)
      const right = Math.min(r.right, vw)
      const s = scrollable(el)
      let dy = 0
      let dx = 0
      if (s.y) {
        if (p.y < top + EDGE_PX && el.scrollTop > 0) dy = -speed(top + EDGE_PX - p.y)
        else if (p.y > bottom - EDGE_PX && el.scrollTop + el.clientHeight < el.scrollHeight - 1) dy = speed(p.y - (bottom - EDGE_PX))
      }
      if (s.x) {
        if (p.x < left + EDGE_PX && el.scrollLeft > 0) dx = -speed(left + EDGE_PX - p.x)
        else if (p.x > right - EDGE_PX && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) dx = speed(p.x - (right - EDGE_PX))
      }
      if (dx || dy) {
        el.scrollBy(dx, dy)
        moved = true
        break
      }
    }
    // A página (quando é ela que rola) — nunca por trás de um diálogo (Sheet do terminal, Modal do painel): lá só rola o
    // conteúdo dele; senão a tela de trás desce sozinha e aparece rolada ao fechar (SPEC-20261028-1923)
    if (!moved && !p.origin.closest('[aria-modal="true"]')) {
      const page = document.scrollingElement
      if (page) {
        let dy = 0
        if (p.y < EDGE_PX && page.scrollTop > 0) dy = -speed(EDGE_PX - p.y)
        else if (p.y > vh - EDGE_PX && page.scrollTop + vh < page.scrollHeight - 1) dy = speed(p.y - (vh - EDGE_PX))
        if (dy) {
          window.scrollBy(0, dy)
          moved = true
        }
      }
    }
    // O conteúdo andou embaixo do dedo parado: o destino pode ter mudado
    if (moved) update()
  }, [update])

  const begin = useCallback(() => {
    const p = pendingRef.current
    if (!p || p.dragging) return
    p.dragging = true
    p.timer = null
    if (p.pointerType !== 'mouse') {
      try {
        navigator.vibrate?.(15)
      } catch {
        /* sem vibração */
      }
    }
    document.body.style.setProperty('user-select', 'none')
    document.body.style.setProperty('-webkit-user-select', 'none')
    update()
    const tick = () => {
      if (!pendingRef.current?.dragging) return
      scrollStep()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [scrollStep, update])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, source: SeatDragSource) => {
      if (pendingRef.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const origin = e.currentTarget
      const p: Pending = {
        source,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        origin,
        timer: null,
        dragging: false,
      }
      pendingRef.current = p
      if (e.pointerType !== 'mouse') p.timer = setTimeout(begin, LONG_PRESS_MS)

      const move = (ev: PointerEvent) => {
        const cur = pendingRef.current
        if (!cur || ev.pointerId !== cur.pointerId) return
        cur.x = ev.clientX
        cur.y = ev.clientY
        if (!cur.dragging) {
          const dist = Math.hypot(ev.clientX - cur.startX, ev.clientY - cur.startY)
          if (cur.pointerType === 'mouse') {
            if (dist > MOUSE_SLOP_PX) begin()
          } else if (dist > TOUCH_SLOP_PX) {
            // Andou antes do tempo: é rolagem (a página rola sozinha); nada de arrastar
            stop()
          }
          return
        }
        update()
      }
      const up = (ev: PointerEvent) => {
        const cur = pendingRef.current
        if (!cur || ev.pointerId !== cur.pointerId) return
        if (!cur.dragging) {
          stop() // toque/clique simples: o click segue (abre "Mover jogador")
          return
        }
        const hit = seatAt(ev.clientX, ev.clientY)
        const src = cur.source
        suppressClickUntil.current = performance.now() + 600
        stop()
        if (hit && !(hit.tableId === src.tableId && hit.seatNumber === src.seatNumber)) onDropRef.current(src, hit)
      }
      const cancel = (ev: PointerEvent) => {
        const cur = pendingRef.current
        if (!cur || ev.pointerId !== cur.pointerId) return
        if (cur.dragging) suppressClickUntil.current = performance.now() + 600
        stop()
      }
      // Arrastando: o dedo não rola a página (o touchmove só é cancelável antes de a rolagem começar — e ela não
      // começou: o dedo ficou parado o tempo de segurar)
      const touchMove = (ev: TouchEvent) => {
        if (pendingRef.current?.dragging && ev.cancelable) ev.preventDefault()
      }
      // Segurar abre o menu do aparelho (Android) / a lupa (iOS): não enquanto segura ou arrasta
      const contextMenu = (ev: Event) => {
        if (pendingRef.current) ev.preventDefault()
      }
      // Esc ou a janela perder o foco (mouse solto fora do navegador) cancelam: o jogador fica onde estava
      const abort = () => {
        if (pendingRef.current?.dragging) suppressClickUntil.current = performance.now() + 600
        stop()
      }
      const keyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') abort()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('touchmove', touchMove, { passive: false })
      window.addEventListener('contextmenu', contextMenu, true)
      window.addEventListener('keydown', keyDown)
      window.addEventListener('blur', abort)
      cleanupRef.current = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('touchmove', touchMove)
        window.removeEventListener('contextmenu', contextMenu, true)
        window.removeEventListener('keydown', keyDown)
        window.removeEventListener('blur', abort)
      }
    },
    [begin, stop, update],
  )

  /** true (e engole) quando o clique é o que vem logo depois de soltar um arrasto */
  const consumeClick = useCallback(() => {
    if (performance.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0
      return true
    }
    return false
  }, [])

  return { drag, onPointerDown, consumeClick }
}
