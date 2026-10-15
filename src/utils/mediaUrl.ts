// Fotos são salvas com caminho relativo (/uploads/...) servido pelo BACKEND.
// Em produção o frontend está em outro domínio, então o caminho precisa da
// origem da API. No dev a base é relativa e o proxy do Vite resolve /uploads.
const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_BASE_URL ?? '/api/v1', window.location.href).origin
  } catch {
    return window.location.origin
  }
})()

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}
