import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useDisplaySession } from '../../hooks/useDisplaySession'
import { useAuth } from '../../hooks/useAuth'
import * as displayPairingApi from '../../api/displayPairing.api'
import { setDisplayToken } from '../../utils/deviceSessions'
import { ROUTES } from '../../constants/routes'
import { DisplayPairingScreen } from './DisplayPairingScreen'
import { TvDisplayPage } from './TvDisplayPage'

function TvLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <LoadingSpinner size="lg" />
    </div>
  )
}

/** A TV: QR grande enquanto aguarda um celular; o telão do torneio depois de pareada. */
export function TvScreen() {
  const { deviceToken, status, connectionError, leave, refresh } = useDisplaySession()

  if (!deviceToken || !status) {
    return <DisplayPairingScreen code={null} connectionError={connectionError} />
  }

  if (status.status === 'Paired' && status.tournamentId) {
    return (
      <TvDisplayPage
        key={status.tournamentId}
        deviceToken={deviceToken}
        pairingCode={status.pairingCode}
        onLeave={() => {
          void leave().catch(() => toast.error('Sem conexão. Tente de novo.'))
        }}
        onUnpaired={refresh}
      />
    )
  }

  return <DisplayPairingScreen code={status.pairingCode} connectionError={connectionError} />
}

/**
 * Link "TV Display" do painel (/tv/:tournamentId): com usuário logado, este
 * navegador vira a TV daquele torneio na hora. Sem login, cai no QR grande.
 */
export function TvDirectPairPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !tournamentId) return
    let cancelled = false
    displayPairingApi
      .pairThisBrowser(tournamentId)
      .then((deviceToken) => {
        if (cancelled) return
        setDisplayToken(deviceToken)
        navigate(ROUTES.TV, { replace: true })
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Não foi possível abrir o telão deste torneio.')
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [isLoading, isAuthenticated, tournamentId, navigate])

  if (isLoading) return <TvLoading />
  if (!isAuthenticated || failed) return <Navigate to={ROUTES.TV} replace />
  return <TvLoading />
}
