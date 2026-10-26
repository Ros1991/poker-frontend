/**
 * Conferência da chave PIX e do BR Code (SPEC-20261023-1218): roda `scripts/pix-cases.json` contra o
 * `src/utils/pix.ts` (importado direto: o Node 22.18 apaga os tipos sozinho, sem build).
 *
 * Uso: npm run check:pix   (também no fim do `npm run lint`)
 *
 * Confere, para cada caso: ok/erro, tipo, chave, exibição, alternativas e a mensagem exata; que a chave normalizada é
 * idempotente e que formatPixKey(chave) = exibição; que as mensagens do JSON são as do pix.ts. No BR Code: os vetores
 * de CRC (123456789 → 29B1, exemplo oficial → 1D3D), os 6 payloads da tabela e os casos de montagem (normaliza antes,
 * chave inválida → null, nome/cidade ASCII cortados em 25/15). Cada payload é revalidado de forma independente
 * (parse TLV, tamanhos, só ASCII e CRC recalculado aqui com tabela própria). QR com valor (SPEC-20261026-1906): os
 * payloads de `brcode.amounts` (montados à mão), o campo 54 no lugar certo (entre 53 e 58, "0.00", até 13), que sem o
 * 54 sobra o QR sem valor, e os valores que não servem (zero, negativo, NaN, infinito, 14 caracteres) → null.
 * Sai com código 1 e lista o que falhou.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pix = await import(pathToFileURL(path.join(here, '..', 'src', 'utils', 'pix.ts')).href)
const table = JSON.parse(readFileSync(path.join(here, 'pix-cases.json'), 'utf8'))

const failures = []
let checks = 0
function check(name, cond, extra = '') {
  checks++
  if (!cond) failures.push(`${name}${extra ? ` — ${extra}` : ''}`)
}
const j = (v) => JSON.stringify(v)

// CRC-16/CCITT-FALSE com tabela (implementação independente da do pix.ts)
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n << 8
  for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff
  return c
})
function crcIndependent(text) {
  let crc = 0xffff
  for (const byte of Buffer.from(text, 'latin1')) crc = ((crc << 8) & 0xffff) ^ CRC_TABLE[((crc >> 8) ^ byte) & 0xff]
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Lê o payload como TLV e devolve { campos, erros }. */
function parseTlv(text) {
  const fields = {}
  let i = 0
  while (i < text.length) {
    const id = text.slice(i, i + 2)
    const len = Number(text.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len)) return { error: `TLV quebrado na posição ${i}` }
    fields[id] = text.slice(i + 4, i + 4 + len)
    if (fields[id].length !== len) return { error: `campo ${id} menor que o tamanho declarado` }
    i += 4 + len
  }
  return { fields }
}

/** Campos do payload na ordem em que aparecem no texto: [[id, valor], …] */
function tlvList(text) {
  const out = []
  let i = 0
  while (i + 4 <= text.length) {
    const id = text.slice(i, i + 2)
    const len = Number(text.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len)) break
    out.push([id, text.slice(i + 4, i + 4 + len)])
    i += 4 + len
  }
  return out
}
const tlvIds = (text) => tlvList(text).map(([id]) => id)

/** expectedAmount: undefined = QR sem valor (sem campo 54); texto = valor esperado no campo 54 (SPEC-20261026-1906) */
function validatePayload(label, payload, expectedKey, expectedAmount) {
  check(`${label}: só ASCII imprimível`, /^[\x20-\x7e]+$/.test(payload))
  const { fields, error } = parseTlv(payload)
  check(`${label}: TLV válido`, !error, error)
  if (!fields) return null
  check(`${label}: 00 = 01`, fields['00'] === '01')
  check(`${label}: sem campo 01 (QR estático)`, !('01' in fields))
  if (expectedAmount === undefined) {
    check(`${label}: sem valor (54)`, !('54' in fields))
  } else {
    // QR com valor: 54 = reais com ponto e 2 casas, até 13 caracteres, logo depois da moeda (53) e antes do país (58)
    check(`${label}: 54 = ${expectedAmount}`, fields['54'] === expectedAmount, String(fields['54']))
    check(`${label}: 54 no formato 0.00 com até 13`, /^[0-9]+\.[0-9]{2}$/.test(fields['54'] ?? '') && fields['54'].length <= 13)
    // Ordem real no texto (as chaves "26", "53"… de um objeto JS saem em ordem numérica, não na do payload)
    const ids = tlvIds(payload)
    check(`${label}: 54 entre 53 e 58`, ids.indexOf('54') === ids.indexOf('53') + 1 && ids.indexOf('58') === ids.indexOf('54') + 1, ids.join(','))
  }
  check(`${label}: 52 = 0000, 53 = 986, 58 = BR`, fields['52'] === '0000' && fields['53'] === '986' && fields['58'] === 'BR')
  check(`${label}: 59 com 1–25 e 60 com 1–15`, fields['59']?.length >= 1 && fields['59'].length <= 25 && fields['60']?.length >= 1 && fields['60'].length <= 15)
  check(`${label}: 62 = txid ***`, fields['62'] === '0503***')
  const mai = parseTlv(fields['26'] ?? '').fields
  check(`${label}: campo 26 ≤ 99`, (fields['26'] ?? '').length <= 99)
  check(`${label}: GUI br.gov.bcb.pix`, mai?.['00'] === 'br.gov.bcb.pix')
  if (expectedKey !== undefined) check(`${label}: chave no campo 26`, mai?.['01'] === expectedKey, `${mai?.['01']} ≠ ${expectedKey}`)
  check(`${label}: termina com 6304 + CRC`, payload.slice(-8, -4) === '6304')
  check(`${label}: CRC recalculado bate`, crcIndependent(payload.slice(0, -4)) === payload.slice(-4), `${crcIndependent(payload.slice(0, -4))} ≠ ${payload.slice(-4)}`)
  return { fields, mai }
}

