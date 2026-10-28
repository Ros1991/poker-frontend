import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

/** Folga entre o topo da área que rola e o começo da aba (o `p-4` do `<main>` do AppLayout) */
const GAP_PX = 16

const isScrollY = (el: Element) => {
  const overflowY = getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll'
}

/**
 * Área que rola em volta de `el`: o `<main>` do AppLayout (`overflow-y-auto`), mesmo quando o conteúdo do momento é
 * curto demais para rolar (a aba nova ainda carregando); fora dele, o ancestral que rola; sem nenhum, a própria página
 */
function scrollBoxOf(el: HTMLElement): HTMLElement {
  const main = el.closest('main')
  if (main && isScrollY(main)) return main
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (isScrollY(p) && p.scrollHeight > p.clientHeight + 1) return p
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

const isPageBox = (box: HTMLElement) => box === document.scrollingElement || box === document.documentElement
const maxScrollOf = (box: HTMLElement) => Math.max(0, box.scrollHeight - box.clientHeight)
/** Começo da aba em coordenadas do conteúdo da área (não muda com a rolagem) */
const startOf = (el: HTMLElement, box: HTMLElement) =>
  el.getBoundingClientRect().top - (isPageBox(box) ? 0 : box.getBoundingClientRect().top) + box.scrollTop

/** Eventos de quem está usando a tela: a partir deles a rolagem é da pessoa e a aba deixa de segurar */
const USER_INPUT = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const

/**
 * Leva a área para `target()` e SEGURA lá enquanto a aba nova carrega (2ª rodada da revisão da onda 15): a aba costuma
 * entrar curta (só o relógio e o "Carregando…") e crescer uns milissegundos depois, quando os dados chegam. Sem segurar,
 * a área ficava presa no fim do conteúdo curto e, quando ele crescia, a ancoragem de rolagem do Chrome (a do celular)
 * empurrava a página junto — a aba abria no fim, com o começo acima da vista.
 *
 * Enquanto segura: a ancoragem da área fica desligada (`overflow-anchor: none`) e, a cada mudança de tamanho da aba ou
 * da página (ResizeObserver), a área volta para `target()` (até onde o conteúdo do momento deixa). Para de segurar no
 * primeiro toque, clique, roda do mouse ou tecla, quando outra rolagem (de outro código) leva a área para outro lugar,
 * quando a aba troca de novo ou quando a tela sai; aí a ancoragem volta a ser a de antes. Devolve a função que para.
 */
function holdScroll(box: HTMLElement, el: HTMLElement, target: () => number): () => void {
  const anchorBefore = box.style.overflowAnchor
  box.style.overflowAnchor = 'none'
  const want = () => Math.min(Math.max(0, Math.round(target())), maxScrollOf(box))
  /** Onde a área deve estar agora (a última posição que este código deixou ou que o próprio conteúdo impôs) */
  let expected = box.scrollTop
  let stopped = false

  const apply = () => {
    if (stopped) return
    if (!el.isConnected) { stop(); return }
    const w = want()
    if (Math.abs(box.scrollTop - w) > 1) box.scrollTop = w
    expected = box.scrollTop
  }
  const onScroll = () => {
    const top = box.scrollTop
    if (Math.abs(top - expected) <= 1) return
    // O conteúdo encolheu e a área desceu junto até o fim dele (não foi ninguém): só segue segurando
    if (top < expected && top >= maxScrollOf(box) - 1) { expected = top; apply(); return }
    stop()
  }
  const onInput = () => stop()
  const scrollSource: HTMLElement | Window = isPageBox(box) ? window : box
  const ro = new ResizeObserver(apply)

  function stop() {
    if (stopped) return
    stopped = true
    ro.disconnect()
    scrollSource.removeEventListener('scroll', onScroll)
    for (const type of USER_INPUT) window.removeEventListener(type, onInput, true)
    box.style.overflowAnchor = anchorBefore
  }

  apply()
  ro.observe(el)
  if (el.parentElement) ro.observe(el.parentElement)
  scrollSource.addEventListener('scroll', onScroll, { passive: true })
  for (const type of USER_INPUT) window.addEventListener(type, onInput, { capture: true, passive: true })
  return stop
}

/**
 * Rolagem ao trocar de aba (revisão da onda 15, SPEC-20261027-2132). No celular a barra de baixo fica sempre à mão, então
 * a troca de aba pode acontecer de qualquer ponto da página — e o `<main>` do AppLayout (que é quem rola) guardava a
 * rolagem da aba anterior: a aba nova abria no meio ou no fim, com a busca, os filtros e o "Adicionar" fora da vista.
 *
 * A decisão usa a rolagem de ANTES da troca (a última que a área teve com a aba anterior), não a do primeiro desenho da
 * aba nova: esse primeiro desenho costuma ser curto (carregando) e o navegador já encolheu a rolagem até o fim dele.
 * - Trocou de aba e, antes da troca, o começo da aba (`contentRef`) estava ACIMA da vista: vai para o começo da aba (com
 *   a folga do `<main>`). Se o começo estava à vista (quem trocou estava perto do topo, como nas abas do topo do
 *   computador), fica onde estava.
 * - Primeira vez com o conteúdo na tela, ou trocou de dono (outro home game ou torneio no mesmo componente): se a área
 *   chegou rolada (veio de outra tela pela barra de baixo, pelo menu ou pelo voltar, com o `<main>` ainda rolado da tela
 *   anterior), volta ao topo. No primeiro carregamento (recarregar) a área começa no topo e nada se mexe.
 * Nos dois casos a posição é SEGURADA enquanto a aba carrega e cresce (`holdScroll`), até a pessoa mexer na tela.
 *
 * `contentRef`: o começo da aba (o contêiner do conteúdo, `data-tab-content`). Enquanto ele não existe (carregando), o
 * efeito espera; `owner`: o id do home game ou do torneio.
 */
export function useTabScrollReset(
  tab: string,
  owner: string | undefined,
  contentRef: RefObject<HTMLElement | null>,
): void {
  const last = useRef<{ tab: string; owner: string | undefined } | null>(null)
  /** Última rolagem vista em cada área que contém a aba (o evento de rolagem chega depois do desenho: ainda é a de antes) */
  const lastScroll = useRef(new WeakMap<Element, number>())
  const stopHold = useRef<(() => void) | null>(null)

  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = e.target === document ? document.scrollingElement : e.target
      const el = contentRef.current
      if (t instanceof Element && el && t.contains(el)) lastScroll.current.set(t, t.scrollTop)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [contentRef])

  // Ao sair da tela: para de segurar e esquece a aba (no StrictMode a tela "sai e volta" e o efeito de baixo refaz tudo)
  useLayoutEffect(() => () => {
    stopHold.current?.()
    stopHold.current = null
    last.current = null
  }, [])

  // Sem lista de dependências: roda a cada render, mas só age quando a aba ou o dono mudam (ou o conteúdo aparece)
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const prev = last.current
    if (prev && prev.tab === tab && prev.owner === owner) return
    last.current = { tab, owner }
    const box = scrollBoxOf(el)
    stopHold.current?.()
    stopHold.current = null

    if (!prev || prev.owner !== owner) {
      if (box.scrollTop > 0) stopHold.current = holdScroll(box, el, () => 0)
      return
    }

    const before = lastScroll.current.get(box) ?? box.scrollTop
    const startedAbove = before > startOf(el, box) + 1
    stopHold.current = startedAbove
      ? holdScroll(box, el, () => startOf(el, box) - GAP_PX)
      : holdScroll(box, el, () => before)
  })
}
