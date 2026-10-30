import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import type { HistoryItem } from '../../types/history.types'
import type { Tournament } from '../../types/tournament.types'
import type { PlayerActionRules } from './PlayerCard'
import { PlayerDetails } from './PlayerDetails'
import type { PlayerDetailsProps } from './PlayerDetails'
import { Sheet } from './Sheet'

interface PlayerSheetProps {
  entry: TournamentEntry | null
  tables: Table[] | undefined
  tournamentId: string
  /** Torneio (composição do total) */
  tournament?: Tournament
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
  /** Inscrições do torneio: a Ficha diz quem este jogador eliminou (SPEC-20261026-1908) */
  entries?: TournamentEntry[]
  /** Timebank ligado no torneio (SPEC-20261029-1722): quantos o jogador tem e o −1/+1 na Ficha (SPEC-20261030-1018) */
  timebank?: PlayerDetailsProps['timebank']
}

/**
 * Ficha do jogador no terminal: o `Sheet` em tela cheia com o conteúdo compartilhado com o painel
 * (`PlayerDetails` — SPEC-20261023-1217): situação, ações e o histórico só dele.
 */
export function PlayerSheet({ entry, onClose, showPayments = true, showTables = true, ...rest }: PlayerSheetProps) {
  if (!entry) return null
  return (
    <Sheet isOpen onClose={onClose} title="Ficha do jogador" elevated>
      <PlayerDetails
        entry={entry}
        showPayment={showPayments}
        showTables={showTables}
        historyPaymentsLocked={!showPayments}
        {...rest}
      />
    </Sheet>
  )
}
