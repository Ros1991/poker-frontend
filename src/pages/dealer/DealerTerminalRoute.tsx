import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Clock, QrCode, ShieldOff } from 'lucide-react'
import { ProtectedRoute } from '../../components/common/ProtectedRoute'
import * as dealerAccessApi from '../../api/dealerAccess.api'
import { setDealerExpiredHandler, setDealerScope } from '../../api/client'
import { getDealerSession, setDealerSession } from '../../utils/deviceSessions'
import { ROUTES } from '../../constants/routes'
import { DealerTerminalPage } from './DealerTerminalPage'

type EndedReason = 'revoked' | 'expired' | 'over'

const ENDED_SCREEN: Record<EndedReason, { icon: typeof QrCode; title: string; detail: string }> = {
  revoked: {
    icon: ShieldOff,
    title: 'Seu acesso foi encerrado pelo organizador',
    detail: 'Se precisar voltar ao terminal, peça o QR ao organizador, leia de novo e aguarde a autorização.',
  },
  expired: {
    icon: Clock,
    title: 'Seu acesso de dealer venceu',
    detail: 'O prazo da autorização acabou. Peça o QR ao organizador, leia de novo e aguarde a autorização.',
  },
  over: {
    icon: QrCode,
    title: 'Seu acesso de dealer acabou',
    detail:
      'O organizador encerrou o acesso ou o torneio terminou. Se precisar voltar, leia o QR de novo e aguarde a autorização.',
  },
}

/**
 * /dealer/:tournamentId — com acesso de dealer (autorizado pelo organizador) deste
 * torneio, abre o terminal sem login e com token restrito; sem ele, segue o fluxo
 * antigo (usuário logado).
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
  const [ended, setEnded] = useState<EndedReason | null>(null)

  // Token do dealer em efeito de LAYOUT: roda antes dos efeitos comuns dos filhos. No desmontar/remontar do StrictMode
  // (desenvolvimento) a conexão do hub do terminal (useWebSocket, efeito do DealerTerminalPage) negociava sem o token
  // (401, sem nova tentativa) e o aviso em tempo real das mesas (TablesUpdate — SPEC-20261027-2133) não chegava
  useLayoutEffect(() => {
    if (!session) return
    setDealerScope({ token: session.accessToken, tournamentId: session.tournamentId })
    return () => setDealerScope(null)
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    let reasonChecked = false
    setDealerExpiredHandler(() => {
      // 401 no terminal: desconectado pelo organizador, QR desativado, prazo vencido ou torneio encerrado.
      // Mostra a tela na hora e confere o motivo no pedido (anônimo, uma vez só) para acertar o texto.
      setDealerSession(null)
      setEnded((current) => current ?? 'over')
      if (reasonChecked) return
      reasonChecked = true
      dealerAccessApi
        .getRequest(session.requestId, session.deviceKey)
        .then((request) => {
          if (cancelled) return
          if (request.status === 'Revoked') setEnded('revoked')
          else if (request.expired) setEnded('expired')
        })
        .catch(() => {
          // Sem o motivo (rede, pedido apagado): fica o texto genérico
        })
    })
    return () => {
      cancelled = true
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

  if (ended) {
    const screen = ENDED_SCREEN[ended]
    const Icon = screen.icon
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <Icon className={`h-12 w-12 ${ended === 'revoked' ? 'text-accent-red' : 'text-accent-yellow'}`} />
          <p className="text-lg font-semibold text-text-primary">{screen.title}</p>
          <p className="text-text-secondary">{screen.detail}</p>
        </div>
      </div>
    )
  }

  return (
    <DealerTerminalPage
      dealerMode={{
        tournamentName: session.tournamentName,
        dealerName: session.dealerName,
        onExit: () => {
          setDealerSession(null)
          navigate(ROUTES.HOME, { replace: true })
        },
      }}
    />
  )
}
