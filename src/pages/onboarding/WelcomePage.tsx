import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as onboardingApi from '../../api/onboarding.api'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import { supportWhatsAppUrl } from '../../constants/contact'
import { useAuth } from '../../hooks/useAuth'
import { onboardingQueryKey, useOnboardingStatus } from '../../hooks/useOnboarding'
import type { OnboardingRequest } from '../../types/onboarding.types'
import type { PlanName } from '../../types/plan.types'
import type { Profile } from '../../types/profile.types'
import { cn } from '../../utils/cn'
import { errorMessage } from '../../utils/httpErrors'
import { PROFILE_QUERY_KEY } from '../profile/profileFormat'
import { PlanRequestedStep } from './PlanRequestedStep'
import { PlanStep } from './PlanStep'
import { ProfileStep } from './ProfileStep'
import { WelcomeSteps } from './WelcomeSteps'
import { draftFromProfile, welcomeDestination, welcomePlanMessage } from './welcomeFlow'
import type { ProfileDraft, ProfileDraftErrors, WelcomeStep } from './welcomeFlow'

/**
 * `/boas-vindas` — primeiro acesso (SPEC-20261023-1212). O `RootGate`/`ProtectedRoute` mandam para cá quando o
 * `GET me` diz `needsOnboarding` (conta nova por cadastro confirmado ou pelo Google), guardando a página de origem.
 *
 * 1. Completar cadastro: foto do Google (fica ou sai), apelido e WhatsApp — ou "Fazer depois".
 * 2. Escolher plano: Mesa começa na hora; Clube/Liga registram o pedido (o plano só muda pelo Admin) e abrem o
 *    WhatsApp do suporte (`VITE_SUPPORT_WHATSAPP`) com a mensagem pronta.
 * Ao terminar: volta para a origem (ex.: `/parear/CODIGO` do QR da TV); sem origem, o painel da conta — o detalhe do
 * home game principal, que a conta já tem desde a confirmação (SPEC-20261029-1723: não há passo "criar home game";
 * o Início da SPEC-20261029-1724 passa a ser o destino quando existir).
 */
export function WelcomePage() {
  const { user, updateUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const status = useOnboardingStatus()

  const from = (location.state as { from?: Location } | null)?.from
  const fromPath = from ? `${from.pathname}${from.search}` : null

  const [step, setStep] = useState<WelcomeStep>('perfil')
  /** undefined = ainda na etapa 1; null = "Fazer depois" (não mexe no perfil) */
  const [draft, setDraft] = useState<ProfileDraft | null | undefined>(undefined)
  const [serverErrors, setServerErrors] = useState<ProfileDraftErrors>({})
  const [saving, setSaving] = useState<PlanName | null>(null)
  const [requested, setRequested] = useState<{ plan: PlanName; whatsappUrl: string | null } | null>(null)
  const [leaving, setLeaving] = useState(false)

  const profile = status.profile

  function applyProfile(next: Profile) {
    queryClient.setQueryData(onboardingQueryKey(user?.id), next)
    queryClient.setQueryData(PROFILE_QUERY_KEY, next)
    updateUser({ name: next.fullName, photoUrl: next.photoUrl })
  }

  async function leave() {
    setLeaving(true)
    const destination = await welcomeDestination(fromPath)
    navigate(destination, { replace: true })
  }

  async function choose(plan: PlanName) {
    if (saving || !profile) return
    setSaving(plan)
    try {
      const body: OnboardingRequest = { plan }
      if (draft) {
        body.nickname = draft.nickname
        body.whatsapp = draft.whatsapp
        if (profile.photoFromProvider && draft.useProviderPhoto !== null) body.useProviderPhoto = draft.useProviderPhoto
      }
      const next = await onboardingApi.completeOnboarding(body)
      applyProfile(next)
      if (plan === 'Mesa') {
        toast.success('Tudo pronto! Você começa no Mesa, grátis. Dá para mudar quando quiser em Meu plano.')
        await leave()
        return
      }
      // Clube/Liga: o pedido ficou gravado; o WhatsApp do suporte abre com a mensagem pronta
      const whatsappUrl = supportWhatsAppUrl(welcomePlanMessage(plan, next.email))
      if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      setRequested({ plan, whatsappUrl })
      setStep('pedido')
    } catch (err) {
      const message = errorMessage(err) ?? 'Não foi possível salvar sua escolha. Tente de novo.'
      if (/whatsapp/i.test(message)) {
        setServerErrors({ whatsapp: message })
        setStep('perfil')
      } else if (/apelido/i.test(message)) {
        setServerErrors({ nickname: message })
        setStep('perfil')
      }
      toast.error(message)
    } finally {
      setSaving(null)
    }
  }

  let content
  if (!profile) {
    content = status.isError ? (
      <section className="rounded-xl border border-border-default bg-bg-card p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-8 w-8 text-accent-red" aria-hidden />
        <p className="mt-3 text-text-primary">Não foi possível carregar seus dados.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={status.refetch}>
            Tentar de novo
          </Button>
          <Button variant="ghost" onClick={() => navigate(ROUTES.HOME_GAMES, { replace: true })}>
            Ir para o painel
          </Button>
        </div>
      </section>
    ) : (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  } else if (step === 'perfil') {
    content = (
      <ProfileStep
        // Montada de novo a cada volta do plano: parte do rascunho (e do erro do servidor, se houver)
        profile={profile}
        initial={draft ?? draftFromProfile(profile)}
        serverErrors={serverErrors}
        onContinue={(next) => {
          setDraft(next)
          setServerErrors({})
          setStep('plano')
        }}
        onSkip={() => {
          setDraft(null)
          setServerErrors({})
          setStep('plano')
        }}
        onProfileChange={applyProfile}
      />
    )
  } else if (step === 'plano') {
    content = (
      <PlanStep
        currentPlan={profile.effectivePlan}
        saving={saving}
        onChoose={(plan) => void choose(plan)}
        onBack={() => setStep('perfil')}
      />
    )
  } else if (requested) {
    content = (
      <PlanRequestedStep
        plan={requested.plan}
        whatsappUrl={requested.whatsappUrl}
        leaving={leaving}
        onContinue={() => void leave()}
      />
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 sm:px-6 sm:py-10">
      <div className={cn('mx-auto w-full', step === 'plano' ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="mb-6 flex flex-col items-center gap-4">
          <BrandLogo variant="mark" className="h-14 w-auto" />
          <WelcomeSteps step={step} />
        </div>
        {content}
      </div>
    </div>
  )
}
