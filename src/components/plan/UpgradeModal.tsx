/**
 * Modal de upgrade ÚNICO do app (SPEC-20261023-1205). Montado UMA vez no `AppLayout`.
 *
 * API estável:
 * - `<UpgradeModal />` — sem props. Abre sozinho com:
 *   - qualquer resposta HTTP 402 de plano (o interceptor do `api/client.ts` dispara o evento
 *     `poker:plan-limit` com o corpo do 402);
 *   - `usePlanGate().open(detail)` / `openFeature(feature, extra)` (cadeados, botões bloqueados).
 *   Lê `code/feature/currentPlan/requiredPlan/usage/limit/nextAllowedAt/message`; o que faltar é
 *   deduzido pelo catálogo (`usePlanCatalog`) e pelo `GET me/plan` (`usePlan`).
 * - `tournaments_per_week` mostra "O próximo torneio libera em X dias/horas" com contagem regressiva.
 * - CTA "Falar com o suporte" (Button gold) abre o WhatsApp de `VITE_SUPPORT_WHATSAPP` com a mensagem
 *   pronta "Quero o plano <exigido> para o home game <nome>"; sem número configurado o CTA vira
 *   "Ver planos". Link secundário "Ver planos" → `/meu-plano`. Não existe checkout.
 * - O nome do home game da mensagem vem de `detail.homeGameName`, senão da rota atual (torneio/home
 *   game no cache do React Query), do home game selecionado ou do único home game da conta.
 */
