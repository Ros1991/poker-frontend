// Apoio da Administração (SPEC-20261023-1206): rótulos, cores dos chips, chaves do React Query e a descrição de cada
// ação administrativa do audit_logs. Datas no mesmo formato do "Meu perfil".
import type { BadgeColor } from '../../components/ui/Badge'
import type { PlanName } from '../../types/plan.types'
import type {
  AdminUserListItem,
  UserAuditEntry,
  UserRole,
} from '../../types/user.types'

export { formatDay, formatDayTime, formatLastUse } from '../profile/profileFormat'

export const ADMIN_USERS_QUERY_KEY = ['admin-users'] as const
export const adminUserQueryKey = (id: string) => ['admin-user', id] as const

export const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Administrador',
  TournamentDirector: 'Organizador',
  Dealer: 'Dealer',
  Player: 'Jogador',
}

export const ROLE_COLORS: Record<UserRole, BadgeColor> = {
  Admin: 'purple',
  TournamentDirector: 'blue',
  Dealer: 'green',
  Player: 'gray',
}

export const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

export const PLAN_COLORS: Record<PlanName, BadgeColor> = {
  Mesa: 'gray',
  Clube: 'blue',
  Liga: 'gold',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}

export function roleColor(role: string): BadgeColor {
  return ROLE_COLORS[role as UserRole] ?? 'gray'
}

export function planColor(plan: string | null | undefined): BadgeColor {
  return PLAN_COLORS[plan as PlanName] ?? 'gray'
}

/** Situação da conta para o chip: excluída, desativada ou ativa. */
export function accountStatus(user: Pick<AdminUserListItem, 'isActive' | 'isDeleted'>): {
  label: string
  color: BadgeColor
} {
  if (user.isDeleted) return { label: 'Excluída', color: 'gray' }
  return user.isActive ? { label: 'Ativa', color: 'green' } : { label: 'Desativada', color: 'red' }
}

/** Último sinal de vida da conta: o mais recente entre o login e o último uso de uma sessão. */
export function lastAccessOf(user: { lastLoginAt: string | null; lastSeenAt: string | null }): string | null {
  const a = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0
  const b = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0
  if (!a && !b) return null
  return a >= b ? user.lastLoginAt : user.lastSeenAt
}

/** Só os dígitos do WhatsApp para o wa.me (55 + DDD + número; número local ganha o 55). */
export function whatsappDigits(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

const FIELD_LABELS: Record<string, string> = {
  FullName: 'nome',
  Nickname: 'apelido',
  Email: 'e-mail',
  Whatsapp: 'WhatsApp',
  Role: 'papel',
  PhotoUrl: 'foto',
}

const RESET_MODE_LABELS: Record<string, string> = {
  Temporary: 'Senha temporária definida',
  Email: 'E-mail de redefinição de senha enviado',
  Link: 'Link de redefinição de senha gerado (24 h)',
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Frase de uma ação administrativa ("Dados editados: nome, e-mail", "Conta desativada"…). */
export function describeAdminAction(entry: UserAuditEntry): string {
  const nv = entry.newValues ?? {}
  switch (entry.action) {
    case 'UserUpdated': {
      const fields = (entry.changedFields ?? []).map((f) => FIELD_LABELS[f] ?? f)
      const role = str(nv.role)
      const base = fields.length ? `Dados editados: ${fields.join(', ')}` : 'Dados editados'
      return role ? `${base} (papel: ${roleLabel(role)})` : base
    }
    case 'PasswordReset': {
      const mode = str(nv.mode)
      if (mode && RESET_MODE_LABELS[mode]) {
        if (mode === 'Email' && nv.sent === false) return 'Tentativa de enviar e-mail de redefinição (falhou)'
        return RESET_MODE_LABELS[mode]
      }
      return 'Senha redefinida'
    }
    case 'StatusChange':
      return nv.isActive === true ? 'Conta reativada' : 'Conta desativada'
    case 'EmailConfirmed':
      return str(nv.via) === 'admin' ? 'E-mail confirmado manualmente' : 'E-mail confirmado'
    case 'EmailConfirmationResent':
      return 'E-mail de confirmação reenviado'
    case 'AccountDeleted':
      return 'Conta excluída pela própria pessoa'
    default:
      return entry.action
  }
}

/** Data de hoje no formato do <input type="date"> (horário local). */
export function todayInput(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2026-11-30" → ISO do fim daquele dia no horário local (o plano vale o dia inteiro). */
export function endOfDayIso(dateInput: string): string {
  const [y, m, d] = dateInput.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59).toISOString()
}

/** ISO → "2026-11-30" (horário local) para preencher o <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Senha temporária aleatória (10 caracteres sem os que confundem: 0/O, 1/l/I). */
export function generateTemporaryPassword(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => alphabet[v % alphabet.length]).join('')
}

/** GUID do .NET (a rota /users/:id só chama a API com um id válido). */
export function isGuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
