import { Phone, Mail } from 'lucide-react'
import type { Person } from '../../types/person.types'
import { Avatar } from '../ui/Avatar'
import { cn } from '../../utils/cn'

function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

interface PlayerStats {
  totalTournaments?: number
  bestPosition?: number
  totalWon?: number
}

interface PlayerCardProps {
  person: Person
  onClick?: () => void
  showStats?: boolean
  stats?: PlayerStats
  className?: string
}

export function PlayerCard({
  person,
  onClick,
  showStats = false,
  stats,
  className,
}: PlayerCardProps) {
  const displayName = person.nickname || person.fullName

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-5',
        'transition-all duration-200',
        onClick &&
          'cursor-pointer hover:border-border-focus hover:bg-bg-tertiary/50 hover:shadow-lg hover:shadow-black/10',
        className,
      )}
    >
      <Avatar src={person.photoUrl} name={displayName} size="xl" />

      <div className="flex flex-col items-center gap-0.5 text-center">
        <h3 className="font-semibold text-text-primary leading-tight">
          {displayName}
        </h3>
        {person.nickname && person.fullName && person.nickname !== person.fullName && (
          <span className="text-sm text-text-muted">
            {person.fullName}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5 text-xs text-text-muted">
        {person.whatsapp && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{displayPhone(person.whatsapp)}</span>
          </div>
        )}
        {person.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{person.email}</span>
          </div>
        )}
      </div>

      {showStats && stats && (
        <div className="mt-1 flex w-full justify-around border-t border-border-default pt-3 text-center">
          <div>
            <p className="text-lg font-bold text-text-primary">
              {stats.totalTournaments ?? 0}
            </p>
            <p className="text-xs text-text-muted">Torneios</p>
          </div>
          <div>
            <p className="text-lg font-bold text-text-primary">
              {stats.bestPosition != null ? `${stats.bestPosition}º` : '-'}
            </p>
            <p className="text-xs text-text-muted">Melhor</p>
          </div>
          <div>
            <p className="text-lg font-bold text-accent-green">
              {stats.totalWon != null
                ? `R$ ${stats.totalWon.toLocaleString('pt-BR')}`
                : '-'}
            </p>
            <p className="text-xs text-text-muted">Ganhos</p>
          </div>
        </div>
      )}
    </div>
  )
}
