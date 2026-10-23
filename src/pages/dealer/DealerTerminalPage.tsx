import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Shuffle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as tablesApi from '../../api/tables.api'
import * as timerApi from '../../api/timer.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PaymentModal } from '../../components/tournament/PaymentModal'
import { AddonDialog } from '../../components/dealer/AddonDialog'
import { AddPlayerSheet } from '../../components/dealer/AddPlayerSheet'
import { BalanceDrawDialog } from '../../components/dealer/BalanceDrawDialog'
import { BreakTableDialog } from '../../components/dealer/BreakTableDialog'
import { DrawTablesDialog } from '../../components/dealer/DrawTablesDialog'
import { EliminateDialog } from '../../components/dealer/EliminateDialog'
import { HistorySheet } from '../../components/dealer/HistorySheet'
import { MoreMenu } from '../../components/dealer/MoreMenu'
import type { MoreScreen } from '../../components/dealer/MoreMenu'
import { MovePlayerDialog } from '../../components/dealer/MovePlayerDialog'
import { PlayerCard } from '../../components/dealer/PlayerCard'
import type { PlayerActionRules } from '../../components/dealer/PlayerCard'
import { PlayerSheet } from '../../components/dealer/PlayerSheet'
import { PlayersSheet } from '../../components/dealer/PlayersSheet'
import { TableAlerts } from '../../components/dealer/TableAlerts'
import { TablesSheet } from '../../components/dealer/TablesSheet'
import { TableSelectDialog } from '../../components/dealer/TableSelectDialog'
import { TerminalHeader } from '../../components/dealer/TerminalHeader'
import { useTerminalActions } from '../../components/dealer/useTerminalActions'
import {
  apiErrorMessage,
  formatCurrency,
  isActiveStatus,
  playerName,
  statusLabel,
  tableLabel,
} from '../../components/dealer/terminalFormat'
import { analyzeTables, countUnseated, pickRandomBalanceMove, seatedByTable } from '../../utils/tableBalance'
import type { BalanceMove } from '../../utils/tableBalance'
import type { TimerState } from '../../types/blind.types'
import type { TournamentEntry } from '../../types/entry.types'
import type { Table } from '../../api/tables.api'

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/**
 * O sorteio de equilíbrio ainda vale com os dados de agora: o jogador segue
 * ativo no mesmo lugar, o lugar de destino está livre e as mesas continuam
 * desequilibradas (2 ou mais de diferença entre origem e destino).
 */
function isBalanceMoveStillValid(move: BalanceMove, tables: Table[], entries: TournamentEntry[]): boolean {
  const player = entries.find((e) => e.id === move.entryId)
  if (!player || !isActiveStatus(player.status)) return false
  if (player.tableId !== move.fromTableId || player.seatNumber !== move.fromSeat) return false
  const toTable = tables.find((t) => t.id === move.toTableId)
  if (!toTable || !tables.some((t) => t.id === move.fromTableId) || move.toSeat > toTable.maxSeats) return false
  const seated = seatedByTable(tables, entries)
  const toPlayers = seated.get(move.toTableId) ?? []
  if (toPlayers.some((e) => e.seatNumber === move.toSeat)) return false
  const fromCount = seated.get(move.fromTableId)?.length ?? 0
  return fromCount - toPlayers.length >= 2
}

interface DealerTerminalPageProps {
  /** Aberto pelo QR do dealer (sem login, só este torneio); `dealerName` vai no selo "Dealer · Nome" */
  dealerMode?: { tournamentName: string; dealerName?: string; onExit: () => void }
}

/**
 * Terminal do dealer: a tela principal é a mesa (Rebuy, Add-on, Pagar, Eliminar);
 * o menos usado (adicionar jogador, jogadores, mesas, histórico) fica atrás do "Mais".
 * Mesma tela para o dealer por QR e para quem abre logado.
 */
