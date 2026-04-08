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
  defaultAddonDoubleAllowed?: boolean
  defaultLateRegistrationLevel?: number | null
  defaultRebuyUntilLevel?: number | null
  defaultSeatsPerTable?: number | null
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
}
