/**
 * Página "Meu plano" (`/meu-plano`, SPEC-20261023-1205).
 *
 * Mostra o plano da conta (gravado e efetivo), a origem/nota ("Cortesia — fundador"), o vencimento,
 * as barras de uso (torneios nos últimos 7 dias com contagem regressiva, membros e — só na Liga ou em quem tem mais
 * de um — home games), a tabela comparativa dos 3 planos (preços e limites SÓ do catálogo do `GET me/plan`) e
 * o CTA "Falar com o suporte" (WhatsApp de `VITE_SUPPORT_WHATSAPP`). Não existe checkout.
 *
 * SPEC-20261029-1723 (D18): no Mesa e no Clube a conta tem um home game só, invisível — a conta é o clube; a página
 * não fala em "home game" para eles (o resumo "Home games: Mesa e Clube — um só, a sua conta; Liga até 3" fica no topo).
 */
import { Loader2, Mail, MessageCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PlanComparisonTable } from '../../components/plan/PlanComparisonTable'
import { PlanUsageBar } from '../../components/plan/PlanUsageBar'
import {
  findPlan,
  formatPlanDate,
  formatPlanPrice,
  formatPlanSource,
  formatTimeUntil,
  homeGamesSummary,
  planExpiry,
  planRequestMessage,
  useTimeUntil,
} from '../../components/plan/planUtils'
import { CONTACT_EMAIL, SUPPORT_WHATSAPP, supportWhatsAppUrl } from '../../constants/contact'
import { useAuth } from '../../hooks/useAuth'
import { usePlan } from '../../hooks/usePlan'
import type { MyPlan, PlanDefinition } from '../../types/plan.types'

function openWhatsApp(url: string | null) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export function MyPlanPage() {
  const { user } = useAuth()
  const { myPlan, isLoading, isError, refetch } = usePlan()
  const countdown = useTimeUntil(myPlan?.usage?.tournamentsLast7Days?.nextAllowedAt)

  const generalSupportUrl = supportWhatsAppUrl(
    `Olá! Tenho uma dúvida sobre os planos do Poker da Galera.${
      user?.email ? `\nMinha conta: ${user.email}` : ''
    }`,
  )

  // O plano é da conta: o pedido vai pelo e-mail dela (no Mesa e no Clube não existe "home game" para citar)
  const choosePlan = (plan: PlanDefinition) =>
    openWhatsApp(supportWhatsAppUrl(planRequestMessage(plan.name, null, user?.email)))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Meu plano</h1>
        <p className="mt-1 text-sm text-text-secondary">
          O plano é da sua conta. {homeGamesSummary(myPlan?.catalog)}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" aria-label="Carregando" />
        </div>
      )}

      {isError && !myPlan && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red-soft p-6 text-center">
          <p className="text-text-primary">Não foi possível carregar o seu plano.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={refetch}>
            Tentar de novo
          </Button>
        </div>
      )}

      {myPlan && (
        <MyPlanContent
          myPlan={myPlan}
          countdownLabel={countdown.label}
          generalSupportUrl={generalSupportUrl}
          onChoose={SUPPORT_WHATSAPP ? choosePlan : undefined}
        />
      )}
    </div>
  )
}

interface MyPlanContentProps {
  myPlan: MyPlan
  countdownLabel: string | null
  generalSupportUrl: string | null
  onChoose?: (plan: PlanDefinition) => void
}

