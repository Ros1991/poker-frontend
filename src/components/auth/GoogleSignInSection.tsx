import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { errorStatus } from '../../utils/httpErrors'
import { GoogleButtonSkeleton, GoogleRetryNotice } from './GoogleButtonPlaceholder'
import { GoogleSignInButton } from './GoogleSignInButton'
import { isEmbeddedBrowser, loadExternalProviders, retryDelayMs } from './googleIdentity'
import type { GoogleRetryReason } from './googleIdentity'

interface GoogleSignInSectionProps {
  context: 'signin' | 'signup'
  /** Texto do separador antes do formulário de e-mail (ex.: "ou entre com seu e-mail") */
  dividerText: string
  onCredential: (idToken: string, nonce: string) => Promise<void> | void
  /** Entrando (depois do popup, esperando a API) */
  busy?: boolean
  /** Erro do último login com o Google (mensagem pronta para a tela) */
  error?: string | null
}

type Availability =
  | { status: 'loading' }
  | { status: 'off' }
  | { status: 'ready'; clientId: string }
  | { status: 'unavailable' }

/**
 * Bloco "Continuar com o Google" das telas Entrar e Criar conta (SPEC-20261023-1210): botão oficial, aviso dos
 * termos e o separador antes do formulário de e-mail. Só fica quando a API diz que o Google está ligado
 * (GET auth/external/providers); sem isso a tela fica só com e-mail e senha, como antes.
 * Enquanto a resposta não chega, o bloco já ocupa o MESMO espaço (esqueleto do botão + termos + separador): o
 * formulário de e-mail não desce ~130 px no meio da digitação. Só o raro "Google desligado" tira o bloco.
 */
export function GoogleSignInSection({ context, dividerText, onCredential, busy = false, error }: GoogleSignInSectionProps) {
  const [availability, setAvailability] = useState<Availability>({ status: 'loading' })
  // Navegador dentro de app (Instagram, Facebook...): o Google recusa o login ali
  const [embedded] = useState(() => isEmbeddedBrowser())
  // GET auth/external/providers falhou (429, rede, API reiniciando): tenta de novo sozinho, sem tirar o bloco
  const [providersTrouble, setProvidersTrouble] = useState<GoogleRetryReason | null>(null)

  useEffect(() => {
    let cancelled = false
    let failures = 0
    let timer: number | undefined
    function load() {
      loadExternalProviders()
        .then((providers) => {
          if (cancelled) return
          const google = providers.find((p) => p.provider === 'google' && p.clientId)
          setProvidersTrouble(null)
          setAvailability(google ? { status: 'ready', clientId: google.clientId } : { status: 'off' })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          // Falha passageira: e-mail e senha seguem funcionando e o botão do Google aparece quando a API responder
          const reason: GoogleRetryReason = errorStatus(err) === 429 ? 'rate' : 'network'
          setProvidersTrouble(reason)
          timer = window.setTimeout(load, retryDelayMs(failures, reason))
          failures += 1
        })
    }
    load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  if (availability.status === 'off') return null

  const showBrowserNotice = embedded || availability.status === 'unavailable'

  return (
    <div className="flex flex-col gap-3" data-google-section={availability.status}>
      {availability.status === 'loading' && (
        <div className="flex flex-col gap-2">
          <GoogleButtonSkeleton framed />
          {providersTrouble && <GoogleRetryNotice reason={providersTrouble} />}
        </div>
      )}

      {availability.status === 'ready' && (
        <GoogleSignInButton
          clientId={availability.clientId}
          context={context}
          onCredential={onCredential}
          onUnavailable={() => setAvailability({ status: 'unavailable' })}
        />
      )}

      {showBrowserNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3" role="note">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" aria-hidden="true" />
          <div className="min-w-0 text-sm text-text-primary">
            <p className="font-semibold">Abra no navegador para entrar com o Google</p>
            <p className="mt-1 text-text-secondary">
              {availability.status === 'unavailable'
                ? 'O botão do Google não carregou aqui. Se você abriu o link dentro de um app (WhatsApp, Instagram), use o menu do app e escolha abrir no navegador.'
                : 'O Google não deixa entrar por dentro de apps como Instagram e Facebook. Use o menu do app e escolha abrir no navegador.'}{' '}
              E-mail e senha funcionam em qualquer lugar.
            </p>
          </div>
        </div>
      )}

      {busy && (
        <p className="text-center text-sm text-text-secondary" role="status">
          Entrando com o Google…
        </p>
      )}

      {error && (
        <p
          className="rounded-lg border border-accent-red/40 bg-accent-red-soft p-3 text-sm text-accent-red-deep"
          role="alert"
        >
          {error}
        </p>
      )}

      <p className="text-center text-xs text-text-secondary">
        Ao continuar, você concorda com os{' '}
        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-blue hover:underline"
        >
          Termos de uso
        </a>{' '}
        e a{' '}
        <a
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-blue hover:underline"
        >
          Política de privacidade
        </a>
        .
      </p>

      <div className="flex items-center gap-3" role="separator" aria-label={dividerText}>
        <span className="h-px flex-1 bg-border-default" aria-hidden="true" />
        <span className="text-xs text-text-secondary">{dividerText}</span>
        <span className="h-px flex-1 bg-border-default" aria-hidden="true" />
      </div>
    </div>
  )
}
