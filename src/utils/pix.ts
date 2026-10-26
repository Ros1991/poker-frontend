// Chave PIX nos formatos dos bancos e BR Code do telão (SPEC-20261023-1218).
//
// Este arquivo é AUTOCONTIDO (sem imports) e só usa sintaxe apagável: o `scripts/check-pix.mjs` o importa direto no
// Node (`npm run check:pix`), sem build. A regra é GÊMEA do `PixKeyNormalizer` do backend
// (poker-backend/PokerTournament.Application/Pix/PixKeyNormalizer.cs) e a fonte da verdade é a tabela
// `poker-frontend/scripts/pix-cases.json`: mudou a regra, muda dos dois lados e na tabela.
//
// Não reaproveita o `utils/phone.ts` (WhatsApp, SPEC-20261023-1213) de propósito: a chave de celular é mais estrita
// (lista de DDDs da Anatel, 9 obrigatório, fixo recusado) e este arquivo precisa rodar no Node sem build. Não unificar.
//
// Formato gravado (o do DICT do Banco Central): CPF 11 dígitos; CNPJ 14 caracteres maiúsculos (12 [0-9A-Z] + 2
// dígitos); celular +55 + DDD + 9 dígitos; e-mail minúsculo até 77 caracteres; chave aleatória minúscula 8-4-4-4-12.

export type PixKeyType = 'Cpf' | 'Cnpj' | 'Phone' | 'Email' | 'Evp'

export const PIX_KEY_TYPES: readonly PixKeyType[] = ['Cpf', 'Cnpj', 'Phone', 'Email', 'Evp']

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  Cpf: 'CPF',
  Cnpj: 'CNPJ',
  Phone: 'Celular',
  Email: 'E-mail',
  Evp: 'Chave aleatória',
}

export type PixKeyErrorCode =
  | 'cpf'
  | 'cnpj'
  | 'celular'
  | 'sem9'
  | 'fixo'
  | 'estrangeiro'
  | 'email'
  | 'email77'
  | 'evp'
  | 'formato'
  | 'ambigua'
  | 'tipo'

/** Mensagens exatas — as mesmas da API (400). */
export const PIX_KEY_MESSAGES: Record<PixKeyErrorCode, string> = {
  cpf: 'CPF inválido: confira os números.',
  cnpj: 'CNPJ inválido: confira os números.',
  celular: 'Celular inválido: use DDD + 9 dígitos (ex.: 61 99999-9999).',
  sem9: 'Celular precisa de 9 dígitos depois do DDD — faltou o 9 na frente?',
  fixo: 'Telefone fixo não pode ser chave PIX. Use um celular com DDD.',
  estrangeiro: 'Só celular do Brasil (+55) pode ser chave PIX.',
  email: 'E-mail inválido para chave PIX.',
  email77: 'E-mail com mais de 77 caracteres não pode ser chave PIX.',
  evp: 'Chave aleatória inválida: são 32 letras e números no formato 8-4-4-4-12.',
  formato:
    'Não reconhecemos o formato da chave PIX. Use CPF, CNPJ, celular com DDD, e-mail ou chave aleatória.',
  ambigua: 'Esta chave pode ser CPF ou celular. Escolha o tipo.',
  tipo: 'Tipo de chave PIX inválido.',
}

export type PixKeyResult =
  | { ok: true; type: PixKeyType; key: string; display: string; alternatives: PixKeyType[] }
  | { ok: true; type: null; key: null; display: null; alternatives: PixKeyType[] }
  | { ok: false; code: PixKeyErrorCode; error: string }

/** DDDs válidos (Anatel, 67). */
const DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

/** Espaços aceitos nas pontas e como separador (mesma lista no C#: \s do JS e do .NET não são iguais). */
const SPACES = ' \t\n\r\f\v '
const SEPARATORS = SPACES + '.-/()'
/** Separador que, logo depois dos 2 primeiros dígitos, indica celular ("61 9…", "61-9…"). */
const PHONE_SEPARATORS = SPACES + '.-'

// Regex do DICT para a chave EMAIL, copiada literalmente da página da API DICT (campo Key).
const EMAIL_RE =
  /^[a-z0-9.!#$'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const HEX32_RE = /^[0-9a-fA-F]{32}$/
const HEX_DASH_RE = /^[0-9a-fA-F-]+$/
const CPF_MASK_RE = /^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$/
const CNPJ_MASK_RE = /^[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-[0-9]{2}$/
const CNPJ_SHAPE_RE = /^[0-9A-Z]{12}[0-9]{2}$/
const ALNUM_RE = /^[0-9A-Za-z]+$/
const DIGITS_RE = /^[0-9]+$/
const LETTER_RE = /[A-Za-z]/

function isSpace(c: string): boolean {
  return SPACES.includes(c)
}

function trimSpaces(s: string): string {
  let a = 0
  let b = s.length
  while (a < b && isSpace(s[a])) a++
  while (b > a && isSpace(s[b - 1])) b--
  return s.slice(a, b)
}

function stripSeparators(s: string): string {
  let out = ''
  for (const c of s) if (!SEPARATORS.includes(c)) out += c
  return out
}

// Só A–Z/a–z: acento e outros alfabetos ficam como estão (e as regex os recusam), igual nos dois lados.
function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32))
}