// 1. Mensagens
for (const [code, msg] of Object.entries(table.messages))
  check(`mensagem "${code}" igual no pix.ts`, pix.PIX_KEY_MESSAGES[code] === msg, `${pix.PIX_KEY_MESSAGES[code]} ≠ ${msg}`)
check('pix.ts não tem mensagem fora da tabela', Object.keys(pix.PIX_KEY_MESSAGES).every((c) => c in table.messages))

// 2. Casos
check('tabela com pelo menos 44 casos', table.cases.length >= 44, String(table.cases.length))
for (const c of table.cases) {
  const label = `caso ${c.id} (${j(c.input)}${c.type ? ` como ${c.type}` : ''})`
  const r = pix.normalizePixKey(c.input, c.type)
  const e = c.expect
  if (e.ok) {
    const same = r.ok && r.type === e.type && r.key === e.key && r.display === e.display && j(r.alternatives) === j(e.alternatives)
    check(label, same, `esperado ${j(e)}, veio ${j(r)}`)
    if (r.ok && r.key) {
      const again = pix.normalizePixKey(r.key)
      check(`${label}: chave normalizada é idempotente`, again.ok && again.key === r.key && again.type === r.type, j(again))
      check(`${label}: formatPixKey`, pix.formatPixKey(r.key) === e.display, pix.formatPixKey(r.key))
      check(`${label}: pixKeyTypeOf`, pix.pixKeyTypeOf(r.key) === e.type)
      // Na tela: alternativa sem tipo = escolha obrigatória (mesma mensagem da API)
      const chk = pix.checkPixKey(c.input, c.type ? pix.parsePixKeyType(c.type) : null)
      const ambiguous = !c.type && e.alternatives.length > 0
      check(`${label}: escolha obrigatória só no caso ambíguo`, chk.needsChoice === ambiguous && chk.error === (ambiguous ? table.messages.ambigua : null), j(chk))
    }
  } else {
    const same = !r.ok && r.code === e.code && r.error === table.messages[e.code]
    check(label, same, `esperado erro ${e.code}, veio ${j(r)}`)
  }
}

// 3. CRC
for (const v of table.brcode.crc) {
  check(`crc16 ${v.note ?? v.input}`, pix.crc16(v.input) === v.crc, `${pix.crc16(v.input)} ≠ ${v.crc}`)
  check(`crc independente ${v.note ?? v.input}`, crcIndependent(v.input) === v.crc)
}

// 4. Payloads da tabela
for (const v of table.brcode.vectors) {
  const p = pix.buildPixPayload(v.key)
  check(`payload ${v.key}`, p === v.payload, `\n      veio     ${p}\n      esperado ${v.payload}`)
  validatePayload(`payload ${v.key} (esperado)`, v.payload, v.key)
  const parsed = validatePayload(`payload ${v.key} (gerado)`, p ?? '', v.key)
  check(`payload ${v.key}: nome e cidade padrão`, parsed?.fields['59'] === table.brcode.name && parsed?.fields['60'] === table.brcode.city)
}

