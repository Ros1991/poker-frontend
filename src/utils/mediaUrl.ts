// Fotos e logos são salvas com caminho relativo (/uploads/...) servido pelo BACKEND.
// Em produção o frontend está em outro domínio (nginx próprio, sem proxy de /uploads), então o caminho
// precisa da origem da API (VITE_API_BASE_URL). No dev a base é relativa e o proxy do Vite resolve /uploads.
const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_BASE_URL ?? '/api/v1', window.location.href).origin
  } catch {
    return window.location.origin
  }
})()

/**
 * URL pronta para `<img src>`: caminho relativo do backend ganha a origem da API; URL absoluta
 * (http/https), prévia local (`blob:`) e imagem embutida (`data:`) passam como estão. Idempotente —
 * chamar duas vezes dá o mesmo resultado (o `Avatar` já chama sozinho).
 */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}
