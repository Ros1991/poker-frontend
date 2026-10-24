// Trava a rolagem da página por trás de modais e telas cheias (SPEC-20261023-1216).
// Com contador: uma modal aberta sobre outra (ex.: confirmação dentro do QR do dealer) não
// destrava o fundo ao fechar — o `overflow` do body só volta quando a última trava sai.

let locks = 0
let previousOverflow = ''

/** Trava a rolagem do body e devolve a função que solta esta trava (chamar mais de uma vez não faz mal). */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (locks === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks++

  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) document.body.style.overflow = previousOverflow
  }
}
