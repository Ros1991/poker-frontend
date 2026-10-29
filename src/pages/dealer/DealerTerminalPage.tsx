import { useMemo, useState } from 'react'
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
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { AddPlayerSheet } from '../../components/dealer/AddPlayerSheet'
import { DrawTablesDialog } from '../../components/dealer/DrawTablesDialog'
import { EliminatedPlayerRow } from '../../components/dealer/EliminatedPlayerRow'
import { HistorySheet } from '../../components/dealer/HistorySheet'
import { MoreMenu } from '../../components/dealer/MoreMenu'
import type { MoreScreen } from '../../components/dealer/MoreMenu'
import { MovePlayerDialog } from '../../components/dealer/MovePlayerDialog'
import { usePlayerActionDialogs } from '../../components/dealer/PlayerActionDialogs'
import { PlayerCard } from '../../components/dealer/PlayerCard'
import { PlayerSheet } from '../../components/dealer/PlayerSheet'
import { PlayersSheet } from '../../components/dealer/PlayersSheet'
import { TableAlerts } from '../../components/dealer/TableAlerts'
import { TablesSheet } from '../../components/dealer/TablesSheet'
import { TableSelectDialog } from '../../components/dealer/TableSelectDialog'
import { TerminalHeader } from '../../components/dealer/TerminalHeader'
import { useTableSuggestions } from '../../components/dealer/useTableSuggestions'
import { useTimebank } from '../../components/dealer/useTimebank'
import { useRememberedTable } from '../../components/dealer/useRememberedTable'
import { terminalFeatures, useTerminalActions } from '../../components/dealer/useTerminalActions'
import {
  apiErrorMessage,
  isActiveStatus,
  playerActionRules,
  playerName,
  tableLabel,
} from '../../components/dealer/terminalFormat'
import { countUnseated } from '../../utils/tableBalance'
import { isKnockout, knockoutTypeOf } from '../../utils/knockout'
import type { TimerState } from '../../types/blind.types'
import type { TournamentEntry } from '../../types/entry.types'

interface DealerTerminalPageProps {
  /** Aberto pelo QR do dealer (sem login, só este torneio); `dealerName` vai no selo "Dealer · Nome" */
  dealerMode?: { tournamentName: string; dealerName?: string; onExit: () => void }
}

/**
 * Terminal do dealer: a tela principal é a mesa (Rebuy, Add-on, Pagar, Eliminar);
 * o menos usado (adicionar jogador, jogadores, mesas, histórico) fica atrás do "Mais".
 * Mesma tela para o dealer por QR e para quem abre logado.
 *
 * Plano do dono (SPEC-20261023-1205, `tournament.planFeatures`): sem Payments somem Pagar,
 * PaymentModal, abatimento e sugestões de PIX; sem Tables não há mesas — a tela principal lista
 * todos que estão jogando, e somem "Mesas" do "Mais", o seletor de mesa e os avisos de
 * desequilíbrio. Rebuy, add-on, eliminar, desfazer, histórico e relógio ficam iguais.
 */
