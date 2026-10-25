import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  CreditCard,
  History,
  Home,
  KeyRound,
  Mail,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import * as usersApi from '../../api/users.api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PLAN_SOURCE_LABELS, formatPlanDate } from '../../components/plan'
import { ROUTES, homeGameDetailPath, userEditPath } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import type { PlanSource } from '../../types/plan.types'
import type { AdminUserDetail, UserPlanHistoryEntry } from '../../types/user.types'
import { displayPhone } from '../../utils/phone'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import { ChangePlanModal } from './ChangePlanModal'
import { ResetPasswordModal } from './ResetPasswordModal'
import {
  ADMIN_USERS_QUERY_KEY,
  accountStatus,
  adminUserQueryKey,
  describeAdminAction,
  formatDay,
  formatDayTime,
  formatLastUse,
  isGuid,
  planColor,
  roleColor,
  roleLabel,
} from './adminUserFormat'

type PendingConfirm = 'deactivate' | 'reactivate' | 'confirm-email' | null

/**
 * Ficha da conta na Administração (SPEC-20261023-1206): dados, acesso (último login, último uso, sessões), e-mail
 * (confirmar manualmente / reenviar), formas de entrar (senha, Google), plano com o histórico do audit_logs (inclusive a
 * cortesia "fundador") e o plano pedido nas boas-vindas, home games, ações administrativas e os botões Editar dados,
 * Alterar plano, Redefinir senha e Desativar/Reativar.
 */
