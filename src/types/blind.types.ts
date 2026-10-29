import type { PixKeyType } from '../utils/pix'
import type { KnockoutType } from '../utils/knockout'

/**
 * Custo padrão de valor fixo por torneio guardado na estrutura (SPEC-20261023-1215): todo torneio criado com a
 * estrutura já nasce com ele na aba Custos (CostType "Default"). Ex.: Churrasqueiro — R$ 330.
 */
export interface BlindStructureDefaultCost {
  id?: string
  description: string
  amount: number
  /** "Para quem" (opcional) */
  beneficiary?: string | null
  pixKey?: string | null
  /** Na resposta: tipo da chave gravada (derivado pela API); no pedido: o tipo escolhido na tela (null = detectar) */
  pixKeyType?: PixKeyType | null
  sortOrder?: number
}

export interface BlindStructure {
  id: string
  name: string
  description?: string | null
  homeGameId?: string | null
  levelCount?: number
  levels: BlindLevel[]
  createdAt?: string
  // Template defaults
  defaultBuyIn?: number | null
  defaultRebuy?: number | null
  defaultAddon?: number | null
  defaultStartingStack?: number | null
  defaultRebuyStack?: number | null
  defaultAddonStack?: number | null
  defaultMaxRebuys?: number | null
  defaultAddonAllowed?: boolean
  /** Máximo de add-ons padrão (SPEC-20261027-1311): 0 = ilimitado, padrão 1 */
  defaultMaxAddons?: number
  defaultLateRegistrationLevel?: number | null
  defaultRebuyUntilLevel?: number | null
  defaultSeatsPerTable?: number | null
  defaultStaffAmount?: number | null
  defaultRankingContribMode?: string | null
  defaultRankingContribValue?: number | null
  /**
   * Custos padrão (SPEC-20261023-1215). No PUT: ausente = manter a lista atual; lista (inclusive vazia) =
   * substituir. O formulário do Mesa omite o campo (e os dois de dealer) para não apagar nada.
   */
  defaultCosts?: BlindStructureDefaultCost[]
  /** "Este torneio tem dealer pago": a criação do torneio pergunta quantos dealers */
  defaultHasDealer?: boolean
  /** Valor POR DEALER, por torneio (obrigatório quando defaultHasDealer) */
  defaultDealerFee?: number | null
  /**
   * Knockout padrão (SPEC-20261026-1909): o torneio criado com a estrutura herda formato e bounty (e pode trocar).
   * No PUT, ausente = manter.
   */
  defaultKnockoutType?: KnockoutType
  defaultBountyAmount?: number | null
  /**
   * Timebank padrão (SPEC-20261029-1722): null = sem timebank; 1 a 99 por jogador. No pedido, 0 desliga e ausente mantém
   * (PUT). O torneio criado com a estrutura herda.
   */
  defaultTimebankCount?: number | null
  /** Segundos de cada timebank padrão (5 a 300) */
  defaultTimebankSeconds?: number | null
}

export interface BlindLevel {
  id?: string
  levelNumber: number
  smallBlind: number
  bigBlind: number
  ante: number
  bigBlindAnte?: number
  durationMinutes: number
  isBreak: boolean
  breakDescription?: string | null
}

export interface TimerState {
  currentLevel: number
  smallBlind: number
  bigBlind: number
  ante: number
  remainingSeconds: number
  totalSeconds: number
  isRunning: boolean
  isPaused: boolean
  nextSmallBlind: number | null
  nextBigBlind: number | null
  nextAnte: number | null
  isBreak: boolean
  /**
   * Não existe nível depois do atual (SPEC-20261029-1720, `TimerStateResponse.IsLastLevel`): "Próximo" desligado e,
   * com o tempo zerado, o relógio travado em 00:00 com o selo "Último nível"
   */
  isLastLevel: boolean
}