export function DealerTerminalPage({ dealerMode }: DealerTerminalPageProps = {}) {
  const { tournamentId: routeTournamentId } = useParams<{ tournamentId: string }>()
  const tournamentId = routeTournamentId ?? ''
  const queryClient = useQueryClient()

  // Lembrada por torneio nesta aba: a volta do telão no celular (SPEC-20261029-1721) cai na mesma mesa
  const [selectedTableId, setSelectedTableId] = useRememberedTable(tournamentId)
  const [tableSelectOpen, setTableSelectOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [screen, setScreen] = useState<MoreScreen | null>(null)
  const [fichaEntryId, setFichaEntryId] = useState<string | null>(null)
  const [showEliminated, setShowEliminated] = useState(false)
  const [moveEntry, setMoveEntry] = useState<TournamentEntry | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  // O que o plano do dono libera (só decide com o torneio carregado; sem a feature, 402)
  const { payments: canPay, tables: canTables } = terminalFeatures(tournament)

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.getAll(tournamentId),
    enabled: !!tournamentId && canTables,
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

  const allEntries = useMemo(() => entries ?? [], [entries])
  const allTables = useMemo(() => tables ?? [], [tables])

  // Mesa escolhida; se ela sumiu (sorteio de novo, mesa quebrada ou excluída) cai na primeira
  const selectedTable =
    allTables.find((t) => t.id === selectedTableId) ?? allTables[0] ?? null

  // Mudança de mesa em outro aparelho (TablesUpdate): o useWebSocket já recarrega mesas e inscrições. A mesa em que este
  // terminal estava foi excluída no painel (SPEC-20261027-2133): ele cai em outra como na quebra e avisa o dealer.
  useWebSocket({
    tournamentId,
    enabled: !!tournamentId,
    onTimerUpdate: (state) => syncFromServer(state as TimerState),
    // Timebank usado/ajustado/desfeito em outro aparelho (SPEC-20261029-1722): o chip "⏱ N" e o histórico na hora
    onEntryUpdate: () => {
      void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
    },
    onTablesUpdate: (event) => {
      if (event.action !== 'deleted' || !selectedTable || event.tableId !== selectedTable.id) return
      const name = event.tableName ?? tableLabel(selectedTable)
      setSelectedTableId(null)
      toast.info(`A ${name} foi excluída. Toque no nome da mesa, no topo, para escolher a sua.`)
    },
  })

  // Quebra/equilíbrio das mesas depois de eliminar (compartilhado com o painel — SPEC-20261026-1908); "Escolher eu
  // mesmo" abre a tela Mesas. Eliminação desfeita fecha o sorteio aberto (feito com as mesas de antes).
  const suggestions = useTableSuggestions({
    tournamentId,
    tournament,
    tables: allTables,
    entries: allEntries,
    onChooseMyself: () => openScreen('tables'),
  })
  const { analysis } = suggestions

  const actions = useTerminalActions(tournamentId, tournament, { onEliminationUndone: suggestions.close })
  const { invalidateAll } = actions

  // Timebank virtual (SPEC-20261029-1722): só com o timebank ligado no torneio — o chip "⏱ N" no card, na Ficha e na
  // lista "Jogadores", a sheet (Usar, +1, −1) e a contagem em tela cheia neste celular. Sem timebank, nada aparece.
  const timebank = useTimebank({ tournamentId, tournament, entries: allEntries, invalidateAll, allowUse: true })
  const timebankFor = (entry: TournamentEntry) => (timebank.enabled ? { onOpen: () => timebank.open(entry) } : undefined)

  const activeEntries = useMemo(() => allEntries.filter((e) => isActiveStatus(e.status)), [allEntries])

  // Sem controle de mesas no plano: todos que estão jogando, por nome
  const playingEntries = useMemo(
    () => [...activeEntries].sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR')),
    [activeEntries],
  )

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

  // Regras dos botões compartilhadas com a aba Jogadores do painel (SPEC-20261023-1217)
  const rulesFor = (entry: TournamentEntry) => playerActionRules(tournament, entry)

  function tablematesOf(entry: TournamentEntry): TournamentEntry[] {
    return activeEntries
      .filter((e) => e.id !== entry.id && !!entry.tableId && e.tableId === entry.tableId)
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
  }

  // Knockout (SPEC-20261026-1909): sem "Pular" — quem eliminou pode ser de outra mesa (ou, sem mesa, qualquer um)
  const knockout = isKnockout(tournament) ? knockoutTypeOf(tournament) : 'None'
  function othersOf(entry: TournamentEntry): TournamentEntry[] {
    return activeEntries
      .filter((e) => e.id !== entry.id)
      .sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR'))
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

  // Diálogos de ação (rebuy, add-on, eliminar, desfazer eliminação, pagar) compartilhados com o painel
  // (SPEC-20261023-1217, L14); depois de eliminar, a quebra/equilíbrio das mesas como sempre
  const flows = usePlayerActionDialogs({
    tournamentId,
    tournament,
    actions,
    showPayment: canPay,
    candidatesFor: tablematesOf,
    othersFor: othersOf,
    onEliminated: () => void suggestions.evaluateAfterElimination(),
  })

  // ── Render ───────────────────────────────────────────────────────────
  const tournamentName = tournament?.name ?? dealerMode?.tournamentName ?? 'Torneio'
  const noPlayers = !entriesLoading && allEntries.length === 0
  const noTables = allTables.length === 0
  // Até o torneio chegar não dá para saber se há mesas no plano: espera junto das inscrições
  const loadingMain = entriesLoading || (!tournament && tournamentLoading)
  const playingLabel = `${activeEntries.length} jogando`

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <TerminalHeader
        tournamentName={tournamentName}
        dealerMode={dealerMode ? { onExit: dealerMode.onExit, dealerName: dealerMode.dealerName } : undefined}
        tableName={
          // Sem o torneio ainda não se sabe se há mesas no plano: o topo espera em branco
          !tournament
            ? null
            : !canTables
              ? playingLabel
              : selectedTable
                ? tableLabel(selectedTable)
                : noTables
                  ? 'Sem mesas'
                  : null
        }
        onSelectTable={canTables ? () => setTableSelectOpen(true) : undefined}
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

      {canTables && (
        <TableAlerts
          analysis={analysis}
          tables={allTables}
          unseatedCount={unseatedCount}
          onBreakTable={suggestions.openBreak}
          onDrawBalance={() => suggestions.drawBalance()}
          onOpenTables={() => openScreen('tables')}
        />
      )}

      <main className="flex-1 px-3 py-3 pb-10">
        {loadingMain ? (
          <LoadingSpinner size="md" text="Carregando jogadores..." className="py-12" />
        ) : noPlayers ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-text-secondary">Ainda não há jogadores no torneio.</p>
            <Button size="lg" className="w-full max-w-xs" onClick={() => openScreen('addPlayer')}>
              <UserPlus className="h-5 w-5" /> Adicionar jogador
            </Button>
          </div>
        ) : !canTables ? (
          <>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Jogando ({playingEntries.length})
            </h2>
            {playingEntries.length === 0 ? (
              <p className="py-8 text-center text-text-secondary">Ninguém jogando agora.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {playingEntries.map((entry) => (
                  <PlayerCard
                    key={entry.id}
                    entry={entry}
                    rules={rulesFor(entry)}
                    onOpen={() => setFichaEntryId(entry.id)}
                    onRebuy={() => flows.askRebuy(entry)}
                    onAddon={() => flows.askAddon(entry)}
                    onPay={() => flows.openPayment(entry)}
                    onEliminate={() => flows.askEliminate(entry)}
                    showPayment={canPay}
                    showSeat={false}
                    knockout={knockout}
                    timebank={timebankFor(entry)}
                  />
                ))}
              </div>
            )}
          </>
        ) : noTables ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            {/* As mesas nascem com as inscrições (SPEC-20261023-1214): aqui só cai torneio antigo com inscritos sem mesa */}
            <p className="text-text-secondary">
              {activeEntries.length === 1 ? '1 jogador sem mesa.' : `${activeEntries.length} jogadores sem mesa.`} Quem entrar daqui
              para frente já senta sozinho.
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {tableEntries.map((entry) => (
                  <PlayerCard
                    key={entry.id}
                    entry={entry}
                    rules={rulesFor(entry)}
                    onOpen={() => setFichaEntryId(entry.id)}
                    onRebuy={() => flows.askRebuy(entry)}
                    onAddon={() => flows.askAddon(entry)}
                    onPay={() => flows.openPayment(entry)}
                    onEliminate={() => flows.askEliminate(entry)}
                    showPayment={canPay}
                    knockout={knockout}
                    timebank={timebankFor(entry)}
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
                  <EliminatedPlayerRow key={entry.id} entry={entry} onOpen={() => setFichaEntryId(entry.id)} knockout={knockout} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Topo: seletor de mesa e "Mais" ── */}
      {canTables && (
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
      )}

      <MoreMenu
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSelect={openScreen}
        showTables={canTables}
        showPayments={canPay}
      />

      {/* ── Telas do "Mais" ── */}
      <AddPlayerSheet
        isOpen={screen === 'addPlayer'}
        onClose={() => setScreen(null)}
        tournamentId={tournamentId}
        entries={entries}
        tables={allTables}
        // Adicionou ou desfez pelo resumo (SPEC-20261023-1213, F14): o resumo tem o "Desfazer" de cada um
        onChanged={invalidateAll}
        showTables={canTables}
        // Dealer pelo QR não informa e-mail (o e-mail liga o jogador à conta — SPEC-20261029-1725)
        allowEmail={!dealerMode}
      />

      <PlayersSheet
        isOpen={screen === 'players'}
        onClose={() => setScreen(null)}
        entries={allEntries}
        tables={allTables}
        onOpenPlayer={(entry) => setFichaEntryId(entry.id)}
        onAddPlayer={() => setScreen('addPlayer')}
        knockout={knockout}
        showPayments={canPay}
        showTables={canTables}
        timebank={timebank.enabled ? { onOpen: timebank.open } : undefined}
      />

      {canTables && (
        <TablesSheet
          isOpen={screen === 'tables'}
          onClose={() => setScreen(null)}
          tournamentId={tournamentId}
          tables={allTables}
          entries={allEntries}
          canBreak={!!analysis.breakable}
          onMovePlayer={(entry) => setMoveEntry(entry)}
          onDraw={() => setDrawOpen(true)}
          onBreak={suggestions.openBreak}
        />
      )}

      <HistorySheet
        isOpen={screen === 'history'}
        onClose={() => setScreen(null)}
        tournamentId={tournamentId}
        onUndo={actions.undoItem}
        paymentsLocked={!!tournament && !canPay}
        entries={allEntries}
      />

      {/* ── Ficha do jogador ── */}
      <PlayerSheet
        entry={fichaEntry}
        entries={allEntries}
        tables={allTables}
        tournamentId={tournamentId}
        tournament={tournament}
        rules={fichaEntry ? rulesFor(fichaEntry) : { canRebuy: false, canAddon: false }}
        onClose={() => setFichaEntryId(null)}
        onRebuy={() => fichaEntry && flows.askRebuy(fichaEntry)}
        onAddon={() => fichaEntry && flows.askAddon(fichaEntry)}
        onPay={() => fichaEntry && flows.openPayment(fichaEntry)}
        onEliminate={() => fichaEntry && flows.askEliminate(fichaEntry)}
        onMove={() => {
          if (!fichaEntry) return
          if (noTables) toast.info('Sorteie as mesas antes de mover jogadores.')
          else setMoveEntry(fichaEntry)
        }}
        onUndoElimination={() => fichaEntry && flows.askUndoElimination(fichaEntry)}
        onUndo={actions.undoItem}
        showPayments={canPay}
        showTables={canTables}
        timebank={fichaEntry ? timebankFor(fichaEntry) : undefined}
      />

      {/* ── Ações do jogador (diálogos compartilhados com o painel) ── */}
      {flows.dialogs}

      {/* ── Timebank: sheet e contagem em tela cheia (só com o timebank ligado) ── */}
      {timebank.dialogs}

      {/* ── Mesas (só com controle de mesas no plano) ── */}
      {canTables && moveEntry && (
        <MovePlayerDialog
          tournamentId={tournamentId}
          entry={moveEntry}
          tables={allTables}
          entries={allEntries}
          onClose={() => setMoveEntry(null)}
          onMoved={invalidateAll}
        />
      )}

      {canTables && drawOpen && (
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

      {/* Quebrar mesa e "Quem muda de mesa" (só com controle de mesas no plano) */}
      {suggestions.dialogs}
    </div>
  )
}