export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const validId = isGuid(id)

  const [planOpen, setPlanOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [confirm, setConfirm] = useState<PendingConfirm>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)

  const { data: user, isLoading, isError, error, refetch } = useQuery({
    queryKey: adminUserQueryKey(id ?? ''),
    queryFn: () => usersApi.getById(id!),
    enabled: validId,
    retry: (count, err) => errorStatus(err) !== 404 && count < 2,
  })

  const backTo = (location.state as { from?: string } | null)?.from ?? ROUTES.USERS

  async function afterChange(detail: AdminUserDetail, message: string) {
    queryClient.setQueryData(adminUserQueryKey(detail.id), detail)
    await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
    toast.success(message)
  }

  async function runConfirm() {
    if (!user || !confirm) return
    setBusy(true)
    try {
      if (confirm === 'confirm-email') {
        const detail = await usersApi.confirmEmail(user.id)
        await afterChange(detail, 'E-mail confirmado. Se a pessoa não lembrar a senha, use "Redefinir senha".')
      } else {
        const detail = await usersApi.setStatus(user.id, confirm === 'reactivate')
        await afterChange(detail, confirm === 'reactivate' ? 'Conta reativada.' : 'Conta desativada e sessões encerradas.')
      }
      setConfirm(null)
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    if (!user) return
    setResending(true)
    try {
      const result = await usersApi.resendConfirmation(user.id)
      await queryClient.invalidateQueries({ queryKey: adminUserQueryKey(user.id) })
      toast.success(`E-mail de confirmação reenviado para ${result.sentTo}.`)
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível reenviar o e-mail de confirmação.')
    } finally {
      setResending(false)
    }
  }

  const header = (
    <button
      type="button"
      onClick={() => navigate(backTo)}
      className="flex min-h-[44px] items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      Voltar para a Administração
    </button>
  )

  if (validId && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando a ficha..." />
      </div>
    )
  }

  if (!validId || isError || !user) {
    const notFound = !validId || errorStatus(error) === 404
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-accent-red" aria-hidden="true" />
          <p className="text-text-secondary">
            {notFound ? 'Conta não encontrada.' : 'Não foi possível carregar a ficha.'}
          </p>
          {!notFound && (
            <Button variant="secondary" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    )
  }

  const isSelf = me?.id === user.id
  const st = accountStatus(user)
  const google = user.externalLogins.filter((l) => l.provider === 'Google')

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {header}

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-card p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar src={user.photoUrl} name={user.fullName} size="xl" />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-text-primary">{user.fullName}</h1>
            {user.nickname && <p className="break-words text-sm text-text-secondary">{user.nickname}</p>}
            <p className="break-all text-sm text-text-secondary">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge color={roleColor(user.role)}>{roleLabel(user.role)}</Badge>
              <Badge color={st.color}>{st.label}</Badge>
              <Badge color={planColor(user.plan.effectivePlan)}>{user.plan.effectivePlan}</Badge>
              {isSelf && <Badge color="blue">Você</Badge>}
            </div>
          </div>
        </div>
        {!user.isDeleted && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
            <Button variant="secondary" onClick={() => navigate(userEditPath(user.id), { state: location.state })}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar dados
            </Button>
            <Button variant="secondary" onClick={() => setPasswordOpen(true)} disabled={!user.isActive}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Redefinir senha
            </Button>
            {user.isActive ? (
              <Button variant="danger" onClick={() => setConfirm('deactivate')} disabled={isSelf}>
                <UserX className="h-4 w-4" aria-hidden="true" />
                Desativar
              </Button>
            ) : (
              <Button variant="success" onClick={() => setConfirm('reactivate')}>
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Reativar
              </Button>
            )}
          </div>
        )}
      </div>
      {isSelf && user.isActive && (
        <p className="-mt-3 text-sm text-text-secondary">
          Esta é a sua conta: você não pode desativá-la nem tirar o seu papel de Administrador.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Plano */}
        <Card
          icon={CreditCard}
          title="Plano"
          action={
            !user.isDeleted && (
              <Button onClick={() => setPlanOpen(true)} className="w-full sm:w-auto">
                Alterar plano
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-3xl font-bold text-text-primary">{user.plan.effectivePlan}</span>
              {user.plan.effectivePlan !== user.plan.plan && (
                <Badge color="red">{user.plan.plan} vencido</Badge>
              )}
            </div>
            <Facts>
              <Fact label="Origem">{sourceLabel(user.plan.source)}</Fact>
              <Fact label="Vencimento">
                {user.plan.expiresAt ? formatDay(user.plan.expiresAt) : 'Sem vencimento'}
              </Fact>
              <Fact label="Observação">{user.plan.note || '—'}</Fact>
              <Fact label="Última alteração">
                {user.plan.updatedAt
                  ? `${formatDayTime(user.plan.updatedAt)}${user.plan.updatedByName ? ` por ${user.plan.updatedByName}` : ''}`
                  : '—'}
              </Fact>
              <Fact label="Pedido nas boas-vindas">
                {user.requestedPlan ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {user.requestedPlan}
                    {user.requestedPlanAt && ` em ${formatDay(user.requestedPlanAt)}`}
                    <Badge color={user.planRequestPending ? 'yellow' : 'green'}>
                      {user.planRequestPending ? 'Pendente' : 'Atendido'}
                    </Badge>
                  </span>
                ) : (
                  'Nenhum'
                )}
              </Fact>
            </Facts>
          </div>
        </Card>

        {/* Acesso */}
        <Card icon={Clock} title="Acesso">
          <Facts>
            <Fact label="Último login">{user.lastLoginAt ? formatDayTime(user.lastLoginAt) : 'Nunca entrou'}</Fact>
            <Fact label="Último uso">{formatLastUse(user.lastSeenAt)}</Fact>
            <Fact label="Sessões ativas">{String(user.activeSessions)}</Fact>
            <Fact label="Conta criada em">{formatDayTime(user.createdAt)}</Fact>
            <Fact label="Boas-vindas">
              {user.needsOnboarding ? 'Ainda não passou pelas boas-vindas' : `Concluídas em ${formatDay(user.onboardedAt)}`}
            </Fact>
            <Fact label="WhatsApp">{user.whatsapp ? displayPhone(user.whatsapp) : '—'}</Fact>
          </Facts>
          {user.sessions.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-border-default pt-4">
              {user.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-medium text-text-primary">{s.label}</span>
                  <span className="text-text-secondary">
                    desde {formatDay(s.createdAt)} · uso {formatLastUse(s.lastUsedAt ?? s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* E-mail e formas de entrar */}
        <Card icon={Mail} title="E-mail e formas de entrar">
          <Facts>
            <Fact label="E-mail confirmado">
              {user.emailConfirmedAt ? (
                `Sim, em ${formatDayTime(user.emailConfirmedAt)}`
              ) : (
                <Badge color="yellow">Não confirmado</Badge>
              )}
            </Fact>
            <Fact label="Senha">{user.hasPassword ? 'Tem senha' : 'Sem senha (entra só pelo Google)'}</Fact>
            <Fact label="Google">
              {google.length === 0
                ? 'Não conectado'
                : google
                    .map(
                      (g) =>
                        `Conectado${g.email ? ` (${g.email})` : ''} desde ${formatDay(g.connectedAt)}${
                          g.lastUsedAt ? `, último uso ${formatLastUse(g.lastUsedAt)}` : ''
                        }`,
                    )
                    .join('; ')}
            </Fact>
          </Facts>
          {!user.emailConfirmedAt && user.isActive && !user.isDeleted && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border-default pt-4 sm:flex-row">
              <Button variant="primary" onClick={() => setConfirm('confirm-email')}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Confirmar manualmente
              </Button>
              <Button
                variant="secondary"
                onClick={() => void resendConfirmation()}
                loading={resending}
                disabled={!user.emailDeliveryEnabled}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Reenviar e-mail de confirmação
              </Button>
            </div>
          )}
          {!user.emailConfirmedAt && user.isActive && !user.isDeleted && !user.emailDeliveryEnabled && (
            <p className="mt-2 text-xs text-text-secondary">
              O servidor não está enviando e-mails agora: use &quot;Confirmar manualmente&quot;.
            </p>
          )}
        </Card>

        {/* Home games */}
        <Card icon={Home} title="Home games">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text-secondary">É dono</h3>
              {user.ownedHomeGames.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum.</p>
              ) : (
                <ul className="flex flex-col">
                  {user.ownedHomeGames.map((hg) => (
                    <li key={hg.id} className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                      <Link
                        to={homeGameDetailPath(hg.id)}
                        className="inline-flex min-h-[44px] items-center font-medium text-accent-blue hover:underline"
                      >
                        {hg.name}
                      </Link>
                      <span className="text-text-secondary">
                        {plural(hg.tournamentsCount, 'torneio', 'torneios')} · {plural(hg.membersCount, 'membro', 'membros')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text-secondary">Participa</h3>
              {user.memberships.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum.</p>
              ) : (
                <ul className="flex flex-col">
                  {user.memberships.map((m) => (
                    <li key={m.homeGameId} className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                      <Link
                        to={homeGameDetailPath(m.homeGameId)}
                        className="inline-flex min-h-[44px] items-center font-medium text-accent-blue hover:underline"
                      >
                        {m.name}
                      </Link>
                      <span className="flex items-center gap-2 text-text-secondary">
                        {m.ownerName && `de ${m.ownerName}`}
                        {m.isAdmin && <Badge color="blue">Administra</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Histórico do plano */}
      <Card icon={History} title="Histórico do plano">
        {user.planHistory.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma troca registrada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {user.planHistory.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-sm text-text-primary">{describePlanEntry(entry)}</span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {formatDayTime(entry.createdAt)}
                  {actorLabel(entry.actorName, entry.action)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Ações administrativas */}
      <Card icon={ShieldCheck} title="Ações administrativas">
        {user.adminActions.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma ação administrativa nesta conta.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {user.adminActions.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-sm text-text-primary">{describeAdminAction(entry)}</span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {formatDayTime(entry.createdAt)}
                  {entry.actorName ? ` por ${entry.actorName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ChangePlanModal isOpen={planOpen} onClose={() => setPlanOpen(false)} user={user} />
      <ResetPasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} user={user} />
      <ConfirmDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
        loading={busy}
        variant={confirm === 'deactivate' ? 'danger' : 'warning'}
        title={
          confirm === 'deactivate'
            ? 'Desativar conta'
            : confirm === 'reactivate'
              ? 'Reativar conta'
              : 'Confirmar e-mail manualmente'
        }
        message={
          confirm === 'deactivate'
            ? `${user.fullName} sai de todos os aparelhos na hora e não consegue mais entrar até a conta ser reativada.`
            : confirm === 'reactivate'
              ? `${user.fullName} volta a conseguir entrar com a senha ou o Google de antes.`
              : `Você confirma que ${user.email} é mesmo de ${user.fullName}? A conta passa a entrar normalmente, com a senha do cadastro mais recente.`
        }
        confirmLabel={
          confirm === 'deactivate' ? 'Desativar' : confirm === 'reactivate' ? 'Reativar' : 'Confirmar e-mail'
        }
      />
    </div>
  )
}

function Card({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-default bg-bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue-soft text-accent-blue"
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-text-primary">{children}</dd>
    </div>
  )
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function sourceLabel(source: string | null | undefined): string {
  if (!source) return '—'
  return PLAN_SOURCE_LABELS[source as PlanSource] ?? source
}

function actorLabel(actorName: string | null, action: string): string {
  if (actorName === 'migration') return ' · automático (fundador)'
  if (action === 'PlanRequested') return ''
  return actorName ? ` por ${actorName}` : ''
}

/** "Mesa → Clube (Cortesia, sem vencimento) — fundador" ou "Pediu Liga nas boas-vindas (tinha Mesa)". */
function describePlanEntry(entry: UserPlanHistoryEntry): string {
  if (entry.action === 'PlanRequested') {
    const had = entry.fromPlan ? ` (tinha ${entry.fromPlan})` : ''
    return `Pediu ${entry.requestedPlan ?? 'um plano pago'} nas boas-vindas${had}`
  }
  const from = entry.fromPlan ?? '—'
  const to = entry.toPlan ?? '—'
  const details = [
    entry.toSource ? sourceLabel(entry.toSource) : null,
    entry.toPlan && entry.toPlan !== 'Mesa'
      ? entry.toExpiresAt
        ? `vence ${formatPlanDate(entry.toExpiresAt)}`
        : 'sem vencimento'
      : null,
  ].filter(Boolean)
  const note = entry.toNote ? ` — ${entry.toNote}` : ''
  return `${from} → ${to}${details.length ? ` (${details.join(', ')})` : ''}${note}`
}
