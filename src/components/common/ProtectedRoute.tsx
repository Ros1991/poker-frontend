import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingSpinner } from './LoadingSpinner'
import { ROUTES, dealerTerminalPath } from '../../constants/routes'
import { getDealerSession } from '../../utils/deviceSessions'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isReconnecting, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <LoadingSpinner
          size="lg"
          text={isReconnecting ? 'Sem conexão com o servidor. Tentando de novo…' : undefined}
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Celular aberto pelo QR do dealer só enxerga o terminal do torneio dele
    const dealer = getDealerSession()
    if (dealer) return <Navigate to={dealerTerminalPath(dealer.tournamentId)} replace />
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
