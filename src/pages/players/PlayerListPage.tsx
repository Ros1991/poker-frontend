import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users, AlertCircle } from 'lucide-react'
import * as personsApi from '../../api/persons.api'
import { SearchInput } from '../../components/ui/SearchInput'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PlayerCard } from '../../components/player/PlayerCard'
import { ROUTES, playerDetailPath } from '../../constants/routes'
import { useHomeGame } from '../../contexts/HomeGameContext'

export function PlayerListPage() {
  const navigate = useNavigate()
  const { selectedHomeGame } = useHomeGame()
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['persons', selectedHomeGame?.id, 'Jogador', search],
    queryFn: () => personsApi.getByHomeGame(selectedHomeGame!.id, 'Jogador'),
    enabled: !!selectedHomeGame,
  })

  const persons = (data ?? []).filter(
    (p) =>
      !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.nickname && p.nickname.toLowerCase().includes(search.toLowerCase())),
  )

  if (!selectedHomeGame) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Users className="h-12 w-12 text-text-muted" />
        <p className="text-lg font-medium text-text-secondary">
          Selecione um Home Game primeiro
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Jogadores</h1>
          <p className="text-sm text-text-secondary">
            Jogadores de {selectedHomeGame.name}
          </p>
        </div>
        <Button
          onClick={() => navigate(ROUTES.PLAYER_NEW)}
          className="sm:w-auto w-full"
        >
          <Plus className="h-4 w-4" />
          Novo Jogador
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou apelido..."
        className="max-w-md"
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" text="Carregando jogadores..." />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertCircle className="h-12 w-12 text-accent-red" />
          <p className="text-text-secondary">
            Erro ao carregar jogadores. Tente novamente.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && persons.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Users className="h-12 w-12 text-text-muted" />
          <p className="text-lg font-medium text-text-secondary">
            {search
              ? 'Nenhum jogador encontrado'
              : 'Nenhum jogador cadastrado'}
          </p>
          <p className="text-sm text-text-muted">
            {search
              ? 'Tente buscar com outros termos.'
              : 'Adicione o primeiro jogador para começar.'}
          </p>
          {!search && (
            <Button
              onClick={() => navigate(ROUTES.PLAYER_NEW)}
              size="sm"
              className="mt-2"
            >
              <Plus className="h-4 w-4" />
              Novo Jogador
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && persons.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {persons.map((person) => (
            <PlayerCard
              key={person.id}
              person={person}
              onClick={() => navigate(playerDetailPath(person.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
