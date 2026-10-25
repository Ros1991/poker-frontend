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
  document?: string
  notes?: string
}

// Foto: só por POST /Persons/{id}/photo (o servidor ignora photoUrl no cadastro — SPEC-20261023-1213).
// No PUT, campo ausente/undefined não muda nada e "" limpa (apelido, e-mail, WhatsApp, notas).

export interface UpdatePersonRequest extends Partial<Omit<CreatePersonRequest, 'homeGameId'>> {
  isActive?: boolean
}
