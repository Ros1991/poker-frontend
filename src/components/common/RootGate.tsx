import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useOnboardingStatus } from '../../hooks/useOnboarding'
import { LoadingSpinner } from './LoadingSpinner'
import { ROUTES, dealerTerminalPath } from '../../constants/routes'
import { getDealerSession } from '../../utils/deviceSessions'

/**
 * "/" — logado vai para o painel (como sempre) ou, no primeiro acesso, para as boas-vindas
 * (SPEC-20261023-1212); celular de dealer volta para o terminal; qualquer outro visitante (ex.: a TV)
 * vai para /tv, que mostra o QR de pareamento. A TV fica numa rota sem depender do login: se alguém
 * entrar em outra aba do mesmo navegador, o telão não vira o painel.
 */
export function RootGate() {
  const { isAuthenticated, isLoading, isReconnecting } = useAuth()
  const onboarding = useOnboardingStatus()

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

  if (isAuthenticated) {
    return <Navigate to={onboarding.needsOnboarding ? ROUTES.WELCOME : ROUTES.HOME_GAMES} replace />
  }

  const dealer = getDealerSession()
  if (dealer) return <Navigate to={dealerTerminalPath(dealer.tournamentId)} replace />

  return <Navigate to={ROUTES.TV} replace />
}
