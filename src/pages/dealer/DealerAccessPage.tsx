import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { QrCode } from 'lucide-react'
import * as dealerAccessApi from '../../api/dealerAccess.api'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { setDealerSession } from '../../utils/deviceSessions'
import { dealerTerminalPath } from '../../constants/routes'

/** O dealer leu o QR: troca o código por um acesso ao terminal daquele torneio. */
export function DealerAccessPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    dealerAccessApi
      .exchange(code)
      .then((access) => {
        if (cancelled) return
        setDealerSession({
          accessToken: access.accessToken,
          tournamentId: access.tournamentId,
          tournamentName: access.tournamentName,
          expiresAt: access.expiresAt,
        })
        navigate(dealerTerminalPath(access.tournamentId), { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        setError(
          status === 429
            ? 'Muitas tentativas seguidas. Espere um minuto e leia o QR de novo.'
            : status === 400
              ? 'Este QR não vale mais. Peça um novo ao organizador.'
              : 'Sem conexão com o servidor. Leia o QR de novo em instantes.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [code, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      {error ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <QrCode className="h-12 w-12 text-accent-yellow" />
          <p className="text-lg font-semibold text-text-primary">Não deu para abrir o terminal</p>
          <p className="text-text-secondary">{error}</p>
        </div>
      ) : (
        <LoadingSpinner size="lg" text="Abrindo o terminal do dealer…" />
      )}
    </div>
  )
}
