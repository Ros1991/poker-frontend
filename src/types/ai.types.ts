// IA na administração (SPEC-20261027-1312). Espelha os DTOs de api/v1/admin/ai e api/v1/ai. A chave da API nunca vem
// do servidor: só a dica "sk-ant-…ABCD".

/** Chave do recurso "Tirar o fundo da foto" (roda no aparelho, sem custo) */
export const BACKGROUND_REMOVAL_FEATURE = 'tirar-o-fundo'

export interface AiKeyInfo {
  configured: boolean
  /** "sk-ant-…ABCD" (4 últimos); null sem chave */
  hint: string | null
  updatedAt: string | null
  updatedByName: string | null
  /** A chave existe mas não decifra com a AI_SECRETS_KEY atual */
  unreadable: boolean
}

export interface AiKeyTestInfo {
  at: string
  ok: boolean
  message: string
  model: string | null
}

export interface AiMonth {
  start: string
  spentUsd: number
  limitUsd: number
  /** Gasto / limite × 100 (null com limite 0) */
  percent: number | null
  /** Gasto em 80 % do limite ou mais */
  warning: boolean
  /** Chamadas pagas recusadas agora (limite 0 ou atingido) */
  blocked: boolean
}

export interface AiFeature {
  key: string
  name: string
  description: string
  isPaid: boolean
  runsOnDevice: boolean
  enabled: boolean
  /** Usos (no aparelho) ou chamadas (pagos) no mês */
  monthUses: number
}

export interface AiModelPrice {
  model: string
  displayName: string
  inputPerMTok: number
  outputPerMTok: number
  cacheWritePerMTok: number
  cacheReadPerMTok: number
  longContextThresholdTokens: number | null
  longInputPerMTok: number | null
  longOutputPerMTok: number | null
  longCacheWritePerMTok: number | null
  longCacheReadPerMTok: number | null
  isDefault: boolean
}

export interface AiUsageSummary {
  key: string
  name: string
  calls: number
  errors: number
  refused: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  costUsd: number
}

export type AiUsageOutcome = 'Success' | 'Error' | 'Refused'

export interface AiUsageItem {
  id: string
  at: string
  actorName: string | null
  homeGameName: string | null
  featureKey: string
  featureName: string
  model: string | null
  modelName: string | null
  onDevice: boolean
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  costUsd: number
  outcome: AiUsageOutcome
  errorCode: string | null
  errorMessage: string | null
  durationMs: number | null
}

export interface AiOverview {
  enabled: boolean
  defaultModel: string
  monthlyLimitUsd: number
  /** AI_SECRETS_KEY presente: sem ela não dá para salvar a chave */
  secretsKeyConfigured: boolean
  key: AiKeyInfo
  lastTest: AiKeyTestInfo | null
  month: AiMonth
  features: AiFeature[]
  prices: AiModelPrice[]
  usageByFeature: AiUsageSummary[]
  usageByModel: AiUsageSummary[]
  recentCalls: AiUsageItem[]
}

export interface UpdateAiSettingsRequest {
  enabled: boolean
  defaultModel: string
  monthlyLimitUsd: number
}

export interface UpdateAiPriceRequest {
  inputPerMTok: number
  outputPerMTok: number
  cacheWritePerMTok: number
  cacheReadPerMTok: number
  longInputPerMTok?: number | null
  longOutputPerMTok?: number | null
  longCacheWritePerMTok?: number | null
  longCacheReadPerMTok?: number | null
}

export interface AiKeyTestResult {
  ok: boolean
  code: string
  message: string
  model: string
}

export interface AiAvailableFeatures {
  features: string[]
}
