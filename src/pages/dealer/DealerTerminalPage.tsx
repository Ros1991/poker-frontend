import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw,
  PlusCircle,
  Skull,
  CreditCard,
  Undo2,
  Clock,
  Pause,
  Play,
  SkipForward,
  SkipBack,
  LayoutGrid,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as tablesApi from '../../api/tables.api'
import * as tournamentDealersApi from '../../api/tournamentDealers.api'
import * as timerApi from '../../api/timer.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PaymentModal } from '../../components/tournament/PaymentModal'
import type { TimerState } from '../../types/blind.types'
import type { TournamentEntry } from '../../types/entry.types'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function DealerTerminalPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'rebuy' | 'addon' | 'eliminate' | 'undo'
    entry: TournamentEntry
  } | null>(null)

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId!),
    enabled: !!tournamentId,
  })

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId!),
    enabled: !!tournamentId,
  })

  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.getAll(tournamentId!),
    enabled: !!tournamentId,
  })

  const { data: dealers } = useQuery({
    queryKey: ['tournamentDealers', tournamentId],
    queryFn: () => tournamentDealersApi.getAll(tournamentId!),
    enabled: !!tournamentId,
  })

  const { formattedTime, timerState, syncFromServer } = useBlindTimer()

  useQuery({
    queryKey: ['timer', tournamentId],
    queryFn: async () => {
      const state = await timerApi.getState(tournamentId!)
      syncFromServer(state as TimerState)
      return state
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  })

  useWebSocket({
    tournamentId: tournamentId ?? '',
    enabled: !!tournamentId,
    onTimerUpdate: (state) => syncFromServer(state as TimerState),
  })

  // Auto-select default table
  useEffect(() => {
    if (selectedTableId || !tables || tables.length === 0) return
    // Dealer's own table?
    const myDealer = dealers?.find((d) => d.personId === user?.personId)
    if (myDealer) {
      const myTable = tables.find((t) => t.dealerPersonId === user?.personId)
      if (myTable) {
        setSelectedTableId(myTable.id)
        return
      }
    }
    setSelectedTableId(tables[0].id)
  }, [tables, dealers, user, selectedTableId])

  const selectedTable = tables?.find((t) => t.id === selectedTableId) ?? null

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
  }

  const rebuyMutation = useMutation({
    mutationFn: (entryId: string) => entriesApi.rebuy(tournamentId!, entryId),
    onSuccess: () => {
      invalidateAll()
      toast.success('Rebuy registrado!')
      setConfirmAction(null)
    },
    onError: () => toast.error('Erro ao registrar rebuy.'),
  })

  const addonMutation = useMutation({
    mutationFn: (entryId: string) => entriesApi.addon(tournamentId!, entryId),
    onSuccess: () => {
      invalidateAll()
      toast.success('Add-on registrado!')
      setConfirmAction(null)
    },
    onError: () => toast.error('Erro ao registrar add-on.'),
  })

  const eliminateMutation = useMutation({
    mutationFn: (entryId: string) =>
      entriesApi.eliminate(tournamentId!, entryId, { entryId }),
    onSuccess: () => {
      invalidateAll()
      toast.success('Jogador eliminado!')
      setConfirmAction(null)
    },
    onError: () => toast.error('Erro ao eliminar jogador.'),
  })

  const undoMutation = useMutation({
    mutationFn: (entryId: string) =>
      entriesApi.undoElimination(tournamentId!, entryId),
    onSuccess: () => {
      invalidateAll()
      toast.success('Eliminacao desfeita!')
      setConfirmAction(null)
    },
    onError: () => toast.error('Erro ao desfazer eliminacao.'),
  })

  const pauseMutation = useMutation({
    mutationFn: () => timerApi.pause(tournamentId!),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Timer pausado')
    },
    onError: () => toast.error('Erro ao pausar timer.'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => timerApi.resume(tournamentId!),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Timer retomado')
    },
    onError: () => toast.error('Erro ao retomar timer.'),
  })

  const nextMutation = useMutation({
    mutationFn: () => timerApi.nextLevel(tournamentId!),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Proximo nivel')
    },
    onError: () => toast.error('Erro ao avancar nivel.'),
  })

  const prevMutation = useMutation({
    mutationFn: () => timerApi.previousLevel(tournamentId!),
    onSuccess: (state) => {
      syncFromServer(state as TimerState)
      toast.success('Nivel anterior')
    },
    onError: () => toast.error('Erro ao voltar nivel.'),
  })

  // Filter entries at selected table
  const tableEntries = useMemo(() => {
    if (!entries || !selectedTableId) return []
    return entries
      .filter((e) => e.tableId === selectedTableId)
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
  }, [entries, selectedTableId])

  const activeEntries = tableEntries.filter(
    (e) => e.status === 'Active' || e.status === 'Registered',
  )
  const eliminatedEntries = tableEntries.filter(
    (e) => e.status !== 'Active' && e.status !== 'Registered',
  )

  function handleConfirm() {
    if (!confirmAction) return
    const { type, entry } = confirmAction
    switch (type) {
      case 'rebuy':
        rebuyMutation.mutate(entry.id)
        break
      case 'addon':
        addonMutation.mutate(entry.id)
        break
      case 'eliminate':
        eliminateMutation.mutate(entry.id)
        break
      case 'undo':
        undoMutation.mutate(entry.id)
        break
    }
  }

  const isActionLoading =
    rebuyMutation.isPending ||
    addonMutation.isPending ||
    eliminateMutation.isPending ||
    undoMutation.isPending

  const confirmMessages: Record<string, string> = {
    rebuy: `Confirmar rebuy para ${confirmAction?.entry.person.nickname ?? confirmAction?.entry.person.fullName ?? ''}?`,
    addon: `Confirmar add-on para ${confirmAction?.entry.person.nickname ?? confirmAction?.entry.person.fullName ?? ''}?`,
    eliminate: `Eliminar ${confirmAction?.entry.person.nickname ?? confirmAction?.entry.person.fullName ?? ''} do torneio?`,
    undo: `Desfazer eliminacao de ${confirmAction?.entry.person.nickname ?? confirmAction?.entry.person.fullName ?? ''}?`,
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Compact Header */}
      <header className="sticky top-0 z-30 border-b border-border-default bg-bg-secondary/95 backdrop-blur-sm px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-muted truncate">
              {tournament?.name}
            </p>
            <button
              onClick={() => setTableModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"
            >
              <LayoutGrid className="h-4 w-4 text-accent-blue" />
              {selectedTable
                ? `Mesa ${selectedTable.tableNumber}`
                : 'Selecionar mesa'}
            </button>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-mono text-lg font-bold text-accent-green">
                {formattedTime}
              </span>
            </div>
            <p className="text-[10px] text-text-muted">
              Nivel {timerState.currentLevel} — {timerState.smallBlind}/
              {timerState.bigBlind}
            </p>
          </div>
        </div>

        {/* Timer controls */}
        <div className="flex gap-1.5 mt-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => prevMutation.mutate()}
            loading={prevMutation.isPending}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() =>
              timerState.isRunning
                ? pauseMutation.mutate()
                : resumeMutation.mutate()
            }
            loading={pauseMutation.isPending || resumeMutation.isPending}
          >
            {timerState.isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Retomar
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => nextMutation.mutate()}
            loading={nextMutation.isPending}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Player Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {entriesLoading ? (
          <LoadingSpinner size="md" text="Carregando jogadores..." />
        ) : !selectedTable ? (
          <p className="text-center text-text-muted py-12">
            Nenhuma mesa disponivel. Sorteie as mesas no dashboard.
          </p>
        ) : (
          <>
            {activeEntries.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Ativos ({activeEntries.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {activeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border-default bg-bg-secondary p-3"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-bg-tertiary text-xs font-bold text-text-primary shrink-0">
                          {entry.seatNumber ?? '-'}
                        </div>
                        <Avatar
                          src={entry.person.photoUrl}
                          name={entry.person.fullName}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {entry.person.nickname ?? entry.person.fullName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted">
                            <span>R: {entry.rebuyCount}</span>
                            <span>·</span>
                            <span>
                              {entry.addonPurchased ? 'Addon' : 'Sem addon'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-xs font-bold ${entry.balance > 0 ? 'text-accent-red' : 'text-accent-green'}`}
                          >
                            {formatCurrency(entry.balance)}
                          </p>
                          <Badge
                            color={
                              entry.paymentStatus === 'Paid'
                                ? 'green'
                                : entry.paymentStatus === 'PartiallyPaid'
                                  ? 'yellow'
                                  : 'red'
                            }
                          >
                            {entry.paymentStatus === 'Paid'
                              ? 'Pago'
                              : entry.paymentStatus === 'PartiallyPaid'
                                ? 'Parcial'
                                : 'Pend.'}
                          </Badge>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={
                            (tournament?.maxRebuys ?? 0) > 0 &&
                            entry.rebuyCount >= (tournament?.maxRebuys ?? 0)
                          }
                          onClick={() =>
                            setConfirmAction({ type: 'rebuy', entry })
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={
                            entry.addonPurchased ||
                            !(tournament?.addonAllowed ?? false)
                          }
                          onClick={() =>
                            setConfirmAction({ type: 'addon', entry })
                          }
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => setPaymentEntry(entry)}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setConfirmAction({ type: 'eliminate', entry })
                          }
                        >
                          <Skull className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {eliminatedEntries.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Eliminados ({eliminatedEntries.length})
                </h2>
                <div className="flex flex-col gap-1.5">
                  {eliminatedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary p-2 opacity-70"
                    >
                      <Avatar
                        src={entry.person.photoUrl}
                        name={entry.person.fullName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {entry.person.nickname ?? entry.person.fullName}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {entry.finalPosition
                            ? `${entry.finalPosition}º lugar`
                            : entry.status}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: 'undo', entry })
                        }
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tableEntries.length === 0 && (
              <p className="text-center text-text-muted py-12">
                Nenhum jogador nesta mesa.
              </p>
            )}
          </>
        )}
      </div>

      {/* Table selection modal */}
      <Modal
        isOpen={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        title="Selecionar Mesa"
        size="sm"
      >
        <div className="flex flex-col gap-2">
          {(tables ?? []).map((t) => {
            const count =
              entries?.filter(
                (e) =>
                  e.tableId === t.id &&
                  (e.status === 'Active' || e.status === 'Registered'),
              ).length ?? 0
            const isMine = t.dealerPersonId === user?.personId
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTableId(t.id)
                  setTableModalOpen(false)
                }}
                className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  selectedTableId === t.id
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-border-default bg-bg-primary hover:bg-bg-tertiary'
                }`}
              >
                <div>
                  <p className="font-semibold text-text-primary">
                    Mesa {t.tableNumber}
                    {isMine && (
                      <span className="ml-2 text-xs text-accent-green">
                        (sua)
                      </span>
                    )}
                  </p>
                  {t.dealerName && (
                    <p className="text-xs text-text-muted">
                      Dealer: {t.dealerName}
                    </p>
                  )}
                </div>
                <span className="text-sm text-text-muted">
                  {count} jogadores
                </span>
              </button>
            )
          })}
          {(!tables || tables.length === 0) && (
            <p className="text-center text-text-muted py-4 text-sm">
              Nenhuma mesa sorteada.
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => setTableModalOpen(false)}
            className="mt-2"
          >
            <X className="h-4 w-4" /> Fechar
          </Button>
        </div>
      </Modal>

      {/* Payment modal */}
      <PaymentModal
        isOpen={!!paymentEntry}
        onClose={() => setPaymentEntry(null)}
        entry={paymentEntry}
        tournamentId={tournamentId!}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={
          confirmAction?.type === 'rebuy'
            ? 'Confirmar Rebuy'
            : confirmAction?.type === 'addon'
              ? 'Confirmar Add-on'
              : confirmAction?.type === 'eliminate'
                ? 'Eliminar Jogador'
                : 'Desfazer Eliminacao'
        }
        message={confirmMessages[confirmAction?.type ?? ''] ?? ''}
        confirmLabel="Confirmar"
        variant={confirmAction?.type === 'eliminate' ? 'danger' : 'warning'}
        loading={isActionLoading}
      />
    </div>
  )
}