// 5. Montagem
for (const b of table.brcode.build) {
  const label = `buildPixPayload(${j(b.key)}${b.name ? `, ${j(b.name)}` : ''}${b.city ? `, cidade ${j(b.city)}` : ''})`
  const p = pix.buildPixPayload(b.key, b.name ?? undefined, b.city ?? undefined)
  if ('payload' in b && b.payload === null) {
    check(`${label} → null`, p === null, String(p))
    continue
  }
  if (b.sameAs) check(`${label} = payload de ${b.sameAs}`, p !== null && p === pix.buildPixPayload(b.sameAs), String(p))
  const parsed = p ? validatePayload(label, p) : null
  check(`${label} gerou payload`, !!parsed)
  if (b.field26Length) check(`${label}: campo 26 com ${b.field26Length}`, parsed?.fields['26'].length === b.field26Length, String(parsed?.fields['26']?.length))
  if (b.nameField) check(`${label}: campo 59 = ${b.nameField}`, parsed?.fields['59'] === b.nameField, parsed?.fields['59'])
  if (b.cityField) check(`${label}: campo 60 = ${b.cityField}`, parsed?.fields['60'] === b.cityField, parsed?.fields['60'])
}

// 6. QR com valor (SPEC-20261026-1906): payloads montados à mão (sem o pix.ts) e montagem com valores que não servem
const amountOf = (a) => (a === 'NaN' ? NaN : a === 'Infinity' ? Infinity : a)
const amounts = table.brcode.amounts ?? []
check('tabela com pelo menos 5 payloads com valor', amounts.length >= 5, String(amounts.length))
for (const v of amounts) {
  const label = `payload ${v.key} com R$ ${v.amount}`
  const p = pix.buildPixPayload(v.key, undefined, undefined, v.amount)
  check(label, p === v.payload, `\n      veio     ${p}\n      esperado ${v.payload}`)
  check(`formatPixAmount(${v.amount}) = ${v.field54}`, pix.formatPixAmount(v.amount) === v.field54, String(pix.formatPixAmount(v.amount)))
  validatePayload(`${label} (esperado)`, v.payload, v.key, v.field54)
  const parsed = validatePayload(`${label} (gerado)`, p ?? '', v.key, v.field54)
  check(`${label}: nome e cidade padrão`, parsed?.fields['59'] === table.brcode.name && parsed?.fields['60'] === table.brcode.city)
  // Sem o campo 54 (e com o CRC refeito aqui) sobra exatamente o QR sem valor da mesma chave
  const rest = tlvList(v.payload).filter(([id]) => id !== '54' && id !== '63').map(([id, val]) => id + String(val.length).padStart(2, '0') + val).join('') + '6304'
  check(`${label}: sem o 54 = QR sem valor`, rest + crcIndependent(rest) === pix.buildPixPayload(v.key))
}
for (const b of table.brcode.amountBuild ?? []) {
  const amount = amountOf(b.amount)
  const label = `buildPixPayload(${j(b.key)}, valor ${String(b.amount)}${b.name ? `, ${j(b.name)}` : ''}${b.city ? `, cidade ${j(b.city)}` : ''})`
  const p = pix.buildPixPayload(b.key, b.name ?? undefined, b.city ?? undefined, amount)
  if ('payload' in b && b.payload === null) {
    check(`${label} → null`, p === null, String(p))
    continue
  }
  if (b.sameAs)
    check(`${label} = payload de ${j(b.sameAs)}`, p !== null && p === pix.buildPixPayload(b.sameAs.key, undefined, undefined, b.sameAs.amount), String(p))
  if (b.sameAsNoAmount) check(`${label} = QR sem valor de ${b.sameAsNoAmount}`, p !== null && p === pix.buildPixPayload(b.sameAsNoAmount), String(p))
  const expected54 = b.sameAsNoAmount ? undefined : (b.field54 ?? pix.formatPixAmount(amount) ?? undefined)
  const parsed = p ? validatePayload(label, p, undefined, expected54) : null
  check(`${label} gerou payload`, !!parsed)
  if (b.field54) check(`${label}: campo 54 = ${b.field54}`, parsed?.fields['54'] === b.field54, parsed?.fields['54'])
  if (b.nameField) check(`${label}: campo 59 = ${b.nameField}`, parsed?.fields['59'] === b.nameField, parsed?.fields['59'])
  if (b.cityField) check(`${label}: campo 60 = ${b.cityField}`, parsed?.fields['60'] === b.cityField, parsed?.fields['60'])
}

if (failures.length) {
  console.error(`check-pix: ${failures.length} falha(s) em ${checks} conferências:`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(
  `check-pix: ${table.cases.length} casos, ${table.brcode.vectors.length} payloads, ${amounts.length} com valor, ${checks} conferências — tudo certo.`,
)
