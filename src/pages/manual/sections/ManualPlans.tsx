import { PlanComparisonTable } from '../../../components/plan/PlanComparisonTable'
import { CONTACT_EMAIL, supportWhatsAppUrl } from '../../../constants/contact'
import { ROUTES } from '../../../constants/routes'
import type { PlanDefinition } from '../../../types/plan.types'
import { accountLink } from '../../landing/sections/accountLink'
import { MANUAL_PAGE } from '../manual.content'

/**
 * Tabela comparativa dos planos no módulo "Planos" do manual (SPEC-20261026-1910): a MESMA da landing, do "Meu plano"
 * e das boas-vindas (`PlanComparisonTable`, catálogo de `GET public/plans`) — preços e limites nunca digitados aqui.
 * Plano grátis → cadastro; pagos → WhatsApp do suporte com a mensagem pronta (sem número no build, e-mail).
 * Logado (integração da onda 14, como a tabela da landing): o plano grátis vira "Abrir painel" (→ /home-games), sem o
 * convite para criar conta.
 */
export function ManualPlans() {
  const account = accountLink()

  const choose = (plan: PlanDefinition) => {
    if (plan.priceMonthly <= 0) {
      window.location.assign(account.loggedIn ? account.href : ROUTES.REGISTER)
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
          plan.priceMonthly <= 0
            ? account.loggedIn
              ? MANUAL_PAGE.plansPanelCta
              : MANUAL_PAGE.plansFreeCta
            : MANUAL_PAGE.plansPaidCta
        }
      />
    </section>
  )
}
