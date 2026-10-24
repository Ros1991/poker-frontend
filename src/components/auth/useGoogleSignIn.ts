import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { linkRequiredFromError } from '../../api/auth.api'
import { ACCOUNT_DISABLED_CODE } from '../../types/auth.types'
import type { ExternalLinkRequired } from '../../types/auth.types'
import { errorCode, errorMessage, errorStatus } from '../../utils/httpErrors'

const GOOGLE_FAIL = 'Não foi possível entrar com o Google. Tente de novo.'

/**
 * Fluxo do botão do Google nas telas Entrar e Criar conta (SPEC-20261023-1210): manda o ID token à API e,
 * conforme a resposta, entra e volta para `returnTo` (ex.: /parear/CODIGO), mostra o erro, ou pede a senha da
 * conta (409 link_requires_password → `linkRequired`).
 */
export function useGoogleSignIn(returnTo: string) {
  const { loginWithExternal } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkRequired, setLinkRequired] = useState<ExternalLinkRequired | null>(null)
  // Ticket de um 409 que a pessoa abandonou ("Cancelar"): vai junto no próximo clique para o servidor descartar
  const abandonedTicket = useRef<string | null>(null)

  const handleCredential = useCallback(
    async (idToken: string, nonce: string) => {
      setBusy(true)
      setError(null)
      const linkTicket = abandonedTicket.current ?? undefined
      abandonedTicket.current = null
      try {
        await loginWithExternal('google', { idToken, nonce, linkTicket })
        navigate(returnTo, { replace: true })
      } catch (err) {
        const link = linkRequiredFromError(err)
        if (link) {
          setLinkRequired(link)
          return
        }
        const status = errorStatus(err)
        if (status === 429) setError('Muitas tentativas seguidas. Espere um minuto e tente de novo.')
        else if (status === 403 && errorCode(err) === ACCOUNT_DISABLED_CODE)
          setError(errorMessage(err) ?? 'Conta desativada. Fale com o suporte.')
        else if (status === 400) setError(errorMessage(err) ?? GOOGLE_FAIL)
        else setError(GOOGLE_FAIL)
      } finally {
        setBusy(false)
      }
    },
    [loginWithExternal, navigate, returnTo],
  )

  const cancelLink = useCallback(() => {
    if (linkRequired) abandonedTicket.current = linkRequired.ticket
    setLinkRequired(null)
  }, [linkRequired])

  return { busy, error, linkRequired, handleCredential, cancelLink }
}
