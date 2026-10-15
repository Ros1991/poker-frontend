// Espelha PublicRankingResponse do backend (GET /public/rankings/{slug}).
// Só dados públicos: nada de contato, documento ou valores por jogador.

// Etapa identificada pela ordem cronológica (1..N), não pelo id do torneio
export interface PublicRankingStage {
  number: number
  name: string
  date: string
  playerCount: number
}

export interface PublicRankingResult {
  stage: number // PublicRankingStage.number
  position: number
  points: number
  counted: boolean
}

export interface PublicRankingPlayer {
  position: number
  personId: string
  displayName: string
  photoUrl: string | null
  totalPoints: number
  tournamentsPlayed: number
  bestPosition: number | null
  discardedPoints: number
  averagePoints: number
  results: PublicRankingResult[]
}

export interface PublicRanking {
  slug: string
  name: string
  season: string | null
  homeGameName: string
  accumulatedPrize: number
  discardCount: number
  totalStages: number
  countedSlots: number
  pointsDependOnFieldSize: boolean // false: ranking por tabela (só a posição importa)
  stages: PublicRankingStage[]
  leaderboard: PublicRankingPlayer[]
  generatedAt: string
}
