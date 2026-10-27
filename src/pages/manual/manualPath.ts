/**
 * Caminhos do manual público (SPEC-20261026-1910). Arquivo pequeno e sem dependências: o `boot.tsx` o importa para
 * decidir, antes de baixar o app, se a visita é do manual (que carrega à parte, como a landing).
 */
const BASE = '/manual'

/** `/manual`, `/manual/` e `/manual/<módulo>` — com ou sem sessão, o manual abre sozinho (sem o pacote do painel). */
export function isManualPath(pathname: string = window.location.pathname): boolean {
  return pathname === BASE || pathname.startsWith(`${BASE}/`)
}

/** Slug do módulo em `/manual/<módulo>` (ou null no índice). */
export function manualSlugFromPath(pathname: string = window.location.pathname): string | null {
  if (!isManualPath(pathname)) return null
  const rest = pathname.slice(BASE.length).replace(/^\/+|\/+$/g, '')
  if (!rest) return null
  try {
    return decodeURIComponent(rest.split('/')[0]).toLowerCase()
  } catch {
    return rest.split('/')[0].toLowerCase()
  }
}
