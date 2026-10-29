import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import * as homeGamesApi from '../../../api/homeGames.api'
import * as personsApi from '../../../api/persons.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Avatar } from '../../../components/ui/Avatar'
import { MY_PLAN_QUERY_KEY } from '../../../hooks/usePlan'
import { useHomeGame } from '../../../hooks/useHomeGame'
import type { HomeGameMember } from '../../../types/homeGame.types'
import { AddMemberModal } from '../AddMemberModal'
import { EmptyState, SectionSpinner } from './EmptyState'
import { useHomeGameShell } from './homeGameShell'

/**
 * Seção Membros (era a aba Membros; SPEC-20261029-1724): quem ajuda a organizar. O menu só mostra a seção para quem
 * gerencia (dono, membro administrador, Admin do sistema); edição inline (administrador + vincular a jogador) e remoção
 * com confirmação (hard delete).
 */
export function MembersSection() {
  const { homeGame, canManage } = useHomeGameShell()
  const homeGameId = homeGame.id
  const queryClient = useQueryClient()
  const { refreshHomeGames } = useHomeGame()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editPersonId, setEditPersonId] = useState<string | null>(null)

  const { data: members, isLoading } = useQuery({
    queryKey: ['homeGameMembers', homeGameId],
    queryFn: () => homeGamesApi.getMembers(homeGameId),
  })
  const list = members ?? []

  // Pessoas disponíveis para vincular (só ao editar)
  const { data: allPersons } = useQuery({
    queryKey: ['persons', homeGameId],
    queryFn: () => personsApi.getByHomeGame(homeGameId),
    enabled: editingId !== null,
  })
  const linkedPersonIds = new Set(list.filter((m) => m.personId && m.id !== editingId).map((m) => m.personId!))
  const availablePersons = (allPersons ?? []).filter((p) => !linkedPersonIds.has(p.id))

  // Contagem de membros (menu e Configurações) e uso do plano mudam junto
  const membersChanged = () => {
    void queryClient.invalidateQueries({ queryKey: ['homeGameMembers', homeGameId] })
    void queryClient.invalidateQueries({ queryKey: ['homeGame', homeGameId] })
    void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
    void refreshHomeGames()
  }

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => homeGamesApi.removeMember(homeGameId, memberId),
    onSuccess: () => {
      toast.success('Membro removido com sucesso!')
      setConfirmRemoveId(null)
      membersChanged()
    },
    onError: () => {
      toast.error('Erro ao remover membro.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { isAdmin?: boolean; personId?: string | null } }) => {
      const body: { isAdmin?: boolean; personId?: string | null } = {}
      if (data.isAdmin !== undefined) body.isAdmin = data.isAdmin
      body.personId = data.personId ?? null
      return homeGamesApi.updateMember(homeGameId, memberId, body)
    },
    onSuccess: () => {
      toast.success('Membro atualizado!')
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ['homeGameMembers', homeGameId] })
    },
    onError: () => {
      toast.error('Erro ao atualizar membro.')
    },
  })

  function startEdit(m: HomeGameMember) {
    setEditingId(m.id)
    setEditIsAdmin(m.isAdmin)
    setEditPersonId(m.personId)
  }

  function saveEdit() {
    if (!editingId) return
    updateMutation.mutate({ memberId: editingId, data: { isAdmin: editIsAdmin, personId: editPersonId } })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Adicionar Membro
          </Button>
        </div>
      )}

      {isLoading && <SectionSpinner />}

      {!isLoading && list.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum membro"
          description="Adicione quem ajuda a organizar os torneios."
        />
      )}

      {!isLoading && list.length > 0 && (
        <div className="space-y-2">
          {list.map((m) =>
            editingId === m.id ? (
              <div key={m.id} className="rounded-lg border border-accent-blue/30 bg-bg-secondary p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar src={m.userPhotoUrl} name={m.userName} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{m.userName}</p>
                    <p className="text-xs text-text-secondary">{m.userEmail}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsAdmin}
                      onChange={(e) => setEditIsAdmin(e.target.checked)}
                      className="h-4 w-4 rounded border-border-input bg-bg-primary text-accent-blue focus:ring-border-focus"
                    />
                    <span className="text-sm text-text-primary">Administrador</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-xs text-text-secondary">Vincular a jogador</label>
                    <select
                      value={editPersonId ?? ''}
                      onChange={(e) => setEditPersonId(e.target.value || null)}
                      className="w-full appearance-none rounded-lg border border-border-input bg-bg-primary px-3 py-2 pr-8 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                    >
                      <option value="">Nenhum</option>
                      {availablePersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname || p.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdit} loading={updateMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3">
                <Avatar src={m.userPhotoUrl} name={m.userName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-text-primary truncate">{m.userName}</p>
                    {m.personNickname && <Badge color="blue">{m.personNickname}</Badge>}
                  </div>
                  <p className="text-xs text-text-secondary">{m.userEmail}</p>
                </div>
                {m.isAdmin && <Badge color="purple">Admin</Badge>}
                {canManage && (
                  <button
                    onClick={() => startEdit(m)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft transition-colors shrink-0"
                    title="Editar membro"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                {canManage &&
                  (confirmRemoveId === m.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmRemoveId(null)}
                        disabled={removeMutation.isPending}
                      >
                        Não
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-accent-red-deep hover:bg-accent-red-soft"
                        onClick={() => removeMutation.mutate(m.id)}
                        loading={removeMutation.isPending}
                      >
                        Sim
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(m.id)}
                      className="p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors shrink-0"
                      title="Remover membro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ))}
              </div>
            ),
          )}
        </div>
      )}

      <AddMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        homeGameId={homeGameId}
        onSuccess={() => {
          setIsAddOpen(false)
          membersChanged()
        }}
      />
    </div>
  )
}
