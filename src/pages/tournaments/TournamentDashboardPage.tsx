import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Users,
  Clock,
  Trophy,
  CreditCard,
  LayoutGrid,
  DollarSign,
  BarChart3,
  Tv,
  Tablet,
  ArrowLeft,
  Play,
  Pause,
  Lock,
  XCircle,
  Pencil,
  UserCog,
} from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as costExtrasApi from '../../api/costExtras.api'
import * as timerApi from '../../api/timer.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_COLORS,
} from '../../constants/statuses'
import {
  dealerTerminalPath,
  tvDisplayPath,
  tournamentEditPath,
} from '../../constants/routes'
import { EntriesTab } from './tabs/EntriesTab'
import { TablesTab } from './tabs/TablesTab'
import { DealersTab } from './tabs/DealersTab'
import { BlindsTab } from './tabs/BlindsTab'
import { PrizesTab } from './tabs/PrizesTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { CostExtrasTab } from './tabs/CostExtrasTab'
import { FinancialTab } from './tabs/FinancialTab'
import type { TimerState } from '../../types/blind.types'
import type { TournamentStatus } from '../../types/tournament.types'

const tabs = [
  { key: 'jogadores', label: 'Jogadores', icon: Users },
  { key: 'mesas', label: 'Mesas', icon: LayoutGrid },
  { key: 'dealers', label: 'Dealers', icon: UserCog },
  { key: 'blinds', label: 'Blinds', icon: Clock },
  { key: 'premiacao', label: 'Premiacao', icon: Trophy },
  { key: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
  { key: 'custos', label: 'Custos', icon: DollarSign },
  { key: 'financeiro', label: 'Financeiro', icon: BarChart3 },
] as const

type TabKey = (typeof tabs)[number]['key']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function TournamentDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('jogadores')
  const [statusConfirm, setStatusConfirm] = useState<{
    status: TournamentStatus
    label: string
    message: string
  } | null>(null)

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => tournamentsApi.getById(id!),
    enabled: !!id,
  })

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', id],
    queryFn: () => entriesApi.getAll(id!),
    enabled: !!id,
  })

  const { data: costExtras = [] } = useQuery({
    queryKey: ['costExtras', id],
    queryFn: () => costExtrasApi.getAll(id!),
    enabled: !!id,
  })

  const { timerState, formattedTime, syncFromServer } = useBlindTimer(() => {
    void queryClient.invalidateQueries({ queryKey: ['timer', id] })
  })

  // Buscar estado inicial do timer + refresh periodico
  useQuery({
    queryKey: ['timer', id],
    queryFn: async () => {
      const state = await timerApi.getState(id!)
      syncFromServer(state as TimerState)
      return state
    },
    enabled: !!id,
    refetchInterval: 10000,
  })

  useWebSocket({
    tournamentId: id ?? '',
    enabled: !!id,
    onTimerUpdate: (state) => syncFromServer(state as TimerState),
    onEntryUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', id] })
    },
    onTournamentUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
    },
    onEliminationUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => timerApi.pause(id!),
    onSuccess: (data) => {
      syncFromServer(data as TimerState)
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      toast.success('Timer pausado.')
    },
    onError: () => toast.error('Erro ao pausar.'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => timerApi.resume(id!),
    onSuccess: (data) => {
      syncFromServer(data as TimerState)
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      toast.success('Timer retomado.')
    },
    onError: () => toast.error('Erro ao retomar.'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (vars: { homeGameId: string; id: string; status: string }) =>
      tournamentsApi.updateStatus(vars.homeGameId, vars.id, vars.status),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      queryClient.invalidateQueries({ queryKey: ['tournaments', vars.homeGameId] })
      // RT-03: o leaderboard do ranking depende do status do torneio (Finished)
      queryClient.invalidateQueries({ queryKey: ['ranking-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      toast.success('Status atualizado!')
      setStatusConfirm(null)
      // Se cancelou, voltar para a lista de torneios do home game
      if (vars.status === 'Cancelled') {
        navigate(`/home-games/${vars.homeGameId}?tab=torneios`)
      }
    },
    onError: () => {
      toast.error('Erro ao atualizar status.')
    },
  })

  if (tournamentLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando torneio..." />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-text-secondary">Torneio nao encontrado.</p>
        <Link to="/" className="text-accent-blue hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  const statusColor =
    TOURNAMENT_STATUS_COLORS[tournament.status as TournamentStatus] ?? ''
  const statusLabel =
    TOURNAMENT_STATUS_LABELS[tournament.status as TournamentStatus] ??
    tournament.status

  const activeEntries = entries.filter((e) => e.status === 'Active' || e.status === 'Registered')

  function getStatusActions() {
    const actions: {
      label: string
      status: TournamentStatus
      icon: typeof Play
      variant: 'primary' | 'success' | 'danger' | 'secondary'
      message: string
    }[] = []

    switch (tournament!.status) {
      case 'Draft':
        actions.push({
          label: 'Iniciar Torneio',
          status: 'InProgress',
          icon: Play,
          variant: 'success',
          message: 'Deseja iniciar o torneio? O timer de blinds sera iniciado. Inscricoes continuam abertas.',
        })
        break
      case 'OpenForRegistration':
        actions.push({
          label: 'Iniciar Torneio',
          status: 'InProgress',
          icon: Play,
          variant: 'success',
          message: 'Deseja iniciar o torneio? O timer de blinds sera iniciado.',
        })
        break
      case 'InProgress':
        actions.push({
          label: 'Encerrar Rebuys',
          status: 'BreakSettlement',
          icon: Lock,
          variant: 'primary',
          message:
            'Deseja encerrar o periodo de rebuys/addons? Os jogadores serao notificados para acerto.',
        })
        actions.push({
          label: 'Finalizar',
          status: 'Finished',
          icon: Lock,
          variant: 'danger',
          message:
            'Deseja finalizar o torneio? Certifique-se de que a premiacao esta confirmada.',
        })
        break
      case 'BreakSettlement':
        actions.push({
          label: 'Finalizar',
          status: 'Finished',
          icon: Lock,
          variant: 'danger',
          message:
            'Deseja finalizar o torneio? Certifique-se de que a premiacao esta confirmada.',
        })
        break
    }

    if (
      tournament!.status !== 'Cancelled' &&
      tournament!.status !== 'Finished'
    ) {
      actions.push({
        label: 'Cancelar',
        status: 'Cancelled',
        icon: XCircle,
        variant: 'danger',
        message:
          'Deseja cancelar o torneio? Esta acao nao pode ser desfeita.',
      })
    }

    return actions
  }

  const statusActions = getStatusActions()

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/home-games/${tournament.homeGameId}?tab=torneios`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">
                {tournament.name}
              </h1>
              <p className="text-sm text-text-muted">
                {tournament.homeGameName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusColor}>{statusLabel}</Badge>
            {tournament.status === 'Draft' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(tournamentEditPath(tournament.id))}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {(tournament.status === 'InProgress' ||
              tournament.status === 'BreakSettlement' ||
              tournament.status === 'OpenForRegistration') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  timerState.isRunning
                    ? pauseMutation.mutate()
                    : resumeMutation.mutate()
                }
                loading={pauseMutation.isPending || resumeMutation.isPending}
              >
                {timerState.isRunning ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Retomar
                  </>
                )}
              </Button>
            )}
            {statusActions.map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                size="sm"
                onClick={() =>
                  setStatusConfirm({
                    status: action.status,
                    label: action.label,
                    message: action.message,
                  })
                }
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Timer</p>
            <p className="text-xl font-mono font-bold text-accent-green">
              {formattedTime}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Jogadores</p>
            <p className="text-xl font-bold text-text-primary">
              {activeEntries.length}/{tournament.totalEntries}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Rebuys</p>
            <p className="text-xl font-bold text-text-primary">
              {tournament.totalRebuys}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Add-ons</p>
            <p className="text-xl font-bold text-text-primary">
              {tournament.totalAddons}
            </p>
          </div>
          {(() => {
            // Total = soma de tudo que todos tem a pagar e receber (totalDue de todas as entries)
            const totalGeral = entries.reduce((sum, e) => sum + (e.totalDue ?? 0), 0)
            // Custos = soma do amount de todos os custos extras
            const totalCustos = costExtras.reduce((sum, c) => sum + (c.amount ?? 0), 0)
            // Premiação = total geral - custos
            const premiacao = totalGeral - totalCustos
            return (
              <>
                <div className="rounded-lg bg-bg-primary p-3">
                  <p className="text-xs text-text-muted">Premiação</p>
                  <p className="text-xl font-bold text-accent-green">
                    {formatCurrency(premiacao)}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-primary p-3">
                  <p className="text-xs text-text-muted">Total</p>
                  <p className="text-xl font-bold text-accent-blue">
                    {formatCurrency(totalGeral)}
                  </p>
                </div>
              </>
            )
          })()}
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2">
          <Link to={tvDisplayPath(tournament.id)} target="_blank">
            <Button variant="ghost" size="sm">
              <Tv className="h-4 w-4" />
              TV Display
            </Button>
          </Link>
          <Link to={dealerTerminalPath(tournament.id)} target="_blank">
            <Button variant="ghost" size="sm">
              <Tablet className="h-4 w-4" />
              Terminal Dealer
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border-default -mx-4 px-4 lg:mx-0 lg:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === tab.key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-6">
        {activeTab === 'jogadores' && (
          <EntriesTab tournament={tournament} entries={entries} />
        )}
        {activeTab === 'mesas' && <TablesTab tournament={tournament} />}
        {activeTab === 'dealers' && <DealersTab tournament={tournament} />}
        {activeTab === 'blinds' && (
          <BlindsTab
            tournament={tournament}
            timerState={timerState}
            syncFromServer={syncFromServer}
          />
        )}
        {activeTab === 'premiacao' && (
          <PrizesTab tournament={tournament} entries={entries} />
        )}
        {activeTab === 'pagamentos' && (
          <PaymentsTab tournament={tournament} entries={entries} />
        )}
        {activeTab === 'custos' && (
          <CostExtrasTab tournament={tournament} />
        )}
        {activeTab === 'financeiro' && (
          <FinancialTab tournament={tournament} entries={entries} />
        )}
      </div>

      {/* Status change confirm dialog */}
      <ConfirmDialog
        isOpen={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        onConfirm={() => {
          if (statusConfirm && id && tournament) {
            updateStatusMutation.mutate({
              homeGameId: tournament.homeGameId,
              id,
              status: statusConfirm.status,
            })
          }
        }}
        title={statusConfirm?.label ?? ''}
        message={statusConfirm?.message ?? ''}
        confirmLabel={statusConfirm?.label ?? 'Confirmar'}
        variant={
          statusConfirm?.status === 'Cancelled' ? 'danger' : 'warning'
        }
        loading={updateStatusMutation.isPending}
      />
    </div>
  )
}
