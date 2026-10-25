import { useId, useState } from 'react'
import { cn } from '../../utils/cn'
import { Input } from '../ui/Input'
import {
  checkPixKey,
  PIX_KEY_TYPE_LABELS,
  PIX_KEY_TYPES,
  type PixKeyType,
} from '../../utils/pix'

interface PixKeyInputProps {
  id?: string
  label?: string
  /** Texto do campo, como a pessoa digitou */
  value: string
  onChange: (value: string) => void
  /** Tipo escolhido pela pessoa; null = automático (detecta pelo formato) */
  type: PixKeyType | null
  onTypeChange: (type: PixKeyType | null) => void
  /**
   * Chave já gravada (edição). Enquanto o texto for igual a ela, vale o tipo dela: quem escolheu CPF ou celular ao
   * salvar não é perguntado de novo. Mexeu no texto, volta a valer o automático (ou o tipo escolhido).
   */
  savedKey?: string | null
  /** Erro de fora (ex.: do envio); tem prioridade sobre o calculado */
  error?: string
  disabled?: boolean
}

const AUTO = 'auto' as const

/**
 * Campo de chave PIX (SPEC-20261023-1218): aceita do jeito que a pessoa digita e mostra o que vai ser gravado —
 * "Detectado: Celular +55 61 99999-9999 · trocar". 11 dígitos que podem ser CPF ou celular pedem a escolha (e o campo
 * fica inválido até escolher). "trocar" abre os chips do tipo (CPF · CNPJ · Celular · E-mail · Chave aleatória ·
 * Automático). Erros com a mensagem da tabela (`utils/pix.ts`), iguais aos da API. Quem usa confere `checkPixKey`
 * antes de salvar e envia `toPixKeyPayload` (chave normalizada + tipo).
 */
export function PixKeyInput({
  id,
  label = 'Chave PIX',
  value,
  onChange,
  type,
  onTypeChange,
  savedKey,
  error,
  disabled,
}: PixKeyInputProps) {
  const autoId = useId()
  const inputId = id ?? `pix-${autoId}`
  const statusId = `${inputId}-status`
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)

  const check = checkPixKey(value, type, savedKey)
  const empty = value.trim() === ''
  const result = check.result
  const valid = result.ok && result.key !== null && !check.needsChoice
  // Erro aparece depois de sair do campo (ou já de cara numa chave gravada fora de formato)
  const showError = !empty && !result.ok && (!focused || touched)
  const shownError = error ?? (showError && !result.ok ? result.error : undefined)

  function choose(next: PixKeyType | null) {
    onTypeChange(next)
    setChooserOpen(false)
  }

  // Tipo mostrado: o detectado/validado; com chave inválida, o escolhido (para a pessoa ver o que está valendo)
  const shownType = result.ok && result.type ? result.type : type
  const typeLabel = shownType ? PIX_KEY_TYPE_LABELS[shownType] : null

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={inputId}
        label={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setTouched(true)
        }}
        error={shownError}
        disabled={disabled}
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        placeholder="CPF, CNPJ, celular com DDD, e-mail ou chave aleatória"
        aria-invalid={!!shownError || check.needsChoice || undefined}
        aria-describedby={statusId}
      />

      <div id={statusId} aria-live="polite" className="flex flex-col gap-2">
        {empty && (
          <p className="text-xs text-text-secondary">
            Pode digitar do jeito que preferir: 61 99999-9999, 123.456.789-09, seu e-mail…
          </p>
        )}

        {check.needsChoice && (
          <div className="flex flex-col gap-2 rounded-lg border border-accent-gold bg-accent-gold-soft p-3">
            <p className="text-sm font-medium text-text-primary">
              Esta chave pode ser CPF ou celular — qual é?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => choose('Cpf')}
                disabled={disabled}
                className="min-h-[44px] rounded-lg border border-border-input bg-bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                É CPF
              </button>
              <button
                type="button"
                onClick={() => choose('Phone')}
                disabled={disabled}
                className="min-h-[44px] rounded-lg border border-border-input bg-bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                É celular
              </button>
            </div>
          </div>
        )}

        {!empty && !check.needsChoice && (valid || type) && (
          <p className="flex flex-wrap items-center gap-x-1 text-xs text-text-secondary">
            <span>{type ? 'Tipo escolhido:' : 'Detectado:'}</span>
            {typeLabel && <strong className="font-semibold text-text-primary">{typeLabel}</strong>}
            {valid && result.ok && result.key && (
              <span className="wrap-anywhere text-text-primary">{result.display}</span>
            )}
            {!disabled && (
              <>
                <span aria-hidden="true" className="text-text-muted">·</span>
                <button
                  type="button"
                  onClick={() => setChooserOpen((o) => !o)}
                  aria-expanded={chooserOpen}
                  className="inline-flex min-h-[44px] items-center px-1 font-medium text-accent-blue underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  trocar
                </button>
              </>
            )}
          </p>
        )}

        {!empty && !valid && !type && !check.needsChoice && !shownError && (
          <p className="text-xs text-text-secondary">
            CPF, CNPJ, celular com DDD, e-mail ou chave aleatória.
          </p>
        )}

        {!empty && !result.ok && !type && !disabled && shownError && (
          <button
            type="button"
            onClick={() => setChooserOpen((o) => !o)}
            aria-expanded={chooserOpen}
            className="inline-flex min-h-[44px] items-center self-start px-1 text-xs font-medium text-accent-blue underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Escolher o tipo da chave
          </button>
        )}

        {chooserOpen && !disabled && (
          <div role="radiogroup" aria-label="Tipo da chave PIX" className="flex flex-wrap gap-2">
            {([...PIX_KEY_TYPES, AUTO] as const).map((option) => {
              const selected = option === AUTO ? type === null : type === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option === AUTO ? null : option)}
                  className={cn(
                    'min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    selected
                      ? 'border-accent-blue bg-accent-blue-soft text-accent-blue-deep'
                      : 'border-border-input bg-bg-card text-text-primary hover:bg-bg-tertiary',
                  )}
                >
                  {option === AUTO ? 'Automático' : PIX_KEY_TYPE_LABELS[option]}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
