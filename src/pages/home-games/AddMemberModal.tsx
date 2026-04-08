import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import * as personsApi from '../../api/persons.api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/ui/SearchInput'
import { Avatar } from '../../components/ui/Avatar'
import apiClient from '../../api/client'

interface UserItem {
  id: string
  name: string
  email: string
  photoUrl: string | null
  role: string
}

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  homeGameId: string
  onSuccess: () => void
}

export function AddMemberModal({
  isOpen,
  onClose,
  homeGameId,
  onSuccess,
}: AddMemberModalProps) {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
  } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const response = await apiClient.get<UserItem[]>('/Users')
      return response.data
    },
    enabled: isOpen,
    staleTime: 30_000,
  })

  const { data: existingMembers } = useQuery({
    queryKey: ['homeGameMembers', homeGameId],
    queryFn: () => homeGamesApi.getMembers(homeGameId),
    enabled: isOpen,
  })

  const { data: persons } = useQuery({
    queryKey: ['persons', homeGameId],
    queryFn: () => personsApi.getByHomeGame(homeGameId),
    enabled: isOpen,
  })

  // Person IDs already linked to existing members
  const linkedPersonIds = new Set(
    (existingMembers ?? []).filter((m) => m.personId).map((m) => m.personId!),
  )

  // Available persons (not already linked to another member)
  const availablePersons = (persons ?? []).filter(
    (p) => !linkedPersonIds.has(p.id),
  )

  const memberUserIds = new Set((existingMembers ?? []).map((m) => m.userId))

  const filteredUsers = (users ?? []).filter(
    (u) =>
      !memberUserIds.has(u.id) &&
      (!search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())),
  )

  const addMutation = useMutation({
    mutationFn: () =>
      homeGamesApi.addMember(homeGameId, {
        userId: selectedUserId!,
        personId: selectedPersonId ?? undefined,
        isAdmin,
      }),
    onSuccess: () => {
      toast.success('Membro adicionado com sucesso!')
      setSelectedUserId(null)
      setSelectedPersonId(null)
      setSearch('')
      setIsAdmin(false)
      onSuccess()
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao adicionar membro. Tente novamente.')
    },
  })

  function handleAdd() {
    if (!selectedUserId) {
      toast.error('Selecione um usuario.')
      return
    }
    addMutation.mutate()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Membro"
      size="md"
    >
      <div className="space-y-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar usuario por nome ou email..."
        />

        {/* User list */}
        <div className="max-h-60 overflow-y-auto rounded-lg border border-border-default">
          {usersLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          )}

          {!usersLoading && usersError && (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <AlertCircle className="h-5 w-5 text-accent-red" />
              <p className="text-sm text-text-muted">
                Erro ao carregar usuarios. Verifique suas permissoes.
              </p>
            </div>
          )}

          {!usersLoading && !usersError && filteredUsers.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">
              Nenhum usuario encontrado.
            </p>
          )}

          {!usersLoading &&
            !usersError &&
            filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  selectedUserId === u.id
                    ? 'bg-accent-blue/10 border-l-2 border-accent-blue'
                    : 'hover:bg-bg-tertiary border-l-2 border-transparent'
                }`}
              >
                <Avatar src={u.photoUrl} name={u.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">{u.email}</p>
                </div>
              </button>
            ))}
        </div>

        {/* Person association */}
        {selectedUserId && availablePersons.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Vincular a jogador/dealer (opcional)
            </label>
            <select
              value={selectedPersonId ?? ''}
              onChange={(e) => setSelectedPersonId(e.target.value || null)}
              className="w-full appearance-none rounded-lg border border-border-default bg-bg-primary px-3 py-2 pr-8 text-sm text-text-primary focus:border-border-focus focus:outline-none"
            >
              <option value="">Nenhum</option>
              {availablePersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname || p.fullName} ({p.type})
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="h-4 w-4 rounded border-border-default bg-bg-primary text-accent-blue focus:ring-border-focus"
          />
          <span className="text-sm text-text-primary">
            Administrador do Home Game
          </span>
        </label>

        <div className="flex justify-end gap-3 border-t border-border-default pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={addMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            loading={addMutation.isPending}
            disabled={!selectedUserId}
          >
            Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
