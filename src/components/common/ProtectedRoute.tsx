import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useOnboardingStatus } from '../../hooks/useOnboarding'
import { LoadingSpinner } from './LoadingSpinner'
import { ROUTES, dealerTerminalPath } from '../../constants/routes'
import { getDealerSession } from '../../utils/deviceSessions'
import { forgetReturn, hasStoredReturn, rememberReturn } from '../../utils/welcomeReturn'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
  /**
   * Boas-vindas (SPEC-20261023-1212): sem isto, conta que ainda não passou pelas boas-vindas vai para
   * `/boas-vindas` (voltando depois para esta página). Só a própria página das boas-vindas liga.
   */
  skipOnboarding?: boolean
}

export function ProtectedRoute({ children, roles, skipOnboarding = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isReconnecting, user } = useAuth()
  const location = useLocation()
  const onboarding = useOnboardingStatus({ enabled: !skipOnboarding })
  const settled = isAuthenticated && !skipOnboarding && !onboarding.isChecking && !onboarding.needsOnboarding
  const goingToLogin = !isLoading && !isAuthenticated && !getDealerSession()
  const here = `${location.pathname}${location.search}`

  useEffect(() => {
    // Conta nova por cadastro com senha volta pelo e-mail de confirmação (sem o state): as boas-vindas leem daqui
    if (goingToLogin) rememberReturn(here)
    // Conta já integrada entrou: o retorno guardado para depois das boas-vindas não vale mais
    else if (settled && hasStoredReturn()) forgetReturn()
  }, [goingToLogin, settled, here])

  if (isLoading || onboarding.isChecking) {
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

  // Primeiro acesso: boas-vindas antes de tudo, voltando para cá depois (ex.: /parear/CODIGO do QR da TV)
  if (onboarding.needsOnboarding) {
    return <Navigate to={ROUTES.WELCOME} state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={ROUTES.HOME_GAMES} replace />
  }

  return <>{children}</>
}
