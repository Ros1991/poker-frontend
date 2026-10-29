import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Gamepad2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as personsApi from '../../../api/persons.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { EditablePhotoAvatar } from '../../../components/photo/EditablePhotoAvatar'
import { PlayerFormDialog } from '../../../components/players/PlayerFormDialog'
import { displayPhone } from '../../../utils/phone'
import type { Person } from '../../../types/person.types'
import { EmptyState, SectionSpinner } from './EmptyState'
import { useHomeGameShell } from './homeGameShell'

/**
 * Seção Jogadores (era a aba Jogadores; SPEC-20261029-1724). Todas as pessoas: quem foi cadastrado como Dealer aparece
 * com o selo "Dealer" e também joga (SPEC-20261023-1216, DL3). "Novo jogador" e "Editar" abrem o PlayerFormDialog; tocar
 * no avatar troca/remove a foto (SPEC-20261023-1213).
 */
export function PlayersSection() {
  const { homeGame, canManage } = useHomeGameShell()
  const homeGameId = homeGame.id
  const queryClient = useQueryClient()
  // null = fechado; 'new' = cadastro; Person = edição
  const [dialog, setDialog] = useState<Person | 'new' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['persons', homeGameId],
    queryFn: () => personsApi.getByHomeGame(homeGameId),
  })
  const persons = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personsApi.remove(id),
    onSuccess: () => {
      toast.success('Jogador removido com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['persons', homeGameId] })
    },
    onError: () => {
      toast.error('Erro ao remover jogador.')
    },
  })

  const refreshPersons = () => void queryClient.invalidateQueries({ queryKey: ['persons', homeGameId] })

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialog('new')}>
            <Plus className="h-4 w-4" />
            Novo jogador
          </Button>
        </div>
      )}

      {isLoading && <SectionSpinner />}

      {!isLoading && persons.length === 0 && (
        <EmptyState
          icon={Gamepad2}
          title="Nenhum jogador cadastrado"
          description="Cadastre os jogadores para inscrevê-los nos torneios."
        />
      )}

      {!isLoading && persons.length > 0 && (
        <div className="space-y-2">
          {persons.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3">
              <EditablePhotoAvatar
                src={p.photoUrl}
                name={p.nickname || p.fullName}
                size="md"
                canEdit={canManage}
                upload={(blob) => personsApi.uploadPhoto(p.id, blob)}
                remove={() => personsApi.removePhoto(p.id)}
                onDone={refreshPersons}
              />
              <div className="flex-1 min-w-0">
                <p className="flex min-w-0 items-center gap-2">
                  <span className="font-medium text-text-primary truncate">{p.nickname || p.fullName}</span>
                  {p.type === 'Dealer' && <Badge color="gray">Dealer</Badge>}
                </p>
                {p.nickname && p.fullName && p.nickname !== p.fullName && (
                  <p className="text-xs text-text-secondary">{p.fullName}</p>
                )}
              </div>
              {p.whatsapp && (
                <span className="text-xs text-text-secondary hidden sm:block">{displayPhone(p.whatsapp)}</span>
              )}
              {canManage && (
                <button
                  onClick={() => setDialog(p)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft transition-colors"
                  title="Editar jogador"
                  aria-label={`Editar ${p.nickname || p.fullName}`}
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                  title="Remover jogador"
                  aria-label={`Remover ${p.nickname || p.fullName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <PlayerFormDialog
        isOpen={dialog !== null}
        onClose={() => setDialog(null)}
        homeGameId={homeGameId}
        person={dialog === 'new' ? null : dialog}
        existing={persons}
      />
    </div>
  )
}
