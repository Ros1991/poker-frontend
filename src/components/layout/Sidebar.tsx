import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  Shield,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { BrandLogo } from '../brand/BrandLogo'
import { useAuth } from '../../hooks/useAuth'
import { useHomeGame } from '../../contexts/HomeGameContext'
import { ROUTES, homeGameDetailPath } from '../../constants/routes'

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

const adminItems = [
  { to: ROUTES.USERS, label: 'Usuarios', icon: Shield },
]

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const { homeGames, selectedHomeGame, selectHomeGame, isLoading } = useHomeGame()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'Admin'

  const handleSelectHomeGame = (homeGame: typeof selectedHomeGame) => {
    if (homeGame) {
      selectHomeGame(homeGame)
      navigate(homeGameDetailPath(homeGame.id))
      onNavigate?.()
    }
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border-default bg-bg-secondary transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-border-default',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? (
          <BrandLogo variant="mark" className="h-9" />
        ) : (
          <BrandLogo variant="lockup" className="h-9" />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {!collapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Meus Home Games
            </span>
          </div>
        )}

        <ul className="flex flex-col gap-1 px-2">
          {isLoading ? (
            <li className="px-3 py-2 text-sm text-text-secondary">
              {collapsed ? '...' : 'Carregando...'}
            </li>
          ) : homeGames.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-secondary">
              {collapsed ? '-' : 'Nenhum home game'}
            </li>
          ) : (
            homeGames.map((homeGame) => (
              <li key={homeGame.id}>
                <button
                  onClick={() => handleSelectHomeGame(homeGame)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] text-left',
                    selectedHomeGame?.id === homeGame.id
                      ? 'bg-accent-blue-soft text-accent-blue'
                      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                  )}
                >
                  <Home className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{homeGame.name}</span>
                      {selectedHomeGame?.id === homeGame.id && (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      )}
                    </>
                  )}
                </button>
              </li>
            ))
          )}

          <li>
            <NavLink
              to={ROUTES.HOME_GAME_NEW}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-accent-green-soft text-accent-green-deep'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )
              }
            >
              <Plus className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>Criar Home Game</span>}
            </NavLink>
          </li>
        </ul>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="my-3 mx-3 border-t border-border-default" />
            {!collapsed && (
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Administracao
                </span>
              </div>
            )}
            <ul className="flex flex-col gap-1 px-2">
              {adminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                        isActive
                          ? 'bg-accent-blue-soft text-accent-blue'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-border-default py-3 text-text-secondary hover:text-text-primary transition-colors min-h-[44px]"
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </aside>
  )
}
