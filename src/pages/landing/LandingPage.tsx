import { useEffect } from 'react'
import { usePageMeta } from '../../hooks/usePageMeta'
import { HEADER, PAGE_META } from './landing.content'
import { Faq } from './sections/Faq'
import { FinalCta } from './sections/FinalCta'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { LandingFooter } from './sections/LandingFooter'
import { LandingHeader } from './sections/LandingHeader'
import { PainPoints } from './sections/PainPoints'
import { Pricing } from './sections/Pricing'
import { ThreeSteps } from './sections/ThreeSteps'

/**
 * Landing institucional em `/` (SPEC-20261023-1207) com as 7 seções do §5 do plano: topo, a dor, como funciona,
 * 3 passos, planos, perguntas frequentes e chamada final + rodapé. Renderizada pelo `RootGate` para o visitante sem
 * sessão, na própria raiz (sem redirecionar: a URL canônica é `/`), num chunk separado (React.lazy) para o pacote do
 * painel, do telão e do terminal não crescer com textos e imagens da vitrine.
 *
 * Mobile-first: uma coluna até `lg`, duas a partir dele; nada mais largo que a tela a 375 px.
 */
export function LandingPage() {
  usePageMeta(PAGE_META.landing)
  useScrollToHash()

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg-primary text-text-primary">
      <a
        href="#conteudo"
        className="sr-only rounded-lg bg-bg-card px-4 py-3 font-semibold text-accent-blue focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:ring-2 focus:ring-accent-blue"
      >
        {HEADER.skipLink}
      </a>
      <LandingHeader onLanding />
      <main id="conteudo">
        <Hero />
        <PainPoints />
        <HowItWorks />
        <ThreeSteps />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter onLanding />
    </div>
  )
}

/**
 * Chegou com `/#planos` (link das páginas legais): o navegador procura a âncora antes de a landing existir, então a
 * landing rola até a seção depois de montar. Âncoras dentro da própria landing o navegador resolve sozinho.
 */
function useScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [])
}
