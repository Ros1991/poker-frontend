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
  Trash2,
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
import { EditablePhotoAvatar } from '../../components/photo/EditablePhotoAvatar'
import { PlayerFormDialog } from '../../components/players/PlayerFormDialog'
import { displayPhone } from '../../utils/phone'
import { cn } from '../../utils/cn'
import {
  ROUTES,
  tournamentDashboardPath,
  rankingDetailPath,
  blindStructureNewPath,
  blindStructureEditPath,
} from '../../constants/routes'
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from '../../constants/statuses'
import { HomeGameFormModal } from './HomeGameFormModal'
import { AddMemberModal } from './AddMemberModal'
import { DeleteHomeGameModal } from './DeleteHomeGameModal'
import { AccessDeniedState } from '../../components/common/AccessDeniedState'
import { isForbiddenError } from '../../utils/httpErrors'
import { useHomeGame } from '../../hooks/useHomeGame'
import { useAuth } from '../../hooks/useAuth'
import { hasFeature, MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { NewTournamentButton } from '../../components/tournament/NewTournamentButton'
import { RankingLockedPreview } from '../rankings/RankingLockedPreview'
import type { PlanName } from '../../types/plan.types'
import type { TournamentStatus } from '../../types/tournament.types'
import type { Person } from '../../types/person.types'
import type { HomeGameMember } from '../../types/homeGame.types'

type Tab = 'torneios' | 'rankings' | 'blinds' | 'membros' | 'jogadores'

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
  const { selectHomeGame, selectedHomeGame, refreshHomeGames } = useHomeGame()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // O dealer entra pelo QR (SPEC-20261023-1216): sem aba de dealers; um link antigo com a aba
  // removida cai em Torneios
  const validTabs: Tab[] = ['torneios', 'rankings', 'jogadores', 'membros', 'blinds']
  const tabParam = searchParams.get('tab') as Tab | null
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'torneios'
  const setActiveTab = (tab: Tab) => setSearchParams({ tab }, { replace: true })
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  // Excluído (SPEC-20261026-1126): a página não volta a marcar este home game como o ativo enquanto sai
  const deletedRef = useRef(false)
  const [tournamentSearch, setTournamentSearch] = useState('')

  // Home Game data
  const {
    data: homeGame,
    isLoading,
    isError,
    error: homeGameError,
  } = useQuery({
    queryKey: ['homeGame', id],
    queryFn: () => homeGamesApi.getById(id!),
    enabled: !!id,
  })

  // Sincroniza o HomeGame selecionado quando a página carrega
  useEffect(() => {
    if (homeGame && !deletedRef.current && selectedHomeGame?.id !== homeGame.id) {
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

  // Ranking de temporada é recurso pago (SPEC-20261023-1205): o plano que vale é o do DONO
  // (homeGame.planFeatures). Sem ele a lista nem é consultada (daria 402 e abriria o modal sozinho).
  const canRankings = !!homeGame && hasFeature(homeGame.planFeatures, 'Rankings')

  // Rankings
  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings', id],
    queryFn: () => rankingsApi.getAll(id!),
    enabled: !!id && activeTab === 'rankings' && canRankings,
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
  // Excluir o home game: só o dono e o Admin do sistema (membro administrador não exclui)
  const canDelete = user?.role === 'Admin' || (!!homeGame && homeGame.ownerId === user?.id)

  // Depois de excluir: troca o home game ativo e vai para a lista (com um só sobrando, ela abre ele sozinha)
  async function handleDeleted() {
    deletedRef.current = true
    await refreshHomeGames()
    navigate(ROUTES.HOME_GAMES, { replace: true })
    queryClient.removeQueries({ queryKey: ['homeGame', id] })
  }

  // Jogadores: todas as pessoas do home game — quem foi cadastrado como Dealer aparece aqui com o
  // selo "Dealer" e também joga (SPEC-20261023-1216, DL3)
  const { data: jogadoresData, isLoading: jogadoresLoading } = useQuery({
    queryKey: ['persons', id],
    queryFn: () => personsApi.getByHomeGame(id!),
    enabled: !!id && activeTab === 'jogadores',
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
    { key: 'membros', label: 'Membros', icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  // 403: não é dono, membro nem Admin deste home game
  if (isForbiddenError(homeGameError)) {
    return <AccessDeniedState />
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

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
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

          {(canManage || canDelete) && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {canManage && (
                <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="secondary"
                  className="text-accent-red-deep hover:bg-accent-red-soft"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir home game
                </Button>
              )}
            </div>
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
          ownerId={homeGame.ownerId}
          homeGameName={homeGame.name}
          tournaments={tournaments}
          isLoading={tournamentsLoading}
          search={tournamentSearch}
          onSearchChange={setTournamentSearch}
        />
      )}
      {activeTab === 'rankings' && (
        <RankingsTab
          rankings={rankings ?? []}
          isLoading={rankingsLoading}
          homeGameId={id!}
          canManage={canManage}
          locked={!canRankings}
          ownerPlan={homeGame.ownerPlan ?? null}
          homeGameName={homeGame.name}
        />
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
          persons={jogadoresData ?? []}
          isLoading={jogadoresLoading}
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

      {/* Excluir home game (SPEC-20261026-1126) */}
      <DeleteHomeGameModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        homeGameId={homeGame.id}
        homeGameName={homeGame.name}
        onDeleted={handleDeleted}
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
          // Uso de membros do plano mudou (SPEC-20261023-1205)
          void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
        }}
      />
    </div>
  )
}

// ------- Torneios Tab -------

function TorneiosTab({
  homeGameId,
  ownerId,
  homeGameName,
  tournaments,
  isLoading,
  search,
  onSearchChange,
}: {
  homeGameId: string
  ownerId: string
  homeGameName: string
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
    planFeatures?: string[]
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
        <NewTournamentButton
          homeGameId={homeGameId}
          ownerId={ownerId}
          homeGameName={homeGameName}
          size="sm"
        />
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
            const sc = {
              label: TOURNAMENT_STATUS_LABELS[t.status] ?? t.status,
              color: TOURNAMENT_STATUS_COLORS[t.status] ?? ('gray' as const),
            }
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
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(t.date)}
                    </span>
                    <span className="tabular-nums">Buy-in: {formatCurrency(t.buyInAmount)}</span>
                    <span>
                      {t.totalEntries} entrada{t.totalEntries !== 1 && 's'}
                    </span>
                    {t.rankingName && (
                      <span
                        className="flex items-center gap-1 text-accent-gold-deep"
                        title={`Ranking: ${t.rankingName}`}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        {t.rankingName}
                      </span>
                    )}
                  </div>
                </div>
                {/* Sem premiação no plano do dono (Mesa) o valor não aparece */}
                {hasFeature(t.planFeatures, 'Prizes') && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-accent-green-deep tabular-nums">
                      {formatCurrency(t.totalPrizePool)}
                    </div>
                    <div className="text-xs text-text-secondary">Premiação</div>
                  </div>
                )}
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
  locked,
  ownerPlan,
  homeGameName,
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
  /** Plano do dono sem Rankings: leaderboard de exemplo desfocado + cadeado */
  locked: boolean
  ownerPlan: PlanName | null
  homeGameName: string
}) {
  const navigate = useNavigate()

  if (locked) {
    return <RankingLockedPreview currentPlan={ownerPlan} homeGameName={homeGameName} />
  }

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
                <Crown className="h-5 w-5 text-accent-gold-deep" />
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
                <p className="mt-2 text-xs text-text-secondary">
                  Temporada: {r.season}
                </p>
              )}
              {r.accumulatedPrize != null && r.accumulatedPrize > 0 && (
                <p className="mt-2 text-sm font-medium text-accent-green-deep tabular-nums">
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
      // Remover libera vaga de membro do plano (SPEC-20261023-1205)
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
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
                    <p className="text-xs text-text-secondary">{m.userEmail}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsAdmin}
                      onChange={(e) => setEditIsAdmin(e.target.checked)}
                      className="h-4 w-4 rounded border-border-input bg-bg-primary text-accent-blue focus:ring-border-focus"
                    />
                    <span className="text-sm text-text-primary">Administrador</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-xs text-text-secondary">Vincular a jogador</label>
                    <select
                      value={editPersonId ?? ''}
                      onChange={(e) => setEditPersonId(e.target.value || null)}
                      className="w-full appearance-none rounded-lg border border-border-input bg-bg-primary px-3 py-2 pr-8 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                    >
                      <option value="">Nenhum</option>
                      {availablePersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname || p.fullName}
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
                  <p className="text-xs text-text-secondary">{m.userEmail}</p>
                </div>
                {m.isAdmin && <Badge color="purple">Admin</Badge>}
                {canManage && (
                  <button
                    onClick={() => startEdit(m)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft transition-colors shrink-0"
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
                      className="text-accent-red-deep hover:bg-accent-red-soft"
                      onClick={() => removeMutation.mutate(m.id)}
                      loading={removeMutation.isPending}
                    >
                      Sim
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(m.id)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors shrink-0"
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

// ------- Persons Tab (Jogadores) -------

// SPEC-20261023-1213 (F17/F20): "Novo jogador" e "Editar" abrem o PlayerFormDialog (mesmos campos do cadastro pelo
// torneio, com foto — tirar na hora, galeria ou webcam, recorte quadrado); tocar no avatar troca/remove a foto (o
// ícone de câmera fica sempre visível: no celular não existe "passar o mouse"). Mantém o selo "Dealer" e a lista
// sem filtro de tipo da SPEC-20261023-1216.
function PersonsTab({
  homeGameId,
  persons,
  isLoading,
  canManage,
}: {
  homeGameId: string
  persons: Person[]
  isLoading: boolean
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  // null = fechado; 'new' = cadastro; Person = edição
  const [dialog, setDialog] = useState<Person | 'new' | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personsApi.remove(id),
    onSuccess: () => {
      toast.success('Jogador removido com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['persons', homeGameId] })
    },
    onError: () => {
      toast.error('Erro ao remover jogador.')
    },
  })

  const refreshPersons = () => void queryClient.invalidateQueries({ queryKey: ['persons', homeGameId] })

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialog('new')}>
            <Plus className="h-4 w-4" />
            Novo jogador
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )}

      {!isLoading && persons.length === 0 && (
        <EmptyState
          icon={Gamepad2}
          title="Nenhum jogador cadastrado"
          description="Cadastre jogadores para este home game."
        />
      )}

      {!isLoading && persons.length > 0 && (
        <div className="space-y-2">
          {persons.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3"
            >
              <EditablePhotoAvatar
                src={p.photoUrl}
                name={p.nickname || p.fullName}
                size="md"
                canEdit={canManage}
                upload={(blob) => personsApi.uploadPhoto(p.id, blob)}
                remove={() => personsApi.removePhoto(p.id)}
                onDone={refreshPersons}
              />
              <div className="flex-1 min-w-0">
                <p className="flex min-w-0 items-center gap-2">
                  <span className="font-medium text-text-primary truncate">
                    {p.nickname || p.fullName}
                  </span>
                  {p.type === 'Dealer' && <Badge color="gray">Dealer</Badge>}
                </p>
                {p.nickname && p.fullName && p.nickname !== p.fullName && (
                  <p className="text-xs text-text-secondary">{p.fullName}</p>
                )}
              </div>
              {p.whatsapp && (
                <span className="text-xs text-text-secondary hidden sm:block">
                  {displayPhone(p.whatsapp)}
                </span>
              )}
              {canManage && (
                <button
                  onClick={() => setDialog(p)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft transition-colors"
                  title="Editar jogador"
                  aria-label={`Editar ${p.nickname || p.fullName}`}
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                  title="Remover jogador"
                  aria-label={`Remover ${p.nickname || p.fullName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <PlayerFormDialog
        isOpen={dialog !== null}
        onClose={() => setDialog(null)}
        homeGameId={homeGameId}
        person={dialog === 'new' ? null : dialog}
        existing={persons}
      />
    </div>
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
    // Custos padrão e dealer pago (SPEC-20261023-1215)
    defaultCosts?: { amount: number }[]
    defaultHasDealer?: boolean
    defaultDealerFee?: number | null
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
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary ml-7">
                  <span>{bs.levelCount ?? bs.levels?.length ?? 0} níveis</span>
                  {(bs.defaultCosts?.length ?? 0) > 0 && (
                    <span className="tabular-nums">
                      {bs.defaultCosts!.length} {bs.defaultCosts!.length === 1 ? 'custo padrão' : 'custos padrão'} ·{' '}
                      {formatCurrency(bs.defaultCosts!.reduce((sum, c) => sum + c.amount, 0))}
                    </span>
                  )}
                  {bs.defaultHasDealer && bs.defaultDealerFee != null && (
                    <span className="tabular-nums">dealer {formatCurrency(bs.defaultDealerFee)} cada</span>
                  )}
                  {bs.defaultBuyIn != null && <span className="tabular-nums">Buy-in: R$ {bs.defaultBuyIn.toFixed(2)}</span>}
                  {bs.defaultStartingStack != null && <span className="tabular-nums">Stack: {bs.defaultStartingStack.toLocaleString('pt-BR')}</span>}
                  {!bs.homeGameId && <span>(global)</span>}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => deleteMutation.mutate(bs.id)}
                  className="p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors shrink-0"
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
