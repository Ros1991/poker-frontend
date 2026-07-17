import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, Users, Trophy, ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as tournamentsApi from '../../api/tournaments.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SearchInput } from '../../components/ui/SearchInput'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_COLORS,
} from '../../constants/statuses'
import { tournamentDashboardPath, homeGameDetailPath } from '../../constants/routes'
import type { TournamentStatus } from '../../types/tournament.types'

const STATUS_FILTERS: { key: TournamentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'Draft', label: 'Rascunho' },
  { key: 'OpenForRegistration', label: 'Aberto' },
  { key: 'InProgress', label: 'Em Andamento' },
  { key: 'Finished', label: 'Encerrado' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function TournamentListPage() {
  // A rota é '/home-games/:id/tournaments' — o param se chama 'id'
  const { id: homeGameId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tournamentsApi.remove(homeGameId!, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournaments', homeGameId] })
      toast.success('Torneio excluído.')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Erro ao excluir torneio.'),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tournaments', homeGameId, search],
    queryFn: () =>
      tournamentsApi.getAll(homeGameId!, {
        search: search || undefined,
        pageSize: 100,
      }),
    enabled: Boolean(homeGameId),
  })

  const tournaments = data?.data ?? []

  const filtered = tournaments
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {homeGameId && (
            <Link
              to={homeGameDetailPath(homeGameId)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="text-2xl font-bold text-text-primary">Torneios</h1>
        </div>
        <Button
          onClick={() =>
            navigate(
              homeGameId
                ? `/home-games/${homeGameId}/tournaments/new`
                : '/home-games',
            )
          }
        >
          <Plus className="h-4 w-4" />
          Novo Torneio
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex overflow-x-auto gap-1">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatusFilter(sf.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                statusFilter === sf.key
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar torneio..."
          className="sm:max-w-xs"
        />
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" text="Carregando torneios..." />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/5 p-6 text-center">
          <p className="text-text-secondary">
            Erro ao carregar torneios. Tente novamente.
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-12 text-center">
          <Trophy className="mx-auto h-12 w-12 text-text-muted mb-3" />
          <p className="text-text-secondary mb-1">Nenhum torneio encontrado.</p>
          <p className="text-sm text-text-muted">
            Crie seu primeiro torneio para comecar.
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tournament) => {
            const statusColor =
              TOURNAMENT_STATUS_COLORS[tournament.status] ?? ''
            const statusLabel =
              TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status

            return (
              <div
                key={tournament.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(tournamentDashboardPath(tournament.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    navigate(tournamentDashboardPath(tournament.id))
                }}
                className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-secondary p-4 text-left transition-colors cursor-pointer hover:border-accent-blue/50 hover:bg-bg-secondary/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">
                      {tournament.name}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {tournament.homeGameName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={statusColor}>{statusLabel}</Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm({ id: tournament.id, name: tournament.name })
                      }}
                      className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-red-500/10 transition-colors"
                      title="Excluir torneio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(tournament.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {tournament.totalEntries} jogadores
                  </span>
                  {tournament.rankingName && (
                    <span
                      className="flex min-w-0 items-center gap-1 text-yellow-500"
                      title={`Ranking: ${tournament.rankingName}`}
                    >
                      <Trophy className="h-3 w-3 shrink-0" />
                      <span className="truncate">{tournament.rankingName}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border-default pt-3">
                  <div>
                    <p className="text-xs text-text-muted">Buy-in</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatCurrency(tournament.buyInAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted">Premiação</p>
                    <p className="text-sm font-semibold text-accent-green">
                      {formatCurrency(tournament.totalPrizePool)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id)
        }}
        title="Excluir Torneio"
        message={`Excluir o torneio "${deleteConfirm?.name ?? ''}"? Ele deixará de contar para o ranking.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
