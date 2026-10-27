import type { ReactNode } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { cn } from '../../utils/cn'
import type { Person } from '../../types/person.types'

/** O que a confirmação precisa da pessoa: o nome (apelido e completo) e a foto */
export type ConfirmPerson = Pick<Person, 'fullName' | 'nickname' | 'photoUrl'>

interface PlayerConfirmHeaderProps {
  person: ConfirmPerson
  /** Linha menor por baixo do nome (ex.: "Hoje: Mesa 1, lugar 3") */
  detail?: ReactNode
  className?: string
}

const shownName = (p: ConfirmPerson) => p.nickname?.trim() || p.fullName

/**
 * Topo das confirmações de ação sobre um jogador (SPEC-20261026-2103): foto redonda (iniciais quando não tem foto) e o
 * nome em destaque, para o dealer conferir que é a pessoa mesmo antes de confirmar — rebuy, add-on, eliminação (normal e
 * knockout), desfazer, mover/trocar, remover da mesa, excluir inscrição e pagamento, no painel e no terminal. O nome em
 * destaque é o do card (apelido, senão o nome completo); o completo vem por baixo quando é diferente. Só `div` aqui
 * dentro: o primeiro `<p>` do corpo continua sendo a frase da confirmação.
 */
export function PlayerConfirmHeader({ person, detail, className }: PlayerConfirmHeaderProps) {
  const name = shownName(person)
  const full = person.fullName.trim()
  return (
    <div
      className={cn('mb-4 flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3', className)}
      data-confirm-player
    >
      <Avatar src={person.photoUrl} name={person.fullName} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="break-words text-xl font-bold leading-tight text-text-primary" data-confirm-player-name>
          {name}
        </div>
        {full && full !== name && (
          <div className="mt-0.5 break-words text-sm text-text-secondary" data-confirm-player-fullname>
            {full}
          </div>
        )}
        {detail && (
          <div className="mt-1 text-sm text-text-secondary" data-confirm-player-detail>
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

interface PlayerPairHeaderProps {
  first: ConfirmPerson
  second: ConfirmPerson
  className?: string
}

/** Trocar dois jogadores de lugar: as duas fotos redondas com os nomes, lado a lado, e a seta de troca no meio */
export function PlayerPairHeader({ first, second, className }: PlayerPairHeaderProps) {
  return (
    <div
      className={cn('mb-4 flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary p-3', className)}
      data-confirm-players
    >
      <PairItem person={first} />
      <ArrowLeftRight className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
      <PairItem person={second} />
    </div>
  )
}

function PairItem({ person }: { person: ConfirmPerson }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" data-confirm-player>
      <Avatar src={person.photoUrl} name={person.fullName} size="xl" />
      <div className="w-full break-words text-base font-bold leading-tight text-text-primary" data-confirm-player-name>
        {shownName(person)}
      </div>
    </div>
  )
}
