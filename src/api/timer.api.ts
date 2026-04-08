import apiClient from './client'
import type { TimerState } from '../types/blind.types'

export async function getState(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.get<TimerState>(
    `/tournaments/${tournamentId}/timer`,
  )
  return response.data
}

export async function start(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.post<TimerState>(
    `/tournaments/${tournamentId}/timer/start`,
  )
  return response.data
}

export async function pause(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.post<TimerState>(
    `/tournaments/${tournamentId}/timer/pause`,
  )
  return response.data
}

export async function resume(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.post<TimerState>(
    `/tournaments/${tournamentId}/timer/resume`,
  )
  return response.data
}

export async function nextLevel(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.post<TimerState>(
    `/tournaments/${tournamentId}/timer/next`,
  )
  return response.data
}

export async function previousLevel(tournamentId: string): Promise<TimerState> {
  const response = await apiClient.post<TimerState>(
    `/tournaments/${tournamentId}/timer/previous`,
  )
  return response.data
}
