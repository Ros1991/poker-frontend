import apiClient from './client'
import type { TimerState } from '../types/blind.types'

export interface DisplayData {
  tournament: {
    id: string
    name: string
    homeGameName: string
    status: string
    totalEntries: number
    playersRemaining: number
    totalRebuys: number
    totalAddons: number
    totalPrizePool: number
    averageStack: number
  }
  timer: TimerState
  entries: {
    personName: string
    personPhotoUrl: string | null
    status: string
    chipCount: number | null
    finalPosition: number | null
  }[]
  blindStructure: {
    currentLevel: number
    levels: {
      level: number
      smallBlind: number
      bigBlind: number
      ante: number
      durationMinutes: number
      isBreak: boolean
    }[]
  } | null
}

export async function getData(tournamentId: string): Promise<DisplayData> {
  const response = await apiClient.get<DisplayData>(
    `/Display/${tournamentId}`,
  )
  return response.data
}
