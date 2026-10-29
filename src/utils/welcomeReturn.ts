/**
 * Para onde voltar depois das boas-vindas (SPEC-20261023-1212).
 *
 * O caminho normal é o `state.from` que o `ProtectedRoute` passa ao mandar para `/boas-vindas` (ex.: o QR da TV abriu
 * `/parear/CODIGO`, a pessoa entrou com o Google e caiu nas boas-vindas). Quando a conta nasce por cadastro com senha,
 * o retorno passa pelo e-mail de confirmação (outra aba, sem `state`): por isso o `ProtectedRoute` também guarda aqui,
 * por 2 horas, a página protegida que mandou para o login.
 *
 * API estável:
 * - `rememberReturn(path)` — guarda (só caminho interno e específico; "/", "/inicio", "/home-games" e telas de entrada
 *   não).
 * - `takeReturn()` — devolve o caminho guardado e ainda válido (ou null) e apaga.
 * - `forgetReturn()` — apaga (a conta entrou e já estava integrada: o retorno guardado não vale mais).
 * - `specificReturn(path)` — o caminho, se for específico e interno; null para os genéricos.
 */
const KEY = 'poker_welcome_return'
const TTL_MS = 2 * 60 * 60 * 1000

/** Caminhos que não são "a página de origem": o destino padrão das boas-vindas decide. */
const GENERIC = new Set(['/', '/inicio', '/home-games', '/boas-vindas', '/login', '/register'])

export function specificReturn(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return GENERIC.has(pathname) ? null : path
}

export function rememberReturn(path: string): void {
  const value = specificReturn(path)
  if (!value) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ path: value, at: Date.now() }))
  } catch {
    // navegador sem armazenamento: fica só o state.from
  }
}

export function forgetReturn(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a apagar
  }
}

export function takeReturn(): string | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  forgetReturn()
  if (!raw) return null
  try {
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof saved.path !== 'string' || typeof saved.at !== 'number') return null
    if (Date.now() - saved.at > TTL_MS) return null
    return specificReturn(saved.path)
  } catch {
    return null
  }
}

/** Há retorno guardado? (sem apagar) */
export function hasStoredReturn(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}
