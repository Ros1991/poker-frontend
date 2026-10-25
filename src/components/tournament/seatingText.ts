import type { SeatingResult, SeatingSeat } from '../../types/entry.types'

// Textos do resultado do assento da inscrição (SPEC-20261023-1214), usados pelo SeatingChangesDialog do painel e pelo
// resumo do "Adicionar jogadores" do terminal.

/** "Mesa 2 aberta" / "Mesas 2 e 3 abertas" / "Mudanças de lugar" (sem mesa aberta) */
export function seatingTitle(seating: SeatingResult): string {
  const names = seating.openedTables.map((t) => t.tableName)
  if (names.length === 0) return 'Mudanças de lugar'
  if (names.length === 1) return `${names[0]} aberta`
  const nums = names.map((n) => n.replace(/^Mesa /, ''))
  return `Mesas ${nums.slice(0, -1).join(', ')} e ${nums[nums.length - 1]} abertas`
}

/** Orientação: torneio começado (MA7) muda entre uma mão e outra; antes do início (MA8) só avisa */
export function seatingAdvice(seating: SeatingResult): string {
  return seating.inProgress
    ? 'Mude os jogadores entre uma mão e outra; as fichas vão junto.'
    : 'Avise quem muda de lugar.'
}

/** "Mesa 1: 2, Mesa 2: 1" — onde ficaram os inscritos (na ordem das mesas) */
export function seatCountsText(seated: SeatingSeat[]): string {
  const counts = new Map<string, number>()
  for (const s of seated) counts.set(s.tableName, (counts.get(s.tableName) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b, 'pt-BR'))
    .map(([name, n]) => `${name}: ${n}`)
    .join(', ')
}