function MyPlanContent({
  myPlan,
  countdownLabel,
  generalSupportUrl,
  onChoose,
}: MyPlanContentProps) {
  const current = findPlan(myPlan.catalog, myPlan.effectivePlan)
  const expiry = planExpiry(myPlan.expiresAt)
  // Conta nova no Mesa (origem Manual, sem nota) não precisa de selo de origem
  const sourceText =
    myPlan.effectivePlan === 'Mesa' && myPlan.source === 'Manual' && !myPlan.note
      ? null
      : formatPlanSource(myPlan.source, myPlan.note)
  const downgraded = myPlan.plan !== myPlan.effectivePlan
  const { homeGames, tournamentsLast7Days, membersByHomeGame } = myPlan.usage
  const currentOrder = current?.order ?? 0
  // Home game como conceito só na Liga — ou em quem ficou com mais de um (ex-Liga rebaixada): nada é apagado
  const homeGamesVisible =
    (myPlan.limits.homeGamesVisible ?? current?.homeGamesVisible ?? false) || homeGames.used > 1
  // Sem home game visível: o principal é "a sua conta" no Mesa e o clube (pelo nome) no Clube
  const memberLabel = (hg: (typeof membersByHomeGame)[number]) =>
    !homeGamesVisible && hg.isPrimary && myPlan.effectivePlan === 'Mesa' ? 'Sua conta' : hg.name

  return (
    <>
      {/* Plano atual */}
      <section className="rounded-xl border border-border-default bg-bg-card p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Plano atual
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-extrabold text-text-primary">{myPlan.effectivePlan}</h2>
              {current && (
                <span className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary tabular-nums">
                    {formatPlanPrice(current.priceMonthly)}
                  </span>
                  {current.priceMonthly > 0 && '/mês'}
                </span>
              )}
            </div>
            {sourceText && !downgraded && <Badge color="blue">{sourceText}</Badge>}
            <p className="text-sm text-text-secondary">
              {downgraded && myPlan.expiresAt ? (
                <>
                  Seu plano <strong className="text-text-primary">{myPlan.plan}</strong> venceu em{' '}
                  {formatPlanDate(myPlan.expiresAt)} e a conta voltou para o{' '}
                  {myPlan.effectivePlan}. Seus dados ficam guardados.
                </>
              ) : myPlan.expiresAt ? (
                <>
                  Vence em {formatPlanDate(myPlan.expiresAt)}
                  {!expiry.expired && ` (faltam ${formatTimeUntil(myPlan.expiresAt)})`}. Seus
                  dados ficam guardados mesmo depois do vencimento.
                </>
              ) : myPlan.effectivePlan === 'Mesa' ? (
                'Plano gratuito, sem vencimento.'
              ) : (
                'Sem vencimento.'
              )}
            </p>
          </div>

          {generalSupportUrl && (
            <Button
              variant="gold"
              className="shrink-0 whitespace-nowrap"
              onClick={() => openWhatsApp(generalSupportUrl)}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Falar com o suporte
            </Button>
          )}
        </div>
      </section>

      {/* Uso */}
      <section className="space-y-5 rounded-xl border border-border-default bg-bg-card p-5 shadow-sm lg:p-6">
        <h2 className="text-lg font-bold text-text-primary">Uso do plano</h2>

        {homeGamesVisible && (
          <PlanUsageBar
            label="Home games (como dono)"
            used={homeGames.used}
            limit={homeGames.limit}
            hint="Contando o home game da sua conta, que nunca é excluído."
          />
        )}

        <PlanUsageBar
          label="Torneios criados nos últimos 7 dias"
          used={tournamentsLast7Days.used}
          limit={tournamentsLast7Days.limit}
          hint={
            countdownLabel
              ? `O próximo torneio libera em ${countdownLabel}.`
              : tournamentsLast7Days.limit !== null
                ? 'Janela móvel: cada torneio ocupa a vaga por 7 dias a partir da criação.'
                : undefined
          }
        />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {homeGamesVisible ? 'Membros além do dono, por home game' : 'Membros além do dono'}
          </h3>
          {membersByHomeGame.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhum membro por enquanto.
            </p>
          ) : (
            membersByHomeGame.map((hg) => (
              <PlanUsageBar key={hg.homeGameId} label={memberLabel(hg)} used={hg.used} limit={hg.limit} />
            ))
          )}
        </div>
      </section>

      {/* Comparativo */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Compare os planos</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Quem é membro de um clube usa os recursos do plano do dono dele.
          </p>
        </div>
        <PlanComparisonTable
          plans={myPlan.catalog}
          highlightCurrent={myPlan.effectivePlan}
          onChoose={onChoose}
          chooseLabel={(plan, isCurrent) =>
            isCurrent
              ? 'Plano atual'
              : plan.order < currentOrder
                ? `Mudar para o ${plan.name}`
                : `Quero o ${plan.name}`
          }
        />
      </section>

      {/* Contato */}
      <section className="flex flex-col items-start gap-3 rounded-xl border border-border-default bg-bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:p-6">
        <div>
          <h2 className="text-base font-bold text-text-primary">Dúvidas sobre os planos?</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Nesta fase de testes o suporte ativa o plano para você.{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1 font-medium text-accent-blue underline"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        {generalSupportUrl && (
          <Button
            variant="secondary"
            className="shrink-0 whitespace-nowrap"
            onClick={() => openWhatsApp(generalSupportUrl)}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp do suporte
          </Button>
        )}
      </section>
    </>
  )
}
