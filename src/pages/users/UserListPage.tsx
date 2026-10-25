import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, Users } from 'lucide-react'
import * as usersApi from '../../api/users.api'
import type { PlanName } from '../../types/plan.types'
import type { AdminUserListItem, AdminUserStatusFilter } from '../../types/user.types'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { formatPlanDate } from '../../components/plan'
import { userDetailPath } from '../../constants/routes'
import {
  ADMIN_USERS_QUERY_KEY,
  accountStatus,
  formatLastUse,
  lastAccessOf,
  planColor,
  roleColor,
  roleLabel,
} from './adminUserFormat'

const PAGE_SIZE = 20

const PLAN_OPTIONS = [
  { value: '', label: 'Todos os planos' },
  { value: 'Mesa', label: 'Mesa' },
  { value: 'Clube', label: 'Clube' },
  { value: 'Liga', label: 'Liga' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Ativas e desativadas' },
  { value: 'active', label: 'Só ativas' },
  { value: 'inactive', label: 'Só desativadas' },
]

function readPlan(value: string | null): PlanName | undefined {
  return value === 'Mesa' || value === 'Clube' || value === 'Liga' ? value : undefined
}

function readStatus(value: string | null): AdminUserStatusFilter {
  return value === 'active' || value === 'inactive' ? value : 'all'
}

/**
 * Administração (SPEC-20261023-1206), só Admin do sistema: contas com busca (nome, apelido, e-mail), filtros por plano,
 * status e "pediu plano", 20 por página. O estado fica na URL (?q=&plan=&status=&requested=&page=) para a ficha voltar
 * no mesmo lugar. Não há "criar usuário" (D14): toda conta nasce pelo cadastro da própria pessoa.
 */
export function UserListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const search = params.get('q') ?? ''
  const plan = readPlan(params.get('plan'))
  const status = readStatus(params.get('status'))
  const requested = params.get('requested') === '1'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, { search, plan, status, requested, page }],
    queryFn: () =>
      usersApi.list({ search, plan, status, requested, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  /** Troca um filtro na URL (vazio = some) e volta para a página 1. */
  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key !== 'page' })
  }

  function openUser(user: AdminUserListItem) {
    navigate(userDetailPath(user.id), {
      state: { from: `/users${params.toString() ? `?${params.toString()}` : ''}` },
    })
  }

  const users = data?.data ?? []
  const total = data?.totalCount ?? 0
  const hasFilters = !!search || !!plan || status !== 'all' || requested

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Administração</h1>
        <p className="text-sm text-text-secondary">
          Contas do sistema: plano, senha e acesso. Toda conta nasce pelo cadastro da própria pessoa.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-card p-4 shadow-sm">
        <SearchInput
          value={search}
          onChange={(value) => setFilter('q', value.trim() ? value : null)}
          placeholder="Buscar por nome, apelido ou e-mail"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            id="filtro-plano"
            aria-label="Plano"
            options={PLAN_OPTIONS}
            value={plan ?? ''}
            onChange={(e) => setFilter('plan', e.target.value || null)}
          />
          <Select
            id="filtro-status"
            aria-label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setFilter('status', e.target.value === 'all' ? null : e.target.value)}
          />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border-input bg-bg-input px-3 text-sm text-text-primary">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
              checked={requested}
              onChange={(e) => setFilter('requested', e.target.checked ? '1' : null)}
            />
            Pediu plano nas boas-vindas
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" text="Carregando contas..." />
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-accent-red" aria-hidden="true" />
          <p className="text-text-secondary">Não foi possível carregar as contas.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users className="h-12 w-12 text-text-muted" aria-hidden="true" />
          <p className="text-lg font-medium text-text-secondary">
            {hasFilters ? 'Nenhuma conta com estes filtros' : 'Nenhuma conta ainda'}
          </p>
        </div>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <>
          <p className="text-sm text-text-secondary" aria-live="polite">
            {total === 1 ? '1 conta' : `${total} contas`}
            {isFetching ? ' · atualizando…' : ''}
          </p>

          {/* Celular: cartões */}
          <ul className="flex flex-col gap-3 md:hidden">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => openUser(user)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border-default bg-bg-card p-4 text-left shadow-sm transition-colors hover:bg-bg-tertiary"
                >
                  <Avatar src={user.photoUrl} name={user.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">{user.fullName}</p>
                    <p className="truncate text-sm text-text-secondary">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <UserChips user={user} />
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">
                      Último acesso: {formatLastUse(lastAccessOf(user))}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Tela larga: tabela, linha inteira clicável */}
          <div className="hidden overflow-x-auto rounded-xl border border-border-default bg-bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {users.map((user) => {
                  const st = accountStatus(user)
                  return (
                    <tr
                      key={user.id}
                      onClick={() => openUser(user)}
                      className="cursor-pointer transition-colors hover:bg-bg-tertiary"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={user.photoUrl} name={user.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text-primary">
                              {user.fullName}
                              {user.nickname && (
                                <span className="font-normal text-text-secondary"> ({user.nickname})</span>
                              )}
                            </p>
                            <p className="truncate text-text-secondary">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={roleColor(user.role)}>{roleLabel(user.role)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge color={planColor(user.effectivePlan)}>{user.effectivePlan}</Badge>
                          {user.planExpiresAt && (
                            <span className="text-xs text-text-secondary">
                              {user.effectivePlan === user.plan
                                ? `vence ${formatPlanDate(user.planExpiresAt)}`
                                : `${user.plan} venceu ${formatPlanDate(user.planExpiresAt)}`}
                            </span>
                          )}
                          {user.planRequestPending && user.requestedPlan && (
                            <Badge color="yellow">Pediu {user.requestedPlan}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge color={st.color}>{st.label}</Badge>
                          {!user.emailConfirmedAt && !user.isDeleted && (
                            <Badge color="yellow">E-mail não confirmado</Badge>
                          )}
                          {user.needsOnboarding && !user.isDeleted && (
                            <Badge color="gray">Sem boas-vindas</Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {formatLastUse(lastAccessOf(user))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation()
                            openUser(user)
                          }}
                        >
                          Ver ficha
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data?.page ?? page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(p) => setFilter('page', p > 1 ? String(p) : null)}
          />
        </>
      )}
    </div>
  )
}

/** Chips do cartão do celular: papel, plano (com pedido pendente) e situação. */
function UserChips({ user }: { user: AdminUserListItem }) {
  const st = accountStatus(user)
  return (
    <>
      <Badge color={roleColor(user.role)}>{roleLabel(user.role)}</Badge>
      <Badge color={planColor(user.effectivePlan)}>{user.effectivePlan}</Badge>
      {user.planRequestPending && user.requestedPlan && (
        <Badge color="yellow">Pediu {user.requestedPlan}</Badge>
      )}
      <Badge color={st.color}>{st.label}</Badge>
      {!user.emailConfirmedAt && !user.isDeleted && <Badge color="yellow">E-mail não confirmado</Badge>}
      {user.needsOnboarding && !user.isDeleted && <Badge color="gray">Sem boas-vindas</Badge>}
    </>
  )
}
