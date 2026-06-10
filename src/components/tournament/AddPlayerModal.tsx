import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, Phone, Plus, Users, Check, AlertCircle } from 'lucide-react'
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

export function AddPlayerModal({
  isOpen,
  onClose,
  tournamentId,
  homeGameId,
}: AddPlayerModalProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [payNow, setPayNow] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Form de criação rápida
  const [newNickname, setNewNickname] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newWhatsapp, setNewWhatsapp] = useState('')

  const {
    data: personsData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
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
  const enrolledPersonIds = new Set((entriesData ?? []).map((e) => e.personId))

  const availablePersons = (personsData ?? []).filter(
    (p) => !enrolledPersonIds.has(p.id),
  )

  const filteredPersons = availablePersons.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase().trim()
    return (
      p.fullName?.toLowerCase().includes(q) ||
      (p.nickname && p.nickname.toLowerCase().includes(q))
    )
  })

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredPersons.forEach((p) => next.add(p.id))
      return next
    })
  }

  const bulkMutation = useMutation({
    mutationFn: () =>
      entriesApi.bulkCreate(tournamentId, [...selectedIds], payNow),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
      const n = created.length
      toast.success(
        n === 1
          ? '1 jogador adicionado ao torneio!'
          : `${n} jogadores adicionados ao torneio!`,
      )
      handleClose()
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { message?: string } | string } })?.response
      const data = resp?.data
      const msg = typeof data === 'string' ? data : data?.message
      toast.error(msg || 'Erro ao adicionar jogadores.')
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
      // Ja deixa o recem-criado selecionado para entrar no lote
      setSelectedIds((prev) => new Set(prev).add(created.id))
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
    setSelectedIds(new Set())
    setPayNow(false)
    setShowCreateForm(false)
    setNewNickname('')
    setNewFullName('')
    setNewWhatsapp('')
    onClose()
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

  const selectedCount = selectedIds.size

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Adicionar Jogadores"
      size="md"
    >
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

        {/* Barra de seleção em massa */}
        {!isLoading && !isError && availablePersons.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">
              {filteredPersons.length} disponíve
              {filteredPersons.length === 1 ? 'l' : 'is'}
              {selectedCount > 0 && (
                <span className="text-accent-blue font-medium">
                  {' '}
                  · {selectedCount} selecionado
                  {selectedCount === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-accent-blue hover:underline"
                disabled={filteredPersons.length === 0}
              >
                Selecionar todos
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-text-muted hover:text-text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lista de jogadores (multi-seleção) */}
        {(isLoading || (isFetching && !personsData)) && (
          <p className="text-sm text-text-muted text-center py-4">
            Carregando jogadores...
          </p>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-accent-red" />
            <p className="text-sm text-text-secondary">
              Não foi possível carregar os jogadores. Verifique sua conexão e
              tente novamente.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refetch()}
              loading={isFetching}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !isError && filteredPersons.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Users className="h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-muted">
              {search
                ? 'Nenhum jogador encontrado com esse termo.'
                : availablePersons.length === 0 && (personsData?.length ?? 0) > 0
                  ? 'Todos os jogadores já estão inscritos.'
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

        {!isLoading && !isError && filteredPersons.length > 0 && (
          <div className="max-h-80 overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
            {filteredPersons.map((person: Person) => {
              const selected = selectedIds.has(person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggle(person.id)}
                  className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors min-h-[56px] border ${
                    selected
                      ? 'bg-accent-blue/10 border-accent-blue/50'
                      : 'border-transparent hover:bg-bg-tertiary'
                  }`}
                >
                  {/* Indicador de seleção */}
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      selected
                        ? 'border-accent-blue bg-accent-blue text-white'
                        : 'border-border-default'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
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
              )
            })}
          </div>
        )}

        {/* Rodapé fixo de ação */}
        <div className="flex flex-col gap-3 border-t border-border-default pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={payNow}
              onChange={(e) => setPayNow(e.target.checked)}
              className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
            />
            <span className="text-sm text-text-primary">
              Buy-in pago na entrada (todos os selecionados)
            </span>
          </label>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={bulkMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => bulkMutation.mutate()}
              loading={bulkMutation.isPending}
              disabled={selectedCount === 0}
            >
              <UserPlus className="h-4 w-4" />
              {selectedCount === 0
                ? 'Adicionar'
                : selectedCount === 1
                  ? 'Adicionar 1 jogador'
                  : `Adicionar ${selectedCount} jogadores`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
