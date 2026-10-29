import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useHomeGame } from '../../../hooks/useHomeGame'
import { ROUTES, homeGameSectionPath } from '../../../constants/routes'

/**
 * `/players` (a lista de jogadores do home game ativo, de antes da SPEC-20261029-1724) → a seção Jogadores do home game
 * selecionado; sem nenhum, o Início.
 */
export function PlayersRedirect() {
  const { selectedHomeGame, isLoading } = useHomeGame()
  if (selectedHomeGame) return <Navigate to={homeGameSectionPath(selectedHomeGame.id, 'jogadores')} replace />
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }
  return <Navigate to={ROUTES.INICIO} replace />
}
