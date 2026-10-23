// Credenciais de aparelho guardadas no navegador, separadas da sessão do usuário:
// a TV (token do aparelho) e o dealer (acesso por QR, restrito a um torneio).

const DISPLAY_TOKEN_KEY = 'poker_display_token'
const DEALER_SESSION_KEY = 'poker_dealer_session'

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

export interface DealerSession {
  accessToken: string
  tournamentId: string
  tournamentName: string
  expiresAt: string
}

export function getDealerSession(): DealerSession | null {
  const raw = read(DEALER_SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as DealerSession
    if (!session.accessToken || new Date(session.expiresAt).getTime() <= Date.now()) {
      write(DEALER_SESSION_KEY, null)
      return null
    }
    return session
  } catch {
    write(DEALER_SESSION_KEY, null)
    return null
  }
}

export function setDealerSession(session: DealerSession | null) {
  write(DEALER_SESSION_KEY, session ? JSON.stringify(session) : null)
}
