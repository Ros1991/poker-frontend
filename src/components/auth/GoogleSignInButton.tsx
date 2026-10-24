import { useEffect, useRef, useState } from 'react'
import * as authApi from '../../api/auth.api'
import { errorStatus } from '../../utils/httpErrors'
import { GoogleButtonSkeleton, GoogleRetryNotice } from './GoogleButtonPlaceholder'
import { loadGoogleIdentity, nonceFromIdToken, retryDelayMs } from './googleIdentity'
import type { GoogleAccountsId, GoogleCredentialResponse, GoogleRetryReason } from './googleIdentity'
import type { ExternalNonceResponse } from '../../types/auth.types'

interface GoogleSignInButtonProps {
  /** Client ID público (vem de GET auth/external/providers) */
  clientId: string
  /** "signin" na tela Entrar, "signup" na de Criar conta (muda só o texto da janela do Google) */
  context: 'signin' | 'signup'
  /**
   * Recebe o ID token e o nonce que está dentro dele. Quando a promessa termina (deu certo ou não), o botão
   * já pede outro nonce à API: cada nonce vale para uma tentativa só.
   */
  onCredential: (idToken: string, nonce: string) => Promise<void> | void
  /** O script do Google não carregou (bloqueado, sem rede, navegador embutido) */
  onUnavailable: () => void
}

// Faixa de largura que o botão oficial aceita
const MIN_WIDTH = 200
const MAX_WIDTH = 400
/** O botão sai da tela um pouco antes do nonce vencer (o clique levaria um nonce que o servidor já recusa). */
const EXPIRY_MARGIN_MS = 5000

function buttonWidth(el: HTMLElement) {
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, el.clientWidth)))
}

/**
 * Botão oficial "Continuar com o Google" (Google Identity Services, popup — a página não sai do lugar, então
 * o retorno para /parear/CODIGO continua valendo). Antes de cada clique o botão carrega um nonce de uso único
 * emitido pela API (POST auth/external/nonce) e o renova antes de vencer (10 min).
 *
 * Duas falhas diferentes: o script do Google não carregou → `onUnavailable` (o bloco mostra "Abra no
 * navegador"); o nonce não veio (429, API reiniciando, Wi-Fi caiu) → o botão continua montado, mostra um aviso
 * neutro e tenta de novo sozinho (5 s, 15 s, 60 s...). Enquanto não houver nonce que valha, o botão oficial
 * fica escondido atrás do esqueleto: clicar com um nonce gasto ou vencido só daria erro.
 */
export function GoogleSignInButton({ clientId, context, onCredential, onUnavailable }: GoogleSignInButtonProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  const onUnavailableRef = useRef(onUnavailable)
  const [ready, setReady] = useState(false)
  const [trouble, setTrouble] = useState<GoogleRetryReason | null>(null)

  // Sempre a versão mais recente dos callbacks, sem reinicializar o Google a cada render
  useEffect(() => {
    onCredentialRef.current = onCredential
    onUnavailableRef.current = onUnavailable
  })

  useEffect(() => {
    let cancelled = false
    let gis: GoogleAccountsId | null = null
    /** Nonce que veio da API e ainda não foi entregue ao Google (o script ainda está carregando). */
    let pending: ExternalNonceResponse | null = null
    /** Nonce em vigor no botão ('' = nenhum que valha). */
    let nonce = ''
    let renderedWidth = 0
    let failures = 0
    let refreshTimer: number | undefined
    let retryTimer: number | undefined
    let expireTimer: number | undefined

    function render() {
      const frame = frameRef.current
      const target = targetRef.current
      if (!frame || !target || !gis) return
      renderedWidth = buttonWidth(frame)
      target.replaceChildren()
      gis.renderButton(target, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width: renderedWidth,
        locale: 'pt-BR',
      })
    }

    /** Some com o botão oficial (nonce gasto ou vencido) até chegar outro nonce. */
    function hideButton() {
      nonce = ''
      window.clearTimeout(expireTimer)
      if (targetRef.current) targetRef.current.style.display = 'none'
      setReady(false)
    }

    function apply(issued: ExternalNonceResponse) {
      if (!gis) {
        pending = issued
        return
      }
      pending = null
      nonce = issued.nonce
      gis.initialize({
        client_id: clientId,
        callback: handleCredential,
        nonce,
        context,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      })
      if (targetRef.current) targetRef.current.style.display = ''
      render()
      setReady(true)
      setTrouble(null)
      // Renova o nonce 90 s antes de vencer, para quem deixa a tela aberta
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => void refreshNonce(), Math.max(60, issued.expiresIn - 90) * 1000)
      // Se a renovação não der certo até o fim, o botão sai antes de o nonce vencer
      window.clearTimeout(expireTimer)
      const current = nonce
      expireTimer = window.setTimeout(
        () => {
          if (!cancelled && nonce === current) hideButton()
        },
        Math.max(0, issued.expiresIn * 1000 - EXPIRY_MARGIN_MS),
      )
    }

    async function refreshNonce() {
      window.clearTimeout(refreshTimer)
      window.clearTimeout(retryTimer)
      let issued: ExternalNonceResponse
      try {
        issued = await authApi.getExternalNonce()
      } catch (err) {
        if (cancelled) return
        // 429 do limite por IP, API reiniciando, rede caiu: não é "navegador embutido". Tenta de novo sozinho.
        const reason: GoogleRetryReason = errorStatus(err) === 429 ? 'rate' : 'network'
        setTrouble(reason)
        retryTimer = window.setTimeout(() => void refreshNonce(), retryDelayMs(failures, reason))
        failures += 1
        return
      }
      if (cancelled) return
      failures = 0
      apply(issued)
    }

    function handleCredential(response: GoogleCredentialResponse) {
      if (!response.credential || cancelled) return
      // O nonce que vale é o que está DENTRO do token: o popup pode ter sido aberto antes de uma renovação, e aí
      // o nonce do botão já é outro (o servidor confere e gasta o do token)
      const usedNonce = nonceFromIdToken(response.credential) ?? nonce
      void Promise.resolve(onCredentialRef.current(response.credential, usedNonce)).finally(() => {
        if (cancelled) return
        // Nonce gasto (ou recusado): o próximo clique precisa de outro. Se o gasto foi o de antes da renovação,
        // o do botão continua valendo.
        if (usedNonce === nonce || !nonce) {
          hideButton()
          void refreshNonce()
        }
      })
    }

    void refreshNonce()
    loadGoogleIdentity()
      .then((id) => {
        if (cancelled) return
        gis = id
        if (pending) apply(pending)
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current()
      })

    // Girou o celular / mudou a largura: redesenha o botão na largura nova
    const observer = new ResizeObserver(() => {
      const frame = frameRef.current
      if (frame && gis && nonce && Math.abs(buttonWidth(frame) - renderedWidth) > 8) render()
    })
    if (frameRef.current) observer.observe(frameRef.current)

    return () => {
      cancelled = true
      window.clearTimeout(refreshTimer)
      window.clearTimeout(retryTimer)
      window.clearTimeout(expireTimer)
      observer.disconnect()
    }
  }, [clientId, context])

  return (
    <div className="flex flex-col gap-2">
      <div ref={frameRef} className="flex min-h-[44px] w-full items-center justify-center">
        {!ready && <GoogleButtonSkeleton />}
        <div ref={targetRef} className="flex justify-center" data-google-button="" />
      </div>
      {!ready && trouble && <GoogleRetryNotice reason={trouble} />}
    </div>
  )
}
