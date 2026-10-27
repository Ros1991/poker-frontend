import { useEffect } from 'react'
import { usePageMeta } from '../../hooks/usePageMeta'
import { HEADER } from '../landing/landing.content'
import { LandingFooter } from '../landing/sections/LandingFooter'
import { LandingHeader } from '../landing/sections/LandingHeader'
import { MANUAL_META, MANUAL_PAGE, findManualModule, manualHref } from './manual.content'
import { ManualIndex } from './sections/ManualIndex'
import { ManualModuleView } from './sections/ManualModuleView'

interface ManualPageProps {
  /** Slug do módulo (`/manual/<slug>`) ou null/undefined no índice (`/manual`) */
  slug?: string | null
}

/**
 * Manual de uso público (SPEC-20261026-1910), sem login. `/manual` é o índice; `/manual/<módulo>` é um módulo com os
 * passos e os prints. Cabeçalho e rodapé da landing (o rodapé leva o crédito das fotos de demonstração). Carregado à
 * parte pelo `boot.tsx` (`standaloneManual.tsx`): sem roteador e sem o pacote do painel; dentro do app (rota do
 * `Router.tsx`) é o mesmo componente, num pedaço separado. Mobile-first, nada mais largo que a tela a 375 px.
 */
export function ManualPage({ slug = null }: ManualPageProps) {
  const module = findManualModule(slug)
  const notFound = !!slug && !module
  usePageMeta(
    module
      ? { title: `${module.title} — Manual do Poker da Galera`, description: module.description, path: manualHref(module.slug) }
      : MANUAL_META,
  )
  useScrollToHash()

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg-primary text-text-primary">
      <a
        href="#conteudo"
        className="sr-only rounded-lg bg-bg-card px-4 py-3 font-semibold text-accent-blue focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:ring-2 focus:ring-accent-blue"
      >
        {HEADER.skipLink}
      </a>
      <LandingHeader />
      <main id="conteudo" data-manual={module ? module.slug : 'indice'}>
        {module ? <ManualModuleView module={module} /> : <ManualIndex notFound={notFound} />}
      </main>
      <LandingFooter>
        <p className="text-xs text-text-secondary" data-manual-credit>
          {MANUAL_PAGE.demoNote} {MANUAL_PAGE.photoCredit}
        </p>
      </LandingFooter>
    </div>
  )
}

/** Chegou com `#secao` no endereço: rola até a seção depois de montar (o navegador procurou antes de ela existir). */
function useScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [])
}
