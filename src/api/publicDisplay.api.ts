import publicClient from './publicClient'
import type {
  DisplaySessionCreated,
  DisplaySessionStatus,
  TvSnapshot,
} from '../types/display.types'

// Telão sem login: a TV se identifica pelo token do aparelho (X-Display-Token)

const withDevice = (deviceToken: string) => ({
  headers: { 'X-Display-Token': deviceToken },
})

export async function createSession(): Promise<DisplaySessionCreated> {
  const response = await publicClient.post<DisplaySessionCreated>('/public/display/sessions')
  return response.data
}

export async function getStatus(deviceToken: string): Promise<DisplaySessionStatus> {
  const response = await publicClient.get<DisplaySessionStatus>(
    '/public/display/session',
    withDevice(deviceToken),
  )
  return response.data
}

export async function leave(deviceToken: string): Promise<DisplaySessionStatus> {
  const response = await publicClient.post<DisplaySessionStatus>(
    '/public/display/session/leave',
    null,
    withDevice(deviceToken),
  )
  return response.data
}

export async function getSnapshot(deviceToken: string): Promise<TvSnapshot> {
  const response = await publicClient.get<TvSnapshot>(
    '/public/display/session/snapshot',
    withDevice(deviceToken),
  )
  return response.data
}
