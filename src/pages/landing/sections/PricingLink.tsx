import type { ReactNode } from 'react'
import { ROUTES } from '../../../constants/routes'
import { PRICING_ANCHOR } from '../landing.content'

interface PricingLinkProps {
  /** Já está na landing: âncora simples (o navegador rola até a seção) */
  onLanding: boolean
  className?: string
  children: ReactNode
}

/**
 * Link "Planos" do cabeçalho e do rodapé: na landing é a âncora `#planos`; nas páginas de termos e privacidade vai
 * para `/#planos` (a landing rola até a seção quando monta com o hash).
 */
export function PricingLink({ onLanding, className, children }: PricingLinkProps) {
  const href = onLanding ? `#${PRICING_ANCHOR}` : `${ROUTES.HOME}#${PRICING_ANCHOR}`
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
