/**
 * Planos Mesa / Clube / Liga (SPEC-20261023-1205) — espelham o contrato HTTP do backend.
 *
 * API estável deste módulo (consumida pelas telas, pela landing e pelas boas-vindas):
 * - `PlanName`, `PlanSource`, `PlanFeature`, `PlanLimitCode` — uniões de string (o backend persiste
 *   e devolve os nomes como texto, igual a `nameof(...)`).
 * - `PlanDefinition` — item do catálogo (`GET public/plans` e `MyPlan.catalog`). É a ÚNICA fonte de
 *   preços e limites no frontend: nenhuma tela digita "R$ 49,90", "até 3" ou "1 por semana".
 * - `MyPlan` — `GET me/plan` (plano, efetivo, vencimento, origem, nota, limites, features, uso, catálogo).
 * - `PlanLimitError` — corpo do HTTP 402 (`PlanLimitException` no backend).
 * - `PlanLimitDetail` — o que o `UpgradeModal` lê: o corpo do 402 ou o que um cadeado manda por
 *   `usePlanGate().open(detail)`. Tem só `code` obrigatório e `homeGameName` (só do frontend, para a
 *   mensagem pronta do WhatsApp).
 * - `PLAN_NAMES`, `PLAN_FEATURES` — listas na ordem do produto (para iterar sem digitar strings).
 */

/** Nome do plano. "Mesa" é o gratuito. */
export type PlanName = 'Mesa' | 'Clube' | 'Liga'

/** Origem do plano atual da conta. */
export type PlanSource = 'Manual' | 'Cortesia' | 'Trial' | 'Assinatura'

/** Recursos exclusivos do pago (enum `PlanFeature` do backend). `ClubLogoOnTv` é só da Liga. */
export type PlanFeature =
  | 'Tables'
  | 'Prizes'
  | 'Payments'
  | 'CostExtras'
  | 'Financial'
  | 'Rankings'
  | 'DealerQr'
  | 'PixCardOnTv'
  | 'ClubLogoOnTv'

/** `code` do 402. */
export type PlanLimitCode =
  | 'feature_locked'
  | 'home_games_limit'
  | 'tournaments_per_week'
  | 'members_limit'

export const PLAN_NAMES: readonly PlanName[] = ['Mesa', 'Clube', 'Liga']

export const PLAN_FEATURES: readonly PlanFeature[] = [
  'Tables',
  'Prizes',
  'Payments',
  'CostExtras',
  'Financial',
  'Rankings',
  'DealerQr',
  'PixCardOnTv',
  'ClubLogoOnTv',
]

/** Item do catálogo (`PlanCatalog` do backend). `null` em limite = ilimitado. */
export interface PlanDefinition {
  name: PlanName
  /** 0 = Mesa, 1 = Clube, 2 = Liga */
  order: number
  priceMonthly: number
  /** Só exibido como "quando a cobrança entrar" */
  priceYearly: number
  maxOwnedHomeGames: number
  /** Membros/admins além do dono; null = ilimitado */
  maxMembersPerHomeGame: number | null
  /** Torneios criados numa janela móvel de 7 dias; null = ilimitado */
  tournamentsPer7Days: number | null
  /** Recursos exclusivos liberados (nomes de `PlanFeature`) */
  features: string[]
  /** Telão e ranking público mostram o selo "Feito com Poker da Galera" */
  showBadge: boolean
  /** Selo "Mais escolhido" (Clube) */
  highlight: boolean
}

export interface PlanLimits {
  maxOwnedHomeGames: number
  maxMembersPerHomeGame: number | null
  tournamentsPer7Days: number | null
}

/** Contador `used / limit`; `limit` null = ilimitado. */
export interface PlanUsageCounter {
  used: number
  limit: number | null
}

export interface PlanTournamentUsage extends PlanUsageCounter {
  /** Quando libera o próximo torneio (ISO), só quando a vaga da semana está ocupada */
  nextAllowedAt: string | null
}

export interface PlanMembersUsage extends PlanUsageCounter {
  homeGameId: string
  name: string
}

export interface PlanUsage {
  /** Home games dos quais a conta é dona */
  homeGames: PlanUsageCounter
  /** Torneios criados nos últimos 7 dias nos home games da conta */
  tournamentsLast7Days: PlanTournamentUsage
  /** Membros além do dono, por home game da conta */
  membersByHomeGame: PlanMembersUsage[]
}

/** `GET api/v1/me/plan` */
export interface MyPlan {
  /** Plano gravado na conta */
  plan: PlanName
  /** O que vale agora: `plan` se `expiresAt` nulo ou futuro, senão Mesa */
  effectivePlan: PlanName
  expiresAt: string | null
  source: PlanSource
  /** Ex.: "fundador" */
  note: string | null
  limits: PlanLimits
  features: string[]
  usage: PlanUsage
  catalog: PlanDefinition[]
}

/** Corpo do HTTP 402 (`PlanLimitException` → ErrorHandlingMiddleware). */
export interface PlanLimitError {
  status: 402
  error: 'PaymentRequired'
  code: PlanLimitCode
  feature: PlanFeature | null
  currentPlan: PlanName
  requiredPlan: PlanName
  usage: number | null
  limit: number | null
  /** ISO; só em `tournaments_per_week` */
  nextAllowedAt: string | null
  /** Pronta para a tela, em pt-BR */
  message: string
  timestamp: string
}

/**
 * O que o `UpgradeModal` recebe: o corpo do 402 (evento `poker:plan-limit`) ou o detalhe que um
 * cadeado manda por `usePlanGate().open(...)`. Campos ausentes são deduzidos (plano exigido pelo
 * catálogo, plano atual pelo `GET me/plan`).
 */
export interface PlanLimitDetail {
  code: PlanLimitCode
  feature?: PlanFeature | null
  currentPlan?: PlanName | null
  requiredPlan?: PlanName | null
  usage?: number | null
  limit?: number | null
  nextAllowedAt?: string | null
  message?: string | null
  /** Só do frontend: nome do home game para a mensagem pronta do WhatsApp do suporte */
  homeGameName?: string | null
}
