/**
 * "Esta visita é de quem só vai ver a landing?" (SPEC-20261023-1207) — a MESMA decisão do ramo 4 do `RootGate`,
 * tomada antes de carregar o app, para o visitante novo em `/` não baixar o pacote inteiro do painel, do telão e do
 * terminal (Lighthouse mobile ≥ 90).
 *
 * Verdadeiro só quando: caminho `/` E nenhuma sessão de login guardada E nenhuma sessão de dealer E nenhum token de
 * TV. Qualquer outro caso (logado, dealer, TV — inclusive a rede de segurança da TV pareada —, qualquer outra rota)
 * carrega o app completo e o `RootGate` decide como sempre.
 */
import { hasStoredSession } from '../../api/client'
import { getDealerSession, getDisplayToken } from '../../utils/deviceSessions'

export function isLandingVisit(pathname: string = window.location.pathname): boolean {
  if (pathname !== '/') return false
  try {
    return !hasStoredSession() && !getDealerSession() && !getDisplayToken()
  } catch {
    // Navegador sem armazenamento: o app completo decide (mesmo caminho de sempre)
    return false
  }
}
