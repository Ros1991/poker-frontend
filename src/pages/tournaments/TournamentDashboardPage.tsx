import { useRef, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Tv,
  Tablet,
  ArrowLeft,
  Play,
  Pause,
  Lock,
  XCircle,
  Pencil,
  UserCheck,
  Crosshair,
} from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as costExtrasApi from '../../api/costExtras.api'
import * as timerApi from '../../api/timer.api'
import * as dealerAccessApi from '../../api/dealerAccess.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { hasFeature, MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { usePlanGate } from '../../hooks/usePlanGate'
import { useTabScrollReset } from '../../hooks/useTabScrollReset'
import { PlanLock } from '../../components/plan'
import { PlanTabLock } from '../../components/layout/PlanTabLock'
import { TOURNAMENT_TABS, homeGameTabPath, isTabLocked, parseTournamentTab } from '../../components/layout/navTabs'
import type { TournamentTabKey } from '../../components/layout/navTabs'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { DealerQrModal } from '../../components/tournament/DealerQrModal'
import { apiErrorMessage, formatTime } from '../../components/dealer/terminalFormat'
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_COLORS,
} from '../../constants/statuses'
import {
  ROUTES,
  dealerMiniTvPath,
  dealerTerminalPath,
  tournamentEditPath,
} from '../../constants/routes'
import { EntriesTab } from './tabs/EntriesTab'
import { TablesTab } from './tabs/TablesTab'
import { BlindsTab } from './tabs/BlindsTab'
import { PrizesTab } from './tabs/PrizesTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { CostExtrasTab } from './tabs/CostExtrasTab'
import { FinancialTab } from './tabs/FinancialTab'
import type { TimerState } from '../../types/blind.types'
import type { TournamentStatus } from '../../types/tournament.types'
import { isKnockout, KNOCKOUT_BADGES, knockoutTypeOf } from '../../utils/knockout'
import type { DealerRequest } from '../../types/display.types'
import type { PlanFeature } from '../../types/plan.types'

// Abas: TOURNAMENT_TABS (components/layout/navTabs.ts), a mesma definição da barra de baixo do celular. `feature`:
// recurso do plano pago que a aba exige (SPEC-20261023-1205). Sem ele no plano do DONO (`tournament.planFeatures`), a
// aba ganha o cadeado e mostra o PlanLock no lugar do conteúdo — e a aba nem monta, então as consultas dela (que dariam
// 402) não saem.

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** 401/403/404: a consulta periódica dos pedidos do dealer não insiste */
function isAccessError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status
  return status === 401 || status === 403 || status === 404
}