function asciiUpper(s: string): string {
  return s.replace(/[a-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 32))
}

function allSame(s: string): boolean {
  for (let i = 1; i < s.length; i++) if (s[i] !== s[0]) return false
  return true
}

function stripBraces(s: string): string {
  return s.length >= 2 && s.startsWith('{') && s.endsWith('}') ? s.slice(1, -1) : s
}

function fail(code: PixKeyErrorCode): PixKeyResult {
  return { ok: false, code, error: PIX_KEY_MESSAGES[code] }
}

function success(type: PixKeyType, key: string, display: string, alternatives: PixKeyType[] = []): PixKeyResult {
  return { ok: true, type, key, display, alternatives }
}

/** CPF: 11 dígitos, não todos iguais, os dois dígitos verificadores certos. */
export function isValidCpf(digits: string): boolean {
  if (!/^[0-9]{11}$/.test(digits) || allSame(digits)) return false
  for (const len of [9, 10]) {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i)
    const dv = (sum * 10) % 11 % 10
    if (dv !== Number(digits[len])) return false
  }
  return true
}

/** CNPJ (também o alfanumérico): valor de cada caractere = código ASCII − 48, pesos 2–9 da direita para a esquerda. */
export function isValidCnpj(key: string): boolean {
  if (!CNPJ_SHAPE_RE.test(key) || allSame(key)) return false
  for (const len of [12, 13]) {
    let sum = 0
    let weight = 2
    for (let i = len - 1; i >= 0; i--) {
      sum += (key.charCodeAt(i) - 48) * weight
      weight = weight === 9 ? 2 : weight + 1
    }
    const r = sum % 11
    const dv = r < 2 ? 0 : 11 - r
    if (dv !== key.charCodeAt(len) - 48) return false
  }
  return true
}

function validateCpf(s: string): PixKeyResult {
  const t = stripSeparators(s)
  if (!isValidCpf(t)) return fail('cpf')
  return success('Cpf', t, `${t.slice(0, 3)}.${t.slice(3, 6)}.${t.slice(6, 9)}-${t.slice(9)}`)
}

function validateCnpj(s: string): PixKeyResult {
  const t = asciiUpper(stripSeparators(s))
  if (!isValidCnpj(t)) return fail('cnpj')
  return success('Cnpj', t, `${t.slice(0, 2)}.${t.slice(2, 5)}.${t.slice(5, 8)}/${t.slice(8, 12)}-${t.slice(12)}`)
}

function validatePhone(s: string): PixKeyResult {
  const hasPlus = s.startsWith('+')
  const digits = stripSeparators(hasPlus ? s.slice(1) : s)
  if (!DIGITS_RE.test(digits)) return fail('celular')

  let national: string
  if (hasPlus) {
    if (!digits.startsWith('55')) return fail('estrangeiro')
    national = digits.slice(2)
  } else if (digits.startsWith('0055')) {
    national = digits.slice(4)
  } else if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    national = digits.slice(2)
  } else {
    national = digits
  }
  // 0 de discagem na frente do DDD (nenhum DDD começa com 0)
  if (national.startsWith('0') && (national.length === 11 || national.length === 12)) national = national.slice(1)

  const ddd = national.slice(0, 2)
  if (national.length === 11) {
    if (!DDDS.has(ddd) || national[2] !== '9') return fail('celular')
  } else if (national.length === 10) {
    if (!DDDS.has(ddd)) return fail('celular')
    if ('6789'.includes(national[2])) return fail('sem9')
    if ('2345'.includes(national[2])) return fail('fixo')
    return fail('celular')
  } else {
    return fail('celular')
  }
  return success('Phone', '+55' + national, `+55 ${ddd} ${national.slice(2, 7)}-${national.slice(7)}`)
}

function validateEmail(s: string): PixKeyResult {
  if (s.length > 77) return fail('email77')
  const key = asciiLower(s)
  if (!EMAIL_RE.test(key)) return fail('email')
  return success('Email', key, key)
}

function validateEvp(s: string): PixKeyResult {
  const hex = asciiLower(stripBraces(s).replace(/-/g, ''))
  if (!/^[0-9a-f]{32}$/.test(hex)) return fail('evp')
  const key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  return success('Evp', key, key)
}

