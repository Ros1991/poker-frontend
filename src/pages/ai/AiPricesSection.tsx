import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import * as aiApi from '../../api/ai.api'
import type { AiModelPrice, AiOverview } from '../../types/ai.types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../utils/httpErrors'
import { AiSection } from './AiSection'
import { decimalText, formatPrice, formatTokens, parseDecimal } from './aiFormat'
import { useApplyOverview } from './useAiOverview'

const FIELDS = [
  ['inputPerMTok', 'Entrada'],
  ['outputPerMTok', 'Saída'],
  ['cacheWritePerMTok', 'Escrita de cache'],
  ['cacheReadPerMTok', 'Leitura de cache'],
] as const
const LONG_FIELDS = [
  ['longInputPerMTok', 'Entrada'],
  ['longOutputPerMTok', 'Saída'],
  ['longCacheWritePerMTok', 'Escrita de cache'],
  ['longCacheReadPerMTok', 'Leitura de cache'],
] as const
type PriceField = (typeof FIELDS)[number][0] | (typeof LONG_FIELDS)[number][0]

function PriceGrid({ price, long = false }: { price: AiModelPrice; long?: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      {(long ? LONG_FIELDS : FIELDS).map(([field, label]) => (
        <div key={field}>
          <dt className="text-xs text-text-secondary">{label}</dt>
          <dd className="text-sm font-medium text-text-primary">{formatPrice(price[field])}</dd>
        </div>
      ))}
    </dl>
  )
}

function PriceModal({ price, onClose }: { price: AiModelPrice; onClose: () => void }) {
  const apply = useApplyOverview()
  const long = price.longContextThresholdTokens != null
  const [values, setValues] = useState<Record<PriceField, string>>(() => {
    const all = [...FIELDS, ...LONG_FIELDS].map(([f]) => [f, decimalText(price[f])])
    return Object.fromEntries(all) as Record<PriceField, string>
  })
  const [saving, setSaving] = useState(false)
  const fields = long ? [...FIELDS, ...LONG_FIELDS] : [...FIELDS]
  const invalid = fields.some(([f]) => {
    const v = parseDecimal(values[f])
    return v === null || v > 10000 || !/^\d+([.,]\d{1,4})?$/.test(values[f].trim())
  })

  async function save() {
    if (invalid) return
    setSaving(true)
    try {
      const num = (f: PriceField) => parseDecimal(values[f]) ?? 0
      apply(
        await aiApi.updatePrice(price.model, {
          inputPerMTok: num('inputPerMTok'),
          outputPerMTok: num('outputPerMTok'),
          cacheWritePerMTok: num('cacheWritePerMTok'),
          cacheReadPerMTok: num('cacheReadPerMTok'),
          ...(long
            ? {
                longInputPerMTok: num('longInputPerMTok'),
                longOutputPerMTok: num('longOutputPerMTok'),
                longCacheWritePerMTok: num('longCacheWritePerMTok'),
                longCacheReadPerMTok: num('longCacheReadPerMTok'),
              }
            : {}),
        }),
      )
      toast.success(`Preços do ${price.displayName} salvos`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar os preços.')
    } finally {
      setSaving(false)
    }
  }

  const input = (f: PriceField, label: string) => (
    <Input
      key={f}
      id={`ia-preco-${f}`}
      label={label}
      inputMode="decimal"
      autoComplete="off"
      value={values[f]}
      onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
    />
  )

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Preços do ${price.displayName}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={invalid}>
            Salvar preços
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">US$ por milhão de tokens (até 4 casas decimais).</p>
        <div className="grid grid-cols-2 gap-3">{FIELDS.map(([f, label]) => input(f, label))}</div>
        {long && (
          <>
            <p className="text-sm font-medium text-text-primary">
              Prompt acima de {formatTokens(price.longContextThresholdTokens ?? 0)} tokens
            </p>
            <div className="grid grid-cols-2 gap-3">{LONG_FIELDS.map(([f, label]) => input(f, label))}</div>
          </>
        )}
        {invalid && <p className="text-sm text-accent-red-deep">Cada preço vai de US$ 0 a US$ 10.000, com até 4 casas decimais.</p>}
      </div>
    </Modal>
  )
}

/** Tabela de preços por modelo (US$ por milhão de tokens), editável — o custo de cada chamada sai daqui */
export function AiPricesSection({ overview }: { overview: AiOverview }) {
  const [editing, setEditing] = useState<AiModelPrice | null>(null)
  return (
    <AiSection
      id="ia-precos"
      title="Preços por modelo"
      description="US$ por milhão de tokens, semeados com a página oficial de preços da Anthropic. Ajuste quando a Anthropic mudar os preços."
    >
      <ul className="flex flex-col gap-3">
        {overview.prices.map((p) => (
          <li key={p.model} className="flex flex-col gap-3 rounded-lg border border-border-default px-3 py-3" data-ia-preco={p.model}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-medium text-text-primary">{p.displayName}</p>
                {p.isDefault && <Badge color="blue">Padrão</Badge>}
              </div>
              <Button variant="secondary" className="shrink-0" onClick={() => setEditing(p)} aria-label={`Editar preços do ${p.displayName}`}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
              </Button>
            </div>
            <PriceGrid price={p} />
            {p.longContextThresholdTokens != null && (
              <div className="flex flex-col gap-2 border-t border-border-default pt-2">
                <p className="text-xs font-medium text-text-secondary">
                  Prompt acima de {formatTokens(p.longContextThresholdTokens)} tokens
                </p>
                <PriceGrid price={p} long />
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && <PriceModal price={editing} onClose={() => setEditing(null)} />}
    </AiSection>
  )
}
