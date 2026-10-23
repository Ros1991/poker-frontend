/** "48KVRX" → "48K VRX" (mais fácil de ler e digitar a partir da TV) */
export function formatPairingCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}
