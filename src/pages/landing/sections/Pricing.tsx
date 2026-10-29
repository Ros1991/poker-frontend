import { PlanComparisonTable } from '../../../components/plan/PlanComparisonTable'
import { formatPlanPrice } from '../../../components/plan/planUtils'
import { CONTACT_EMAIL, supportWhatsAppUrl } from '../../../constants/contact'
import { ROUTES } from '../../../constants/routes'
import { usePlanCatalog } from '../../../hooks/usePlanCatalog'
import type { PlanDefinition } from '../../../types/plan.types'
import { PRICING, PRICING_ANCHOR } from '../landing.content'

/**
 * Seção 5 — planos Mesa / Clube / Liga. A tabela é a MESMA do "Meu plano" e das boas-vindas (`PlanComparisonTable`,
 * catálogo de `GET public/plans`): preços, limites, selo "Mais escolhido" e nota da fase de testes saem de lá — nada
 * digitado aqui. CTA: plano grátis → `/register`; pagos → "Falar com o suporte" no WhatsApp (sem número no build,
 * e-mail do contato). Sempre "Criar conta grátis" (SPEC-20261029-1724: só o visitante vê a landing; quem está logado e
 * chega ao cadastro vai para o Início). SPEC-20261029-1723: a frase dos home games (Mesa e Clube: a conta é o clube; Liga
 * até N, do catálogo).
 */
export function Pricing() {
  const { plans } = usePlanCatalog()
  const featured = plans.find((p) => p.highlight && p.priceMonthly > 0)
  // O plano em que "home game" aparece como conceito (Liga) e o máximo dele, do catálogo
  const multi = plans.find((p) => p.homeGamesVisible ?? p.maxOwnedHomeGames > 1)
  const choose = (plan: PlanDefinition) => {
    if (plan.priceMonthly <= 0) {
      window.location.assign(ROUTES.REGISTER)
      return
    }
    const whatsapp = supportWhatsAppUrl(PRICING.supportMessage(plan.name))
    if (whatsapp) {
      window.open(whatsapp, '_blank', 'noopener,noreferrer')
      return
    }
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(PRICING.emailSubject(plan.name))}`
  }

  return (
    <section id={PRICING_ANCHOR} aria-labelledby="landing-planos" className="scroll-mt-4 bg-bg-primary">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="landing-planos" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            {PRICING.title}
          </h2>
          <p className="mt-3 text-base text-text-secondary">{PRICING.text}</p>
          {multi && (
            <p className="mt-3 text-base text-text-secondary">
              {PRICING.homeGames(multi.name, multi.maxOwnedHomeGames)}
            </p>
          )}
          {featured && (
            <p className="mt-3 text-base font-semibold text-text-primary">
              {PRICING.perHead(
                featured.name,
                PRICING.perHeadPlayers,
                formatPlanPrice(featured.priceMonthly / PRICING.perHeadPlayers),
              )}
            </p>
          )}
        </div>

        <PlanComparisonTable
          className="mt-8"
          onChoose={choose}
          chooseLabel={(plan) =>
            plan.priceMonthly <= 0 ? PRICING.freeCta : PRICING.paidCta
          }
        />
      </div>
    </section>
  )
}
