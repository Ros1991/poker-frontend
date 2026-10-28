import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlarmClock, History, Pencil, Phone, Trash2, UserPlus, Users } from 'lucide-react'
import * as entriesApi from '../../../api/entries.api'
import * as personsApi from '../../../api/persons.api'
import * as tablesApi from '../../../api/tables.api'
import * as tournamentsApi from '../../../api/tournaments.api'
import { hasFeature } from '../../../hooks/usePlan'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { SearchInput } from '../../../components/ui/SearchInput'
import { AddPlayerModal } from '../../../components/tournament/AddPlayerModal'
import { PlayerFormDialog } from '../../../components/players/PlayerFormDialog'
import { DrawTablesDialog } from '../../../components/dealer/DrawTablesDialog'
import { EliminatedPlayerRow } from '../../../components/dealer/EliminatedPlayerRow'
import { HistoryList } from '../../../components/dealer/HistoryList'
import { MovePlayerDialog } from '../../../components/dealer/MovePlayerDialog'
import { usePlayerActionDialogs } from '../../../components/dealer/PlayerActionDialogs'
import { PlayerCard } from '../../../components/dealer/PlayerCard'
import { PlayerDetails } from '../../../components/dealer/PlayerDetails'
import { PlayerConfirmHeader } from '../../../components/dealer/PlayerConfirmHeader'
import { TableAlerts } from '../../../components/dealer/TableAlerts'
import { TablesOverview } from '../../../components/dealer/TablesSheet'
import { useTableSuggestions } from '../../../components/dealer/useTableSuggestions'
import { useTerminalActions } from '../../../components/dealer/useTerminalActions'
import {
  amountDue,
  apiErrorMessage,
  formatCurrency,
  groupActiveByTable,
  isActiveStatus,
  matchesPlayerSearch,
  playerActionRules,
  playerName,
} from '../../../components/dealer/terminalFormat'
import { cn } from '../../../utils/cn'
import { isKnockout, knockoutTypeOf } from '../../../utils/knockout'
import { countUnseated } from '../../../utils/tableBalance'
import type { TournamentEntry } from '../../../types/entry.types'
import type { Person } from '../../../types/person.types'
import type { Tournament } from '../../../types/tournament.types'

interface EntriesTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

type View = 'players' | 'history'
type Filter = 'all' | 'playing' | 'eliminated' | 'owing'

/** Intervalo do terminal: o painel vê o que o dealer faz (L12) */
const LIVE_REFETCH_MS = 8000

// Cards e linhas numa grade que se ajusta à largura que a sidebar deixa (L7): 1 coluna no celular, 2 no tablet,
// 3 em tela larga; o `min(…, 100%)` impede rolagem horizontal quando a área é menor que 20rem
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-2'

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">{children}</h3>
}

/**
 * Aba Jogadores do painel do torneio (SPEC-20261023-1217): montada com as mesmas peças do terminal do dealer —
 * PlayerCard, a Ficha (PlayerDetails), HistoryList com "Desfazer" amarrado ao item exato e o useTerminalActions com o
 * toast "Desfazer" — mais o que só o organizador tem (editar jogador, WhatsApp, excluir inscrição, filtros por
 * estado, busca, bônus de pontualidade, grade de 2–3 colunas no computador). Tudo que se desfaz passa pelo histórico.
 *
 * Plano do dono (SPEC-20261023-1205, `tournament.planFeatures`): sem Payments não há Pagar, "Deve/Pago", filtro
 * Devendo nem PaymentModal, e os pagamentos do histórico ficam sem "Desfazer"; sem Tables não há agrupamento por mesa,
 * lugar, "Mover" nem consulta a GET tables (402 abriria o modal de upgrade sozinho).
 *
 * Mesas como no terminal (SPEC-20261026-1908): depois de eliminar, as mesmas sugestões (`useTableSuggestions`:
 * "Quebrar mesa" — com o "Agora é mesa final!" no resultado — ou "Quem muda de mesa"), os mesmos avisos do topo
 * (`TableAlerts`) e, no "Escolher eu mesmo", as mesas com os lugares numa modal (`TablesOverview`, tocar no jogador
 * abre o "Mover").
 */
