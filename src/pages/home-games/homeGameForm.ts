// Formulário de home game — o mesmo na página (HomeGameFormPage) e na modal (HomeGameFormModal).
//
// SPEC-20261023-1218 (PX15): o PUT do backend copia o pedido INTEIRO (campo ausente vira null), então os dois
// formulários carregam e enviam chave PIX (normalizada, com o tipo), beneficiário e os três valores padrão — antes eles
// mostravam esses campos e não enviavam, e editar o nome apagava tudo. No plano sem pagamentos (Mesa) a seção "Dados
// PIX" fica escondida e a edição reenvia o que já estava gravado, para não apagar nada.
import { z } from 'zod'
import { hasFeature, usePlan } from '../../hooks/usePlan'
import type { CreateHomeGameRequest, HomeGame } from '../../types/homeGame.types'
import { checkPixKey, toPixKeyPayload, type PixKeyType } from '../../utils/pix'

const toNumber = (v: string) => Number(v.trim().replace(',', '.'))
const money = z
  .string()
  .refine((v) => v.trim() === '' || (Number.isFinite(toNumber(v)) && toNumber(v) >= 0), 'Valor inválido')

export const homeGameSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo de 100 caracteres'),
  description: z.string().max(500, 'Máximo de 500 caracteres').optional().or(z.literal('')),
  location: z.string().max(200, 'Máximo de 200 caracteres').optional().or(z.literal('')),
  pixKey: z.string().max(200, 'Máximo de 200 caracteres'),
  pixBeneficiary: z.string().max(100, 'Máximo de 100 caracteres'),
  // Valores como texto (campo vazio = sem valor padrão → null, não 0)
  defaultBuyIn: money,
  defaultRebuy: money,
  defaultAddon: money,
})

export type HomeGameFormData = z.infer<typeof homeGameSchema>

const moneyText = (v: number | null | undefined) => (v == null ? '' : String(v))

/** Valores do formulário: vazios na criação; os gravados na edição (inclusive PIX e valores padrão). */
export function homeGameFormValues(homeGame?: HomeGame | null): HomeGameFormData {
  return {
    name: homeGame?.name ?? '',
    description: homeGame?.description ?? '',
    location: homeGame?.location ?? '',
    pixKey: homeGame?.pixKey ?? '',
    pixBeneficiary: homeGame?.pixBeneficiary ?? '',
    defaultBuyIn: moneyText(homeGame?.defaultBuyIn),
    defaultRebuy: moneyText(homeGame?.defaultRebuy),
    defaultAddon: moneyText(homeGame?.defaultAddon),
  }
}

/**
 * Mostrar a seção "Dados PIX"? Só quando o plano libera pagamentos: na edição, o do DONO (homeGame.planFeatures); na
 * criação, o da própria conta (quem cria é o dono). O Admin do sistema segue a mesma regra (SPEC-20261026-1126). Plano
 * da conta ainda carregando → escondida.
 */
export function useHomeGamePixVisible(homeGame: HomeGame | null | undefined, isEditing: boolean): boolean {
  const { myPlan } = usePlan()
  if (isEditing) return !!homeGame && hasFeature(homeGame.planFeatures, 'Payments')
  return !!myPlan && hasFeature(myPlan.features, 'Payments')
}

/** Mensagem que impede salvar a chave (fora de formato ou CPF × celular sem escolha); null = ok. */
export function homeGamePixError(
  data: HomeGameFormData,
  pixType: PixKeyType | null,
  homeGame: HomeGame | null | undefined,
  showPix: boolean,
): string | null {
  return showPix ? checkPixKey(data.pixKey, pixType, homeGame?.pixKey ?? null).error : null
}

/** Pedido completo (criar e editar mandam tudo; o PUT do backend grava o pedido inteiro). */
export function buildHomeGameRequest(
  data: HomeGameFormData,
  pixType: PixKeyType | null,
  homeGame: HomeGame | null | undefined,
  showPix: boolean,
): CreateHomeGameRequest {
  const savedKey = homeGame?.pixKey ?? null
  // Seção escondida (Mesa): reenvia a chave e o beneficiário gravados (a API mantém a chave antiga como está)
  const pix = showPix ? toPixKeyPayload(data.pixKey, pixType, savedKey) : toPixKeyPayload(savedKey, null, savedKey)
  const beneficiary = showPix ? data.pixBeneficiary.trim() : (homeGame?.pixBeneficiary ?? '')
  const amount = (v: string) => (v.trim() === '' ? null : toNumber(v))
  return {
    name: data.name,
    description: data.description || undefined,
    location: data.location || undefined,
    pixKey: pix.key,
    pixKeyType: pix.type,
    pixBeneficiary: beneficiary || null,
    defaultBuyIn: amount(data.defaultBuyIn),
    defaultRebuy: amount(data.defaultRebuy),
    defaultAddon: amount(data.defaultAddon),
  }
}
