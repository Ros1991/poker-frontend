/**
 * Imagens reais do sistema usadas na landing (SPEC-20261023-1207): capturas de tela de um home game de
 * DEMONSTRAÇÃO, com jogadores, chave PIX e valores fictícios (nenhum nome, foto ou PIX de pessoa real), já com a
 * logo da SPEC-20261023-1202 e o tema claro da SPEC-20261023-1204.
 *
 * Os arquivos ficam em `src/assets/landing/*.webp` e são importados: o Vite põe hash no nome, então o cache
 * imutável de `/assets/` no nginx nunca serve uma captura velha. Cada imagem tem 2–3 larguras para o `srcSet`.
 * Para refazer as capturas: roteiro `landing-capturas.mjs` no scratchpad da SPEC (API local + Chrome headless).
 */
import telaoPareado640 from '../../assets/landing/telao-pareado-640.webp'
import telaoPareado960 from '../../assets/landing/telao-pareado-960.webp'
import telaoPareado1280 from '../../assets/landing/telao-pareado-1280.webp'
import telaoQr640 from '../../assets/landing/telao-qr-640.webp'
import telaoQr960 from '../../assets/landing/telao-qr-960.webp'
import terminalDealer360 from '../../assets/landing/terminal-dealer-360.webp'
import terminalDealer480 from '../../assets/landing/terminal-dealer-480.webp'
import terminalDealer720 from '../../assets/landing/terminal-dealer-720.webp'
import pagamentosPix360 from '../../assets/landing/pagamentos-pix-360.webp'
import pagamentosPix480 from '../../assets/landing/pagamentos-pix-480.webp'
import pagamentosPix720 from '../../assets/landing/pagamentos-pix-720.webp'
import rankingPublico360 from '../../assets/landing/ranking-publico-360.webp'
import rankingPublico480 from '../../assets/landing/ranking-publico-480.webp'
import rankingPublico720 from '../../assets/landing/ranking-publico-720.webp'
import type { LandingImageKey } from './landing.content'

export interface LandingImage {
  /** Menor versão (fallback do `src`) */
  src: string
  srcSet: string
  /** Proporção real da captura (o `<img>` reserva o espaço: sem pulo de layout) */
  width: number
  height: number
}

/**
 * `sizes` da imagem do topo (telão numa TV): o `Hero` e o pré-carregamento do `boot.tsx` usam o MESMO valor, para o
 * navegador reaproveitar o download que começou antes do React.
 */
export const HERO_IMAGE_SIZES = '(min-width: 1024px) 34rem, calc(100vw - 3rem)'

/** TV: capturas 16:9 (1280×720). Celular: 390×780 px de tela (1:2), em 360, 480 e 720 px de largura. */
const TV = { width: 1280, height: 720 }
const PHONE = { width: 720, height: 1440 }

export const LANDING_IMAGES: Record<LandingImageKey, LandingImage> = {
  telaoPareado: {
    src: telaoPareado640,
    srcSet: `${telaoPareado640} 640w, ${telaoPareado960} 960w, ${telaoPareado1280} 1280w`,
    ...TV,
  },
  telaoQr: {
    src: telaoQr640,
    srcSet: `${telaoQr640} 640w, ${telaoQr960} 960w`,
    ...TV,
  },
  terminalDealer: {
    src: terminalDealer360,
    srcSet: `${terminalDealer360} 360w, ${terminalDealer480} 480w, ${terminalDealer720} 720w`,
    ...PHONE,
  },
  pagamentosPix: {
    src: pagamentosPix360,
    srcSet: `${pagamentosPix360} 360w, ${pagamentosPix480} 480w, ${pagamentosPix720} 720w`,
    ...PHONE,
  },
  rankingPublico: {
    src: rankingPublico360,
    srcSet: `${rankingPublico360} 360w, ${rankingPublico480} 480w, ${rankingPublico720} 720w`,
    ...PHONE,
  },
}
