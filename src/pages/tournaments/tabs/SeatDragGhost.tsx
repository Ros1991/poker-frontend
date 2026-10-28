import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ghostPosition } from './useSeatDrag'

/**
 * Fantasma de quem está sendo arrastado (SPEC-20261027-2133): centrado no dedo/mouse e acima dele, mas preso dentro da
 * tela (revisão da onda 15: perto da borda esquerda a 320 px a foto e o nome saíam da tela). O tamanho muda com o texto
 * ("Solte num lugar", "Mesa 2, lugar 4", "Trocar com …"), então a posição é medida a cada render, antes da pintura.
 * Usado na aba Mesas do painel e na tela Mesas do terminal do dealer (SPEC-20261028-1923).
 */
export function SeatDragGhost({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { left, top } = ghostPosition(x, y, el.offsetWidth, el.offsetHeight, document.documentElement.clientWidth, window.innerHeight)
    el.style.transform = `translate(${left}px, ${top}px)`
  })
  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      data-seat-drag-ghost
      className="pointer-events-none fixed left-0 top-0 z-[70] flex max-w-[16rem] items-center gap-2 rounded-full border border-accent-blue bg-bg-card py-1 pl-1 pr-3 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  )
}
