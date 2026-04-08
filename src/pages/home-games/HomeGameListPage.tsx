import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, MapPin, Users, Trophy, Loader2 } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/ui/SearchInput'
import { homeGameDetailPath } from '../../constants/routes'
import { HomeGameFormModal } from './HomeGameFormModal'
import { useHomeGame } from '../../contexts/HomeGameContext'

export function HomeGameListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { homeGames: contextHomeGames, selectedHomeGame, selectHomeGame, isLoading: contextLoading } = useHomeGame()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['homeGames', search],
    queryFn: () => homeGamesApi.getAll(),
  })

  const homeGames = (data ?? []).filter(
    (hg) => !search || hg.name.toLowerCase().includes(search.toLowerCase()),
  )

  // Se só tem 1 HomeGame, redireciona automaticamente
  useEffect(() => {
    if (!contextLoading && contextHomeGames.length === 1) {
      const hg = contextHomeGames[0]
      if (!selectedHomeGame || selectedHomeGame.id !== hg.id) {
        selectHomeGame(hg)
      }
      navigate(homeGameDetailPath(hg.id), { replace: true })
    }
  }, [contextLoading, contextHomeGames, selectedHomeGame, selectHomeGame, navigate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Home Games</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Gerencie seus grupos de poker
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Home Game
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar home games..."
        className="max-w-md"
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-accent-red/30 bg-red-500/10 p-6 text-center">
          <p className="text-text-primary">Erro ao carregar os home games.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && homeGames.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-16 px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-tertiary mb-4">
            <Trophy className="h-8 w-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">
            Nenhum home game encontrado
          </h3>
          <p className="mt-1 text-sm text-text-secondary text-center max-w-sm">
            {search
              ? 'Nenhum resultado para sua busca. Tente outro termo.'
              : 'Crie seu primeiro home game para comecar a organizar torneios.'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar Home Game
            </Button>
          )}
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && !isError && homeGames.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homeGames.map((hg) => (
            <button
              key={hg.id}
              onClick={() => navigate(homeGameDetailPath(hg.id))}
              className="group flex flex-col rounded-xl border border-border-default bg-bg-secondary p-5 text-left transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent-blue transition-colors line-clamp-1">
                  {hg.name}
                </h3>
                {hg.isActive ? (
                  <span className="shrink-0 inline-flex items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                    Ativo
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center rounded-full bg-gray-500/20 px-2 py-0.5 text-xs font-medium text-gray-400">
                    Inativo
                  </span>
                )}
              </div>

              {hg.description && (
                <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                  {hg.description}
                </p>
              )}

              {hg.location && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{hg.location}</span>
                </div>
              )}

              <div className="mt-auto flex items-center gap-4 pt-4 border-t border-border-default mt-4">
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Users className="h-4 w-4 text-text-muted" />
                  <span>
                    {hg.memberCount}{' '}
                    {hg.memberCount === 1 ? 'membro' : 'membros'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Trophy className="h-4 w-4 text-text-muted" />
                  <span>
                    {hg.tournamentCount}{' '}
                    {hg.tournamentCount === 1 ? 'torneio' : 'torneios'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <HomeGameFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          setIsFormOpen(false)
          queryClient.invalidateQueries({ queryKey: ['homeGames'] })
        }}
      />
    </div>
  )
}
