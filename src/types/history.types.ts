// Histórico do torneio no terminal (espelha HistoryItemResponse do backend)

export type HistoryKind =
  | 'BuyIn'
  | 'Rebuy'
  | 'Addon'
  | 'Payment'
  | 'Settlement'
  | 'PrizePayment'
  | 'Elimination'
  | 'Activity'

export type HistoryActivityType =
  | 'TablesDrawn'
  | 'PlayerMoved'
  | 'PlayersSwapped'
  | 'PlayerSeated'
  | 'TableBroken'
  | 'PlayerRemoved'
  /** Jogador novo cadastrado pelo torneio (painel ou terminal) — SPEC-20261023-1213 */
  | 'PlayerCreated'
  /** Foto do jogador posta/trocada pelo torneio — SPEC-20261023-1213 */
  | 'PlayerPhotoChanged'

export interface HistoryItem {
  /** "{kind}:{refId}" — único na lista */
  id: string
  kind: HistoryKind
  activityType: HistoryActivityType | null
  /** Id da transação / eliminação / atividade */
  refId: string
  entryId: string | null
  playerName: string | null
  /** Texto pronto em pt-BR */
  description: string
  amount: number | null
  at: string
  /** "Dealer", nome do organizador ou null */
  by: string | null
  undone: boolean
  undoneAt: string | null
  undoneBy: string | null
  canUndo: boolean
  undoBlockedReason: string | null
}
