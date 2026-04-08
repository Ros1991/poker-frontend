import { NavLink } from 'react-router-dom'
import { Home, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useHomeGame } from '../../contexts/HomeGameContext'
import { ROUTES, homeGameDetailPath } from '../../constants/routes'

interface BottomNavProps {
  className?: string
}

export function BottomNav({ className }: BottomNavProps) {
  const { homeGames, selectedHomeGame } = useHomeGame()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-border-default bg-bg-secondary/95 backdrop-blur-sm safe-area-inset-bottom',
        className,
      )}
    >
      <ul className="flex items-center justify-around">
        {homeGames.slice(0, 3).map((homeGame) => (
          <li key={homeGame.id} className="flex-1">
            <NavLink
              to={homeGameDetailPath(homeGame.id)}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors min-h-[56px] justify-center',
                  isActive || selectedHomeGame?.id === homeGame.id
                    ? 'text-accent-blue'
                    : 'text-text-muted hover:text-text-secondary',
                )
              }
            >
              <Home className="h-5 w-5" />
              <span className="truncate max-w-[70px]">{homeGame.name}</span>
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <NavLink
            to={ROUTES.HOME_GAME_NEW}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors min-h-[56px] justify-center',
                isActive
                  ? 'text-accent-green'
                  : 'text-text-muted hover:text-text-secondary',
              )
            }
          >
            <Plus className="h-5 w-5" />
            <span>Criar</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
