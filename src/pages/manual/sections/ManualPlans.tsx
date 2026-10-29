import { PlanComparisonTable } from '../../../components/plan/PlanComparisonTable'
import { CONTACT_EMAIL, supportWhatsAppUrl } from '../../../constants/contact'
import { ROUTES } from '../../../constants/routes'
import type { PlanDefinition } from '../../../types/plan.types'
import { MANUAL_PAGE } from '../manual.content'

/**
 * Tabela comparativa dos planos no módulo "Planos" do manual (SPEC-20261026-1910): a MESMA da landing, do "Meu plano"
 * e das boas-vindas (`PlanComparisonTable`, catálogo de `GET public/plans`) — preços e limites nunca digitados aqui.
 * Plano grátis → cadastro; pagos → WhatsApp do suporte com a mensagem pronta (sem número no build, e-mail).
 * Sempre "Criar conta grátis" (SPEC-20261029-1724, como a landing): quem está logado e toca nele vai do cadastro para o
 * Início.
 */
export function ManualPlans() {
  const choose = (plan: PlanDefinition) => {
    if (plan.priceMonthly <= 0) {
      window.location.assign(ROUTES.REGISTER)
      return
    }
    const whatsapp = supportWhatsAppUrl(MANUAL_PAGE.plansMessage(plan.name))
    if (whatsapp) {
      window.open(whatsapp, '_blank', 'noopener,noreferrer')
      return
    }
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(MANUAL_PAGE.plansEmailSubject(plan.name))}`
  }

  return (
    <section id="comparar-planos" aria-labelledby="manual-comparar-planos" className="scroll-mt-4">
      <h2 id="manual-comparar-planos" className="text-2xl font-extrabold text-text-primary">
        {MANUAL_PAGE.plansTitle}
      </h2>
      <p className="mt-2 text-base text-text-secondary">{MANUAL_PAGE.plansText}</p>
      <PlanComparisonTable
        className="mt-6"
        onChoose={choose}
        chooseLabel={(plan) =>
          plan.priceMonthly <= 0 ? MANUAL_PAGE.plansFreeCta : MANUAL_PAGE.plansPaidCta
        }
      />
    </section>
  )
}
