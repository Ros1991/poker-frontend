import publicClient from './publicClient'
import type { PublicRanking } from '../types/publicRanking.types'

export async function getBySlug(slug: string): Promise<PublicRanking> {
  const response = await publicClient.get<PublicRanking>(
    `/public/rankings/${encodeURIComponent(slug)}`,
  )
  return response.data
}
