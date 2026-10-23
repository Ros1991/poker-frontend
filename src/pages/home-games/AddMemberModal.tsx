import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import * as personsApi from '../../api/persons.api'
import * as usersApi from '../../api/users.api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { errorStatus } from '../../utils/httpErrors'
import type { UserLookup } from '../../types/user.types'

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
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<UserLookup | null>(null)
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

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

  // Jogadores/dealers já vinculados a algum membro
  const linkedPersonIds = new Set(
    (existingMembers ?? []).filter((m) => m.personId).map((m) => m.personId!),
  )

  // Disponíveis para vincular (ainda sem membro)
  const availablePersons = (persons ?? []).filter(
    (p) => !linkedPersonIds.has(p.id),
  )

  const memberUserIds = new Set((existingMembers ?? []).map((m) => m.userId))
  const alreadyMember = !!found && memberUserIds.has(found.id)

  // Busca por e-mail exato no servidor (não lista usuários nem filtra no navegador)
  const lookupMutation = useMutation({
    mutationFn: (value: string) => usersApi.lookupByEmail(value),
    onSuccess: (user) => {
      setFound(user)
      setLookupMessage(null)
    },
    onError: (error: unknown) => {
      setFound(null)
      const status = errorStatus(error)
      const serverMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      if (status === 404) {
        setLookupMessage(
          'Nenhuma conta com este e-mail. A pessoa precisa criar a conta primeiro.',
        )
      } else if (status === 400) {
        setLookupMessage('Informe o e-mail.')
      } else if (status === 429) {
        // Limite de 10 buscas por minuto por usuário (backend "user-lookup")
        setLookupMessage('Muitas buscas seguidas. Espere um minuto.')
      } else if (status === 403) {
        // Só quem administra um home game pode buscar contas (mensagem do backend)
        setLookupMessage(
          serverMessage || 'Só quem administra um home game pode buscar contas.',
        )
      } else {
        setLookupMessage('Erro ao buscar a conta. Tente novamente.')
      }
    },
  })

  function handleSearch() {
    const value = email.trim()
    if (!value) {
      setFound(null)
      setLookupMessage('Informe o e-mail.')
      return
    }
    lookupMutation.mutate(value)
  }

  function resetForm() {
    setEmail('')
    setFound(null)
    setLookupMessage(null)
    setSelectedPersonId(null)
    setIsAdmin(false)
  }

  const addMutation = useMutation({
    mutationFn: () =>
      homeGamesApi.addMember(homeGameId, {
        userId: found!.id,
        personId: selectedPersonId ?? undefined,
        isAdmin,
      }),
    onSuccess: () => {
      toast.success('Membro adicionado com sucesso!')
      resetForm()
      onSuccess()
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao adicionar membro. Tente novamente.')
    },
  })

  function handleAdd() {
    if (!found) {
      toast.error('Busque a conta pelo e-mail antes de adicionar.')
      return
    }
    if (alreadyMember) {
      toast.error('Já é membro deste home game.')
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
        <div className="space-y-1.5">
          <label
            htmlFor="add-member-email"
            className="text-sm font-medium text-text-secondary"
          >
            E-mail da conta
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="add-member-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                placeholder="pessoa@exemplo.com"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSearch}
              loading={lookupMutation.isPending}
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Peça o e-mail que a pessoa usou no cadastro.
          </p>
        </div>

        {/* Resultado da busca */}
        {lookupMessage && !found && (
          <div className="flex items-start gap-2 rounded-lg border border-border-default px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent-red" />
            <p className="text-sm text-text-muted">{lookupMessage}</p>
          </div>
        )}

        {found && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              alreadyMember
                ? 'border-border-default bg-bg-tertiary'
                : 'border-accent-blue bg-accent-blue/10'
            }`}
          >
            <Avatar src={found.photoUrl} name={found.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {found.name}
              </p>
              <p className="text-xs text-text-muted truncate">{found.email}</p>
            </div>
            {alreadyMember ? (
              <span className="text-xs text-text-muted whitespace-nowrap">
                Já é membro deste home game
              </span>
            ) : (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-accent-blue" />
            )}
          </div>
        )}

        {/* Vínculo com jogador/dealer */}
        {found && !alreadyMember && availablePersons.length > 0 && (
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
            disabled={!found || alreadyMember}
          >
            Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
