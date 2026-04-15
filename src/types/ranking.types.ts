export interface Ranking {
  id: string
  homeGameId: string
  name: string
  description: string | null
  season: string | null
  isActive: boolean
  scoringMode: 'Formula' | 'Table'
  scoringFormula: string | null
  scoringTable: string | null // JSON: [{"position":1,"points":100},...]
  accumulatedPrize: number
  discardCount: number
  createdAt: string
}

export interface ScoringTableRow {
  position: number
  points: number
}

export interface RankingLeaderboardEntry {
  position: number
  person: {
    id: string
    fullName: string
    nickname: string | null
    photoUrl: string | null
    isActive: boolean
  }
  totalPoints: number
  tournamentsPlayed: number
  bestPosition: number
  discardedPoints: number
  averagePoints: number
}

export interface CreateRankingRequest {
  name: string
  description?: string
  scoringMode: 'Formula' | 'Table'
  scoringFormula?: string
  scoringTable?: string // JSON string
  accumulatedPrize?: number
  discardCount?: number
}
