// O que o aparelho oferece para tirar/escolher foto (SPEC-20261023-1213, F4). Fora dos componentes porque arquivo
// de componente só exporta componentes (react-refresh/only-export-components).

/** Celular/tablet (toque como ponteiro principal): "Tirar foto" e "Escolher da galeria" */
export function isTouchDevice(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

/** Webcam disponível neste navegador (getUserMedia só existe em https ou localhost) */
export function canUseWebcam(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}
