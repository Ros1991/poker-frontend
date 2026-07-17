import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit,
  MapPin,
  Users,
  Trophy,
  Crown,
  Loader2,
  Plus,
  Calendar,
  UserPlus,
  Gamepad2,
  Shield,
  Trash2,
  Camera,
  Timer,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import * as homeGamesApi from '../../api/homeGames.api'
import * as tournamentsApi from '../../api/tournaments.api'
import * as rankingsApi from '../../api/rankings.api'
import * as personsApi from '../../api/persons.api'
import * as blindStructuresApi from '../../api/blindStructures.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { SearchInput } from '../../components/ui/SearchInput'
import { cn } from '../../utils/cn'
import {
  ROUTES,
  tournamentDashboardPath,
  rankingDetailPath,
  blindStructureNewPath,
  blindStructureEditPath,
} from '../../constants/routes'
import { HomeGameFormModal } from './HomeGameFormModal'
import { AddMemberModal } from './AddMemberModal'
import { useHomeGame } from '../../contexts/HomeGameContext'
import { useAuth } from '../../hooks/useAuth'
import type { TournamentStatus } from '../../types/tournament.types'
import type { Person } from '../../types/person.types'
import type { HomeGameMember } from '../../types/homeGame.types'

type Tab = 'torneios' | 'rankings' | 'blinds' | 'membros' | 'jogadores' | 'dealers'

