export type UserRole = 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  photoUrl: string | null
}

export interface CreateUserRequest {
  fullName: string
  nickname?: string
  email: string
  whatsapp?: string
  password: string
  role: UserRole
}

export interface UpdateUserRequest {
  fullName?: string
  nickname?: string
  email?: string
  whatsapp?: string
  password?: string
  role?: UserRole
  isActive?: boolean
}
