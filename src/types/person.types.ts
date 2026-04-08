export interface Person {
  id: string
  homeGameId: string
  type: 'Jogador' | 'Dealer'
  fullName: string
  nickname: string | null
  email: string | null
  whatsapp: string | null
  photoUrl: string | null
  document: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
}

export interface CreatePersonRequest {
  homeGameId: string
  type: 'Jogador' | 'Dealer'
  fullName: string
  nickname?: string
  email?: string
  whatsapp?: string
  photoUrl?: string
  document?: string
  notes?: string
}

export interface UpdatePersonRequest extends Partial<Omit<CreatePersonRequest, 'homeGameId'>> {
  isActive?: boolean
}
