// Credenciais de aparelho guardadas no navegador, separadas da sessão do usuário:
// a TV (token do aparelho) e o dealer (acesso por QR autorizado pelo organizador,
// restrito a um torneio e a este aparelho).

const DISPLAY_TOKEN_KEY = 'poker_display_token'
const DEALER_SESSION_KEY = 'poker_dealer_session'
const DEALER_DEVICE_KEY = 'poker_dealer_device_key'
const DEALER_NAME_KEY = 'poker_dealer_name'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // navegador sem armazenamento (aba anônima restrita): segue só na memória
  }
}

export function getDisplayToken(): string | null {
  return read(DISPLAY_TOKEN_KEY)
}

export function setDisplayToken(token: string | null) {
  write(DISPLAY_TOKEN_KEY, token)
}

// ---- Dealer ----

/** Sessão do dealer neste aparelho: o token vale só para este torneio e para este pedido */
export interface DealerSession {
  accessToken: string
  tournamentId: string
  tournamentName: string
  expiresAt: string
  /** Nome informado ao pedir acesso (vai no selo "Dealer · Nome") */
  dealerName: string
  /** Id do pedido aprovado (sub do token); serve para consultar o motivo quando o acesso cai */
  requestId: string
  /** Chave deste aparelho (a mesma de getDeviceKey) */
  deviceKey: string
}

export function getDealerSession(): DealerSession | null {
  const raw = read(DEALER_SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<DealerSession>
    // Sessão vencida ou do formato antigo (troca direta pelo QR, sem pedido): descarta
    if (
      !session.accessToken ||
      !session.requestId ||
      !session.deviceKey ||
      !session.expiresAt ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      write(DEALER_SESSION_KEY, null)
      return null
    }
    return session as DealerSession
  } catch {
    write(DEALER_SESSION_KEY, null)
    return null
  }
}

export function setDealerSession(session: DealerSession | null) {
  write(DEALER_SESSION_KEY, session ? JSON.stringify(session) : null)
}

// Sem armazenamento, a chave vale só enquanto a página estiver aberta
let memoryDeviceKey: string | null = null

function randomKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Página aberta por http:// fora de localhost (celular na rede local): sem randomUUID
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Chave do aparelho do dealer: gerada UMA vez e guardada. Vai em todo pedido de acesso;
 * só o hash fica no servidor, e o token só é entregue ao aparelho que fez o pedido.
 */
export function getDeviceKey(): string {
  const stored = read(DEALER_DEVICE_KEY)
  if (stored && stored.length >= 1 && stored.length <= 128) return stored
  if (!memoryDeviceKey) memoryDeviceKey = randomKey()
  write(DEALER_DEVICE_KEY, memoryDeviceKey)
  return memoryDeviceKey
}

/** Último nome informado neste aparelho (pré-preenche o formulário) */
export function getDealerName(): string {
  return read(DEALER_NAME_KEY) ?? ''
}

export function setDealerName(name: string) {
  write(DEALER_NAME_KEY, name.trim() ? name : null)
}
