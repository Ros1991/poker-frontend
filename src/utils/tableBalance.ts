// Análise de mesas do terminal do dealer (funções puras, sem React).
// O sistema só avisa e sorteia sugestões; quem confirma a mudança é o dealer.

/** Formato mínimo de mesa usado aqui (compatível com Table de tables.api) */
export interface BalanceTable {
  id: string
  tableNumber: number
  tableName?: string | null
  maxSeats: number
}

/** Formato mínimo de inscrição usado aqui (compatível com TournamentEntry) */
export interface BalanceEntry {
  id: string
  status: string
  tableId: string | null
  seatNumber: number | null
  person: { fullName: string; nickname: string | null }
}

export interface TableAnalysis {
  /**
   * Os jogadores ativos cabem em uma mesa a menos. `players` = quantos foram
   * considerados (sentados + ativos sem lugar, que também precisam de lugar).
   */
  breakable: { targetTables: number; suggestedTableId: string; players: number } | null
  /** Diferença de 2 ou mais jogadores entre a mesa mais cheia e a mais vazia */
  imbalance: {
    fromTableId: string
    toTableId: string
    fromCount: number
    toCount: number
  } | null
}

export interface BalanceMove {
  entryId: string
  playerName: string
  fromTableId: string
  fromSeat: number
  toTableId: string
  toSeat: number
}

export function isActiveStatus(status: string): boolean {
  return status === 'Active' || status === 'Registered'
}

export function tableLabel(table: Pick<BalanceTable, 'tableNumber' | 'tableName'>): string {
  return table.tableName?.trim() || `Mesa ${table.tableNumber}`
}

function entryName(entry: BalanceEntry): string {
  return entry.person.nickname?.trim() || entry.person.fullName
}

/** Jogadores ativos sentados em cada mesa (id da mesa → inscrições) */
export function seatedByTable<E extends BalanceEntry>(
  tables: BalanceTable[],
  entries: E[],
): Map<string, E[]> {
  const map = new Map<string, E[]>()
  for (const t of tables) map.set(t.id, [])
  for (const e of entries) {
    if (!isActiveStatus(e.status) || !e.tableId || e.seatNumber == null) continue
    map.get(e.tableId)?.push(e)
  }
  return map
}

/** Jogadores ativos sem lugar: sem mesa, sem número de lugar ou numa mesa que não está entre as ativas */
export function countUnseated(tables: BalanceTable[], entries: BalanceEntry[]): number {
  const tableIds = new Set(tables.map((t) => t.id))
  return entries.filter(
    (e) => isActiveStatus(e.status) && (!e.tableId || e.seatNumber == null || !tableIds.has(e.tableId)),
  ).length
}

/** Lugares livres da mesa (1..maxSeats sem jogador ativo) */
export function freeSeats(table: BalanceTable, seated: BalanceEntry[]): number[] {
  const taken = new Set(seated.map((e) => e.seatNumber))
  const free: number[] = []
  for (let s = 1; s <= table.maxSeats; s++) if (!taken.has(s)) free.push(s)
  return free
}

export function analyzeTables(
  tables: BalanceTable[],
  entries: BalanceEntry[],
): TableAnalysis {
  const result: TableAnalysis = { breakable: null, imbalance: null }
  if (tables.length < 2) return result

  const seated = seatedByTable(tables, entries)
  const count = (t: BalanceTable) => seated.get(t.id)?.length ?? 0
  const free = (t: BalanceTable) => Math.max(0, t.maxSeats - count(t))
  const totalFree = tables.reduce((sum, t) => sum + free(t), 0)
  const seatedTotal = tables.reduce((sum, t) => sum + count(t), 0)
  // Quem está ativo sem lugar também precisa de lugar: entra na conta da quebra
  const unseated = countUnseated(tables, entries)

  // Quebrar: os jogadores da mesa (mais os sem lugar) cabem nos lugares livres das demais.
  // Sugerida = a com menos jogadores (empate → a de número maior, que costuma sair primeiro).
  const candidates = tables
    .filter((t) => count(t) + unseated <= totalFree - free(t))
    .sort((a, b) => count(a) - count(b) || b.tableNumber - a.tableNumber)
  if (candidates.length > 0) {
    result.breakable = {
      targetTables: tables.length - 1,
      suggestedTableId: candidates[0].id,
      players: seatedTotal + unseated,
    }
  }

  // Desequilíbrio: mais cheia x mais vazia (que tenha lugar livre)
  const byCount = [...tables].sort(
    (a, b) => count(b) - count(a) || a.tableNumber - b.tableNumber,
  )
  const from = byCount[0]
  const to = [...byCount].reverse().find((t) => t.id !== from.id && free(t) > 0)
  if (to && count(from) - count(to) >= 2) {
    result.imbalance = {
      fromTableId: from.id,
      toTableId: to.id,
      fromCount: count(from),
      toCount: count(to),
    }
  }

  return result
}

/**
 * Sorteia um jogador da mesa mais cheia e um lugar livre da mais vazia.
 * `excludeEntryId` evita repetir o mesmo jogador no "Sortear outro" (se houver outro).
 */
export function pickRandomBalanceMove(
  analysis: TableAnalysis,
  tables: BalanceTable[],
  entries: BalanceEntry[],
  excludeEntryId?: string,
): BalanceMove | null {
  const imb = analysis.imbalance
  if (!imb) return null
  const fromTable = tables.find((t) => t.id === imb.fromTableId)
  const toTable = tables.find((t) => t.id === imb.toTableId)
  if (!fromTable || !toTable) return null

  const seated = seatedByTable(tables, entries)
  const fromPlayers = seated.get(fromTable.id) ?? []
  const pool =
    fromPlayers.length > 1 && excludeEntryId
      ? fromPlayers.filter((e) => e.id !== excludeEntryId)
      : fromPlayers
  const seats = freeSeats(toTable, seated.get(toTable.id) ?? [])
  if (pool.length === 0 || seats.length === 0) return null

  const player = pool[Math.floor(Math.random() * pool.length)]
  const seat = seats[Math.floor(Math.random() * seats.length)]
  return {
    entryId: player.id,
    playerName: entryName(player),
    fromTableId: fromTable.id,
    fromSeat: player.seatNumber ?? 0,
    toTableId: toTable.id,
    toSeat: seat,
  }
}
