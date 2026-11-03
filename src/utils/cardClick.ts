import type { MouseEvent } from 'react'

/** O que conta como controle de dentro do card: o toque nele faz só o que ele faz */
const CONTROLS =
  'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [data-card-ignore]'

/**
 * Card que abre de qualquer lugar (SPEC-20261103-1928): o toque no fundo do card vale como a ação principal dele (abrir a
 * Ficha do jogador, por exemplo), menos quando cai num controle de dentro — botão, link ou campo continuam fazendo só o
 * que fazem. Também não abre: clique que veio de um portal (um modal aberto por um botão do card — o React propaga o
 * evento pela árvore de componentes, não pela página), com outro botão do mouse ou terminando uma seleção de texto.
 */
export function isCardBackgroundClick(e: MouseEvent<HTMLElement>): boolean {
  if (e.defaultPrevented || e.button !== 0) return false
  const card = e.currentTarget
  const target = e.target
  if (!(target instanceof Element) || !card.contains(target)) return false
  const control = target.closest(CONTROLS)
  if (control && control !== card && card.contains(control)) return false
  const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
  if (selection && !selection.isCollapsed && selection.anchorNode && card.contains(selection.anchorNode)) return false
  return true
}

/**
 * Link que cobre o card inteiro (SPEC-20261103-1928): vai no título do card, e o `::after` dele se estende por cima do
 * card (que precisa de `relative`). Os botões e links de dentro ficam acima dele com `CARD_CONTROLS`. Por ser um link de
 * verdade, abre pelo teclado (Tab + Enter, com o anel de foco no card todo), em outra aba e no toque longo do celular.
 */
export const CARD_LINK =
  'after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent-blue'

/** Camada dos controles de dentro de um card com `CARD_LINK`: acima do link que cobre o card */
export const CARD_CONTROLS = 'relative z-[1]'
