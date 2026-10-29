/**
 * Botão de conta da landing, do manual e das páginas legais: sempre "Entrar" (SPEC-20261029-1724). Quem está logado não
 * vê mais a landing em `/` (vai para o Início); no manual e nas páginas legais, "Entrar" leva ao login, que manda quem
 * já tem sessão direto para o Início.
 */
import { LogIn } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'

export function accountLink() {
  return { href: ROUTES.LOGIN, Icon: LogIn }
}
