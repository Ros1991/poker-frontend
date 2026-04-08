export type UserRole = 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'

export interface User {
  id: string
  personId: string
  personName: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface CreateUserRequest {
  personId: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserRequest {
  email?: string
  password?: string
  role?: UserRole
  isActive?: boolean
}