export function DealerTerminalPage({ dealerMode }: DealerTerminalPageProps = {}) {
  const { tournamentId: routeTournamentId } = useParams<{ tournamentId: string }>()
  const tournamentId = routeTournamentId ?? ''
  const queryClient = useQueryClient()

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [tableSelectOpen, setTableSelectOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [screen, setScreen] = useState<MoreScreen | null>(null)
  const [fichaEntryId, setFichaEntryId] = useState<string | null>(null)
  const [showEliminated, setShowEliminated] = useState(false)
  const [rebuyEntry, setRebuyEntry] = useState<TournamentEntry | null>(null)
  const [addonEntry, setAddonEntry] = useState<TournamentEntry | null>(null)
  const [eliminateEntry, setEliminateEntry] = useState<TournamentEntry | null>(null)
  const [undoElimEntry, setUndoElimEntry] = useState<TournamentEntry | null>(null)
  const [moveEntry, setMoveEntry] = useState<TournamentEntry | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [breakOpen, setBreakOpen] = useState(false)
  const [balanceMove, setBalanceMove] = useState<BalanceMove | null>(null)

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.getAll(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  const { formattedTime, timerState, syncFromServer } = useBlindTimer()

  useQuery({
    queryKey: ['timer', tournamentId],
    queryFn: async () => {
      const state = await timerApi.getState(tournamentId)
      syncFromServer(state as TimerState)
      return state
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  })

  useWebSocket({
    tournamentId,
    enabled: !!tournamentId,
    onTimerUpdate: (state) => syncFromServer(state as TimerState),
  })

  // Eliminação desfeita: o sorteio de equilíbrio/quebra aberto foi feito com as mesas de antes
  const closeTableDialogs = useCallback(() => {
    setBalanceMove(null)
    setBreakOpen(false)
  }, [])

  const actions = useTerminalActions(tournamentId, tournament, { onEliminationUndone: closeTableDialogs })
  const { invalidateAll } = actions

  const allEntries = useMemo(() => entries ?? [], [entries])
  const allTables = useMemo(() => tables ?? [], [tables])

  // Mesa escolhida; se ela sumiu (sorteio de novo, mesa quebrada) cai na primeira
  const selectedTable =
    allTables.find((t) => t.id === selectedTableId) ?? allTables[0] ?? null

  const analysis = useMemo(() => analyzeTables(allTables, allEntries), [allTables, allEntries])

  const activeEntries = useMemo(() => allEntries.filter((e) => isActiveStatus(e.status)), [allEntries])

  const tableEntries = useMemo(() => {
    if (!selectedTable) return []
    return activeEntries
      .filter((e) => e.tableId === selectedTable.id)
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
  }, [activeEntries, selectedTable])

  // A inscrição não guarda a mesa de quem saiu: lista os eliminados do torneio, mais recentes primeiro
  const eliminatedEntries = useMemo(
    () =>
      allEntries
        .filter((e) => !isActiveStatus(e.status))
        .sort((a, b) => (b.eliminatedAt ?? '').localeCompare(a.eliminatedAt ?? '')),
    [allEntries],
  )

  const unseatedCount = useMemo(() => countUnseated(allTables, allEntries), [allTables, allEntries])

  const fichaEntry = allEntries.find((e) => e.id === fichaEntryId) ?? null

  function rulesFor(entry: TournamentEntry): PlayerActionRules {
    const maxRebuys = tournament?.maxRebuys ?? 0
    return {
      canRebuy: !(maxRebuys > 0 && entry.rebuyCount >= maxRebuys),
      canAddon: !entry.addonPurchased && (tournament?.addonAllowed ?? false),
    }
  }

  function tablematesOf(entry: TournamentEntry): TournamentEntry[] {
    return activeEntries
      .filter((e) => e.id !== entry.id && !!entry.tableId && e.tableId === entry.tableId)
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
  }

  function openScreen(next: MoreScreen) {
    setMoreOpen(false)
    setTableSelectOpen(false)
    setScreen(next)
  }

  // ── Timer ────────────────────────────────────────────────────────────
  const pauseMutation = useMutation({
    mutationFn: () => timerApi.pause(tournamentId),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Relógio pausado')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao pausar o relógio.')),
  })

  const resumeMutation = useMutation({
    mutationFn: () => timerApi.resume(tournamentId),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Relógio retomado')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao retomar o relógio.')),
  })

  const nextMutation = useMutation({
    mutationFn: () => timerApi.nextLevel(tournamentId),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Próximo nível')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao avançar o nível.')),
  })

  const prevMutation = useMutation({
    mutationFn: () => timerApi.previousLevel(tournamentId),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Nível anterior')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao voltar o nível.')),
  })

  // ── Mesas: equilíbrio depois de eliminar ─────────────────────────────
  /** Inscrições e mesas buscadas agora no servidor (sem cache) */
  async function fetchFreshTables() {
    const [freshEntries, freshTables] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['entries', tournamentId],
        queryFn: () => entriesApi.getAll(tournamentId),
        staleTime: 0,
      }),
      queryClient.fetchQuery({
        queryKey: ['tables', tournamentId],
        queryFn: () => tablesApi.getAll(tournamentId),
        staleTime: 0,
      }),
    ])
    return { freshEntries, freshTables }
  }

  /** Com os dados novos: se der para quebrar uma mesa abre o "Quebrar"; senão, se desequilibrou, sorteia quem muda */
  async function evaluateTablesAfterElimination() {
    try {
      const { freshEntries, freshTables } = await fetchFreshTables()
      const fresh = analyzeTables(freshTables, freshEntries)
      if (fresh.breakable) setBreakOpen(true)
      else if (fresh.imbalance) setBalanceMove(pickRandomBalanceMove(fresh, freshTables, freshEntries))
    } catch {
      // Sem os dados novos, os avisos do topo aparecem na próxima consulta
    }
  }

  function drawBalanceMove(excludeEntryId?: string) {
    const move = pickRandomBalanceMove(analysis, allTables, allEntries, excludeEntryId)
    if (!move) {
      toast.info('As mesas já estão equilibradas.')
      setBalanceMove(null)
      return
    }
    setBalanceMove(move)
  }

  /** Sorteia de novo com os dados novos; se não há mais desequilíbrio, fecha avisando */
  function redrawBalanceMove(freshTables: Table[], freshEntries: TournamentEntry[], notice?: string) {
    const move = pickRandomBalanceMove(analyzeTables(freshTables, freshEntries), freshTables, freshEntries)
    if (!move) {
      toast.info('As mesas já estão equilibradas.')
      setBalanceMove(null)
      return
    }
    if (notice) toast.info(notice)
    setBalanceMove(move)
  }

  const balanceMutation = useMutation({
    mutationFn: async (move: BalanceMove) => {
      // O sorteio pode ter ficado velho (eliminação desfeita, outro aparelho mexeu): confere antes
      const { freshEntries, freshTables } = await fetchFreshTables()
      if (!isBalanceMoveStillValid(move, freshTables, freshEntries)) {
        return { moved: false as const, freshEntries, freshTables }
      }
      await tablesApi.movePlayer(tournamentId, {
        entryId: move.entryId,
        toTableId: move.toTableId,
        toSeat: move.toSeat,
        reason: 'balance',
      })
      return { moved: true as const }
    },
    onSuccess: (outcome, move) => {
      if (!outcome.moved) {
        redrawBalanceMove(outcome.freshTables, outcome.freshEntries, 'As mesas mudaram. Sorteamos de novo: confira antes de confirmar.')
        return
      }
      const dest = allTables.find((t) => t.id === move.toTableId)
      toast.success(`${move.playerName} foi para ${dest ? tableLabel(dest) : 'a mesa'}, lugar ${move.toSeat}`)
      setBalanceMove(null)
      invalidateAll()
    },
    onError: async (err) => {
      toast.error(apiErrorMessage(err, 'Erro ao mudar o jogador de mesa.'))
      // 400 = o servidor recusou este sorteio (ex.: lugar de destino já ocupado): sorteia de novo
      if (httpStatus(err) !== 400) return
      try {
        const { freshEntries, freshTables } = await fetchFreshTables()
        redrawBalanceMove(freshTables, freshEntries, 'Sorteamos de novo: confira antes de confirmar.')
      } catch {
        setBalanceMove(null)
      }
    },
  })

  // ── Render ───────────────────────────────────────────────────────────
  const tournamentName = tournament?.name ?? dealerMode?.tournamentName ?? 'Torneio'
  const noPlayers = !entriesLoading && allEntries.length === 0
  const noTables = allTables.length === 0

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <TerminalHeader
        tournamentName={tournamentName}
        dealerMode={dealerMode ? { onExit: dealerMode.onExit, dealerName: dealerMode.dealerName } : undefined}
        tableName={selectedTable ? tableLabel(selectedTable) : noTables ? 'Sem mesas' : null}
        onSelectTable={() => setTableSelectOpen(true)}
        formattedTime={formattedTime}
        timerState={timerState}
        onPrevLevel={() => prevMutation.mutate()}
        onNextLevel={() => nextMutation.mutate()}
        onTogglePause={() => (timerState.isRunning ? pauseMutation.mutate() : resumeMutation.mutate())}
        prevLoading={prevMutation.isPending}
        nextLoading={nextMutation.isPending}
        toggleLoading={pauseMutation.isPending || resumeMutation.isPending}
        onOpenMore={() => setMoreOpen(true)}
      />

      <TableAlerts
        analysis={analysis}
        tables={allTables}
        unseatedCount={unseatedCount}
        onBreakTable={() => setBreakOpen(true)}
        onDrawBalance={() => drawBalanceMove()}
        onOpenTables={() => openScreen('tables')}
      />

      <main className="flex-1 px-3 py-3 pb-10">
        {entriesLoading ? (
          <LoadingSpinner size="md" text="Carregando jogadores..." className="py-12" />
        ) : noPlayers ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-text-secondary">Ainda não há jogadores no torneio.</p>
            <Button size="lg" className="w-full max-w-xs" onClick={() => openScreen('addPlayer')}>
              <UserPlus className="h-5 w-5" /> Adicionar jogador
            </Button>
          </div>
        ) : noTables ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-text-secondary">
              {activeEntries.length} {activeEntries.length === 1 ? 'jogador' : 'jogadores'} e nenhuma mesa sorteada.
            </p>
            <Button size="lg" className="w-full max-w-xs" onClick={() => setDrawOpen(true)}>
              <Shuffle className="h-5 w-5" /> Sortear mesas
            </Button>
            <Button variant="secondary" className="w-full max-w-xs" onClick={() => openScreen('addPlayer')}>
              <UserPlus className="h-4 w-4" /> Adicionar jogador
            </Button>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Jogando nesta mesa ({tableEntries.length})
            </h2>
            {tableEntries.length === 0 ? (
              <p className="py-8 text-center text-text-secondary">Nenhum jogador nesta mesa.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tableEntries.map((entry) => (
                  <PlayerCard
                    key={entry.id}
                    entry={entry}
                    rules={rulesFor(entry)}
                    onOpen={() => setFichaEntryId(entry.id)}
                    onRebuy={() => setRebuyEntry(entry)}
                    onAddon={() => setAddonEntry(entry)}
                    onPay={() => actions.openPayment(entry)}
                    onEliminate={() => setEliminateEntry(entry)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {eliminatedEntries.length > 0 && (
          <section className="mt-5">
            <button
              type="button"
              onClick={() => setShowEliminated((v) => !v)}
              className="flex min-h-[44px] w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              {showEliminated ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Eliminados ({eliminatedEntries.length})
            </button>
            {showEliminated && (
              <div className="flex flex-col gap-1.5">
                {/* Eliminados: fundo zebra e nome em text-secondary, sem opacidade (que derrubava o texto abaixo de AA) */}
                {eliminatedEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setFichaEntryId(entry.id)}
                    className="flex min-h-[48px] items-center gap-2 rounded-lg border border-border-default bg-bg-zebra p-2 text-left"
                  >
                    <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{playerName(entry)}</span>
                    <span className="text-xs text-text-secondary">{statusLabel(entry)}</span>
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Topo: seletor de mesa e "Mais" ── */}
      <TableSelectDialog
        isOpen={tableSelectOpen}
        onClose={() => setTableSelectOpen(false)}
        tables={allTables}
        entries={allEntries}
        selectedTableId={selectedTable?.id ?? null}
        onSelect={(id) => {
          setSelectedTableId(id)
          setTableSelectOpen(false)
        }}
        onOpenTables={() => openScreen('tables')}
      />

      <MoreMenu isOpen={moreOpen} onClose={() => setMoreOpen(false)} onSelect={openScreen} />

      {/* ── Telas do "Mais" ── */}
      <AddPlayerSheet
        isOpen={screen === 'addPlayer'}
        onClose={() => setScreen(null)}
        tournamentId={tournamentId}
        tournament={tournament}
        onAdded={(result) => {
          invalidateAll()
          // Inscrição nova: qualquer BuyIn dela no histórico é o desta ação
          void actions.showUndoToast(
            `${playerName(result.entry)} entrou no torneio`,
            result.entry.id,
            ['BuyIn'],
            new Set(),
          )
        }}
        onPay={(entry) => actions.openPayment(entry)}
      />

      <PlayersSheet
        isOpen={screen === 'players'}
        onClose={() => setScreen(null)}
        entries={allEntries}
        tables={allTables}
        onOpenPlayer={(entry) => setFichaEntryId(entry.id)}
        onAddPlayer={() => setScreen('addPlayer')}
      />

      <TablesSheet
        isOpen={screen === 'tables'}
        onClose={() => setScreen(null)}
        tables={allTables}
        entries={allEntries}
        canBreak={!!analysis.breakable}
        onMovePlayer={(entry) => setMoveEntry(entry)}
        onDraw={() => setDrawOpen(true)}
        onBreak={() => setBreakOpen(true)}
      />

      <HistorySheet
        isOpen={screen === 'history'}
        onClose={() => setScreen(null)}
        tournamentId={tournamentId}
        onUndo={actions.undoItem}
      />

      {/* ── Ficha do jogador ── */}
      <PlayerSheet
        entry={fichaEntry}
        tables={allTables}
        tournamentId={tournamentId}
        rules={fichaEntry ? rulesFor(fichaEntry) : { canRebuy: false, canAddon: false }}
        onClose={() => setFichaEntryId(null)}
        onRebuy={() => fichaEntry && setRebuyEntry(fichaEntry)}
        onAddon={() => fichaEntry && setAddonEntry(fichaEntry)}
        onPay={() => fichaEntry && actions.openPayment(fichaEntry)}
        onEliminate={() => fichaEntry && setEliminateEntry(fichaEntry)}
        onMove={() => {
          if (!fichaEntry) return
          if (noTables) toast.info('Sorteie as mesas antes de mover jogadores.')
          else setMoveEntry(fichaEntry)
        }}
        onUndoElimination={() => fichaEntry && setUndoElimEntry(fichaEntry)}
        onUndo={actions.undoItem}
      />

      {/* ── Ações do jogador ── */}
      <ConfirmDialog
        isOpen={!!rebuyEntry}
        onClose={() => setRebuyEntry(null)}
        onConfirm={() =>
          rebuyEntry &&
          actions.rebuyMutation.mutate(rebuyEntry, { onSettled: () => setRebuyEntry(null) })
        }
        title="Rebuy"
        message={
          rebuyEntry
            ? `Rebuy para ${playerName(rebuyEntry)}: ${formatCurrency(tournament?.rebuyAmount ?? 0)}?`
            : ''
        }
        confirmLabel="Confirmar rebuy"
        variant="warning"
        loading={actions.rebuyMutation.isPending}
      />

      <AddonDialog
        entry={addonEntry}
        tournament={tournament}
        loading={actions.addonMutation.isPending}
        onClose={() => setAddonEntry(null)}
        onConfirm={(isDouble) =>
          addonEntry &&
          actions.addonMutation.mutate(
            { entry: addonEntry, isDouble },
            { onSettled: () => setAddonEntry(null) },
          )
        }
      />

      {eliminateEntry && (
        <EliminateDialog
          entry={eliminateEntry}
          tablemates={tablematesOf(eliminateEntry)}
          loading={actions.eliminateMutation.isPending}
          onClose={() => setEliminateEntry(null)}
          onConfirm={(eliminatedByEntryId) =>
            actions.eliminateMutation.mutate(
              { entry: eliminateEntry, eliminatedByEntryId },
              {
                onSuccess: () => {
                  setEliminateEntry(null)
                  void evaluateTablesAfterElimination()
                },
              },
            )
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!undoElimEntry}
        onClose={() => setUndoElimEntry(null)}
        onConfirm={() =>
          undoElimEntry &&
          actions.undoEliminationMutation.mutate(undoElimEntry, { onSettled: () => setUndoElimEntry(null) })
        }
        title="Desfazer eliminação"
        message={undoElimEntry ? `Desfazer a eliminação de ${playerName(undoElimEntry)}? Ele volta a jogar.` : ''}
        confirmLabel="Desfazer"
        variant="warning"
        loading={actions.undoEliminationMutation.isPending}
      />

      <PaymentModal
        isOpen={!!actions.paymentEntry}
        onClose={actions.closePayment}
        entry={actions.paymentEntry}
        tournamentId={tournamentId}
      />

      {/* ── Mesas ── */}
      {moveEntry && (
        <MovePlayerDialog
          tournamentId={tournamentId}
          entry={moveEntry}
          tables={allTables}
          entries={allEntries}
          onClose={() => setMoveEntry(null)}
          onMoved={invalidateAll}
        />
      )}

      {drawOpen && (
        <DrawTablesDialog
          tournamentId={tournamentId}
          hasTables={!noTables}
          activePlayers={activeEntries.length}
          defaultSeats={tournament?.seatsPerTable && tournament.seatsPerTable > 1 ? tournament.seatsPerTable : 9}
          onClose={() => setDrawOpen(false)}
          onDrawn={() => {
            invalidateAll()
            setSelectedTableId(null)
            // Mostra os lugares sorteados para o dealer anunciar
            setScreen('tables')
          }}
        />
      )}

      {breakOpen && (
        <BreakTableDialog
          tournamentId={tournamentId}
          tables={allTables}
          entries={allEntries}
          suggestedTableId={analysis.breakable?.suggestedTableId ?? null}
          onClose={() => setBreakOpen(false)}
          onBroken={() => invalidateAll()}
        />
      )}

      {balanceMove && (
        <BalanceDrawDialog
          move={balanceMove}
          tables={allTables}
          loading={balanceMutation.isPending}
          onConfirm={() => balanceMutation.mutate(balanceMove)}
          onReroll={() => drawBalanceMove(balanceMove.entryId)}
          onChooseMyself={() => {
            setBalanceMove(null)
            openScreen('tables')
          }}
          onClose={() => setBalanceMove(null)}
        />
      )}
    </div>
  )
}
