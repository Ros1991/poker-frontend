import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CreditCard, PlusCircle, RefreshCw, Skull, Undo2 } from 'lucide-react'
import * as tournamentPlayersApi from '../../api/tournamentPlayers.api'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { EditablePhotoAvatar } from '../photo/EditablePhotoAvatar'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import type { HistoryItem } from '../../types/history.types'
import type { Tournament } from '../../types/tournament.types'
import { HistoryList } from './HistoryList'
import { DueLabel } from './PlayerCard'
import type { PlayerActionRules } from './PlayerCard'
import {
  eliminatedByEntry,
  entryTotalBreakdown,
  formatCurrency,
  isActiveStatus,
  joinNames,
  playerName,
  seatLabel,
  statusLabel,
} from './terminalFormat'

export interface PlayerDetailsProps {
  entry: TournamentEntry
  tables: Table[] | undefined
  tournamentId: string
  /** Torneio (composição do total: staff/ranking por jogador) */
  tournament?: Tournament
  rules: PlayerActionRules
  onRebuy: () => void
  onAddon: () => void
  onPay: () => void
  onEliminate: () => void
  onMove: () => void
  onUndoElimination: () => void
  onUndo: (item: HistoryItem) => Promise<void>
  /** Plano do dono com Payments: "Pagar", "Total", "Pagou", "Deve/Pago" e a composição do total (SPEC-20261023-1205, D3) */
  showPayment?: boolean
  /** Plano do dono com Tables: "Mesa" e "Mover" */
  showTables?: boolean
  /** Caixa fechado (settlementClosed, L16): sem Rebuy, Add-on e Eliminar; Pagar segue */
  gameActionsLocked?: boolean
  /** O que só o organizador tem (painel): Editar jogador, WhatsApp, Excluir inscrição */
  organizerActions?: ReactNode
  /** Plano do dono sem Payments: pagamentos do histórico sem "Desfazer" (L11) */
  historyPaymentsLocked?: boolean
  /** Presente = a foto também pode ser removida (só o organizador; o dealer nunca remove) */
  removePhoto?: () => Promise<unknown>
  /** Chaves a mais para invalidar depois de trocar a foto (ex.: pessoas do home game, no painel) */
  onPhotoChanged?: () => void
  /** Inscrições do torneio: dizem QUEM este jogador eliminou (sem elas a Ficha mostra só quantos) */
  entries?: TournamentEntry[]
}

function Info({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border-default bg-bg-card p-2.5', className)}>
      <p className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

/**
 * Conteúdo da Ficha do jogador (SPEC-20261023-1217, L1/L8): foto (tocar troca — SPEC-20261023-1213), situação,
 * rebuys, add-on, total, pagou, "Deve", botões de ação e o histórico só dele. O terminal mostra num `Sheet`
 * (PlayerSheet); o painel, num `Modal`, com as ações do organizador por baixo.
 */
export function PlayerDetails({
  entry,
  tables,
  tournamentId,
  tournament,
  rules,
  onRebuy,
  onAddon,
  onPay,
  onEliminate,
  onMove,
  onUndoElimination,
  onUndo,
  showPayment = true,
  showTables = true,
  gameActionsLocked = false,
  organizerActions,
  historyPaymentsLocked = false,
  removePhoto,
  onPhotoChanged,
  entries,
}: PlayerDetailsProps) {
  const queryClient = useQueryClient()
  const active = isActiveStatus(entry.status)
  // Quantas pessoas eliminou (SPEC-20261026-1908): o número vem do servidor; os nomes, das inscrições (se vieram)
  const eliminations = entry.eliminationsCount ?? 0
  const victims = entries ? eliminatedByEntry(entry, entries).map(playerName) : []
  // Campeão (nunca eliminado, eliminatedAt nulo) não tem eliminação a desfazer
  const canUndoElimination = !active && !!entry.eliminatedAt
  const playActions = active && !gameActionsLocked

  return (
    <div data-player-details>
      <div className="mb-3 flex items-center gap-3">
        {/* Tocar no avatar troca a foto (SPEC-20261023-1213, F20) — dealer e organizador; remover só no painel */}
        <EditablePhotoAvatar
          src={entry.person.photoUrl}
          name={playerName(entry)}
          size="xl"
          upload={(blob) => tournamentPlayersApi.uploadPhoto(tournamentId, entry.personId, blob)}
          remove={removePhoto}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
            void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
            // Sem Tables no plano a consulta de mesas nem existe (daria 402)
            if (showTables) void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
            onPhotoChanged?.()
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
        {showPayment && <Info label="Total" value={formatCurrency(entry.totalDue)} />}
        {showPayment && <Info label="Pagou" value={formatCurrency(entry.totalPaid)} />}
        {/* Com a Mesa a contagem fica ímpar: Eliminações ocupa a última linha inteira */}
        <Info label="Eliminações" value={eliminations} className={showTables ? 'col-span-2' : undefined} />
      </div>
      {eliminations > 0 && victims.length > 0 && (
        <p className="mb-3 text-sm text-text-secondary" data-eliminated-names>
          Eliminou <span className="font-medium text-text-primary">{joinNames(victims)}</span>
        </p>
      )}
      {showPayment && (
        <>
          <p className="mb-1 text-center text-base">
            <DueLabel entry={entry} />
          </p>
          <p className="mb-3 text-center text-xs tabular-nums text-text-secondary" data-total-breakdown>
            {entryTotalBreakdown(entry, tournament)}
          </p>
        </>
      )}

      {playActions ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onRebuy} disabled={!rules.canRebuy}>
            <RefreshCw className="h-4 w-4" /> Rebuy
          </Button>
          <Button variant="secondary" onClick={onAddon} disabled={!rules.canAddon}>
            <PlusCircle className="h-4 w-4" /> Add-on
          </Button>
          {showPayment && (
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
            className={showPayment === showTables ? 'col-span-2' : undefined}
            onClick={onEliminate}
          >
            <Skull className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      ) : active ? (
        // Caixa fechado: quem ainda joga só paga (e muda de lugar, com mesas)
        (showPayment || showTables) && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {showPayment && (
              <Button variant="success" onClick={onPay} className={showTables ? undefined : 'col-span-2'}>
                <CreditCard className="h-4 w-4" /> Pagar
              </Button>
            )}
            {showTables && (
              <Button variant="secondary" onClick={onMove} className={showPayment ? undefined : 'col-span-2'}>
                <ArrowRightLeft className="h-4 w-4" /> Mover
              </Button>
            )}
          </div>
        )
      ) : (
        (showPayment || canUndoElimination) && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {showPayment && (
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

      {organizerActions && <div className="mb-4">{organizerActions}</div>}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Histórico do jogador
      </h3>
      <HistoryList
        tournamentId={tournamentId}
        entryId={entry.id}
        onUndo={onUndo}
        paymentsLocked={historyPaymentsLocked}
      />
    </div>
  )
}