function validateAs(type: PixKeyType, s: string): PixKeyResult {
  switch (type) {
    case 'Cpf':
      return validateCpf(s)
    case 'Cnpj':
      return validateCnpj(s)
    case 'Phone':
      return validatePhone(s)
    case 'Email':
      return validateEmail(s)
    case 'Evp':
      return validateEvp(s)
  }
}

/** Texto do tipo (vindo da tela ou da API) → tipo; vazio = automático; desconhecido = undefined. */
export function parsePixKeyType(type: string | null | undefined): PixKeyType | null | undefined {
  if (type == null) return null
  const t = trimSpaces(type)
  if (t === '') return null
  const lower = asciiLower(t)
  return PIX_KEY_TYPES.find((k) => asciiLower(k) === lower)
}

/**
 * Normaliza a chave digitada. Sem tipo: detecta (e-mail → chave aleatória → "+" celular → máscaras de CPF/CNPJ →
 * letras = CNPJ alfanumérico → só dígitos pelo tamanho; 11 dígitos pela regra CPF × celular). Com tipo: valida só
 * como aquele tipo. Vazio → `{ ok: true, key: null }` (remover a chave).
 * `alternatives` só aparece com 11 dígitos sem formatação que são CPF válido E celular plausível: a tela exige
 * escolher e a API, sem tipo, responde "Esta chave pode ser CPF ou celular. Escolha o tipo.".
 */
export function normalizePixKey(input: string | null | undefined, type?: string | null): PixKeyResult {
  const s = trimSpaces(input ?? '')
  if (s === '') return { ok: true, type: null, key: null, display: null, alternatives: [] }

  const chosen = parsePixKeyType(type)
  if (chosen === undefined) return fail('tipo')
  if (chosen) return validateAs(chosen, s)

  if (s.includes('@')) return validateEmail(s)

  const inner = stripBraces(s)
  if (UUID_RE.test(inner) || HEX32_RE.test(inner) || (HEX_DASH_RE.test(inner) && inner.length >= 30))
    return validateEvp(s)

  if (s.startsWith('+')) return validatePhone(s)
  if (CPF_MASK_RE.test(s)) return validateCpf(s)
  if (CNPJ_MASK_RE.test(s)) return validateCnpj(s)

  const t = stripSeparators(s)
  if (!ALNUM_RE.test(t)) return fail('formato')
  if (LETTER_RE.test(t)) return CNPJ_SHAPE_RE.test(asciiUpper(t)) ? validateCnpj(s) : fail('formato')

  switch (t.length) {
    case 11: {
      // A formatação desempata: parênteses ou separador logo depois dos 2 primeiros dígitos = celular
      const phoneFormatted = /[()]/.test(s) || (/^[0-9]{2}/.test(s) && s.length > 2 && PHONE_SEPARATORS.includes(s[2]))
      if (phoneFormatted) return validatePhone(s)
      const cpfOk = isValidCpf(t)
      const phoneOk = DDDS.has(t.slice(0, 2)) && t[2] === '9'
      if (cpfOk && phoneOk) {
        const cpf = validateCpf(s)
        return cpf.ok && cpf.type ? success('Cpf', cpf.key, cpf.display, ['Phone']) : cpf
      }
      if (cpfOk) return validateCpf(s)
      if (phoneOk) return validatePhone(s)
      return fail(t[2] === '9' ? 'celular' : 'cpf')
    }
    case 13:
      return t.startsWith('55') ? validatePhone(s) : fail('formato')
    case 15:
      return t.startsWith('0055') ? validatePhone(s) : fail('formato')
    case 12:
      return t.startsWith('0') || t.startsWith('55') ? validatePhone(s) : fail('formato')
    case 10:
      return validatePhone(s)
    case 14:
      return validateCnpj(s)
    default:
      return fail('formato')
  }
}

/** Tipo de uma chave já gravada (normalizada); null se não normaliza ou vazia. */
export function pixKeyTypeOf(key: string | null | undefined): PixKeyType | null {
  const r = normalizePixKey(key)
  return r.ok ? r.type : null
}

/** Exibição da chave ("+55 61 99999-9999", "123.456.789-09"); o texto cru quando não normaliza. */
export function formatPixKey(key: string | null | undefined): string {
  const r = normalizePixKey(key)
  return r.ok && r.key ? r.display : (key ?? '')
}

/** Tipo que vale para a chave do campo: o escolhido; senão, se o texto é a chave já gravada, o tipo dela. */
export function resolvePixKeyType(
  value: string | null | undefined,
  chosen: PixKeyType | null | undefined,
  savedKey?: string | null,
): PixKeyType | null {
  if (chosen) return chosen
  if (savedKey && trimSpaces(value ?? '') === savedKey) return pixKeyTypeOf(savedKey)
  return null
}

