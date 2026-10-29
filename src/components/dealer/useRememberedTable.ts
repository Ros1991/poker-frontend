import { useCallback, useState } from 'react'

// Mesa escolhida no terminal do dealer, guardada por torneio nesta aba (sessionStorage — SPEC-20261029-1721): ir para o
// telão no celular e voltar ao terminal (o seletor "Terminal | Telão") cai na mesma mesa. Mesa que sumiu (sorteio de novo,
// quebrada, excluída) o terminal já troca pela primeira; sem armazenamento, vale só enquanto o terminal está aberto.

const keyFor = (tournamentId: string) => `poker_dealer_table_${tournamentId}`

function read(tournamentId: string): string | null {
  if (!tournamentId) return null
  try {
    return sessionStorage.getItem(keyFor(tournamentId))
  } catch {
    return null
  }
}

function write(tournamentId: string, tableId: string | null) {
  if (!tournamentId) return
  try {
    if (tableId) sessionStorage.setItem(keyFor(tournamentId), tableId)
    else sessionStorage.removeItem(keyFor(tournamentId))
  } catch {
    // aba anônima restrita: fica só na memória
  }
}

/** `[mesa escolhida, escolher]` — como um useState, mas lembrado por torneio nesta aba */
export function useRememberedTable(tournamentId: string): [string | null, (tableId: string | null) => void] {
  const [tableId, setTableId] = useState<string | null>(() => read(tournamentId))
  const choose = useCallback(
    (next: string | null) => {
      setTableId(next)
      write(tournamentId, next)
    },
    [tournamentId],
  )
  return [tableId, choose]
}
