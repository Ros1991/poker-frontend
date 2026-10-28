import { useSyncExternalStore } from 'react'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import { useVirtualKeyboardOpen } from '../../hooks/useVirtualKeyboardOpen'

/**
 * Teclado virtual aberto e área visível abaixo disto: layout compacto (SPEC-20261027-1311) — o rodapé vira uma linha só
 * e o "Voltar para a lista" fica só no topo. Só a altura baixa (janela baixa no computador, celular deitado sem teclado)
 * não liga o compacto: "Selecionar todos", "Limpar" e a contagem ficam à vista.
 */
export const COMPACT_BELOW_PX = 600

/**
 * Teclado aberto e área visível abaixo disto (celular deitado: sobram 150–240 px; celular pequeno em pé): layout mínimo
 * — quem abriga o picker (Modal do painel, Sheet do terminal) esconde o próprio cabeçalho e o "Fechar"/"Voltar" dele
 * vem para a barra de cima do picker, para a lista e o formulário não ficarem com altura zero (lacuna de critério da
 * onda 14).
 */
export const MINIMAL_BELOW_PX = 300

/**
 * Área visível abaixo disto, com ou sem teclado (celular deitado: 320–430 px): pouca altura — a moldura de quem abriga
 * fica baixa (Modal `tight`) e o cadastro usa a linha única "voltar + título" no topo. O rodapé completo da lista
 * ("Selecionar todos", "Limpar", contagem) continua: só o teclado aberto o troca pelo compacto.
 */
export const SHORT_BELOW_PX = 480

/**
 * Largura a partir da qual, no layout mínimo, os botões do rodapé sobem para a mesma linha da busca (ou do título do
 * cadastro): celular deitado tem largura de sobra e altura de menos. Abaixo disto (celular em pé) o rodapé fica embaixo.
 */
export const ROW_MIN_WIDTH_PX = 520

function subscribeWidth(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

const wideSnapshot = () => window.innerWidth >= ROW_MIN_WIDTH_PX
const wideServerSnapshot = () => true

/**
 * `sm` do Tailwind (40rem = 640 px): abaixo disto (celular em pé) o cadastro de jogador novo usa o X/✓ no topo, o padrão
 * dos formulários no celular (SPEC-20261027-2132) — o ✓ ao lado do título faz o mesmo que o botão principal e o rodapé
 * some. A mesma media query das classes `sm:`, para o JS e o CSS concordarem na mesma largura.
 */
const SM_QUERY = '(min-width: 40rem)'

function subscribeSm(onChange: () => void): () => void {
  const mq = window.matchMedia(SM_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const phoneSnapshot = () => !window.matchMedia(SM_QUERY).matches
const phoneServerSnapshot = () => false

export interface PickerLayout {
  /** Área visível < 480 px, com ou sem teclado (celular deitado) */
  short: boolean
  /** Teclado aberto e área visível < 600 px */
  compact: boolean
  /** Teclado aberto e área visível < 300 px: sem o cabeçalho de quem abriga; o fechar vem para o picker */
  minimal: boolean
  /** Mínimo com largura de sobra (celular deitado): os botões ficam na barra de cima, sem rodapé */
  row: boolean
  /** Abaixo de `sm` (640 px): cadastro com o X/✓ no topo (SPEC-20261027-2132), sem rodapé */
  phone: boolean
  /** Altura da área visível (px) */
  visibleHeight: number
}

/**
 * Layout do "Adicionar jogadores" conforme o teclado e a área visível. O MESMO cálculo no PlayerPicker e em quem o
 * abriga (AddPlayerModal no painel, AddPlayerSheet no terminal): os dois leem as mesmas fontes externas
 * (useSyncExternalStore), então concordam sobre quando o cabeçalho de fora some e o fechar aparece dentro.
 */
export function usePickerLayout(): PickerLayout {
  const viewport = useVisualViewport()
  const keyboardOpen = useVirtualKeyboardOpen()
  const wide = useSyncExternalStore(subscribeWidth, wideSnapshot, wideServerSnapshot)
  const phone = useSyncExternalStore(subscribeSm, phoneSnapshot, phoneServerSnapshot)
  const visibleHeight = viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
  const compact = keyboardOpen && visibleHeight < COMPACT_BELOW_PX
  const minimal = compact && visibleHeight < MINIMAL_BELOW_PX
  return { short: visibleHeight < SHORT_BELOW_PX, compact, minimal, row: minimal && wide, phone, visibleHeight }
}
