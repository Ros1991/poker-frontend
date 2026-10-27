// Torneio knockout (SPEC-20261026-1909) — as mesmas regras do backend (KnockoutRules), num lugar só da tela.
//  - Formato: Normal ('None'), Knockout simples ('Simple') ou Knockout progressivo ('Progressive', PKO).
//  - Bounty: valor fixo por entrada, PARTE do buy-in (o resto vai para o prize pool); cada rebuy compra um bounty novo do
//    mesmo valor, que entra na cabeça do jogador; add-on não tem bounty.
//  - Eliminação: no simples quem elimina leva 100% da cabeça do eliminado; no PKO leva metade em dinheiro e a outra
//    metade soma na própria cabeça. Quem nunca foi eliminado (o campeão) fica com a própria cabeça no fim.

export type KnockoutType = 'None' | 'Simple' | 'Progressive'

export const KNOCKOUT_TYPES: KnockoutType[] = ['None', 'Simple', 'Progressive']

/** Nome do formato nas telas */
export const KNOCKOUT_LABELS: Record<KnockoutType, string> = {
  None: 'Normal',
  Simple: 'Knockout simples',
  Progressive: 'Knockout progressivo (PKO)',
}

/** Selo curto (telão, cabeçalho do painel) */
export const KNOCKOUT_BADGES: Record<KnockoutType, string> = {
  None: 'Normal',
  Simple: 'Knockout',
  Progressive: 'PKO',
}

/** Uma linha sobre o formato, para o formulário */
export const KNOCKOUT_HINTS: Record<KnockoutType, string> = {
  None: 'Sem bounty: todo o buy-in vai para o prize pool.',
  Simple: 'Quem elimina leva o bounty inteiro do eliminado.',
  Progressive: 'Quem elimina leva metade do bounty em dinheiro e a outra metade soma na própria cabeça.',
}

interface KnockoutLike {
  knockoutType?: string | null
  bountyAmount?: number | null
}

export function knockoutTypeOf(t: KnockoutLike | null | undefined): KnockoutType {
  const k = t?.knockoutType
  return k === 'Simple' || k === 'Progressive' ? k : 'None'
}

/** Torneio knockout de verdade (formato + bounty > 0), como o servidor confere */
export function isKnockout(t: KnockoutLike | null | undefined): boolean {
  return knockoutTypeOf(t) !== 'None' && (t?.bountyAmount ?? 0) > 0
}

export function isProgressive(t: KnockoutLike | null | undefined): boolean {
  return isKnockout(t) && knockoutTypeOf(t) === 'Progressive'
}

/** Divide a cabeça como o servidor: simples = tudo em dinheiro; PKO = metade (arredondada para baixo no centavo) */
export function splitBounty(t: KnockoutLike | null | undefined, head: number): { cash: number; toHead: number } {
  if (!(head > 0)) return { cash: 0, toHead: 0 }
  if (!isProgressive(t)) return { cash: head, toHead: 0 }
  const cash = Math.floor(Math.round(head * 100) / 2) / 100
  return { cash, toHead: Math.round((head - cash) * 100) / 100 }
}

interface BountyEntryLike {
  bountyHead?: number | null
  bountyWon?: number | null
  eliminatedAt?: string | null
}

/** Fica com a própria cabeça no acerto: quem nunca foi eliminado (o campeão, ou quem jogava quando o torneio encerrou) */
export function keepsOwnHead(entry: BountyEntryLike): boolean {
  return !entry.eliminatedAt && (entry.bountyHead ?? 0) > 0
}

/** Bounty a receber no acerto final: o que ganhou eliminando + a própria cabeça de quem não foi eliminado */
export function bountyToReceive(entry: BountyEntryLike): number {
  return Math.round(((entry.bountyWon ?? 0) + (keepsOwnHead(entry) ? (entry.bountyHead ?? 0) : 0)) * 100) / 100
}

/**
 * Validação do formulário (mesmas mensagens do servidor): no knockout o bounty é obrigatório, menor que o buy-in (o
 * resto vai para o prize pool) e, com rebuy, até o valor do rebuy (cada rebuy compra um bounty novo). Null = ok.
 */
export function bountyError(type: KnockoutType, bounty: number, buyIn: number, rebuy: number | null | undefined): string | null {
  if (type === 'None') return null
  if (!(bounty > 0)) return 'Informe o valor do bounty do torneio knockout.'
  if (bounty >= buyIn) return 'O bounty é parte do buy-in: precisa ser menor que o buy-in (o resto vai para o prize pool).'
  if ((rebuy ?? 0) > 0 && bounty > (rebuy ?? 0))
    return 'Cada rebuy compra um bounty novo: o bounty não pode passar do valor do rebuy.'
  return null
}
