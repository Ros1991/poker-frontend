import { BookOpen, LogIn, Tv } from 'lucide-react'
import { BrandLogo } from '../../../components/brand/BrandLogo'
import { ROUTES } from '../../../constants/routes'
import { HEADER } from '../landing.content'
import { linkButton } from './linkStyles'
import { PricingLink } from './PricingLink'

interface LandingHeaderProps {
  /** Na landing o "Planos" é âncora; nas páginas legais leva a `/#planos` */
  onLanding?: boolean
}

/**
 * Topo da landing, das páginas de termos/privacidade e do manual (SPEC-20261023-1207): logo completa da
 * SPEC-20261023-1202 (que já traz o nome e o subtítulo — nada de texto repetido ao lado), "Planos" e "Manual" (a partir
 * de `md`; o manual é da SPEC-20261026-1910), "Entrar" e "Abrir o Telão da TV" (só "Telão" no celular).
 */
export function LandingHeader({ onLanding = false }: LandingHeaderProps) {
  return (
    <header className="border-b border-border-default bg-bg-secondary">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 lg:px-8">
        <a
          href={ROUTES.HOME}
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        >
          <BrandLogo variant="full" className="h-14 sm:h-16" />
        </a>
        <nav aria-label={HEADER.navLabel} className="flex items-center gap-2 sm:gap-3">
          <PricingLink
            onLanding={onLanding}
            className="hidden min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue md:inline-flex"
          >
            {HEADER.pricing}
          </PricingLink>
          {/* Manual de uso (SPEC-20261026-1910): a partir de `md`, como o "Planos"; no celular fica no rodapé e nos 3 passos */}
          <a
            href={ROUTES.MANUAL}
            className="hidden min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue md:inline-flex"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {HEADER.manual}
          </a>
          <a href={ROUTES.LOGIN} className={linkButton('secondary', 'md')}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {HEADER.login}
          </a>
          <a href={ROUTES.TV} className={linkButton('gold', 'md')}>
            <Tv className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="hidden sm:inline">{HEADER.tvBefore}</span>
              {HEADER.tvShort}
              <span className="hidden sm:inline">{HEADER.tvAfter}</span>
            </span>
          </a>
        </nav>
      </div>
    </header>
  )
}
