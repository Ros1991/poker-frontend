/** Minúsculas e sem acento, para busca por nome ("José" acha "jose" e "JOSÉ") */
export function normalizeText(text: string): string {
  // Remove os acentos (marcas combinantes)
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Espaços das pontas fora e os do meio juntados ("  Zé   da Silva " → "Zé da Silva") */
export function normalizeSpaces(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean).join(' ')
}

/** Chave de nome igual à do servidor: sem diferença de maiúsculas, acentos mantidos, espaços normalizados */
export function nameKey(text: string): string {
  return normalizeSpaces(text).toUpperCase()
}
