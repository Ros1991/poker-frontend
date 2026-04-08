import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'
import { ROUTES } from '../../constants/routes'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    await logout()
    queryClient.clear() // Limpa TODO o cache do React Query
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-bg-secondary px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary lg:hidden">
          PokerTM
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-text-primary">
                {user.name}
              </span>
              <span className="text-xs text-text-muted">{user.role}</span>
            </div>
            <Avatar src={user.photoUrl} name={user.name} size="sm" />
          </>
        )}
        <button
          onClick={() => void handleLogout()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-accent-red hover:bg-red-500/10 transition-colors"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
