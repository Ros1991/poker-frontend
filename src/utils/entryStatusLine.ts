// Situação do jogador em texto corrido — a MESMA frase no card do dealer (PlayerCard) e na 2ª linha do telão
// (TvDisplayPage): "2 rebuys · Add-on · Deve R$ 50,00" (SPEC-20261029-1720, D1). Os pedaços vêm separados para quem
// colore cada um (o "Deve" em vermelho, o "Pago" em verde, a cabeça do PKO em roxo).

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "Sem rebuy" / "1 rebuy" / "3 rebuys" */
export function rebuyCountLabel(count: number): string {
  return count > 0 ? `${count} rebuy${count > 1 ? 's' : ''}` : 'Sem rebuy'
}

/** "Sem add-on" / "Add-on" / "3 add-ons" */
export function addonCountLabel(count: number): string {
  return count <= 0 ? 'Sem add-on' : count === 1 ? 'Add-on' : `${count} add-ons`
}

/** Cor do trecho do saldo: devendo (vermelho), pagou a mais (azul) ou pago (verde) */
export type DueTone = 'due' | 'over' | 'paid'

/** Classes do trecho do saldo (texto pequeno: variante -deep, que passa AA; o azul base já passa) */
export const DUE_TONE_CLASS: Record<DueTone, string> = {
  due: 'font-semibold tabular-nums text-accent-red-deep',
  over: 'font-semibold tabular-nums text-accent-blue',
  paid: 'font-semibold text-accent-green-deep',
}

/**
 * Saldo do jogador (devido − pago, em reais): "Deve R$ 50,00", "Pagou a mais R$ 20,00" (pago acima do devido) ou
 * "Pago". Arredonda aos centavos antes de decidir.
 */
export function dueStatus(balance: number): { text: string; tone: DueTone } {
  const cents = Math.round((balance || 0) * 100) / 100
  if (cents > 0) return { text: `Deve ${BRL.format(cents)}`, tone: 'due' }
  if (cents < 0) return { text: `Pagou a mais ${BRL.format(-cents)}`, tone: 'over' }
  return { text: 'Pago', tone: 'paid' }
}

/** Cabeça do PKO no telão: "Cabeça 75" / "Cabeça 87,50" (em reais, sem o "R$") */
export function bountyHeadText(value: number): string {
  const v = value || 0
  return `Cabeça ${v.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`
}

export type EntryStatusKind = 'rebuys' | 'addons' | 'head' | 'due'

export interface EntryStatusPart {
  kind: EntryStatusKind
  text: string
  /** Só no trecho do saldo */
  tone?: DueTone
}

export interface EntryStatusInput {
  rebuyCount: number
  addonCount: number
  /** Devido − pago (só entra com `showMoney`) */
  balance?: number
  /** Cabeça atual do PKO (só entra com `pko`) */
  bountyHead?: number | null
}

export interface EntryStatusOptions {
  /** Recurso Payments do plano: sem ele, a linha não tem o trecho do "Deve"/"Pago" */
  showMoney: boolean
  /** Torneio PKO: a cabeça entra na linha, depois dos add-ons */
  pko?: boolean
}

/** Pedaços da linha, na ordem: rebuys · add-ons · cabeça (PKO) · saldo (Payments) */
export function entryStatusParts(entry: EntryStatusInput, { showMoney, pko = false }: EntryStatusOptions): EntryStatusPart[] {
  const parts: EntryStatusPart[] = [
    { kind: 'rebuys', text: rebuyCountLabel(entry.rebuyCount ?? 0) },
    { kind: 'addons', text: addonCountLabel(entry.addonCount ?? 0) },
  ]
  if (pko) parts.push({ kind: 'head', text: bountyHeadText(entry.bountyHead ?? 0) })
  if (showMoney) {
    const due = dueStatus(entry.balance ?? 0)
    parts.push({ kind: 'due', text: due.text, tone: due.tone })
  }
  return parts
}

/** Separador entre os pedaços */
export const ENTRY_STATUS_SEPARATOR = ' · '

/** A linha inteira: "2 rebuys · Add-on · Cabeça 75 · Deve R$ 50,00" */
export function entryStatusLine(entry: EntryStatusInput, options: EntryStatusOptions): string {
  return entryStatusParts(entry, options)
    .map((p) => p.text)
    .join(ENTRY_STATUS_SEPARATOR)
}
