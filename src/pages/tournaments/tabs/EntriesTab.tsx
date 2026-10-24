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
  AlarmClock,
} from 'lucide-react'
import * as entriesApi from '../../../api/entries.api'
import * as tournamentsApi from '../../../api/tournaments.api'
import { hasFeature } from '../../../hooks/usePlan'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Avatar } from '../../../components/ui/Avatar'
import { SearchInput } from '../../../components/ui/SearchInput'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
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
  // SPEC-20261023-1205 (D3): sem Payments no plano do dono não há pagamento algum na lista —
  // some o botão Pagar/Ver pagamentos, o badge de pagamento, as colunas Pago/Saldo e o PaymentModal
  const canPay = hasFeature(tournament.planFeatures, 'Payments')
  const [search, setSearch] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)
  const [eliminateEntry, setEliminateEntry] = useState<TournamentEntry | null>(null)
  const [rebuyConfirm, setRebuyConfirm] = useState<TournamentEntry | null>(null)
  const [addonConfirm, setAddonConfirm] = useState<TournamentEntry | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<TournamentEntry | null>(null)
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [bonusCount, setBonusCount] = useState('')
  const [bonusChips, setBonusChips] = useState('')
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

  const bonusMutation = useMutation({
    mutationFn: ({ count, chips }: { count: number; chips: number }) =>
      tournamentsApi.updatePunctualityBonus(tournament.id, count, chips),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Bônus de pontualidade salvo!')
      setShowBonusModal(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao salvar bônus.')
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
      const finishedStatuses = ['Eliminated', 'Awarded', 'PaidOut']
      const aFinished = finishedStatuses.includes(a.status)
      const bFinished = finishedStatuses.includes(b.status)
      // Ativos vem primeiro; ao terminar, sobram so finalizados (1º no topo)
      if (aFinished !== bFinished) return aFinished ? 1 : -1
      // Entre finalizados: por posicao final crescente (1º, 2º, 3º...)
      if (aFinished && bFinished) {
        return (a.finalPosition ?? 9999) - (b.finalPosition ?? 9999)
      }
      // Entre ativos: ordem original
      return 0
    })

  const activeEntries = entries.filter((e) => (e.status === 'Active' || e.status === 'Registered'))
  const isSettlement = tournament.settlementClosed
  const isInProgress =
    tournament.status === 'Draft' ||
    tournament.status === 'OpenForRegistration' ||
    tournament.status === 'InProgress'

  function getRowBorderColor(entry: TournamentEntry): string {
    if (canPay && entry.paymentStatus === 'Paid') return 'border-accent-green/30 bg-accent-green-soft'
    if (canPay && entry.paymentStatus === 'PartiallyPaid') return 'border-accent-yellow/40 bg-accent-yellow-soft'
    // Eliminado: sem opacidade (derrubava o texto abaixo de AA); o estado vem do fundo vermelho-claro e do nome em text-secondary
    if (entry.status === 'Eliminated') return 'border-accent-red/30 bg-accent-red-soft'
    return 'border-border-default bg-bg-primary'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header — no celular cada item numa linha própria com largura total;
          do sm em diante, título à esquerda e controles numa linha à direita */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Jogadores ({entries.length})
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              setBonusCount(String(tournament.punctualityBonusCount ?? 0))
              setBonusChips(String(tournament.punctualityBonusChips ?? 0))
              setShowBonusModal(true)
            }}
            className="flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-secondary tabular-nums hover:text-text-primary hover:border-accent-blue/50 transition-colors sm:w-auto sm:min-h-0 sm:justify-start"
            title="Bônus de pontualidade (fichas extras)"
          >
            <AlarmClock className="h-3.5 w-3.5 text-accent-gold-deep" />
            Bônus: {tournament.punctualityBonusCount ?? 0} ×{' '}
            {(tournament.punctualityBonusChips ?? 0).toLocaleString('pt-BR')}
          </button>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar jogador..."
            className="w-full sm:w-48"
          />
          {isInProgress && (
            <Button
              size="sm"
              onClick={() => setShowAddPlayer(true)}
              className="w-full min-h-[44px] sm:w-auto sm:min-h-[36px]"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Success toast with WhatsApp link */}
      {successMessage && successMessage.entry.person.whatsapp && (
        <div className="flex items-center justify-between rounded-lg bg-accent-green-soft border border-accent-green/30 p-3">
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
              className="flex items-center gap-1 rounded-lg bg-accent-green-deep px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-green-hover transition-colors"
            >
              <Phone className="h-3 w-3" />
              WhatsApp
            </a>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-text-secondary hover:text-text-primary text-xs"
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
              className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-center ${getRowBorderColor(entry)}`}
            >
              {/* Player info */}
              <div className="flex items-center gap-3 w-full sm:flex-1 sm:min-w-[200px]">
                <Avatar
                  src={entry.person.photoUrl}
                  name={entry.person.nickname ?? entry.person.fullName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      entry.status === 'Eliminated' ? 'text-text-secondary' : 'text-text-primary'
                    }`}
                  >
                    {entry.person.nickname ?? entry.person.fullName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      color={ENTRY_STATUS_COLORS[entry.status as EntryStatus]}
                    >
                      {ENTRY_STATUS_LABELS[entry.status as EntryStatus] ??
                        entry.status}
                      {entry.finalPosition
                        ? ` ${entry.finalPosition}º`
                        : ''}
                      {(entry.status === 'Awarded' ||
                        entry.status === 'PaidOut') &&
                      entry.prizeAmount
                        ? ` · ${formatCurrency(entry.prizeAmount)}`
                        : ''}
                    </Badge>
                    {canPay && (
                      <Badge
                        color={PAYMENT_STATUS_COLORS[entry.paymentStatus as PaymentStatus]}
                      >
                        {PAYMENT_STATUS_LABELS[
                          entry.paymentStatus as PaymentStatus
                        ] ?? entry.paymentStatus}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial info */}
              <div
                className={`grid gap-2 w-full text-xs text-text-secondary tabular-nums sm:flex sm:w-auto sm:items-center sm:gap-4 ${
                  canPay ? 'grid-cols-3' : 'grid-cols-4'
                }`}
              >
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
                        className="rounded p-0.5 text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
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
                        className="rounded p-0.5 text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
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
                {canPay && (
                  <>
                    <div className="text-center">
                      <p>Pago</p>
                      <p className="font-semibold text-accent-green-deep">
                        {formatCurrency(entry.totalPaid)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p>Saldo</p>
                      <p
                        className={`font-semibold ${entry.balance > 0 ? 'text-accent-red-deep' : entry.balance < 0 ? 'text-accent-blue' : 'text-accent-green-deep'}`}
                      >
                        {formatCurrency(entry.balance)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 w-full justify-end sm:w-auto sm:flex-shrink-0">
                {/* Campeão (nunca eliminado, eliminatedAt nulo) não tem eliminação a desfazer */}
                {(entry.status === 'Eliminated' || entry.status === 'Awarded') && entry.eliminatedAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undoEliminationMutation.mutate(entry.id)}
                    title="Desfazer eliminação"
                    className="text-accent-blue hover:text-accent-blue-hover hover:bg-accent-blue-soft"
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
                      className="text-accent-red hover:text-accent-red-deep hover:bg-accent-red-soft"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveConfirm(entry)}
                      title="Remover do torneio"
                      className="text-accent-red hover:text-accent-red-deep hover:bg-accent-red-soft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canPay && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaymentEntry(entry)}
                    title={entry.balance > 0 ? 'Pagar / Ver pagamentos' : 'Ver / Estornar pagamentos'}
                    className={
                      entry.balance > 0
                        ? 'text-accent-green-deep hover:text-accent-green-hover hover:bg-accent-green-soft'
                        : 'text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft'
                    }
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                )}
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
        allowPayment={canPay}
      />

      {canPay && (
        <PaymentModal
          isOpen={!!paymentEntry}
          onClose={() => setPaymentEntry(null)}
          entry={paymentEntry}
          tournamentId={tournament.id}
        />
      )}

      <EliminationModal
        isOpen={!!eliminateEntry}
        onClose={() => setEliminateEntry(null)}
        entry={eliminateEntry}
        activeEntries={activeEntries}
        tournamentId={tournament.id}
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
        message={`Remover ${removeConfirm?.person.nickname ?? removeConfirm?.person.fullName ?? ''} do torneio? ${canPay ? 'Todos os pagamentos e rebuys serão apagados' : 'Todos os rebuys e add-ons serão apagados'}. Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        loading={removeMutation.isPending}
      />

      {/* Bônus de Pontualidade (Modal do kit: fecha só no X/Cancelar — SPEC-20261023-1216) */}
      <Modal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        title="Bônus de Pontualidade"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowBonusModal(false)}
              disabled={bonusMutation.isPending}
            >
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
          Fichas extras pra quem chegou no horário. Entram no total de
          fichas exibido no telão.
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

      {/* Confirmar Add-on (Modal do kit) */}
      <Modal
        isOpen={!!addonConfirm}
        onClose={() => setAddonConfirm(null)}
        title="Confirmar Add-on"
        size="sm"
        footer={
          <Button
            variant="ghost"
            onClick={() => setAddonConfirm(null)}
            disabled={addonMutation.isPending}
            className="w-full"
          >
            Cancelar
          </Button>
        }
      >
        {addonConfirm && (
          <>
            <p className="mb-4 text-sm text-text-secondary">
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
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
