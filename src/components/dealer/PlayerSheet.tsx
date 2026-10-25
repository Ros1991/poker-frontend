import { useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CreditCard, PlusCircle, RefreshCw, Skull, Undo2 } from 'lucide-react'
import * as tournamentPlayersApi from '../../api/tournamentPlayers.api'
import { Button } from '../ui/Button'
import { EditablePhotoAvatar } from '../photo/EditablePhotoAvatar'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import type { HistoryItem } from '../../types/history.types'
import { HistoryList } from './HistoryList'
import { DueLabel } from './PlayerCard'
import type { PlayerActionRules } from './PlayerCard'
import { Sheet } from './Sheet'
import { formatCurrency, isActiveStatus, playerName, seatLabel, statusLabel } from './terminalFormat'

interface PlayerSheetProps {
  entry: TournamentEntry | null
  tables: Table[] | undefined
  tournamentId: string
  rules: PlayerActionRules
  onClose: () => void
  onRebuy: () => void
  onAddon: () => void
  onPay: () => void
  onEliminate: () => void
  onMove: () => void
  onUndoElimination: () => void
  onUndo: (item: HistoryItem) => Promise<void>
  /** Plano do dono com Payments: "Pagar", "Pagou" e "Deve/Pago" (SPEC-20261023-1205, D3) */
  showPayments?: boolean
  /** Plano do dono com Tables: lugar na mesa e "Mover" */
  showTables?: boolean
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

/** Ficha do jogador: situação, ações e o histórico só dele */
export function PlayerSheet({
  entry,
  tables,
  tournamentId,
  rules,
  onClose,
  onRebuy,
  onAddon,
  onPay,
  onEliminate,
  onMove,
  onUndoElimination,
  onUndo,
  showPayments = true,
  showTables = true,
}: PlayerSheetProps) {
  const queryClient = useQueryClient()
  if (!entry) return null
  const active = isActiveStatus(entry.status)
  // Campeão (nunca eliminado, eliminatedAt nulo) não tem eliminação a desfazer
  const canUndoElimination = !active && !!entry.eliminatedAt

  return (
    <Sheet isOpen onClose={onClose} title="Ficha do jogador" elevated>
      <div className="mb-3 flex items-center gap-3">
        {/* Tocar no avatar troca a foto (SPEC-20261023-1213, F20) — dealer e organizador; remover só no painel */}
        <EditablePhotoAvatar
          src={entry.person.photoUrl}
          name={playerName(entry)}
          size="xl"
          upload={(blob) => tournamentPlayersApi.uploadPhoto(tournamentId, entry.personId, blob)}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
            void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
            void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-text-primary">{playerName(entry)}</p>
          {entry.person.nickname && (
            <p className="truncate text-sm text-text-secondary">{entry.person.fullName}</p>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {showTables && <Info label="Mesa" value={active ? seatLabel(entry, tables) : '—'} />}
        <Info label="Situação" value={statusLabel(entry)} />
        <Info label="Rebuys" value={entry.rebuyCount} />
        <Info
          label="Add-on"
          value={entry.addonPurchased ? (entry.addonDouble ? 'Duplo' : 'Simples') : 'Não'}
        />
        <Info label="Total" value={formatCurrency(entry.totalDue)} />
        {showPayments && <Info label="Pagou" value={formatCurrency(entry.totalPaid)} />}
      </div>
      {showPayments && (
        <p className="mb-3 text-center text-base">
          <DueLabel entry={entry} />
        </p>
      )}

      {active ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onRebuy} disabled={!rules.canRebuy}>
            <RefreshCw className="h-4 w-4" /> Rebuy
          </Button>
          <Button variant="secondary" onClick={onAddon} disabled={!rules.canAddon}>
            <PlusCircle className="h-4 w-4" /> Add-on
          </Button>
          {showPayments && (
            <Button variant="success" onClick={onPay}>
              <CreditCard className="h-4 w-4" /> Pagar
            </Button>
          )}
          {showTables && (
            <Button variant="secondary" onClick={onMove}>
              <ArrowRightLeft className="h-4 w-4" /> Mover
            </Button>
          )}
          <Button
            variant="danger"
            className={showPayments === showTables ? 'col-span-2' : undefined}
            onClick={onEliminate}
          >
            <Skull className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      ) : (
        (showPayments || canUndoElimination) && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {showPayments && (
              <Button variant="success" onClick={onPay}>
                <CreditCard className="h-4 w-4" /> Pagar
              </Button>
            )}
            {canUndoElimination && (
              <Button variant="secondary" onClick={onUndoElimination}>
                <Undo2 className="h-4 w-4" /> Desfazer eliminação
              </Button>
            )}
          </div>
        )
      )}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Histórico do jogador
      </h3>
      <HistoryList tournamentId={tournamentId} entryId={entry.id} onUndo={onUndo} />
    </Sheet>
  )
}
