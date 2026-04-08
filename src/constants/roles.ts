export const USER_ROLES = {
  ADMIN: 'Admin',
  ORGANIZADOR: 'Organizador',
  DEALER: 'Dealer',
  JOGADOR: 'Jogador',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Administrador',
  Organizador: 'Organizador',
  Dealer: 'Dealer',
  Jogador: 'Jogador',
}
