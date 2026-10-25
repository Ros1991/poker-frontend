// WhatsApp brasileiro: uma regra só para o painel, o terminal e o servidor (PhoneNumbers.cs).
// Guardado só com os dígitos locais (DDD + número, 10 ou 11 dígitos), sem o 55 do país.

/** Teto de dígitos guardados enquanto digita: um número que não vira 10–11 dígitos aparece inteiro e a validação recusa */
const MAX_INPUT_DIGITS = 15

/**
 * Só os dígitos locais, na mesma regra do servidor (PhoneNumbers.NormalizeLocal): tira o que não é dígito, os zeros
 * do começo (o 0 do DDD/operadora e o 00 internacional — nenhum DDD começa com 0) e o 55 do país quando sobram mais
 * de 11 dígitos (e os zeros que vierem depois dele). NUNCA corta: "+55 (11) 98765-4321" → "11987654321",
 * "011 98765-4321" → "11987654321"; vazio → undefined.
 */
export function cleanWhatsapp(value: string | null | undefined): string | undefined {
  let digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2).replace(/^0+/, '')
  return digits || undefined
}

/**
 * Valor do campo WhatsApp a cada tecla ou colagem: normaliza ANTES de limitar o tamanho (colar o número copiado do
 * contato, com +55, não perde os últimos dígitos). Sobra além de 11 dígitos fica (até 15) para a validação apontar.
 */
export function whatsappInput(value: string): string {
  return (cleanWhatsapp(value) ?? '').slice(0, MAX_INPUT_DIGITS)
}

/**
 * Máscara enquanto digita, pelo mesmo critério do displayPhone: 11 dígitos → "(11) 99999-9999"; até 10 →
 * "(11) 3333-4444" (o traço muda de lugar quando chega o 11º). Mais de 11 (número que não fecha) → só os dígitos.
 */
export function formatPhone(value: string): string {
  const d = cleanWhatsapp(value) ?? ''
  if (d.length > 11) return d
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Número local válido para cadastro: 10 ou 11 dígitos */
export function isValidWhatsapp(value: string | null | undefined): boolean {
  const local = cleanWhatsapp(value)
  return !!local && (local.length === 10 || local.length === 11)
}

/** Exibição de um número já gravado: "(11) 99999-9999" / "(11) 9999-9999"; outro formato volta como está */
export function displayPhone(phone: string): string {
  const local = cleanWhatsapp(phone) ?? ''
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}