const statusConfig: Record<
  TournamentStatus,
  { label: string; color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' }
> = {
  Draft: { label: 'Rascunho', color: 'gray' },
  OpenForRegistration: { label: 'Iniciado', color: 'blue' },
  InProgress: { label: 'Iniciado', color: 'blue' },
  BreakSettlement: { label: 'Rebuys Finalizados', color: 'yellow' },
  Finished: { label: 'Finalizado', color: 'green' },
  Cancelled: { label: 'Cancelado', color: 'red' },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd 'de' MMM, yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function HomeGameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectHomeGame, selectedHomeGame } = useHomeGame()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const validTabs: Tab[] = ['torneios', 'rankings', 'jogadores', 'dealers', 'membros', 'blinds']
  const tabParam = searchParams.get('tab') as Tab | null
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'torneios'
  const setActiveTab = (tab: Tab) => setSearchParams({ tab }, { replace: true })
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [tournamentSearch, setTournamentSearch] = useState('')

  // Home Game data
  const {
    data: homeGame,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['homeGame', id],
    queryFn: () => homeGamesApi.getById(id!),
    enabled: !!id,
  })

  // Sincroniza o HomeGame selecionado quando a página carrega
  useEffect(() => {
    if (homeGame && selectedHomeGame?.id !== homeGame.id) {
      selectHomeGame(homeGame)
    }
  }, [homeGame, selectedHomeGame?.id, selectHomeGame])

  // Tournaments
  const { data: tournamentsData, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['tournaments', id, tournamentSearch],
    queryFn: () =>
      tournamentsApi.getAll(id!, {
        search: tournamentSearch || undefined,
      }),
    enabled: !!id && activeTab === 'torneios',
  })

  // Rankings
  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings', id],
    queryFn: () => rankingsApi.getAll(id!),
    enabled: !!id && activeTab === 'rankings',
  })

  // Members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['homeGameMembers', id],
    queryFn: () => homeGamesApi.getMembers(id!),
    enabled: !!id,
  })

  // Permission check: owner, admin member, or system admin
  const canManage =
    user?.role === 'Admin' ||
    homeGame?.ownerId === user?.id ||
    (members ?? []).some((m) => m.userId === user?.id && m.isAdmin)

  // Jogadores (Persons type=Jogador)
  const { data: jogadoresData, isLoading: jogadoresLoading } = useQuery({
    queryKey: ['persons', id, 'Jogador'],
    queryFn: () => personsApi.getByHomeGame(id!, 'Jogador'),
    enabled: !!id && activeTab === 'jogadores',
  })

  // Dealers (Persons type=Dealer)
  const { data: dealersData, isLoading: dealersLoading } = useQuery({
    queryKey: ['persons', id, 'Dealer'],
    queryFn: () => personsApi.getByHomeGame(id!, 'Dealer'),
    enabled: !!id && activeTab === 'dealers',
  })

  // Blind Structures
  const { data: blindStructures, isLoading: blindsLoading } = useQuery({
    queryKey: ['blindStructures', id],
    queryFn: () => blindStructuresApi.getAll({ homeGameId: id }),
    enabled: !!id && activeTab === 'blinds',
  })

  const tournaments = (tournamentsData?.data ?? []).filter(
    (t) => t.status !== 'Cancelled',
  )

  const tabs: { key: Tab; label: string; icon: typeof Trophy }[] = [
    { key: 'torneios', label: 'Torneios', icon: Trophy },
    { key: 'rankings', label: 'Rankings', icon: Crown },
    { key: 'blinds', label: 'Estruturas', icon: Timer },
    { key: 'jogadores', label: 'Jogadores', icon: Gamepad2 },
    { key: 'dealers', label: 'Dealers', icon: Shield },
    { key: 'membros', label: 'Membros', icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  if (isError || !homeGame) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-primary text-lg">
          Erro ao carregar o home game.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => navigate(ROUTES.HOME_GAMES)}
        >
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate(ROUTES.HOME_GAMES)}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary truncate">
                {homeGame.name}
              </h1>
              {homeGame.isActive ? (
                <Badge color="green">Ativo</Badge>
              ) : (
                <Badge color="gray">Inativo</Badge>
              )}
            </div>

            {homeGame.description && (
              <p className="mt-2 text-sm text-text-secondary max-w-2xl">
                {homeGame.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-muted">
              {homeGame.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {homeGame.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {homeGame.memberCount}{' '}
                {homeGame.memberCount === 1 ? 'membro' : 'membros'}
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {homeGame.tournamentCount}{' '}
                {homeGame.tournamentCount === 1 ? 'torneio' : 'torneios'}
              </span>
            </div>
          </div>

          {canManage && (
            <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-default">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-accent-blue text-accent-blue'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'torneios' && (
        <TorneiosTab
          homeGameId={id!}
          tournaments={tournaments}
          isLoading={tournamentsLoading}
          search={tournamentSearch}
          onSearchChange={setTournamentSearch}
        />
      )}
      {activeTab === 'rankings' && (
        <RankingsTab rankings={rankings ?? []} isLoading={rankingsLoading} homeGameId={id!} canManage={canManage} />
      )}
      {activeTab === 'blinds' && (
        <BlindsTab
          homeGameId={id!}
          structures={blindStructures ?? []}
          isLoading={blindsLoading}
          canManage={canManage}
        />
      )}
      {activeTab === 'jogadores' && (
        <PersonsTab
          homeGameId={id!}
          type="Jogador"
          persons={jogadoresData ?? []}
          isLoading={jogadoresLoading}
          canManage={canManage}
        />
      )}
      {activeTab === 'dealers' && (
        <PersonsTab
          homeGameId={id!}
          type="Dealer"
          persons={dealersData ?? []}
          isLoading={dealersLoading}
          canManage={canManage}
        />
      )}
      {activeTab === 'membros' && (
        <MembrosTab
          homeGameId={id!}
          members={members ?? []}
          isLoading={membersLoading}
          onAddMember={() => setIsAddMemberOpen(true)}
          canManage={canManage}
        />
      )}

      {/* Edit Modal */}
      <HomeGameFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        homeGame={homeGame}
        onSuccess={() => {
          setIsEditOpen(false)
          queryClient.invalidateQueries({ queryKey: ['homeGame', id] })
          queryClient.invalidateQueries({ queryKey: ['homeGames'] })
        }}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        homeGameId={id!}
        onSuccess={() => {
          setIsAddMemberOpen(false)
          queryClient.invalidateQueries({
            queryKey: ['homeGameMembers', id],
          })
          queryClient.invalidateQueries({ queryKey: ['homeGame', id] })
        }}
      />
    </div>
  )
}

// ------- Torneios Tab -------

function TorneiosTab({
  homeGameId,
  tournaments,
  isLoading,
  search,
  onSearchChange,
}: {
  homeGameId: string
  tournaments: {
    id: string
    name: string
    status: TournamentStatus
    date: string
    buyInAmount: number
    totalEntries: number
    playersRemaining: number
    totalPrizePool: number
    rankingName: string | null
  }[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar torneios..."
          className="max-w-sm"
        />
        <Button
          size="sm"
          onClick={() => navigate(`/home-games/${homeGameId}/tournaments/new`)}
        >
          <Plus className="h-4 w-4" />
          Novo Torneio
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && tournaments.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Nenhum torneio encontrado"
          description={
            search
              ? 'Nenhum resultado para sua busca.'
              : 'Crie o primeiro torneio deste home game.'
          }
        />
      )}

      {!isLoading && tournaments.length > 0 && (
        <div className="space-y-2">
          {tournaments.map((t) => {
            const sc = statusConfig[t.status] ?? { label: t.status, color: 'gray' as const }
            return (
              <button
                key={t.id}
                onClick={() => navigate(tournamentDashboardPath(t.id))}
                className="w-full flex items-center gap-4 rounded-lg border border-border-default bg-bg-secondary p-4 text-left transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-text-primary truncate">
                      {t.name}
                    </h4>
                    <Badge color={sc.color}>{sc.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(t.date)}
                    </span>
                    <span>Buy-in: {formatCurrency(t.buyInAmount)}</span>
                    <span>
                      {t.totalEntries} entrada{t.totalEntries !== 1 && 's'}
                    </span>
                    {t.rankingName && (
                      <span
                        className="flex items-center gap-1 text-yellow-500"
                        title={`Ranking: ${t.rankingName}`}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        {t.rankingName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-accent-green">
                    {formatCurrency(t.totalPrizePool)}
                  </div>
                  <div className="text-xs text-text-muted">Premiação</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------- Rankings Tab -------

function RankingsTab({
  rankings,
  isLoading,
  homeGameId,
  canManage,
}: {
  rankings: {
    id: string
    name: string
    description: string | null
    season: string | null
    isActive: boolean
    accumulatedPrize?: number
  }[]
  isLoading: boolean
  homeGameId: string
  canManage: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => navigate(`/home-games/${homeGameId}/rankings/new`)}>
            <Plus className="h-4 w-4" />
            Novo Ranking
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && rankings.length === 0 && (
        <EmptyState
          icon={Crown}
          title="Nenhum ranking encontrado"
          description="Crie um ranking para acompanhar a pontuacao dos jogadores."
        />
      )}

      {!isLoading && rankings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rankings.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(rankingDetailPath(r.id))}
              className="flex flex-col rounded-lg border border-border-default bg-bg-secondary p-4 text-left transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-400" />
                <h4 className="font-medium text-text-primary">{r.name}</h4>
                {r.isActive ? (
                  <Badge color="green">Ativo</Badge>
                ) : (
                  <Badge color="gray">Inativo</Badge>
                )}
              </div>
              {r.description && (
                <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                  {r.description}
                </p>
              )}
              {r.season && (
                <p className="mt-2 text-xs text-text-muted">
                  Temporada: {r.season}
                </p>
              )}
              {r.accumulatedPrize != null && r.accumulatedPrize > 0 && (
                <p className="mt-2 text-sm font-medium text-accent-green">
                  Acumulado: R$ {r.accumulatedPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ------- Membros Tab -------

function MembrosTab({
  homeGameId,
  members,
  isLoading,
  onAddMember,
  canManage,
}: {
  homeGameId: string
  members: HomeGameMember[]
  isLoading: boolean
  onAddMember: () => void
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editPersonId, setEditPersonId] = useState<string | null>(null)

  // Persons disponíveis para vincular
  const { data: allPersons } = useQuery({
    queryKey: ['persons', homeGameId],
    queryFn: () => personsApi.getByHomeGame(homeGameId),
    enabled: editingId !== null,
  })

  // Person IDs já vinculados (exceto o membro sendo editado)
  const linkedPersonIds = new Set(
    members.filter((m) => m.personId && m.id !== editingId).map((m) => m.personId!),
  )
  const availablePersons = (allPersons ?? []).filter((p) => !linkedPersonIds.has(p.id))

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      homeGamesApi.removeMember(homeGameId, memberId),
    onSuccess: () => {
      toast.success('Membro removido com sucesso!')
      setConfirmRemoveId(null)
      queryClient.invalidateQueries({ queryKey: ['homeGameMembers', homeGameId] })
      queryClient.invalidateQueries({ queryKey: ['homeGame', homeGameId] })
    },
    onError: () => {
      toast.error('Erro ao remover membro.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { isAdmin?: boolean; personId?: string | null } }) => {
      const body: { isAdmin?: boolean; personId?: string | null } = {}
      if (data.isAdmin !== undefined) body.isAdmin = data.isAdmin
      body.personId = data.personId ?? null
      return homeGamesApi.updateMember(homeGameId, memberId, body)
    },
    onSuccess: () => {
      toast.success('Membro atualizado!')
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['homeGameMembers', homeGameId] })
    },
    onError: () => {
      toast.error('Erro ao atualizar membro.')
    },
  })

  function startEdit(m: HomeGameMember) {
    setEditingId(m.id)
    setEditIsAdmin(m.isAdmin)
    setEditPersonId(m.personId)
  }

  function saveEdit() {
    if (!editingId) return
    updateMutation.mutate({
      memberId: editingId,
      data: { isAdmin: editIsAdmin, personId: editPersonId },
    })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={onAddMember}>
            <UserPlus className="h-4 w-4" />
            Adicionar Membro
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum membro"
          description="Adicione membros ao home game."
        />
      )}

      {!isLoading && members.length > 0 && (
        <div className="space-y-2">
          {members.map((m) =>
            editingId === m.id ? (
              <div
                key={m.id}
                className="rounded-lg border border-accent-blue/30 bg-bg-secondary p-3 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={m.userPhotoUrl} name={m.userName} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{m.userName}</p>
                    <p className="text-xs text-text-muted">{m.userEmail}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsAdmin}
                      onChange={(e) => setEditIsAdmin(e.target.checked)}
                      className="h-4 w-4 rounded border-border-default bg-bg-primary text-accent-blue focus:ring-border-focus"
                    />
                    <span className="text-sm text-text-primary">Administrador</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-xs text-text-muted">Vincular a jogador/dealer</label>
                    <select
                      value={editPersonId ?? ''}
                      onChange={(e) => setEditPersonId(e.target.value || null)}
                      className="w-full appearance-none rounded-lg border border-border-default bg-bg-primary px-3 py-2 pr-8 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                    >
                      <option value="">Nenhum</option>
                      {availablePersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname || p.fullName} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdit} loading={updateMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3"
              >
                <Avatar src={m.userPhotoUrl} name={m.userName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-text-primary truncate">
                      {m.userName}
                    </p>
                    {m.personNickname && (
                      <Badge color="blue">{m.personNickname}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">{m.userEmail}</p>
                </div>
                {m.isAdmin && <Badge color="purple">Admin</Badge>}
                {canManage && (
                  <button
                    onClick={() => startEdit(m)}
                    className="p-1.5 rounded-md text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-colors shrink-0"
                    title="Editar membro"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                {canManage && (confirmRemoveId === m.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmRemoveId(null)}
                      disabled={removeMutation.isPending}
                    >
                      Nao
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => removeMutation.mutate(m.id)}
                      loading={removeMutation.isPending}
                    >
                      Sim
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(m.id)}
                    className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    title="Remover membro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ------- Persons Tab (Jogadores / Dealers) -------

function PersonsTab({
  homeGameId,
  type,
  persons,
  isLoading,
  canManage,
}: {
  homeGameId: string
  type: 'Jogador' | 'Dealer'
  persons: Person[]
  isLoading: boolean
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editEmail] = useState('')

  const label = type === 'Jogador' ? 'jogador' : 'dealer'
  const labelPlural = type === 'Jogador' ? 'jogadores' : 'dealers'
  const IconType = type === 'Jogador' ? Gamepad2 : Shield

  const createMutation = useMutation({
    mutationFn: async (data: { fullName: string; nickname?: string; email?: string; whatsapp?: string; photoFile?: File }) => {
      const { photoFile, ...personData } = data
      const created = await personsApi.create({ ...personData, homeGameId, type })
      if (photoFile) {
        try {
          await personsApi.uploadPhoto(created.id, photoFile)
        } catch {
          toast.error(`${type} criado, mas erro ao enviar foto.`)
        }
      }
      return created
    },
    onSuccess: () => {
      toast.success(`${type} criado com sucesso!`)
      setIsFormOpen(false)
      queryClient.invalidateQueries({ queryKey: ['persons', homeGameId, type] })
    },
    onError: () => {
      toast.error(`Erro ao criar ${label}.`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nickname?: string; fullName?: string; whatsapp?: string; email?: string } }) =>
      personsApi.update(id, data),
    onSuccess: () => {
      toast.success(`${type} atualizado!`)
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['persons', homeGameId, type] })
    },
    onError: () => {
      toast.error(`Erro ao atualizar ${label}.`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personsApi.remove(id),
    onSuccess: () => {
      toast.success(`${type} removido com sucesso!`)
      queryClient.invalidateQueries({ queryKey: ['persons', homeGameId, type] })
    },
    onError: () => {
      toast.error(`Erro ao remover ${label}.`)
    },
  })

  function startEdit(p: Person) {
    setEditingId(p.id)
    setEditNickname(p.nickname || '')
    setEditFullName(p.fullName || '')
    setEditWhatsapp(p.whatsapp ? displayPhone(p.whatsapp) : '')
    void p.email
  }

  function saveEdit() {
    if (!editingId || !editNickname.trim()) {
      toast.error('Apelido é obrigatório.')
      return
    }
    const rawDigits = editWhatsapp.replace(/\D/g, '') || undefined
    // Limpar: remover +55 se presente, limitar a 11 dígitos
    const cleanWhatsapp = rawDigits
      ? (rawDigits.startsWith('55') && rawDigits.length > 11 ? rawDigits.slice(2) : rawDigits).slice(0, 11)
      : undefined
    updateMutation.mutate({
      id: editingId,
      data: {
        nickname: editNickname.trim(),
        fullName: editFullName.trim() || editNickname.trim(),
        whatsapp: cleanWhatsapp,
        email: editEmail.trim() || undefined,
      },
    })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo {type}
          </Button>
        </div>
      )}

      {/* Inline form - above the list */}
      {isFormOpen && (
        <PersonFormInline
          type={type}
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setIsFormOpen(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && persons.length === 0 && (
        <EmptyState
          icon={IconType}
          title={`Nenhum ${label} cadastrado`}
          description={`Cadastre ${labelPlural} para este home game.`}
        />
      )}

      {!isLoading && persons.length > 0 && (
        <div className="space-y-2">
          {persons.map((p) =>
            editingId === p.id ? (
              <div
                key={p.id}
                className="rounded-lg border border-accent-blue/30 bg-bg-secondary p-3 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="Apelido *"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formatPhone(editWhatsapp)}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdit} loading={updateMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3"
              >
                <PhotoAvatar personId={p.id} photoUrl={p.photoUrl} name={p.nickname || p.fullName} canManage={canManage} onUploaded={() => queryClient.invalidateQueries({ queryKey: ['persons', homeGameId, type] })} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {p.nickname || p.fullName}
                  </p>
                  {p.nickname && p.fullName && p.nickname !== p.fullName && (
                    <p className="text-xs text-text-muted">{p.fullName}</p>
                  )}
                </div>
                {p.whatsapp && (
                  <span className="text-xs text-text-muted hidden sm:block">
                    {displayPhone(p.whatsapp)}
                  </span>
                )}
                {canManage && (
                  <button
                    onClick={() => startEdit(p)}
                    className="p-1.5 rounded-md text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-colors"
                    title={`Editar ${label}`}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title={`Remover ${label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ------- Person Form Inline -------

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Remove prefixo 55 se tiver mais de 11 dígitos
  let local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  // Se ainda > 11 dígitos, truncar
  if (local.length > 11) local = local.slice(0, 11)
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

// ------- Photo Avatar (clicável para trocar foto) -------

function PhotoAvatar({
  personId,
  photoUrl,
  name,
  canManage,
  onUploaded,
}: {
  personId: string
  photoUrl: string | null
  name: string
  canManage: boolean
  onUploaded: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await personsApi.uploadPhoto(personId, file)
      toast.success('Foto atualizada!')
      onUploaded()
    } catch {
      toast.error('Erro ao enviar foto.')
    }
    e.target.value = ''
  }

  if (!canManage) {
    return <Avatar src={photoUrl} name={name} size="md" />
  }

  return (
    <div className="relative group shrink-0">
      <Avatar src={photoUrl} name={name} size="md" />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Trocar foto"
      >
        <Camera className="h-4 w-4 text-white" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
    </div>
  )
}

// ------- Person Form Inline -------

function PersonFormInline({
  type,
  onSubmit,
  onCancel,
  isLoading,
}: {
  type: 'Jogador' | 'Dealer'
  onSubmit: (data: { fullName: string; nickname?: string; email?: string; whatsapp?: string; photoFile?: File }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) {
      toast.error('Apelido e obrigatorio.')
      return
    }
    const rawDigits = whatsapp.replace(/\D/g, '') || undefined
    const cleanWhatsapp = rawDigits
      ? (rawDigits.startsWith('55') && rawDigits.length > 11 ? rawDigits.slice(2) : rawDigits).slice(0, 11)
      : undefined
    onSubmit({
      fullName: fullName.trim() || nickname.trim(),
      nickname: nickname.trim(),
      whatsapp: cleanWhatsapp,
      photoFile: photoFile || undefined,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-accent-blue/30 bg-bg-secondary p-4 space-y-3"
    >
      <h4 className="text-sm font-semibold text-text-primary">
        Novo {type}
      </h4>
      <div className="flex items-start gap-4">
        {/* Foto */}
        <label className="shrink-0 cursor-pointer group" title="Adicionar foto">
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Foto"
              className="h-16 w-16 rounded-full object-cover border-2 border-accent-blue/30 group-hover:border-accent-blue transition-colors"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-bg-tertiary border-2 border-dashed border-border-default group-hover:border-accent-blue flex items-center justify-center transition-colors">
              <Camera className="h-5 w-5 text-text-muted group-hover:text-accent-blue" />
            </div>
          )}
        </label>
        {/* Campos */}
        <div className="flex-1 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Apelido *"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            placeholder="Nome completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          />
          <input
            type="text"
            placeholder="(11) 99999-9999"
            value={formatPhone(whatsapp)}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={isLoading}>
          Salvar
        </Button>
      </div>
    </form>
  )
}

// ------- Estruturas Tab -------

function BlindsTab({
  homeGameId,
  structures,
  isLoading,
  canManage,
}: {
  homeGameId: string
  structures: {
    id: string
    name: string
    description?: string | null
    homeGameId?: string | null
    levelCount?: number
    defaultBuyIn?: number | null
    defaultStartingStack?: number | null
    levels?: { levelNumber: number; smallBlind: number; bigBlind: number; ante: number; durationMinutes: number; isBreak: boolean }[]
  }[]
  isLoading: boolean
  canManage: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blindStructuresApi.remove(id),
    onSuccess: () => {
      toast.success('Estrutura removida!')
      queryClient.invalidateQueries({ queryKey: ['blindStructures', homeGameId] })
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(status === 403 ? 'Sem permissao.' : msg || 'Erro ao remover estrutura.')
    },
  })

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => navigate(blindStructureNewPath(homeGameId))}
          >
            <Plus className="h-4 w-4" />
            Nova Estrutura
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && structures.length === 0 && (
        <EmptyState
          icon={Timer}
          title="Nenhuma estrutura de torneio"
          description="Crie uma estrutura de torneio para usar nos torneios."
        />
      )}

      {!isLoading && structures.length > 0 && (
        <div className="space-y-2">
          {structures.map((bs) => (
            <div
              key={bs.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-4 transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary"
            >
              <div
                className={`flex-1 min-w-0 ${canManage ? 'cursor-pointer' : ''}`}
                onClick={() => canManage && navigate(blindStructureEditPath(homeGameId, bs.id))}
              >
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-accent-blue shrink-0" />
                  <h4 className="font-medium text-text-primary truncate">
                    {bs.name}
                  </h4>
                  {canManage && (
                    <Edit className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  )}
                </div>
                {bs.description && (
                  <p className="mt-1 text-sm text-text-secondary line-clamp-1 ml-7">
                    {bs.description}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted ml-7">
                  <span>{bs.levelCount ?? bs.levels?.length ?? 0} niveis</span>
                  {bs.defaultBuyIn != null && <span>Buy-in: R$ {bs.defaultBuyIn.toFixed(2)}</span>}
                  {bs.defaultStartingStack != null && <span>Stack: {bs.defaultStartingStack.toLocaleString('pt-BR')}</span>}
                  {!bs.homeGameId && <span>(global)</span>}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => deleteMutation.mutate(bs.id)}
                  className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Remover estrutura"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ------- Shared Empty State -------

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Trophy
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-12 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary mb-3">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary text-center max-w-sm">
        {description}
      </p>
    </div>
  )
}
