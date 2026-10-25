// Apoio das boas-vindas (SPEC-20261023-1212): rascunho da etapa 1, destino ao terminar e a mensagem do suporte.
import * as homeGamesApi from '../../api/homeGames.api'
import { ROUTES } from '../../constants/routes'
import type { PlanName } from '../../types/plan.types'
import type { Profile } from '../../types/profile.types'
import { cleanWhatsapp } from '../../utils/phone'
import { forgetReturn, specificReturn, takeReturn } from '../../utils/welcomeReturn'

/** Etapas: 1 Completar cadastro → 2 Escolher plano → (Clube/Liga) pedido registrado. */
export type WelcomeStep = 'perfil' | 'plano' | 'pedido'

/**
 * O que a etapa 1 manda no `POST me/onboarding`. `null` (o "Fazer depois") = não mexe em nada do perfil.
 * `whatsapp` = só os dígitos locais (DDD + número); o servidor grava com o 55.
 */
export interface ProfileDraft {
  nickname: string
  whatsapp: string
  /** Só quando a foto atual é a do Google; senão null (não mexe) */
  useProviderPhoto: boolean | null
}

/** Rascunho inicial a partir do que a conta já tem (o cadastro por senha já pode ter apelido e WhatsApp). */
export function draftFromProfile(profile: Profile): ProfileDraft {
  return {
    nickname: profile.nickname ?? '',
    whatsapp: cleanWhatsapp(profile.whatsapp) ?? '',
    useProviderPhoto: profile.photoFromProvider ? true : null,
  }
}

export type ProfileDraftErrors = Partial<Record<'nickname' | 'whatsapp', string>>

/**
 * Para onde ir depois das boas-vindas: a página de origem (o `state.from` do ProtectedRoute ou o retorno guardado
 * antes do login — ex.: `/parear/CODIGO` do QR da TV); sem origem, quem já participa de algum home game vai para o
 * painel e quem não tem nenhum vai criar o primeiro.
 */
export async function welcomeDestination(from: string | null): Promise<string> {
  const origin = specificReturn(from) ?? takeReturn()
  forgetReturn()
  if (origin) return origin
  try {
    const homeGames = await homeGamesApi.getAll()
    return homeGames.length > 0 ? ROUTES.HOME_GAMES : ROUTES.HOME_GAME_NEW
  } catch {
    return ROUTES.HOME_GAMES
  }
}

/** Mensagem pronta do WhatsApp do suporte ao pedir Clube/Liga nas boas-vindas. */
export function welcomePlanMessage(plan: PlanName, email: string | null | undefined): string {
  const first = `Olá! Quero o plano ${plan} para o meu home game.`
  return email ? `${first}\nMinha conta: ${email}` : first
}

/** Texto do botão de cada plano na tabela das boas-vindas. */
export const WELCOME_CHOOSE_LABELS: Record<PlanName, string> = {
  Mesa: 'Começar grátis',
  Clube: 'Quero o Clube',
  Liga: 'Quero a Liga',
}
