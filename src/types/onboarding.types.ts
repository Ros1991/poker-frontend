// Boas-vindas no primeiro acesso (SPEC-20261023-1212): espelho de `POST me/onboarding` (OnboardingRequest no backend).
// A resposta é o mesmo `Profile` de `GET me` (agora com `needsOnboarding = false`).
import type { PlanName } from './plan.types'

export interface OnboardingRequest {
  /** Até 100 caracteres. Ausente/null = mantém o que está gravado; vazio = sem apelido */
  nickname?: string | null
  /** Com ou sem 55/máscara; o servidor grava 55 + DDD + número. Ausente/null = mantém; vazio = sem WhatsApp */
  whatsapp?: string | null
  /** Foto do Google: true = fica; false = sai (só se a foto atual for a do Google); ausente/null = não mexe */
  useProviderPhoto?: boolean | null
  /** Mesa começa na hora; Clube/Liga só registram o pedido (o plano muda pelo Admin) */
  plan: PlanName
}
