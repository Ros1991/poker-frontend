// Iniciais e cor do avatar sem foto, compartilhadas pelo `Avatar` e por quem desenha o círculo
// por conta própria (ex.: card do jogador no terminal). Ficam fora do Avatar.tsx porque arquivo de
// componente só exporta componentes (react-refresh/only-export-components).

/** "Ana Maria Souza" → "AM" (até 2 letras) */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Paleta de iniciais derivada da logo (SPEC-20261023-1204). Cada fundo já traz o texto que passa
 * AA em cima dele: dourado só com texto marinho; os demais são sólidos escuros com branco.
 */
const INITIALS_COLORS = [
  'bg-accent-blue text-white', // royal
  'bg-text-primary text-white', // marinho
  'bg-accent-gold text-text-primary', // dourado
  'bg-accent-green-deep text-white', // verde
  'bg-accent-red-deep text-white', // vermelho
  'bg-accent-teal text-white', // teal
  'bg-accent-indigo text-white', // índigo
  'bg-accent-orange-deep text-white', // laranja (bronze)
] as const

/** Classes de fundo + texto derivadas do nome (sempre a mesma cor para o mesmo nome) */
export function getColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length] ?? INITIALS_COLORS[0]
}