export function EntriesTab({ tournament, entries }: EntriesTabProps) {
  const queryClient = useQueryClient()
  const tid = tournament.id
  const canPay = hasFeature(tournament.planFeatures, 'Payments')
  const canTables = hasFeature(tournament.planFeatures, 'Tables')
  const live = tournament.status !== 'Finished' && tournament.status !== 'Cancelled'
  // Knockout (SPEC-20261026-1909): bounties nos cards/linhas/Ficha e eliminação sem "Pular"
  const knockout = isKnockout(tournament) ? knockoutTypeOf(tournament) : 'None'
  const gameActionsLocked = !!tournament.settlementClosed
  const isInProgress =
    tournament.status === 'Draft' || tournament.status === 'OpenForRegistration' || tournament.status === 'InProgress'

  const [view, setView] = useState<View>('players')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [fichaEntryId, setFichaEntryId] = useState<string | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<TournamentEntry | null>(null)
  const [editPerson, setEditPerson] = useState<Person | null>(null)
  const [moveEntry, setMoveEntry] = useState<TournamentEntry | null>(null)
  const [tablesOpen, setTablesOpen] = useState(false)
  const [drawOpen, setDrawOpen] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [bonusCount, setBonusCount] = useState('')
  const [bonusChips, setBonusChips] = useState('')

  // L12: inscrições e torneio a cada 8 s enquanto o torneio não terminou (o EntriesController não avisa por
  // SignalR). Mesmas chaves do dashboard: os dados chegam pelas props.
  useQuery({
    queryKey: ['entries', tid],
    queryFn: () => entriesApi.getAll(tid),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  })
  useQuery({
    queryKey: ['tournament', tid],
    queryFn: () => tournamentsApi.getById(tid),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  })
  // Só com Tables no plano (L11): sem ele a consulta nem sai
  const { data: tables } = useQuery({
    queryKey: ['tables', tid],
    queryFn: () => tablesApi.getAll(tid),
    enabled: canTables,
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  })
  const allTables = useMemo(() => (canTables ? tables ?? [] : []), [canTables, tables])

  // Quebra/equilíbrio das mesas depois de eliminar, igual ao terminal (SPEC-20261026-1908); "Escolher eu mesmo" abre
  // as mesas numa modal. Eliminação desfeita fecha o sorteio aberto (feito com as mesas de antes).
  const suggestions = useTableSuggestions({
    tournamentId: tid,
    tournament,
    tables: allTables,
    entries,
    onChooseMyself: () => setTablesOpen(true),
  })
  const actions = useTerminalActions(tid, tournament, { onEliminationUndone: suggestions.close })
  const activeEntries = useMemo(() => entries.filter((e) => isActiveStatus(e.status)), [entries])
  const unseatedCount = useMemo(() => countUnseated(allTables, entries), [allTables, entries])
  // Avisos de mesa do topo só com o jogo valendo (torneio encerrado ou caixa fechado não mexe em mesa)
  const showTableAlerts = canTables && live && !gameActionsLocked && allTables.length > 0

  /** "Quem eliminou?": companheiros de mesa; sem mesa (ou sem Tables no plano), todos os outros ativos por nome (L10) */
  function candidatesFor(entry: TournamentEntry): TournamentEntry[] {
    const others = activeEntries.filter((e) => e.id !== entry.id)
    if (canTables && entry.tableId) {
      const mates = others
        .filter((e) => e.tableId === entry.tableId)
        .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
      if (mates.length > 0) return mates
    }
    return [...others].sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR'))
  }

  /** Knockout: todos os outros ativos por nome (escolher alguém de fora da mesa) */
  function othersFor(entry: TournamentEntry): TournamentEntry[] {
    return activeEntries
      .filter((e) => e.id !== entry.id)
      .sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR'))
  }

  // Depois de eliminar, a quebra/equilíbrio das mesas como no terminal (SPEC-20261026-1908)
  const flows = usePlayerActionDialogs({
    tournamentId: tid,
    tournament,
    actions,
    showPayment: canPay,
    candidatesFor,
    othersFor,
    onEliminated: () => void suggestions.evaluateAfterElimination(),
  })

  const bonusMutation = useMutation({
    mutationFn: ({ count, chips }: { count: number; chips: number }) =>
      tournamentsApi.updatePunctualityBonus(tid, count, chips),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tid] })
      toast.success('Bônus de pontualidade salvo!')
      setShowBonusModal(false)
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao salvar bônus.')),
  })

  // Excluir inscrição (L5): só na Ficha, só para quem joga; deixa "Inscrição excluída" no histórico
  const removeMutation = useMutation({
    mutationFn: (entry: TournamentEntry) => entriesApi.remove(tid, entry.id),
    onSuccess: (_data, entry) => {
      setRemoveConfirm(null)
      setFichaEntryId(null)
      actions.invalidateAll()
      toast.success(`Inscrição de ${playerName(entry)} excluída`)
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao excluir a inscrição.')),
  })

  // ── Lista ──────────────────────────────────────────────────────────
  const effectiveFilter: Filter = !canPay && filter === 'owing' ? 'all' : filter
  const searched = useMemo(() => entries.filter((e) => matchesPlayerSearch(e, search)), [entries, search])
  const counts = useMemo(
    () => ({
      all: searched.length,
      playing: searched.filter((e) => isActiveStatus(e.status)).length,
      eliminated: searched.filter((e) => !isActiveStatus(e.status)).length,
      owing: searched.filter((e) => amountDue(e) > 0).length,
    }),
    [searched],
  )
  const visible = useMemo(() => {
    switch (effectiveFilter) {
      case 'playing':
        return searched.filter((e) => isActiveStatus(e.status))
      case 'eliminated':
        return searched.filter((e) => !isActiveStatus(e.status))
      case 'owing':
        // Inclui quem saiu e ainda deve
        return searched.filter((e) => amountDue(e) > 0)
      default:
        return searched
    }
  }, [searched, effectiveFilter])

  const playing = useMemo(() => visible.filter((e) => isActiveStatus(e.status)), [visible])
  const eliminated = useMemo(
    () =>
      visible
        .filter((e) => !isActiveStatus(e.status))
        .sort((a, b) => (a.finalPosition ?? 9999) - (b.finalPosition ?? 9999)),
    [visible],
  )
  // Por mesa só com Tables no plano e mesa ativa; senão uma lista só, por nome
  const grouped = canTables && allTables.length > 0
  const groups = useMemo(() => (grouped ? groupActiveByTable(playing, allTables) : []), [grouped, playing, allTables])
  const playingByName = useMemo(
    () => [...playing].sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR')),
    [playing],
  )

  const fichaEntry = entries.find((e) => e.id === fichaEntryId) ?? null

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'playing', label: 'Jogando' },
    { key: 'eliminated', label: 'Eliminados' },
    ...(canPay ? [{ key: 'owing' as const, label: 'Devendo' }] : []),
  ]

  function renderPlaying(entry: TournamentEntry) {
    // Caixa fechado (L16): quem ainda joga vira linha compacta, sem botoeira
    if (gameActionsLocked)
      return (
        <EliminatedPlayerRow
          key={entry.id}
          entry={entry}
          onOpen={() => setFichaEntryId(entry.id)}
          showDue={canPay}
          knockout={knockout}
        />
      )
    return (
      <PlayerCard
        key={entry.id}
        entry={entry}
        rules={playerActionRules(tournament, entry)}
        onOpen={() => setFichaEntryId(entry.id)}
        onRebuy={() => flows.askRebuy(entry)}
        onAddon={() => flows.askAddon(entry)}
        onPay={() => flows.openPayment(entry)}
        onEliminate={() => flows.askEliminate(entry)}
        showPayment={canPay}
        showSeat={canTables}
        knockout={knockout}
      />
    )
  }

  function prizeText(entry: TournamentEntry): string | null {
    if (!entry.prizeAmount || entry.prizeAmount <= 0) return null
    const paid = entry.prizePaid || entry.status === 'PaidOut'
    return `${formatCurrency(entry.prizeAmount)}${paid ? ' · pago' : ''}`
  }

  const showPlayingSection = effectiveFilter !== 'eliminated' && playing.length > 0
  const showEliminatedSection = effectiveFilter !== 'playing' && eliminated.length > 0

  // ── Ficha: o que só o organizador tem (L8) ────────────────────────
  function organizerActions(entry: TournamentEntry) {
    const whatsapp = entry.person.whatsapp?.replace(/\D/g, '')
    const canRemove = isActiveStatus(entry.status) && !gameActionsLocked
    return (
      <div className="flex flex-col gap-3">
        {/* Uma coluna no celular (o rótulo "Editar jogador" não cabe pela metade da Ficha), duas do sm em diante */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className={whatsapp ? undefined : 'sm:col-span-2'}
            onClick={() => setEditPerson(entry.person)}
          >
            <Pencil className="h-4 w-4" /> Editar jogador
          </Button>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-input bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
            >
              <Phone className="h-4 w-4 text-accent-green-deep" /> WhatsApp
            </a>
          )}
        </div>
        {canRemove && (
          <div className="rounded-lg border border-accent-red/30 bg-accent-red-soft p-3" data-remove-entry-area>
            <p className="mb-2 text-xs text-text-secondary">
              Tira {playerName(entry)} do torneio e apaga {canPay ? 'os pagamentos, rebuys e add-ons' : 'os rebuys e add-ons'}{' '}
              dele. Fica registrado no histórico.
            </p>
            <Button variant="danger" className="w-full" onClick={() => setRemoveConfirm(entry)}>
              <Trash2 className="h-4 w-4" /> Excluir inscrição
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-entries-tab>
      {/* Cabeçalho — no celular cada item numa linha própria com largura total; do sm em diante, título à esquerda e
          controles numa linha à direita */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Jogadores ({entries.length})</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            role="tablist"
            aria-label="O que ver"
            className="grid grid-cols-2 rounded-lg border border-border-input bg-bg-card p-0.5"
          >
            {(
              [
                { key: 'players', label: 'Jogadores', icon: Users },
                { key: 'history', label: 'Histórico', icon: History },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  view === key ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setBonusCount(String(tournament.punctualityBonusCount ?? 0))
              setBonusChips(String(tournament.punctualityBonusChips ?? 0))
              setShowBonusModal(true)
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-secondary tabular-nums transition-colors hover:border-accent-blue/50 hover:text-text-primary sm:w-auto sm:justify-start"
            title="Bônus de pontualidade (fichas extras)"
          >
            <AlarmClock className="h-3.5 w-3.5 text-accent-gold-deep" />
            Bônus: {tournament.punctualityBonusCount ?? 0} × {(tournament.punctualityBonusChips ?? 0).toLocaleString('pt-BR')}
          </button>
          {isInProgress && (
            <Button size="sm" onClick={() => setShowAddPlayer(true)} className="min-h-[44px] w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {view === 'history' ? (
        <section className="flex flex-col gap-3" data-entries-history>
          <SearchInput
            value={historySearch}
            onChange={setHistorySearch}
            placeholder="Buscar jogador"
            debounceMs={150}
            className="w-full sm:max-w-sm"
          />
          <HistoryList
            tournamentId={tid}
            search={historySearch}
            onUndo={actions.undoItem}
            paymentsLocked={!canPay}
            entries={entries}
          />
        </section>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center">
          <UserPlus className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-text-secondary">Nenhum jogador inscrito ainda.</p>
          {isInProgress && (
            <Button size="sm" className="mt-3 min-h-[44px]" onClick={() => setShowAddPlayer(true)}>
              <UserPlus className="h-4 w-4" />
              Adicionar primeiro jogador
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Avisos de mesa do terminal (quebrar ou equilibrar; jogador sem lugar), com as mesmas regras */}
          {showTableAlerts && (
            <TableAlerts
              analysis={suggestions.analysis}
              tables={allTables}
              unseatedCount={unseatedCount}
              onBreakTable={suggestions.openBreak}
              onDrawBalance={() => suggestions.drawBalance()}
              onOpenTables={() => setTablesOpen(true)}
              className="px-0 pt-0"
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar jogador..."
              debounceMs={150}
              className="w-full sm:w-64"
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar jogadores">
              {filters.map((f) => {
                const active = effectiveFilter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-accent-blue bg-accent-blue-soft text-accent-blue'
                        : 'border-border-input bg-bg-card text-text-secondary hover:text-text-primary',
                    )}
                    data-filter={f.key}
                  >
                    {f.label}
                    <span className="tabular-nums" data-filter-count>
                      {counts[f.key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {!showPlayingSection && !showEliminatedSection && (
            <p className="py-8 text-center text-text-secondary">Nenhum jogador neste filtro.</p>
          )}

          {showPlayingSection && (
            <section data-section="playing">
              <SectionTitle>Jogando ({playing.length})</SectionTitle>
              {grouped ? (
                <div className="flex flex-col gap-4">
                  {groups.map((g) => (
                    <div key={g.key} data-table-group>
                      <h4 className="mb-1.5 text-sm font-semibold text-text-primary">
                        {g.title} · {g.entries.length} {g.entries.length === 1 ? 'jogador' : 'jogadores'}
                      </h4>
                      <div className={GRID}>{g.entries.map(renderPlaying)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={GRID}>{playingByName.map(renderPlaying)}</div>
              )}
            </section>
          )}

          {showEliminatedSection && (
            <section data-section="eliminated">
              <SectionTitle>Eliminados ({eliminated.length})</SectionTitle>
              <div className={GRID}>
                {eliminated.map((entry) => (
                  <EliminatedPlayerRow
                    key={entry.id}
                    entry={entry}
                    onOpen={() => setFichaEntryId(entry.id)}
                    prizeText={prizeText(entry)}
                    showDue={canPay}
                    knockout={knockout}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Ficha do jogador (o painel usa Modal; o terminal, o Sheet em tela cheia) ── */}
      <Modal isOpen={!!fichaEntry} onClose={() => setFichaEntryId(null)} title="Ficha do jogador" size="lg">
        {fichaEntry && (
          <PlayerDetails
            entry={fichaEntry}
            entries={entries}
            tables={allTables}
            tournamentId={tid}
            tournament={tournament}
            rules={playerActionRules(tournament, fichaEntry)}
            onRebuy={() => flows.askRebuy(fichaEntry)}
            onAddon={() => flows.askAddon(fichaEntry)}
            onPay={() => flows.openPayment(fichaEntry)}
            onEliminate={() => flows.askEliminate(fichaEntry)}
            onMove={() => {
              if (allTables.length === 0) toast.info('Sorteie as mesas antes de mover jogadores.')
              else setMoveEntry(fichaEntry)
            }}
            onUndoElimination={() => flows.askUndoElimination(fichaEntry)}
            onUndo={actions.undoItem}
            showPayment={canPay}
            showTables={canTables}
            gameActionsLocked={gameActionsLocked}
            historyPaymentsLocked={!canPay}
            organizerActions={organizerActions(fichaEntry)}
            removePhoto={() => personsApi.removePhoto(fichaEntry.personId)}
            onPhotoChanged={() => void queryClient.invalidateQueries({ queryKey: ['persons', tournament.homeGameId] })}
          />
        )}
      </Modal>

      {/* ── Ações do jogador (os mesmos diálogos do terminal) ── */}
      {flows.dialogs}

      {/* ── Mesas como no terminal: as mesas com os lugares, sortear de novo, quebrar e o sorteio de equilíbrio ── */}
      {canTables && (
        <Modal isOpen={tablesOpen} onClose={() => setTablesOpen(false)} title="Mesas" size="lg">
          <TablesOverview
            tables={allTables}
            entries={entries}
            canBreak={!!suggestions.analysis.breakable}
            onMovePlayer={(entry) => setMoveEntry(entry)}
            onDraw={() => setDrawOpen(true)}
            onBreak={suggestions.openBreak}
          />
        </Modal>
      )}

      {canTables && drawOpen && (
        <DrawTablesDialog
          tournamentId={tid}
          hasTables={allTables.length > 0}
          activePlayers={activeEntries.length}
          defaultSeats={tournament.seatsPerTable && tournament.seatsPerTable > 1 ? tournament.seatsPerTable : 9}
          onClose={() => setDrawOpen(false)}
          onDrawn={() => {
            actions.invalidateAll()
            // Mostra os lugares sorteados para anunciar (como o terminal)
            setTablesOpen(true)
          }}
        />
      )}

      {canTables && moveEntry && (
        <MovePlayerDialog
          tournamentId={tid}
          entry={moveEntry}
          tables={allTables}
          entries={entries}
          onClose={() => setMoveEntry(null)}
          onMoved={actions.invalidateAll}
        />
      )}

      {suggestions.dialogs}

      <PlayerFormDialog
        isOpen={!!editPerson}
        onClose={() => setEditPerson(null)}
        homeGameId={tournament.homeGameId}
        person={editPerson}
        existing={entries.map((e) => e.person)}
        onSaved={() => actions.invalidateAll()}
      />

      <ConfirmDialog
        isOpen={!!removeConfirm}
        onClose={() => !removeMutation.isPending && setRemoveConfirm(null)}
        onConfirm={() => removeConfirm && removeMutation.mutate(removeConfirm)}
        title="Excluir inscrição"
        header={removeConfirm && <PlayerConfirmHeader person={removeConfirm.person} />}
        message={
          removeConfirm
            ? `Excluir a inscrição de ${playerName(removeConfirm)}? ${
                canPay ? 'Todos os pagamentos e rebuys serão apagados' : 'Todos os rebuys e add-ons serão apagados'
              }. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={removeMutation.isPending}
      />

      <AddPlayerModal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        tournamentId={tid}
        entries={entries}
      />

      {/* Bônus de Pontualidade (Modal do kit: fecha só no X/Cancelar — SPEC-20261023-1216) */}
      <Modal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        title="Bônus de Pontualidade"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBonusModal(false)} disabled={bonusMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                bonusMutation.mutate({
                  count: Number(bonusCount) || 0,
                  chips: Number(bonusChips) || 0,
                })
              }
              loading={bonusMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-text-secondary">
          Fichas extras pra quem chegou no horário. Entram no total de fichas exibido no telão.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            id="bonus-count"
            label="Jogadores que receberam"
            type="number"
            min={0}
            value={bonusCount}
            onChange={(e) => setBonusCount(e.target.value)}
          />
          <Input
            id="bonus-chips"
            label="Fichas de bônus (por jogador)"
            type="number"
            min={0}
            step={500}
            value={bonusChips}
            onChange={(e) => setBonusChips(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
