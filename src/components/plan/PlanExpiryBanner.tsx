/**
 * Banner de vencimento do plano (SPEC-20261023-1205), montado no `AppLayout`.
 *
 * API estável: `<PlanExpiryBanner />` sem props. Aparece quando o plano pago da conta vence em
 * ≤ 7 dias ("Seu plano Clube vence em 3 dias. Seus dados ficam guardados.") ou já venceu e a conta
 * voltou para o Mesa. Pode ser dispensado (vale para a sessão da aba, por vencimento). Lê o
 * `GET me/plan` (`usePlan`) e, enquanto ele não chega, os campos de plano do `AuthUser`.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X } from 'lucide-react'
import { ROUTES } from '../../constants/routes'
import { supportWhatsAppUrl } from '../../constants/contact'
import { useAuth } from '../../hooks/useAuth'
import { usePlan } from '../../hooks/usePlan'
import { formatPlanDate, formatTimeUntil, planExpiry, planRequestMessage } from './planUtils'

const DISMISS_KEY = 'poker_plan_banner_dismissed'

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

function writeDismissed(value: string) {
  try {
    sessionStorage.setItem(DISMISS_KEY, value)
  } catch {
    // sem storage (aba privada): o banner some só até recarregar
  }
}

export function PlanExpiryBanner() {
  const { user } = useAuth()
  const { myPlan } = usePlan()
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed())

  const plan = myPlan?.plan ?? user?.plan
  const expiresAt = myPlan ? myPlan.expiresAt : user?.planExpiresAt
  if (!plan || plan === 'Mesa' || !expiresAt) return null

  const info = planExpiry(expiresAt)
  if (!info.soon && !info.expired) return null

  // A chave inclui o estado: dispensar o "vence em" não esconde o "venceu"
  const key = `${expiresAt}|${info.expired ? 'expired' : 'soon'}`
  if (dismissed === key) return null

  const when = formatTimeUntil(expiresAt)
  const supportUrl = supportWhatsAppUrl(planRequestMessage(plan, null, user?.email))

  return (
    <div
      className="flex items-start gap-3 border-b border-accent-gold bg-accent-gold-soft px-4 py-3 lg:px-6"
      role="status"
    >
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold-deep" aria-hidden />
      <p className="flex-1 text-sm text-text-primary">
        {info.expired ? (
          <>
            Seu plano <strong>{plan}</strong> venceu em {formatPlanDate(expiresAt)} e a conta voltou
            para o Mesa. Seus dados ficam guardados.
          </>
        ) : (
          <>
            Seu plano <strong>{plan}</strong> vence em {when} ({formatPlanDate(expiresAt)}). Seus
            dados ficam guardados.
          </>
        )}{' '}
        <Link to={ROUTES.MY_PLAN} className="font-semibold text-accent-blue underline">
          Meu plano
        </Link>
        {supportUrl && (
          <>
            {' · '}
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent-blue underline"
            >
              Falar com o suporte
            </a>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          writeDismissed(key)
          setDismissed(key)
        }}
        className="-my-2 -mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
        aria-label="Dispensar aviso"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
