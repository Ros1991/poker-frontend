import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { LoadingSpinner } from './LoadingSpinner'
import { ROUTES, dealerTerminalPath } from '../../constants/routes'
import { getDealerSession, getDisplayToken, setDisplayToken } from '../../utils/deviceSessions'
import * as publicDisplayApi from '../../api/publicDisplay.api'

// Landing num chunk separado (SPEC-20261023-1207): o pacote do painel, do telão e do terminal não leva os textos e
// as imagens da vitrine.
const LandingPage = lazy(() =>
  import('../../pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)

function GateSpinner({ text }: { text?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}

/**
 * "/" decide em 4 ramos (SPEC-20261023-1207; o 1º mudou na SPEC-20261029-1724):
 * 1. logado → o Início da conta (`/inicio`; as boas-vindas do primeiro acesso ficam com o `ProtectedRoute` dele). O
 *    `boot.tsx` já carrega o app completo para quem tem sessão guardada (`landingVisit.ts`), então a landing não pisca;
 * 2. celular com sessão de dealer → o terminal daquele torneio;
 * 3. aparelho com token de TV → `DisplayTokenGate` (rede de segurança das TVs que ainda abrem a raiz);
 * 4. qualquer outro visitante → a landing, renderizada na própria raiz (sem redirecionar: a URL canônica é `/`).
 *
 * Sem sessão guardada o `AuthProvider` resolve `isLoading=false` na hora, sem chamar `/auth/me`: o visitante novo vê
 * a landing sem esperar a rede. Sessão guardada que o servidor recusa (expirada, revogada) cai no ramo 4: a landing. A TV fica numa rota própria (`/tv`) que não depende do login: se alguém entrar em
 * outra aba do mesmo navegador, o telão não vira o painel.
 */
export function RootGate() {
  const { isAuthenticated, isLoading, isReconnecting } = useAuth()

  if (isLoading) {
    return (
      <GateSpinner text={isReconnecting ? 'Sem conexão com o servidor. Tentando de novo…' : undefined} />
    )
  }

  if (isAuthenticated) return <Navigate to={ROUTES.INICIO} replace />

  const dealer = getDealerSession()
  if (dealer) return <Navigate to={dealerTerminalPath(dealer.tournamentId)} replace />

  const displayToken = getDisplayToken()
  if (displayToken) return <DisplayTokenGate token={displayToken} />

  return <LandingInRoot />
}

function LandingInRoot() {
  return (
    <Suspense fallback={<GateSpinner />}>
      <LandingPage />
    </Suspense>
  )
}

type DisplayDecision = 'checking' | 'tv' | 'landing'

/**
 * Rede de segurança da TV: o aparelho guardou um token de TV. Consulta UMA vez o status (o mesmo
 * `GET public/display/session` do `useDisplaySession`):
 * - `Paired` → `/tv` (a TV da casa que ainda abre a raiz — inclusive a que guardou o 301 antigo de pktv.com.br para a
 *   raiz — continua caindo no telão, sem parear de novo);
 * - `Pending`, TV desconhecida/expirada (401/404) → landing (o celular que só abriu `/tv` uma vez não fica preso);
 *   no 401 o token morto é descartado, como o `useDisplaySession` faz;
 * - erro de rede ou do servidor → `/tv` (quem tem token de TV é quase certamente uma TV, e `/tv` já tem laço de nova
 *   tentativa).
 * A resposta vai para o cache da sessão da TV, então o `/tv` abre sem consultar de novo.
 */
function DisplayTokenGate({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<DisplayDecision>('checking')

  useEffect(() => {
    let cancelled = false
    publicDisplayApi
      .getStatus(token)
      .then((status) => {
        if (cancelled) return
        if (status.status === 'Paired') {
          queryClient.setQueryData(['display-session', token], status)
          setDecision('tv')
        } else {
          setDecision('landing')
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const httpStatus = axios.isAxiosError(err) ? err.response?.status : undefined
        if (httpStatus === 401 || httpStatus === 404) {
          if (httpStatus === 401) setDisplayToken(null)
          setDecision('landing')
          return
        }
        setDecision('tv')
      })
    return () => {
      cancelled = true
    }
  }, [token, queryClient])

  if (decision === 'checking') return <GateSpinner />
  if (decision === 'tv') return <Navigate to={ROUTES.TV} replace />
  return <LandingInRoot />
}
