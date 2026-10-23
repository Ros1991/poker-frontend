import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { ProtectedRoute } from '../../components/common/ProtectedRoute'
import { setDealerExpiredHandler, setDealerScope } from '../../api/client'
import { getDealerSession, setDealerSession } from '../../utils/deviceSessions'
import { ROUTES } from '../../constants/routes'
import { DealerTerminalPage } from './DealerTerminalPage'

/**
 * /dealer/:tournamentId — com acesso de dealer (QR) deste torneio, abre o
 * terminal sem login e com token restrito; sem ele, segue o fluxo antigo
 * (usuário logado).
 */
export function DealerTerminalRoute() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [session] = useState(() => {
    const dealer = getDealerSession()
    const scoped = dealer && dealer.tournamentId === tournamentId ? dealer : null
    // Já no primeiro render: as consultas do terminal saem com o token do dealer
    if (scoped) setDealerScope({ token: scoped.accessToken, tournamentId: scoped.tournamentId })
    return scoped
  })
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!session) return
    setDealerScope({ token: session.accessToken, tournamentId: session.tournamentId })
    setDealerExpiredHandler(() => {
      setDealerSession(null)
      setExpired(true)
    })
    return () => {
      setDealerScope(null)
      setDealerExpiredHandler(null)
    }
  }, [session])

  if (!session) {
    return (
      <ProtectedRoute>
        <DealerTerminalPage />
      </ProtectedRoute>
    )
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <QrCode className="h-12 w-12 text-accent-yellow" />
          <p className="text-lg font-semibold text-text-primary">Seu acesso de dealer acabou</p>
          <p className="text-text-secondary">
            O torneio terminou ou o organizador gerou um QR novo. Peça o QR ao organizador e leia de novo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <DealerTerminalPage
      dealerMode={{
        tournamentName: session.tournamentName,
        onExit: () => {
          setDealerSession(null)
          navigate(ROUTES.HOME, { replace: true })
        },
      }}
    />
  )
}
