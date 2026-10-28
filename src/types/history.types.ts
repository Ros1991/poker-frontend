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
  /** Mesa aberta pela inscrição (e quem mudou para ela) — SPEC-20261023-1214 */
  | 'TableOpened'
  /** Mesa sem ninguém sentado excluída pelo organizador (dealer dela liberado) — SPEC-20261027-2133 */
  | 'TableDeleted'

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
  /**
   * Aviso para quem pode desfazer mesmo assim (SPEC-20261023-1217, L4): o organizador (token de usuário) desfaz rebuy,
   * add-on e inscrição com o torneio encerrado/cancelado ou prêmio pago; a confirmação mostra o aviso antes da pergunta.
   * Para o dealer vem sempre null (lá o item continua bloqueado, com `undoBlockedReason`).
   */
  undoWarning: string | null
  /** Só na eliminação: posição em que saiu (null fora dela) */
  position?: number | null
  /** Só na eliminação: quem eliminou (apelido, senão nome; null se não informado) */
  eliminatedByName?: string | null
}
