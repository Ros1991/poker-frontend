import { useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, ShieldAlert, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as aiApi from '../../api/ai.api'
import type { AiKeyTestResult, AiOverview } from '../../types/ai.types'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Select } from '../../components/ui/Select'
import { errorMessage } from '../../utils/httpErrors'
import { AiSection } from './AiSection'
import { formatDayTime } from './aiFormat'
import { useApplyOverview } from './useAiOverview'

/**
 * Chave da API da Anthropic: guardada cifrada no servidor e NUNCA devolvida (só "sk-ant-…" + 4 últimos). Trocar,
 * remover e "Testar chave" pela API de modelos (sem custo de tokens).
 */
export function AiKeySection({ overview }: { overview: AiOverview }) {
  const apply = useApplyOverview()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testModel, setTestModel] = useState(overview.defaultModel)
  const [result, setResult] = useState<AiKeyTestResult | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { key } = overview
  const canSave = overview.secretsKeyConfigured

  async function saveKey() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const next = await aiApi.setKey(apiKey.trim())
      apply(next)
      setApiKey('')
      setResult(null)
      toast.success(key.configured ? 'Chave trocada' : 'Chave salva')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar a chave.')
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      const r = await aiApi.testKey(testModel)
      setResult(r)
      apply(await aiApi.getOverview())
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível testar a chave.')
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    setRemoving(true)
    try {
      apply(await aiApi.removeKey())
      setResult(null)
      setConfirmRemove(false)
      toast.success('Chave removida')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível remover a chave.')
    } finally {
      setRemoving(false)
    }
  }

  const shownTest: { ok: boolean; message: string; at?: string; model?: string | null } | null = result
    ? { ok: result.ok, message: result.message, model: result.model }
    : overview.lastTest
      ? { ok: overview.lastTest.ok, message: overview.lastTest.message, at: overview.lastTest.at, model: overview.lastTest.model }
      : null

  return (
    <AiSection
      id="ia-chave"
      title="Chave da Anthropic"
      description="Fica cifrada no servidor e nunca volta para o navegador: aqui aparecem só o começo e os 4 últimos caracteres."
    >
      {!canSave && (
        <div className="flex items-start gap-2 rounded-lg bg-accent-red-soft px-3 py-2 text-sm text-accent-red-deep" role="alert" data-ia-sem-chave-mestra>
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            A chave mestra (variável AI_SECRETS_KEY) não está configurada no servidor. Sem ela a chave da API não pode ser
            guardada com segurança: configure a variável e reinicie o servidor.
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border-default px-3 py-3" data-ia-chave-status>
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
        {key.configured ? (
          <div className="min-w-0">
            <p className="font-medium text-text-primary">
              {/* Dica curta inteira numa linha (a 320 px não quebra no meio: "s" / "k-ant-…") */}
              Chave cadastrada: <span className="whitespace-nowrap font-mono" data-ia-chave-hint>{key.hint}</span>
            </p>
            <p className="text-sm text-text-secondary">
              {key.updatedByName ? `Por ${key.updatedByName}` : 'Atualizada'} em {formatDayTime(key.updatedAt)}
            </p>
          </div>
        ) : (
          <p className="text-text-secondary">Nenhuma chave cadastrada. Sem chave, nenhum recurso pago funciona.</p>
        )}
      </div>

      {key.unreadable && (
        <p className="flex items-start gap-2 rounded-lg bg-accent-yellow-soft px-3 py-2 text-sm text-text-primary" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          A chave guardada não pôde ser lida (a chave mestra do servidor mudou ou falta). Cadastre a chave de novo.
        </p>
      )}

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          void saveKey()
        }}
      >
        <div className="min-w-0 flex-1">
          <PasswordInput
            id="ia-chave-api"
            label={key.configured ? 'Trocar a chave' : 'Chave da API'}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!canSave || saving}
          />
        </div>
        <Button type="submit" loading={saving} disabled={!canSave || !apiKey.trim()} className="w-full sm:w-auto">
          {key.configured ? 'Trocar chave' : 'Salvar chave'}
        </Button>
      </form>

      {key.configured && (
        <div className="flex flex-col gap-3 border-t border-border-default pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Select
                id="ia-modelo-teste"
                label="Modelo a conferir"
                options={overview.prices.map((p) => ({ value: p.model, label: p.displayName }))}
                value={testModel}
                onChange={(e) => setTestModel(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => void test()} loading={testing} className="w-full sm:w-auto">
              Testar chave
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(true)} className="w-full sm:w-auto">
              Remover chave
            </Button>
          </div>
          <p className="text-xs text-text-secondary">O teste consulta a API de modelos da Anthropic: não gasta tokens.</p>
          {shownTest && (
            <div
              className={
                shownTest.ok
                  ? 'flex items-start gap-2 rounded-lg bg-accent-green-soft px-3 py-2 text-sm text-accent-green-deep'
                  : 'flex items-start gap-2 rounded-lg bg-accent-red-soft px-3 py-2 text-sm text-accent-red-deep'
              }
              role="status"
              data-ia-teste
            >
              {shownTest.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {shownTest.message}
                {shownTest.at && ` (último teste em ${formatDayTime(shownTest.at)})`}
              </span>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
        title="Remover a chave"
        message={'Sem a chave, nenhum recurso pago de IA funciona até você cadastrar outra. O "Tirar o fundo" (no aparelho) continua.'}
        confirmLabel="Remover chave"
        loading={removing}
      />
    </AiSection>
  )
}
