// Gera o payload "PIX copia e cola" (BR Code estático, padrão EMV/Bacen) a
// partir de uma chave PIX. Sem valor embutido — o pagador digita o valor.
// A chave entra EXATAMENTE como cadastrada (telefone deve incluir +55).

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

// CRC16-CCITT (polinômio 0x1021, init 0xFFFF) sobre o payload — campo 63 do EMV.
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Nome/cidade são exigidos pelo padrão, mas os apps exibem os dados reais do
// recebedor ao ler o QR; valores genéricos são aceitos. ASCII sem acento.
export function buildPixPayload(
  pixKey: string,
  merchantName = 'TORNEIO POKER',
  merchantCity = 'SAO PAULO',
): string {
  const key = pixKey.trim()
  const name = merchantName.slice(0, 25)
  const city = merchantCity.slice(0, 15)

  const payload =
    tlv('00', '01') + // Payload Format Indicator
    tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) + // Merchant Account Info (PIX)
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Moeda: BRL
    tlv('58', 'BR') + // País
    tlv('59', name) +
    tlv('60', city) +
    tlv('62', tlv('05', '***')) + // txid livre (QR estático)
    '6304' // CRC (id + tamanho; valor calculado abaixo)

  return payload + crc16(payload)
}
