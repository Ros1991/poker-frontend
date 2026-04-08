import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, Phone, Plus, Users } from 'lucide-react'
import * as personsApi from '../../api/persons.api'
import * as entriesApi from '../../api/entries.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { Avatar } from '../ui/Avatar'
import type { Person } from '../../types/person.types'

interface AddPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  homeGameId: string
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  let local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length > 11) local = local.slice(0, 11)
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

export function AddPlayerModal({
  isOpen,
  onClose,
  tournamentId,
  homeGameId,
}: AddPlayerModalProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [payNow, setPayNow] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Form de criação rápida
  const [newNickname, setNewNickname] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newWhatsapp, setNewWhatsapp] = useState('')

  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', homeGameId, 'Jogador'],
    queryFn: () => personsApi.getByHomeGame(homeGameId, 'Jogador'),
    enabled: isOpen && !!homeGameId,
  })

  // Buscar entries do torneio para filtrar jogadores ja inscritos
  const { data: entriesData } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: isOpen && !!tournamentId,
  })

  // IDs de pessoas ja inscritas no torneio (qualquer status, inclusive eliminados)
  const enrolledPersonIds = new Set(
    (entriesData ?? []).map((e) => e.personId),
  )

  const filteredPersons = (personsData ?? [])
    .filter((p) => !enrolledPersonIds.has(p.id))
    .filter((p) => {
      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        p.fullName?.toLowerCase().includes(q) ||
        (p.nickname && p.nickname.toLowerCase().includes(q))
      )
    })

  const createEntryMutation = useMutation({
    mutationFn: (data: { personId: string; paid: boolean }) =>
      entriesApi.create(tournamentId, {
        tournamentId,
        personId: data.personId,
        paid: data.paid,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      toast.success(
        `${selectedPerson?.nickname ?? selectedPerson?.fullName} adicionado ao torneio!`,
      )
      handleClose()
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { message?: string } | string } })?.response
      const data = resp?.data
      const msg = typeof data === 'string' ? data : data?.message
      toast.error(msg || 'Erro ao adicionar jogador.')
    },
  })

  const createPersonMutation = useMutation({
    mutationFn: (data: {
      fullName: string
      nickname?: string
      whatsapp?: string
    }) =>
      personsApi.create({
        ...data,
        homeGameId,
        type: 'Jogador',
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ['persons', homeGameId, 'Jogador'],
      })
      toast.success('Jogador cadastrado!')
      // Selecionar automaticamente o jogador recem-criado
      setSelectedPerson(created)
      setShowCreateForm(false)
      setNewNickname('')
      setNewFullName('')
      setNewWhatsapp('')
    },
    onError: () => {
      toast.error('Erro ao cadastrar jogador.')
    },
  })

  function handleClose() {
    setSearch('')
    setSelectedPerson(null)
    setPayNow(false)
    setShowCreateForm(false)
    setNewNickname('')
    setNewFullName('')
    setNewWhatsapp('')
    onClose()
  }

  function handleConfirm() {
    if (!selectedPerson) return
    createEntryMutation.mutate({
      personId: selectedPerson.id,
      paid: payNow,
    })
  }

  function handleCreatePerson() {
    if (!newNickname.trim()) {
      toast.error('Apelido é obrigatório.')
      return
    }
    const digits = newWhatsapp.replace(/\D/g, '') || undefined
    const cleanWhatsapp = digits
      ? (digits.startsWith('55') && digits.length > 11
          ? digits.slice(2)
          : digits
        ).slice(0, 11)
      : undefined
    createPersonMutation.mutate({
      fullName: newFullName.trim() || newNickname.trim(),
      nickname: newNickname.trim(),
      whatsapp: cleanWhatsapp,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Adicionar Jogador"
      size="md"
    >
      {!selectedPerson ? (
        <div className="flex flex-col gap-4">
          {/* Search + botão de novo */}
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nome ou apelido..."
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateForm((v) => !v)}
              title="Cadastrar novo jogador"
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>

          {/* Form inline de criação rápida */}
          {showCreateForm && (
            <div className="rounded-lg border border-accent-blue/30 bg-bg-secondary p-3 space-y-3">
              <p className="text-xs font-semibold text-text-secondary uppercase">
                Novo Jogador
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Apelido *"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={formatPhone(newWhatsapp)}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewNickname('')
                    setNewFullName('')
                    setNewWhatsapp('')
                  }}
                  disabled={createPersonMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreatePerson}
                  loading={createPersonMutation.isPending}
                >
                  Cadastrar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de jogadores */}
          {isLoading && (
            <p className="text-sm text-text-muted text-center py-4">
              Carregando jogadores...
            </p>
          )}

          {!isLoading && filteredPersons.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Users className="h-10 w-10 text-text-muted" />
              <p className="text-sm text-text-muted">
                {search
                  ? 'Nenhum jogador encontrado com esse termo.'
                  : 'Nenhum jogador cadastrado neste home game.'}
              </p>
              {!showCreateForm && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowCreateForm(true)}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar Jogador
                </Button>
              )}
            </div>
          )}

          {!isLoading && filteredPersons.length > 0 && (
            <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
              {filteredPersons.map((person) => (
                <button
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className="flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-bg-tertiary"
                >
                  <Avatar
                    src={person.photoUrl}
                    name={person.nickname ?? person.fullName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {person.nickname ?? person.fullName}
                    </p>
                    {person.nickname &&
                      person.fullName &&
                      person.nickname !== person.fullName && (
                        <p className="text-xs text-text-muted truncate">
                          {person.fullName}
                        </p>
                      )}
                  </div>
                  {person.whatsapp && (
                    <Phone className="h-3.5 w-3.5 text-accent-green flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-bg-primary p-4">
            <Avatar
              src={selectedPerson.photoUrl}
              name={selectedPerson.nickname ?? selectedPerson.fullName}
              size="lg"
            />
            <div className="flex-1">
              <p className="font-semibold text-text-primary">
                {selectedPerson.nickname ?? selectedPerson.fullName}
              </p>
              {selectedPerson.nickname && (
                <p className="text-sm text-text-muted">
                  {selectedPerson.fullName}
                </p>
              )}
              {selectedPerson.whatsapp && (
                <a
                  href={`https://wa.me/${selectedPerson.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-green hover:underline flex items-center gap-1 mt-1"
                >
                  <Phone className="h-3 w-3" />
                  {displayPhone(selectedPerson.whatsapp)}
                </a>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={payNow}
              onChange={(e) => setPayNow(e.target.checked)}
              className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
            />
            <span className="text-sm text-text-primary">
              Buy-in pago na entrada
            </span>
          </label>

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setSelectedPerson(null)}
              disabled={createEntryMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirm}
              loading={createEntryMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
