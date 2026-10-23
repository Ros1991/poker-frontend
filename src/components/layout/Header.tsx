import { Crown, LogOut, Menu } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'
import { ROUTES } from '../../constants/routes'
import { BrandLogo } from '../brand/BrandLogo'
import { Badge } from '../ui/Badge'
import { usePlan } from '../../hooks/usePlan'

interface HeaderProps {
  onMenuToggle?: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { myPlan } = usePlan()
  const plan = myPlan?.effectivePlan ?? user?.effectivePlan ?? user?.plan

  const handleLogout = async () => {
    await logout()
    queryClient.clear() // Limpa TODO o cache do React Query
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-bg-secondary px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* No celular a sidebar está fechada: a marca aparece aqui */}
        <BrandLogo variant="lockup" className="h-8 lg:hidden" />
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            {/* Meu plano (SPEC-20261023-1205): no celular só o ícone */}
            <Link
              to={ROUTES.MY_PLAN}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              aria-label={plan ? `Meu plano: ${plan}` : 'Meu plano'}
              title="Meu plano"
            >
              <Crown className="h-5 w-5 text-accent-gold-deep" aria-hidden />
              <span className="hidden md:inline">Meu plano</span>
              {plan && (
                <Badge color={plan === 'Mesa' ? 'gray' : 'gold'} className="hidden sm:inline-flex">
                  {plan}
                </Badge>
              )}
            </Link>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-text-primary">
                {user.name}
              </span>
              <span className="text-xs text-text-secondary">{user.role}</span>
            </div>
            <Avatar src={user.photoUrl} name={user.name} size="sm" />
          </>
        )}
        <button
          onClick={() => void handleLogout()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
