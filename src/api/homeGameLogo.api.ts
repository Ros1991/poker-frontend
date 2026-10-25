import apiClient from './client'
import type { HomeGame } from '../types/homeGame.types'

// Logo do clube (SPEC-20261023-1213): aparece no telão e no ranking público no plano Liga.
// Dono ou membro administrador. A logo vai na proporção original (lado maior até 512 px).

export async function uploadLogo(homeGameId: string, logo: Blob): Promise<HomeGame> {
  const formData = new FormData()
  formData.append('file', logo, logo.type === 'image/png' ? 'logo.png' : 'logo.jpg')
  const response = await apiClient.post<HomeGame>(`/HomeGames/${homeGameId}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function removeLogo(homeGameId: string): Promise<HomeGame> {
  const response = await apiClient.delete<HomeGame>(`/HomeGames/${homeGameId}/logo`)
  return response.data
}
