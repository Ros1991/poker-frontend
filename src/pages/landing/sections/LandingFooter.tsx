import type { ReactNode } from 'react'
import { Tv } from 'lucide-react'
import { CONTACT_EMAIL } from '../../../constants/contact'
import { ROUTES } from '../../../constants/routes'
import { FOOTER } from '../landing.content'
import { PricingLink } from './PricingLink'

interface LandingFooterProps {
  /** Na landing o "Planos" é âncora; nas páginas legais leva a `/#planos` */
  onLanding?: boolean
  /** Linha extra no fim do rodapé (ex.: o crédito das fotos no manual — SPEC-20261026-1910) */
  children?: ReactNode
}

const LINK =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-sm font-semibold text-text-primary underline-offset-4 hover:text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue'

/**
 * Seção 7 (parte 2) — rodapé: Entrar · Telão · Planos · Manual · Termos · Privacidade · Contato e os domínios curtos do
 * telão. O "Manual" (SPEC-20261026-1910) leva ao manual de uso público.
 */
export function LandingFooter({ onLanding = false, children }: LandingFooterProps) {
  return (
    <footer className="border-t border-border-default bg-bg-secondary">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <nav aria-label={FOOTER.navLabel}>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <li>
              <a href={ROUTES.LOGIN} className={LINK}>
                {FOOTER.links.login}
              </a>
            </li>
            <li>
              <a href={ROUTES.TV} className={LINK}>
                {FOOTER.links.tv}
              </a>
            </li>
            <li>
              <PricingLink onLanding={onLanding} className={LINK}>
                {FOOTER.links.pricing}
              </PricingLink>
            </li>
            <li>
              <a href={ROUTES.MANUAL} className={LINK}>
                {FOOTER.links.manual}
              </a>
            </li>
            <li>
              <a href={ROUTES.TERMS} className={LINK}>
                {FOOTER.links.terms}
              </a>
            </li>
            <li>
              <a href={ROUTES.PRIVACY} className={LINK}>
                {FOOTER.links.privacy}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                {FOOTER.links.contact}
              </a>
            </li>
          </ul>
        </nav>
        <div className="space-y-1 text-sm text-text-secondary lg:text-right">
          <p className="flex items-center gap-2 lg:justify-end">
            <Tv className="h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
            <span className="font-semibold text-text-primary">{FOOTER.tvLine}</span>
          </p>
          <p>
            {FOOTER.copyright(new Date().getFullYear())} ·{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline-offset-4 hover:text-accent-blue hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
      {children && <div className="mx-auto max-w-6xl px-4 pb-6 lg:px-8">{children}</div>}
    </footer>
  )
}
