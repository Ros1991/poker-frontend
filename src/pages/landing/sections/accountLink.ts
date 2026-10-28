/**
 * Botão de conta da landing, do manual e das páginas legais: "Entrar" para o visitante e "Abrir painel" para quem já
 * tem sessão guardada neste navegador (o `/` mostra a landing também para quem está logado).
 */
import { LayoutDashboard, LogIn } from 'lucide-react'
import { hasStoredSession } from '../../../api/client'
import { ROUTES } from '../../../constants/routes'

export function accountLink() {
  return hasStoredSession()
    ? { loggedIn: true, href: ROUTES.HOME_GAMES, Icon: LayoutDashboard }
    : { loggedIn: false, href: ROUTES.LOGIN, Icon: LogIn }
}