export function TournamentDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const gate = usePlanGate()
  // Aba na URL (?tab=, SPEC-20261027-2132): a barra de baixo do celular, o voltar do navegador e o recarregar respeitam a
  // aba. Trocar de aba substitui a entrada do histórico (como no detalhe do home game)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: TournamentTabKey = parseTournamentTab(searchParams.get('tab'))
  const setActiveTab = (tab: TournamentTabKey) => setSearchParams({ tab }, { replace: true })
  // Trocar de aba (barra de baixo ou abas do topo) com a página rolada abre a aba nova do começo dela (revisão da onda 15)
  const tabContentRef = useRef<HTMLDivElement>(null)
  useTabScrollReset(activeTab, id, tabContentRef)
  const [dealerQrOpen, setDealerQrOpen] = useState(false)
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

  // Recursos do plano do DONO do home game (SPEC-20261023-1205). Só decide com o torneio carregado:
  // antes disso nenhuma consulta de recurso pago sai (sem a feature ela daria 402 e abriria o modal).
  const planFeatures = tournament?.planFeatures
  const can = (feature: PlanFeature) => !!tournament && hasFeature(planFeatures, feature)
  const canCostExtras = can('CostExtras')
  const canDealerQr = can('DealerQr')
  const canFinancial = can('Financial')
  const canPrizes = can('Prizes')

  const { data: costExtras = [] } = useQuery({
    queryKey: ['costExtras', id],
    queryFn: () => costExtrasApi.getAll(id!),
    enabled: !!id && canCostExtras,
  })

  // Pedidos de acesso do dealer (SPEC-20261023-1208): consulta a cada 5 s enquanto a aba está
  // visível e o torneio não terminou; o banner no topo e o modal do QR usam a mesma lista.
  // Só com o terminal do dealer por QR no plano (DealerQr).
  const tournamentOver = tournament?.status === 'Finished' || tournament?.status === 'Cancelled'
  const { data: dealerRequests = [] } = useQuery({
    queryKey: ['dealer-requests', id],
    queryFn: () => dealerAccessApi.listRequests(id!),
    enabled: !!id && !!tournament && !tournamentOver && canDealerQr,
    // Sem acesso ao torneio (401/403/404) não adianta insistir; queda de rede continua tentando
    refetchInterval: (query) =>
      isAccessError(query.state.error) || document.visibilityState !== 'visible' ? false : 5000,
    retry: false,
  })
  const pendingDealerRequests = dealerRequests.filter((r) => r.status === 'Pending')
  const connectedDealers = dealerRequests.filter((r) => r.status === 'Approved')

  const decideDealerMutation = useMutation({
    mutationFn: ({ action, request }: { action: 'approve' | 'reject'; request: DealerRequest }) =>
      action === 'approve'
        ? dealerAccessApi.approve(id!, request.id)
        : dealerAccessApi.reject(id!, request.id),
    onSuccess: (_data, { action, request }) => {
      toast.success(
        action === 'approve'
          ? `${request.name} autorizado como dealer.`
          : `Pedido de ${request.name} recusado.`,
      )
      void queryClient.invalidateQueries({ queryKey: ['dealer-requests', id] })
      void queryClient.invalidateQueries({ queryKey: ['dealer-access', id] })
    },
    onError: (err, { action }) => {
      toast.error(
        apiErrorMessage(
          err,
          action === 'approve' ? 'Não foi possível autorizar o dealer.' : 'Não foi possível recusar o pedido.',
        ),
      )
      // 400 (pedido venceu, QR revogado…): a lista do servidor já mudou
      void queryClient.invalidateQueries({ queryKey: ['dealer-requests', id] })
    },
  })
  const decidingDealerId = decideDealerMutation.isPending
    ? decideDealerMutation.variables?.request.id
    : undefined

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
      // SPEC-20261026-1907: cancelado sai da contagem de torneios do home game e devolve a vaga da semana do plano
      queryClient.invalidateQueries({ queryKey: ['homeGame', vars.homeGameId] })
      queryClient.invalidateQueries({ queryKey: ['homeGames'] })
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
      toast.success('Status atualizado!')
      setStatusConfirm(null)
      // Se cancelou, voltar para a lista de torneios do home game
      if (vars.status === 'Cancelled') {
        navigate(`/home-games/${vars.homeGameId}?tab=torneios`)
      }
    },
    onError: (err: unknown) => {
      // Mensagem do servidor (ex.: "Torneio finalizado não pode ser cancelado.")
      toast.error(apiErrorMessage(err, 'Erro ao atualizar status.'))
      // O status pode ter mudado por fora (ex.: finalizado sozinho na última eliminação): relê para as ações certas
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
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
        <p className="text-text-secondary">Torneio não encontrado.</p>
        <Link to={ROUTES.HOME_GAMES} className="text-accent-blue hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  const statusColor =
    TOURNAMENT_STATUS_COLORS[tournament.status as TournamentStatus]
  const statusLabel =
    TOURNAMENT_STATUS_LABELS[tournament.status as TournamentStatus] ??
    tournament.status

  const activeEntries = entries.filter((e) => e.status === 'Active' || e.status === 'Registered')

  // Sem premiação no plano não há o que confirmar antes de finalizar
  const finishMessage = canPrizes
    ? 'Deseja finalizar o torneio? Certifique-se de que a premiação está confirmada.'
    : 'Deseja finalizar o torneio?'

  const activeTabFeature = TOURNAMENT_TABS.find((t) => t.key === activeTab)?.feature
  const activeTabLocked = !!activeTabFeature && !hasFeature(planFeatures, activeTabFeature)

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
          message: 'Deseja iniciar o torneio? O timer de blinds será iniciado. Inscrições continuam abertas.',
        })
        break
      case 'OpenForRegistration':
        actions.push({
          label: 'Iniciar Torneio',
          status: 'InProgress',
          icon: Play,
          variant: 'success',
          message: 'Deseja iniciar o torneio? O timer de blinds será iniciado.',
        })
        break
      case 'InProgress':
        actions.push({
          label: 'Encerrar Rebuys',
          status: 'BreakSettlement',
          icon: Lock,
          variant: 'primary',
          message:
            'Deseja encerrar o período de rebuys/add-ons? Os jogadores serão notificados para acerto.',
        })
        actions.push({
          label: 'Finalizar',
          status: 'Finished',
          icon: Lock,
          variant: 'danger',
          message: finishMessage,
        })
        break
      case 'BreakSettlement':
        actions.push({
          label: 'Finalizar',
          status: 'Finished',
          icon: Lock,
          variant: 'danger',
          message: finishMessage,
        })
        break
    }

    // Cancelar: em qualquer status antes de finalizar, inclusive no acerto (BreakSettlement). Finalizado não cancela
    // (SPEC-20261026-1907: o servidor recusa com 400 — cancelado não conta no limite semanal do plano).
    if (
      tournament!.status !== 'Cancelled' &&
      tournament!.status !== 'Finished'
    ) {
      actions.push({
        label: 'Cancelar torneio',
        status: 'Cancelled',
        icon: XCircle,
        variant: 'danger',
        message:
          'Deseja cancelar o torneio? Esta ação não pode ser desfeita.',
      })
    }

    return actions
  }

  const statusActions = getStatusActions()

  return (
    <div className="flex flex-col gap-4">
      {/* Pedidos de acesso do dealer aguardando autorização (um aviso por pedido; no máximo 5) */}
      {pendingDealerRequests.length > 0 && (
        <div className="flex flex-col gap-2">
          {pendingDealerRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border border-accent-blue/30 bg-accent-blue-soft p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-card">
                  <UserCheck className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="font-bold">{request.name}</span> quer entrar como dealer
                  </p>
                  <p className="text-xs tabular-nums text-text-secondary">
                    Pediu às {formatTime(request.requestedAt)} · o pedido vale por 15 min
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  variant="success"
                  className="min-h-[44px] sm:min-w-[120px]"
                  loading={
                    decidingDealerId === request.id && decideDealerMutation.variables?.action === 'approve'
                  }
                  disabled={decidingDealerId === request.id}
                  onClick={() => decideDealerMutation.mutate({ action: 'approve', request })}
                >
                  Autorizar
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-[44px] sm:min-w-[120px]"
                  loading={
                    decidingDealerId === request.id && decideDealerMutation.variables?.action === 'reject'
                  }
                  disabled={decidingDealerId === request.id}
                  onClick={() => decideDealerMutation.mutate({ action: 'reject', request })}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Voltar: o home game do torneio, na aba Torneios */}
            <Link
              to={homeGameTabPath(tournament.homeGameId, 'torneios')}
              aria-label={`Voltar para ${tournament.homeGameName}`}
              title="Voltar para o home game"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">
                {tournament.name}
              </h1>
              <p className="text-sm text-text-secondary">
                {tournament.homeGameName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={statusColor}>{statusLabel}</Badge>
            {/* Formato knockout (SPEC-20261026-1909) */}
            {isKnockout(tournament) && (
              <Badge color="purple" className="gap-1 tabular-nums">
                <Crosshair className="h-3.5 w-3.5" aria-hidden />
                <span data-knockout-badge={knockoutTypeOf(tournament)}>
                  {KNOCKOUT_BADGES[knockoutTypeOf(tournament)]} · bounty {formatCurrency(tournament.bountyAmount ?? 0)}
                </span>
              </Badge>
            )}
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
        <div
          className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${canFinancial ? 'lg:grid-cols-6' : ''}`}
        >
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-secondary">Timer</p>
            <p className="text-xl font-mono font-bold text-text-primary tabular-nums">
              {formattedTime}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-secondary">Jogadores</p>
            <p className="text-xl font-bold text-text-primary tabular-nums">
              {activeEntries.length}/{tournament.totalEntries}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-secondary">Rebuys</p>
            <p className="text-xl font-bold text-text-primary tabular-nums">
              {tournament.totalRebuys}
            </p>
          </div>
          <div className="rounded-lg bg-bg-primary p-3">
            <p className="text-xs text-text-secondary">Add-ons</p>
            <p className="text-xl font-bold text-text-primary tabular-nums">
              {tournament.totalAddons}
            </p>
          </div>
          {canFinancial && (() => {
            // Total = soma de tudo que todos tem a pagar e receber (totalDue de todas as entries)
            const totalGeral = entries.reduce((sum, e) => sum + (e.totalDue ?? 0), 0)
            // Custos = soma do amount de todos os custos extras
            const totalCustos = costExtras.reduce((sum, c) => sum + (c.amount ?? 0), 0)
            // Premiação = total geral - custos - bounties (SPEC-20261026-1909: bounty fica à parte do prize pool)
            const bounties = isKnockout(tournament) ? (tournament.totalBounties ?? 0) : 0
            const premiacao = totalGeral - totalCustos - bounties
            return (
              <>
                <div className="rounded-lg bg-bg-primary p-3">
                  <p className="text-xs text-text-secondary">Premiação</p>
                  {/* Com custo fixo (custos padrão da estrutura, SPEC-20261023-1215) o líquido começa negativo:
                      em vermelho, nunca em verde (o telão mostra 0; aqui fica o valor real) */}
                  <p
                    className={`text-xl font-bold tabular-nums ${premiacao < 0 ? 'text-accent-red-deep' : 'text-accent-green-deep'}`}
                  >
                    {formatCurrency(premiacao)}
                  </p>
                  {isKnockout(tournament) && (
                    <p className="text-xs tabular-nums text-accent-purple-deep" data-header-bounties>
                      + {formatCurrency(bounties)} em bounties
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-bg-primary p-3">
                  <p className="text-xs text-text-secondary">Total</p>
                  <p className="text-xl font-bold text-accent-blue tabular-nums">
                    {formatCurrency(totalGeral)}
                  </p>
                </div>
              </>
            )
          })()}
        </div>

        {/* Botões "Telão" e "Dealer" (SPEC-20261027-2132; antes "TV Display" e "Terminal do dealer"): 44 px (toque à mesa)
            e, no celular, lado a lado em duas colunas iguais (mesma linha a 320 px); do sm para cima, como antes. O do dealer é a
            única porta para o terminal e para o QR que o dealer escaneia (DL4), então é secondary — com borda, cara de ação.
            O aria-label diz o que cada um faz. O "Telão" (antes "TV", SPEC-20261029-1721, D6) abre o telão no celular nesta
            mesma aba; a TV da casa entra só pelo QR em /tv (a rota /tv/:id continua existindo, sem link aqui). */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Link to={dealerMiniTvPath(tournament.id)}>
            <Button
              variant="gold"
              aria-label="Abrir o telão no celular"
              title="No celular ou numa tela ao lado; a TV da casa entra pelo QR em /tv"
              className="flex w-full px-2 sm:inline-flex sm:w-auto sm:px-4"
            >
              <Tv className="h-4 w-4" />
              Telão
            </Button>
          </Link>
          {/* Um botão só para o dealer (SPEC-20261023-1216, DL4): abre o QR para o dealer escanear
              (com "Abrir o terminal aqui" dentro); torneio encerrado abre o terminal direto; plano
              sem DealerQr fica com o cadeado. */}
          {!canDealerQr ? (
            <Button
              variant="secondary"
              onClick={() =>
                gate.openFeature('DealerQr', {
                  currentPlan: tournament.ownerPlan ?? null,
                  homeGameName: tournament.homeGameName,
                })
              }
              title="Recurso de plano pago"
              aria-label="Terminal do dealer (recurso de plano pago)"
              className="flex w-full px-2 sm:inline-flex sm:w-auto sm:px-4"
            >
              <Lock className="h-4 w-4 text-accent-gold-deep" />
              Dealer
            </Button>
          ) : tournamentOver ? (
            <Link to={dealerTerminalPath(tournament.id)} target="_blank">
              <Button variant="secondary" aria-label="Terminal do dealer" className="flex w-full px-2 sm:inline-flex sm:w-auto sm:px-4">
                <Tablet className="h-4 w-4" />
                Dealer
              </Button>
            </Link>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setDealerQrOpen(true)}
              aria-label={`Terminal do dealer${connectedDealers.length > 0 ? ` (${connectedDealers.length} ${connectedDealers.length === 1 ? 'conectado' : 'conectados'})` : ''}`}
              className="flex w-full px-2 sm:inline-flex sm:w-auto sm:px-4"
            >
              <Tablet className="h-4 w-4" />
              Dealer
              {/* No celular só o número (cabe na meia linha); do sm para cima, "N conectado(s)" como antes */}
              {connectedDealers.length > 0 && (
                <Badge color="green">
                  <span className="sm:hidden">{connectedDealers.length}</span>
                  <span className="hidden sm:inline">
                    {connectedDealers.length} {connectedDealers.length === 1 ? 'conectado' : 'conectados'}
                  </span>
                </Badge>
              )}
            </Button>
          )}
        </div>
        {canDealerQr && !tournamentOver && (
          <DealerQrModal
            isOpen={dealerQrOpen}
            onClose={() => setDealerQrOpen(false)}
            tournamentId={tournament.id}
            tournamentName={tournament.name}
          />
        )}
      </div>

      {/* Abas do topo só no computador (lg+): no celular a navegação é a barra de baixo (SPEC-20261027-2132) */}
      <div className="hidden overflow-x-auto border-b border-border-default -mx-4 px-4 lg:mx-0 lg:flex lg:px-0">
        {TOURNAMENT_TABS.map((tab) => {
          const locked = isTabLocked(tab, planFeatures)
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] ${
                activeTab === tab.key
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
              title={locked ? 'Recurso de plano pago' : undefined}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {locked && <PlanTabLock />}
            </button>
          )
        })}
      </div>

      {/* Tab Content (data-tab-content: começo da aba aberta — os prints do manual rolam até aqui no celular, e a troca de
          aba com a página rolada volta para cá: useTabScrollReset) */}
      <div ref={tabContentRef} className="rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-6" data-tab-content={activeTab}>
        {activeTabLocked && activeTabFeature ? (
          <PlanLock
            feature={activeTabFeature}
            currentPlan={tournament.ownerPlan ?? null}
            homeGameName={tournament.homeGameName}
            className="my-4"
          />
        ) : (
        <>
        {activeTab === 'jogadores' && (
          <EntriesTab tournament={tournament} entries={entries} />
        )}
        {activeTab === 'mesas' && <TablesTab tournament={tournament} />}
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
        </>
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
        // Cancelar o torneio: o botão que só fecha vira 'Voltar' (dois 'Cancelar' no mesmo diálogo confundiam)
        cancelLabel={statusConfirm?.status === 'Cancelled' ? 'Voltar' : 'Cancelar'}
        variant={
          statusConfirm?.status === 'Cancelled' ? 'danger' : 'warning'
        }
        loading={updateStatusMutation.isPending}
      />
    </div>
  )
}
