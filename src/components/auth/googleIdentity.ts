import * as authApi from '../../api/auth.api'
import type { ExternalProviderInfo } from '../../types/auth.types'

// Google Identity Services (GIS) — SPEC-20261023-1210. O script do Google só é carregado nas telas
// que mostram o botão (Entrar e Criar conta; depois o perfil, SPEC-20261023-1211), nunca no resto do app.

/** Resposta do botão: `credential` é o ID token (JWT) assinado pelo Google. */
export interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce?: string
  ux_mode?: 'popup' | 'redirect'
  context?: 'signin' | 'signup' | 'use'
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  itp_support?: boolean
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

export interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void
  cancel: () => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Falha passageira ao preparar o botão: limite por IP (429) ou rede/API fora. */
export type GoogleRetryReason = 'network' | 'rate'

/** Esperas entre as novas tentativas (a última se repete até dar certo). */
const RETRY_DELAYS_MS = [5000, 15000, 60000]
/** No 429 (limite anônimo por IP, janela de 1 min) a nova tentativa não vem antes disto. */
const RATE_LIMIT_MIN_DELAY_MS = 15000

/** Quanto esperar antes da próxima tentativa, depois de `failures` falhas seguidas (0 = primeira falha). */
export function retryDelayMs(failures: number, reason: GoogleRetryReason): number {
  const base = RETRY_DELAYS_MS[Math.min(Math.max(failures, 0), RETRY_DELAYS_MS.length - 1)]
  return reason === 'rate' ? Math.max(base, RATE_LIMIT_MIN_DELAY_MS) : base
}
const LOAD_TIMEOUT_MS = 12000

let gisPromise: Promise<GoogleAccountsId> | null = null

/** Carrega o script do Google uma vez por página. Falha (bloqueado, sem rede, timeout) rejeita e libera nova tentativa. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (!gisPromise) {
    gisPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
      const script = existing ?? document.createElement('script')
      const timer = window.setTimeout(() => reject(new Error('Google Identity: tempo esgotado')), LOAD_TIMEOUT_MS)
      script.addEventListener('load', () => {
        window.clearTimeout(timer)
        const id = window.google?.accounts?.id
        if (id) resolve(id)
        else reject(new Error('Google Identity: script sem google.accounts.id'))
      })
      script.addEventListener('error', () => {
        window.clearTimeout(timer)
        reject(new Error('Google Identity: script não carregou'))
      })
      if (!existing) {
        script.src = GIS_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
    }).catch((err: unknown) => {
      // Libera nova tentativa com um script novo (o elemento que falhou não dispara load de novo)
      document.querySelector(`script[src="${GIS_SRC}"]`)?.remove()
      gisPromise = null
      throw err
    })
  }
  return gisPromise
}

let providersPromise: Promise<ExternalProviderInfo[]> | null = null

/** Provedores ligados no servidor (cache da página: entrar ↔ criar conta não busca de novo). */
export function loadExternalProviders(): Promise<ExternalProviderInfo[]> {
  if (!providersPromise) {
    providersPromise = authApi
      .getExternalProviders()
      .then((r) => (Array.isArray(r.providers) ? r.providers : []))
      .catch((err: unknown) => {
        providersPromise = null
        throw err
      })
  }
  return providersPromise
}

/**
 * Navegador embutido em app (Instagram, Facebook, TikTok, WebView do Android, WKWebView no iPhone): o
 * Google recusa o login ali (`disallowed_useragent`). Heurística pelo User-Agent — erra para o lado de
 * avisar, e o botão continua na tela.
 */
export function isEmbeddedBrowser(userAgent: string = navigator.userAgent): boolean {
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|WhatsApp/i.test(userAgent))
    return true
  if (/Android/i.test(userAgent) && /; wv\)/.test(userAgent)) return true
  // iPhone/iPad: WKWebView de app não traz o "Safari/" que o Safari e o Chrome do iOS (CriOS) trazem
  if (/iPhone|iPad|iPod/i.test(userAgent) && /AppleWebKit/i.test(userAgent) && !/Safari\//i.test(userAgent))
    return true
  return false
}

/**
 * Claim `nonce` do ID token (o payload base64url do JWT), só para saber QUAL nonce foi no popup — o botão pode ter
 * renovado o dele enquanto a janela do Google estava aberta. Não valida nada: quem confere assinatura, emissor,
 * validade e o próprio nonce (e o gasta) é o servidor. Null = token ilegível.
 */
export function nonceFromIdToken(idToken: string): string | null {
  const payload = idToken.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    const nonce = claims && typeof claims === 'object' ? (claims as { nonce?: unknown }).nonce : undefined
    return typeof nonce === 'string' && nonce ? nonce : null
  } catch {
    return null
  }
}