import { useCallback, useEffect, useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Lock, MessageCircle, Users, Home } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { PLAN_LIMIT_EVENT } from '../../api/client'
import { ROUTES } from '../../constants/routes'
import { supportWhatsAppUrl } from '../../constants/contact'
import { useAuth } from '../../hooks/useAuth'
import { usePlan, MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import { useHomeGame } from '../../hooks/useHomeGame'
import type { PlanFeature, PlanLimitDetail, PlanName } from '../../types/plan.types'
import type { Tournament } from '../../types/tournament.types'
import type { HomeGame } from '../../types/homeGame.types'
import {
  PLAN_FEATURE_DESCRIPTIONS,
  PLAN_FEATURE_LABELS,
  PLAN_LIMIT_TITLES,
  describeHomeGames,
  describeMembers,
  describeTournaments,
  findPlan,
  formatPlanPrice,
  nextPlan,
  planRequestMessage,
  requiredPlanFor,
  useTimeUntil,
} from './planUtils'

/** Frase padrão por código quando o backend (ou o cadeado) não mandou `message`. */
function fallbackMessage(detail: PlanLimitDetail, requiredPlan: PlanName | null): string {
  const target = requiredPlan ? `no plano ${requiredPlan}` : 'em um plano pago'
  switch (detail.code) {
    case 'feature_locked':
      return detail.feature
        ? `${PLAN_FEATURE_LABELS[detail.feature]} está disponível ${target}.`
        : `Este recurso está disponível ${target}.`
    case 'home_games_limit':
      return `Seu plano chegou ao limite de home games. Mais home games ${target}.`
    case 'tournaments_per_week':
      return `Seu plano permite um número limitado de torneios a cada 7 dias. Torneios ilimitados ${target}.`
    case 'members_limit':
      return `Seu plano chegou ao limite de membros deste home game. Mais membros ${target}.`
  }
}

function usageText(detail: PlanLimitDetail): string | null {
  if (detail.usage == null || detail.limit == null) return null
  switch (detail.code) {
    case 'home_games_limit':
      return `Você já é dono de ${detail.usage} de ${detail.limit} home game${detail.limit === 1 ? '' : 's'} do seu plano.`
    case 'tournaments_per_week':
      return `${detail.usage} de ${detail.limit} torneio${detail.limit === 1 ? '' : 's'} criado${detail.limit === 1 ? '' : 's'} nos últimos 7 dias.`
    case 'members_limit':
      return detail.limit === 0
        ? 'O plano atual não inclui membros além do dono.'
        : `${detail.usage} de ${detail.limit} membros além do dono.`
    default:
      return null
  }
}

export function UpgradeModal() {
  // Guarda a tela em que abriu: ao navegar (ex.: "Ver planos") o modal não fica por cima da página nova
  const [opened, setOpened] = useState<{ detail: PlanLimitDetail; path: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const detail = opened && opened.path === location.pathname ? opened.detail : null
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { myPlan } = usePlan()
  const { homeGames, selectedHomeGame } = useHomeGame()
  // O catálogo já vem no /me/plan; o público só é buscado se o /me/plan ainda não chegou
  const { plans: publicPlans } = usePlanCatalog({ enabled: !!detail && !myPlan })
  const catalog = myPlan?.catalog?.length ? myPlan.catalog : publicPlans

  useEffect(() => {
    function handlePlanLimit(e: Event) {
      const incoming = (e as CustomEvent<PlanLimitDetail>).detail
      if (!incoming?.code) return
      setOpened({ detail: incoming, path: window.location.pathname })
      // Uso e plano mudam (venceu, criou algo): atualiza o "Meu plano" junto
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
    }
    window.addEventListener(PLAN_LIMIT_EVENT, handlePlanLimit)
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, handlePlanLimit)
  }, [queryClient])

  const close = useCallback(() => setOpened(null), [])

  const countdown = useTimeUntil(
    detail?.code === 'tournaments_per_week' ? detail.nextAllowedAt : null,
  )

  if (!detail) return null

  const currentPlan: PlanName | null = detail.currentPlan ?? myPlan?.effectivePlan ?? null
  const requiredPlan: PlanName | null =
    detail.requiredPlan ??
    (detail.feature ? requiredPlanFor(detail.feature, catalog) : nextPlan(currentPlan, catalog))
  const required = findPlan(catalog, requiredPlan)
  const current = findPlan(catalog, currentPlan)
  const message = detail.message?.trim() || fallbackMessage(detail, requiredPlan)
  // SPEC-20261029-1723: no Mesa e no Clube a conta não vê home game (a conta é o clube) — sem "1 de 1 home game"
  const hidesHomeGames =
    detail.code === 'home_games_limit' && !!current && !(current.homeGamesVisible ?? current.maxOwnedHomeGames > 1)
  const usage = hidesHomeGames ? null : usageText(detail)

  // O que o plano exigido acrescenta ao atual (sem o atual no catálogo, mostra tudo)
  const gains: string[] = required
    ? [
        ...(!current || current.maxOwnedHomeGames !== required.maxOwnedHomeGames
          ? [describeHomeGames(required)]
          : []),
        ...(!current || current.tournamentsPer7Days !== required.tournamentsPer7Days
          ? [describeTournaments(required)]
          : []),
        ...(!current || current.maxMembersPerHomeGame !== required.maxMembersPerHomeGame
          ? [describeMembers(required)]
          : []),
        ...required.features
          .filter((f): f is PlanFeature => f in PLAN_FEATURE_LABELS)
          .filter((f) => !current?.features.includes(f))
          .map((f) => PLAN_FEATURE_LABELS[f]),
      ]
    : []

  // Nome do home game para a mensagem pronta do WhatsApp
  const homeGameName = (() => {
    if (detail.homeGameName) return detail.homeGameName
    const path = location.pathname
    const tournamentMatch = matchPath('/tournaments/:id/*', path)
    if (tournamentMatch?.params.id) {
      const t = queryClient.getQueryData<Tournament>(['tournament', tournamentMatch.params.id])
      if (t?.homeGameName) return t.homeGameName
    }
    const hgMatch =
      matchPath('/home-games/:homeGameId/rankings/*', path) ??
      matchPath('/home-games/:homeGameId/blinds/*', path) ??
      matchPath('/home-games/:homeGameId/*', path)
    const hgId = hgMatch?.params.homeGameId
    if (hgId && hgId !== 'new') {
      const hg =
        queryClient.getQueryData<HomeGame>(['homeGame', hgId]) ??
        homeGames.find((h) => h.id === hgId)
      if (hg?.name) return hg.name
    }
    if (selectedHomeGame?.name) return selectedHomeGame.name
    const owned = myPlan?.usage?.membersByHomeGame ?? []
    return owned.length === 1 ? owned[0].name : null
  })()

  // Limite de home games: o pedido é por mais home games, não por um home game específico
  const supportText = planRequestMessage(
    requiredPlan,
    detail.code === 'home_games_limit' ? null : homeGameName,
    user?.email,
  )
  const whatsappUrl = supportWhatsAppUrl(supportText)
  const onPlansPage = location.pathname === ROUTES.MY_PLAN

  const goToPlans = () => {
    setOpened(null)
    if (!onPlansPage) navigate(ROUTES.MY_PLAN)
  }

  const title =
    detail.code === 'feature_locked' && requiredPlan
      ? `Recurso do plano ${requiredPlan}`
      : PLAN_LIMIT_TITLES[detail.code]

  const Icon =
    detail.code === 'tournaments_per_week'
      ? Clock
      : detail.code === 'members_limit'
        ? Users
        : detail.code === 'home_games_limit'
          ? Home
          : Lock

  return (
    <Modal
      isOpen
      onClose={close}
      title={title}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {whatsappUrl ? (
            <>
              <Button variant="ghost" onClick={goToPlans}>
                Ver planos
              </Button>
              <Button
                variant="gold"
                onClick={() => {
                  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Falar com o suporte
              </Button>
            </>
          ) : (
            <Button variant="gold" onClick={goToPlans}>
              Ver planos
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-gold-soft">
            <Icon className="h-6 w-6 text-accent-gold-deep" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-base font-medium text-text-primary">{message}</p>
            {detail.code === 'feature_locked' && detail.feature && (
              <p className="text-sm text-text-secondary">
                {PLAN_FEATURE_DESCRIPTIONS[detail.feature]}
              </p>
            )}
            {usage && <p className="text-sm text-text-secondary">{usage}</p>}
            {currentPlan && (
              <p className="text-sm text-text-secondary">
                Plano atual: <span className="font-semibold text-text-primary">{currentPlan}</span>
              </p>
            )}
          </div>
        </div>

        {detail.code === 'tournaments_per_week' && (countdown.label || countdown.reached) && (
          <div
            className="flex items-center gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue-soft px-4 py-3"
            role="status"
          >
            <Clock className="h-5 w-5 shrink-0 text-accent-blue" aria-hidden />
            <p className="text-sm text-text-primary">
              {countdown.reached ? (
                'A vaga da semana já liberou: tente criar o torneio de novo.'
              ) : (
                <>
                  O próximo torneio libera em{' '}
                  <span className="font-semibold tabular-nums">{countdown.label}</span>.
                </>
              )}
            </p>
          </div>
        )}

        {required && (
          <div className="rounded-lg border border-border-default bg-bg-primary p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-extrabold text-text-primary">
                  {required.name}
                </span>
                {required.highlight && <Badge color="gold">Mais escolhido</Badge>}
              </div>
              <span className="text-sm text-text-secondary">
                <span className="text-base font-bold text-text-primary tabular-nums">
                  {formatPlanPrice(required.priceMonthly)}
                </span>
                {required.priceMonthly > 0 && '/mês'}
              </span>
            </div>
            {gains.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {current ? `O que muda em relação ao ${current.name}` : 'O que o plano inclui'}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-text-primary">
                  {gains.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-text-secondary">
          Fase de testes: o plano é ativado pelo suporte, sem cobrança automática. Seus dados ficam
          guardados em qualquer plano.
        </p>
      </div>
    </Modal>
  )
}
