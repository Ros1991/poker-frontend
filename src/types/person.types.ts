export interface Person {
  id: string
  homeGameId: string
  type: 'Jogador' | 'Dealer'
  fullName: string
  nickname: string | null
  email: string | null
  whatsapp: string | null
  /** Foto EXIBIDA: a da conta vinculada, se ela tiver; senão a do cadastro (resolvida no servidor — SPEC-20261029-1725) */
  photoUrl: string | null
  /** Foto do cadastro neste home game (a que o formulário troca/remove; vale quando a conta não tem foto) */
  ownPhotoUrl?: string | null
  /** A foto exibida vem da conta vinculada */
  photoFromAccount?: boolean
  /** Conta vinculada pelo e-mail confirmado ou pelo "vincular membro ↔ jogador" (vazio para o dealer por QR) */
  linkedUserId?: string | null
  linkedUserName?: string | null
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

/** "Já conhecemos este jogador" (GET Persons/lookup-email): a conta confirmada com o e-mail digitado no cadastro */
export interface AccountLookup {
  found: boolean
  fullName: string | null
  nickname: string | null
  photoUrl: string | null
}
