export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  fullName: string
  nickname?: string
  email: string
  password: string
  whatsapp?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'
  photoUrl: string | null
}
