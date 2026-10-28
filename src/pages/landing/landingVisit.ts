/**
 * "Esta visita é de quem só vai ver a landing?" (SPEC-20261023-1207) — a MESMA decisão do `RootGate`, tomada antes de
 * carregar o app, para quem abre `/` não baixar o pacote inteiro do painel, do telão e do terminal (Lighthouse
 * mobile ≥ 90).
 *
 * Verdadeiro quando o caminho é `/` E: há sessão de login guardada (logado vê a landing com "Abrir painel"), OU não há
 * sessão de dealer nem token de TV. Sem login, o dealer e a TV (rede de segurança da TV pareada) carregam o app
 * completo e o `RootGate` decide.
 */
import { hasStoredSession } from '../../api/client'
import { getDealerSession, getDisplayToken } from '../../utils/deviceSessions'

export function isLandingVisit(pathname: string = window.location.pathname): boolean {
  if (pathname !== '/') return false
  try {
    return hasStoredSession() || (!getDealerSession() && !getDisplayToken())
  } catch {
    // Navegador sem armazenamento: o app completo decide (mesmo caminho de sempre)
    return false
  }
}
