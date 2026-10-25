/**
 * Contatos e endereços públicos do Poker da Galera (SPEC-20261023-1205).
 *
 * API estável:
 * - `SUPPORT_WHATSAPP: string | null` — número do suporte (só dígitos, com DDI) lido de
 *   `import.meta.env.VITE_SUPPORT_WHATSAPP` (`.env.production`/`.env.development`). Nunca digitar o
 *   número no código. `null` quando a variável não está definida no build.
 * - `supportWhatsAppUrl(text): string | null` — link `https://wa.me/<número>?text=<mensagem>` com a
 *   mensagem pronta; `null` sem número configurado (o CTA então cai em "Ver planos", main.md §6).
 * - `PUBLIC_SITE_URL` — raiz pública (sem barra no fim). O selo/QR do telão aponta para
 *   `${PUBLIC_SITE_URL}/` e não para `window.location.origin` (o telão pode estar em outro domínio).
 * - `PUBLIC_SITE_HOST` — "pokerdagalera.com.br", para exibir em texto.
 * - `CONTACT_EMAIL` — e-mail de contato público.
 *
 * Os domínios curtos do telão (`TV_SHORT_DOMAINS`, SPEC-20261023-1207) ficam em `pages/landing/landing.content.ts`:
 * aquele arquivo é importado direto pelo Node (gerador das páginas legais e suíte da landing) e não pode depender
 * deste módulo, que lê `import.meta.env` (só existe no Vite).
 */

function onlyDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

/** Número do suporte (DDI + DDD + número, só dígitos) ou null se o build não tiver a variável. */
export const SUPPORT_WHATSAPP: string | null =
  onlyDigits(import.meta.env.VITE_SUPPORT_WHATSAPP) || null

export const PUBLIC_SITE_URL = 'https://pokerdagalera.com.br'

export const PUBLIC_SITE_HOST = 'pokerdagalera.com.br'

export const CONTACT_EMAIL = 'contato@pokerdagalera.com.br'

/** Link do WhatsApp do suporte com a mensagem pronta, ou null sem número configurado. */
export function supportWhatsAppUrl(text: string): string | null {
  if (!SUPPORT_WHATSAPP) return null
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`
}
