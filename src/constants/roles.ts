export const USER_ROLES = {
  ADMIN: 'Admin',
  TOURNAMENT_DIRECTOR: 'TournamentDirector',
  DEALER: 'Dealer',
  PLAYER: 'Player',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Administrador',
  TournamentDirector: 'Organizador',
  Dealer: 'Dealer',
  Player: 'Jogador',
}