export interface PixKeyCheck {
  result: PixKeyResult
  /** Tipo que vale (escolhido ou o da chave gravada); null = automático */
  type: PixKeyType | null
  /** 11 dígitos que podem ser CPF ou celular, sem tipo: a pessoa precisa escolher */
  needsChoice: boolean
  /** Mensagem que impede salvar (erro da tabela ou "escolha o tipo"); null = pode salvar */
  error: string | null
}

export function checkPixKey(
  value: string | null | undefined,
  chosen: PixKeyType | null | undefined,
  savedKey?: string | null,
): PixKeyCheck {
  const type = resolvePixKeyType(value, chosen, savedKey)
  const result = normalizePixKey(value, type)
  const needsChoice = result.ok && !type && result.alternatives.length > 0
  const error = !result.ok ? result.error : needsChoice ? PIX_KEY_MESSAGES.ambigua : null
  return { result, type, needsChoice, error }
}

/** Corpo do envio: chave já normalizada e o tipo dela (vazio → null; inválida vai como digitada e a API recusa). */
export function toPixKeyPayload(
  value: string | null | undefined,
  chosen: PixKeyType | null | undefined,
  savedKey?: string | null,
): { key: string | null; type: PixKeyType | null } {
  const { result, type } = checkPixKey(value, chosen, savedKey)
  if (result.ok) return { key: result.key, type: result.type }
  const raw = trimSpaces(value ?? '')
  return { key: raw === '' ? null : raw, type }
}

// ---------------------------------------------------------------------------------------------------------------
// BR Code (PIX copia e cola estático, padrão EMV do Banco Central)
// ---------------------------------------------------------------------------------------------------------------

/** CRC-16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF) — campo 63, calculado com o "6304" incluído. */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Campo id + tamanho (2 dígitos) + valor; só ASCII imprimível e no máximo 99 (senão o payload não existe). */
function tlv(id: string, value: string): string {
  if (value.length < 1 || value.length > 99 || !/^[\x20-\x7e]+$/.test(value))
    throw new Error(`campo ${id} inválido no BR Code`)
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

/** Nome/cidade do BR Code: sem acento, só ASCII imprimível, maiúsculo, cortado em `max` bytes (= caracteres). */
export function toEmvText(text: string, max: number): string {
  const ascii = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
  return asciiUpper(trimSpaces(ascii)).slice(0, max).trim()
}

/**
 * Valor do campo 54 do BR Code (SPEC-20261026-1906): reais com ponto e 2 casas ("150.00"), no máximo 13 caracteres
 * (o padrão EMV). Valor que não serve (zero, negativo, NaN, infinito, que arredonda para 0,00 ou não cabe) → null.
 */
export function formatPixAmount(amount: number): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null
  const text = (Math.round(amount * 100) / 100).toFixed(2)
  if (text === '0.00' || text.length > 13 || !/^[0-9]+\.[0-9]{2}$/.test(text)) return null
  return text
}

/**
 * Payload "PIX copia e cola" (QR estático, sem o campo 01; txid ***). A chave SEMPRE passa pelo normalizador antes
 * (até uma chave antiga não normalizada sai certa); chave inválida → null (sem QR). Nome e cidade são exigidos pelo
 * padrão; os apps mostram o nome real do DICT ao ler o QR.
 * Sem `amount` (ou null): QR reutilizável sem valor (o do telão). Com `amount` (SPEC-20261026-1906, tela de pagar):
 * campo 54 com o valor já preenchido, logo depois da moeda (53); valor que não serve → null (sem QR).
 */
export function buildPixPayload(
  pixKey: string | null | undefined,
  merchantName = 'POKER DA GALERA',
  merchantCity = 'SAO PAULO',
  amount?: number | null,
): string | null {
  const pix = normalizePixKey(pixKey)
  if (!pix.ok || !pix.key || pix.key.length > 77) return null
  const amountText = amount == null ? null : formatPixAmount(amount)
  if (amount != null && amountText === null) return null
  const name = toEmvText(merchantName, 25) || 'POKER DA GALERA'
  const city = toEmvText(merchantCity, 15) || 'SAO PAULO'
  try {
    const payload =
      tlv('00', '01') + // Payload Format Indicator
      tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pix.key)) + // Merchant Account Information (PIX)
      tlv('52', '0000') + // Merchant Category Code
      tlv('53', '986') + // Moeda: BRL
      (amountText ? tlv('54', amountText) : '') + // Valor da transação (só no QR com valor)
      tlv('58', 'BR') + // País
      tlv('59', name) +
      tlv('60', city) +
      tlv('62', tlv('05', '***')) + // txid livre (QR estático)
      '6304' // CRC (id + tamanho; valor calculado abaixo)
    return payload + crc16(payload)
  } catch {
    return null
  }
}
