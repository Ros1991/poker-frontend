/**
 * Dica ao lado da foto editável — o MESMO texto nas boas-vindas e no Meu perfil (revisão geral do programa, ondas 7–9).
 * "Toque ou clique" serve no celular e no computador.
 */
export function photoHint(hasPhoto: boolean): string {
  return hasPhoto
    ? 'Toque ou clique na foto para trocar ou remover.'
    : 'Toque ou clique no círculo para pôr uma foto: tire na hora ou escolha uma imagem.'
}
