import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  UserPlus,
  RotateCcw,
  PlusCircle,
  XCircle,
  CreditCard,
  Phone,
  Trash2,
  Undo2,
  MinusCircle,
} from 'lucide-react'
import * as entriesApi from '../../../api/entries.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Avatar } from '../../../components/ui/Avatar'
import { SearchInput } from '../../../components/ui/SearchInput'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { AddPlayerModal } from '../../../components/tournament/AddPlayerModal'
import { PaymentModal } from '../../../components/tournament/PaymentModal'
import { EliminationModal } from '../../../components/tournament/EliminationModal'
import {
  ENTRY_STATUS_COLORS,
  ENTRY_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from '../../../constants/statuses'
import type { TournamentEntry, EntryStatus, PaymentStatus } from '../../../types/entry.types'
import type { Tournament } from '../../../types/tournament.types'

interface EntriesTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function EntriesTab({ tournament, entries }: EntriesTabProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)
  const [eliminateEntry, setEliminateEntry] = useState<TournamentEntry | null>(null)
  const [rebuyConfirm, setRebuyConfirm] = useState<TournamentEntry | null>(null)
  const [addonConfirm, setAddonConfirm] = useState<TournamentEntry | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<TournamentEntry | null>(null)
  const [successMessage, setSuccessMessage] = useState<{
    entry: TournamentEntry
    action: string
  } | null>(null)

  const rebuyMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string }) =>
      entriesApi.rebuy(tournament.id, entryId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      const entry = entries.find((e) => e.id === variables.entryId)
      if (entry) {
        setSuccessMessage({ entry, action: 'Rebuy' })
      }
      toast.success('Rebuy registrado!')
      setRebuyConfirm(null)
    },
    onError: () => {
      toast.error('Erro ao registrar rebuy.')
    },
  })

  const addonMutation = useMutation({
    mutationFn: ({ entryId, isDouble }: { entryId: string; isDouble?: boolean }) =>
      entriesApi.addon(tournament.id, entryId, { isDouble }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      const entry = entries.find((e) => e.id === variables.entryId)
      if (entry) {
        setSuccessMessage({ entry, action: variables.isDouble ? 'Add-on Duplo' : 'Add-on' })
      }
      toast.success(variables.isDouble ? 'Add-on duplo registrado!' : 'Add-on registrado!')
      setAddonConfirm(null)
    },
    onError: () => {
      toast.error('Erro ao registrar add-on.')
    },
  })

  const removeRebuyMutation = useMutation({
    mutationFn: (entryId: string) =>
      entriesApi.removeRebuy(tournament.id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Rebuy removido!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao remover rebuy.')
    },
  })

  const removeAddonMutation = useMutation({
    mutationFn: (entryId: string) =>
      entriesApi.removeAddon(tournament.id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Addon removido!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao remover addon.')
    },
  })

  const undoEliminationMutation = useMutation({
    mutationFn: (entryId: string) =>
      entriesApi.undoElimination(tournament.id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      toast.success('Eliminação desfeita!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao desfazer eliminação.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (entryId: string) => entriesApi.remove(tournament.id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Jogador removido do torneio!')
      setRemoveConfirm(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao remover jogador.')
    },
  })

  const filtered = entries
    .filter((e) => {
      if (!search) return true
      const name = (e.person.nickname ?? e.person.fullName).toLowerCase()
      return name.includes(search.toLowerCase())
    })
    .slice()
    .sort((a, b) => {
      const aEliminated = a.status === 'Eliminated' || a.status === 'Awarded'
      const bEliminated = b.status === 'Eliminated' || b.status === 'Awarded'
      // Ativos vem primeiro
      if (aEliminated !== bEliminated) return aEliminated ? 1 : -1
      // Entre eliminados: ultimo eliminado primeiro (mais recente no topo dos eliminados)
      if (aEliminated && bEliminated) {
        const aTime = a.eliminatedAt ? new Date(a.eliminatedAt).getTime() : 0
        const bTime = b.eliminatedAt ? new Date(b.eliminatedAt).getTime() : 0
        return bTime - aTime
      }
      // Entre ativos: ordem original (por id ou nome)
      return 0
    })

  const activeEntries = entries.filter((e) => (e.status === 'Active' || e.status === 'Registered'))
  const isSettlement = tournament.settlementClosed
  const isInProgress =
    tournament.status === 'Draft' ||
    tournament.status === 'OpenForRegistration' ||
    tournament.status === 'InProgress'

  function getRowBorderColor(entry: TournamentEntry): string {
    if (entry.paymentStatus === 'Paid') return 'border-green-500/30 bg-green-500/5'
    if (entry.paymentStatus === 'PartiallyPaid') return 'border-yellow-500/30 bg-yellow-500/5'
    if (entry.status === 'Eliminated') return 'border-red-500/20 bg-red-500/5 opacity-70'
    return 'border-border-default bg-bg-primary'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Jogadores ({entries.length})
        </h2>
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar jogador..."
            className="w-48"
          />
          {isInProgress && (
            <Button size="sm" onClick={() => setShowAddPlayer(true)}>
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Success toast with WhatsApp link */}
      {successMessage && successMessage.entry.person.whatsapp && (
        <div className="flex items-center justify-between rounded-lg bg-accent-green/10 border border-accent-green/30 p-3">
          <p className="text-sm text-text-primary">
            {successMessage.action} registrado para{' '}
            {successMessage.entry.person.nickname ??
              successMessage.entry.person.fullName}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${successMessage.entry.person.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              <Phone className="h-3 w-3" />
              WhatsApp
            </a>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-text-muted hover:text-text-primary text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <UserPlus className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhum jogador inscrito ainda.</p>
          {isInProgress && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setShowAddPlayer(true)}
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Primeiro Jogador
            </Button>
          )}
        </div>
      )}

      {/* Entries list */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${getRowBorderColor(entry)}`}
            >
              {/* Player info */}
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Avatar
                  src={entry.person.photoUrl}
                  name={entry.person.nickname ?? entry.person.fullName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {entry.person.nickname ?? entry.person.fullName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      className={
                        ENTRY_STATUS_COLORS[entry.status as EntryStatus] ?? ''
                      }
                    >
                      {ENTRY_STATUS_LABELS[entry.status as EntryStatus] ??
                        entry.status}
                    </Badge>
                    <Badge
                      className={
                        PAYMENT_STATUS_COLORS[
                          entry.paymentStatus as PaymentStatus
                        ] ?? ''
                      }
                    >
                      {PAYMENT_STATUS_LABELS[
                        entry.paymentStatus as PaymentStatus
                      ] ?? entry.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Financial info */}
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <div className="text-center">
                  <p>Buy-in</p>
                  <p className="font-semibold text-text-primary">
                    {formatCurrency(entry.buyInAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p>Rebuys</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="font-semibold text-text-primary">
                      {entry.rebuyCount}
                    </p>
                    {entry.rebuyCount > 0 && (
                      <button
                        type="button"
                        onClick={() => removeRebuyMutation.mutate(entry.id)}
                        className="rounded p-0.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover 1 rebuy"
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p>Add-on</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="font-semibold text-text-primary">
                      {entry.addonPurchased
                        ? entry.addonDouble
                          ? 'Duplo'
                          : 'Sim'
                        : '-'}
                    </p>
                    {entry.addonPurchased && (
                      <button
                        type="button"
                        onClick={() => removeAddonMutation.mutate(entry.id)}
                        className="rounded p-0.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover addon"
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p>Total</p>
                  <p className="font-semibold text-text-primary">
                    {formatCurrency(entry.totalDue)}
                  </p>
                </div>
                <div className="text-center">
                  <p>Pago</p>
                  <p className="font-semibold text-accent-green">
                    {formatCurrency(entry.totalPaid)}
                  </p>
                </div>
                <div className="text-center">
                  <p>Saldo</p>
                  <p
                    className={`font-semibold ${entry.balance > 0 ? 'text-accent-red' : entry.balance < 0 ? 'text-accent-blue' : 'text-accent-green'}`}
                  >
                    {formatCurrency(entry.balance)}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {(entry.status === 'Eliminated' || entry.status === 'Awarded') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undoEliminationMutation.mutate(entry.id)}
                    title="Desfazer eliminação"
                    className="text-accent-blue hover:text-blue-300"
                    loading={undoEliminationMutation.isPending}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}
                {!isSettlement && (entry.status === 'Active' || entry.status === 'Registered') && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRebuyConfirm(entry)}
                      title="Rebuy"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    {tournament.addonAllowed && !entry.addonPurchased && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddonConfirm(entry)}
                        title="Add-on"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEliminateEntry(entry)}
                      title="Eliminar"
                      className="text-accent-red hover:text-red-300"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveConfirm(entry)}
                      title="Remover do torneio"
                      className="text-text-muted hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaymentEntry(entry)}
                  title={entry.balance > 0 ? 'Pagar / Ver pagamentos' : 'Ver / Estornar pagamentos'}
                  className={
                    entry.balance > 0
                      ? 'text-accent-green hover:text-green-300'
                      : 'text-text-muted hover:text-accent-blue'
                  }
                >
                  <CreditCard className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddPlayerModal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        tournamentId={tournament.id}
        homeGameId={tournament.homeGameId}
      />

      <PaymentModal
        isOpen={!!paymentEntry}
        onClose={() => setPaymentEntry(null)}
        entry={paymentEntry}
        tournamentId={tournament.id}
      />

      <EliminationModal
        isOpen={!!eliminateEntry}
        onClose={() => setEliminateEntry(null)}
        entry={eliminateEntry}
        activeEntries={activeEntries}
        tournamentId={tournament.id}
        totalEntries={tournament.totalEntries}
      />

      <ConfirmDialog
        isOpen={!!rebuyConfirm}
        onClose={() => setRebuyConfirm(null)}
        onConfirm={() => {
          if (rebuyConfirm) {
            rebuyMutation.mutate({ entryId: rebuyConfirm.id })
          }
        }}
        title="Confirmar Rebuy"
        message={`Registrar rebuy de ${formatCurrency(tournament.rebuyAmount)} para ${rebuyConfirm?.person.nickname ?? rebuyConfirm?.person.fullName ?? ''}?`}
        confirmLabel="Rebuy"
        variant="warning"
        loading={rebuyMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        onConfirm={() => {
          if (removeConfirm) {
            removeMutation.mutate(removeConfirm.id)
          }
        }}
        title="Remover Jogador"
        message={`Remover ${removeConfirm?.person.nickname ?? removeConfirm?.person.fullName ?? ''} do torneio? Todos os pagamentos e rebuys serao apagados. Esta acao nao pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        loading={removeMutation.isPending}
      />

      {/* Addon Modal */}
      {addonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Confirmar Add-on
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              {addonConfirm.person.nickname ?? addonConfirm.person.fullName}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() =>
                  addonMutation.mutate({ entryId: addonConfirm.id, isDouble: false })
                }
                loading={addonMutation.isPending}
                className="w-full"
              >
                <PlusCircle className="h-4 w-4" />
                Addon Simples &mdash; {formatCurrency(tournament.addonAmount)}
              </Button>
              {tournament.addonDoubleAllowed && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    addonMutation.mutate({ entryId: addonConfirm.id, isDouble: true })
                  }
                  loading={addonMutation.isPending}
                  className="w-full"
                >
                  <PlusCircle className="h-4 w-4" />
                  Addon Duplo &mdash; {formatCurrency(tournament.addonAmount * 2)}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setAddonConfirm(null)}
                disabled={addonMutation.isPending}
                className="w-full mt-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
