import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number
  /** Recebe o número a cada tecla: vazio vira `emptyValue`; fora de `min`/`max` vira o limite */
  onValueChange: (value: number) => void
  min?: number
  max?: number
  /** Só inteiros (descarta a parte decimal digitada) */
  integer?: boolean
  /** Valor informado enquanto o campo está vazio e mostrado ao sair dele vazio. Padrão: `min`, ou 0 */
  emptyValue?: number
}

function format(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

/**
 * Campo numérico que deixa apagar tudo e digitar de novo (SPEC-20261103-1226): o texto digitado fica como está enquanto a
 * pessoa digita — vazio, "0", "05" —, a tela recebe o número a cada tecla (vazio = `emptyValue`; fora de `min`/`max` = o
 * limite) e, ao sair do campo, ele mostra o valor que valeu. Antes, cada campo convertia o texto em número a cada tecla
 * e nunca ficava vazio: trocar "3" por "5" exigia digitar "35" e apagar o "3".
 *
 * O texto acompanha o `value` de fora só quando o campo não está em foco (o valor anterior fica no estado, sem efeito).
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  integer = false,
  emptyValue,
  onFocus,
  onBlur,
  inputMode,
  step,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => format(value))
  const [previous, setPrevious] = useState(value)
  const [focused, setFocused] = useState(false)

  // Mudança de fora (outro botão, recálculo, recarga): só reescreve o texto fora de foco
  if (!Object.is(value, previous)) {
    setPrevious(value)
    if (!focused) setText(format(value))
  }

  const fallback = emptyValue ?? min ?? 0
  const clamp = (n: number) => {
    let result = integer ? Math.trunc(n) : n
    if (min != null && result < min) result = min
    if (max != null && result > max) result = max
    return result
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
      step={step ?? (integer ? 1 : undefined)}
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const parsed = raw.trim() === '' ? Number.NaN : Number(raw.replace(',', '.'))
        onValueChange(Number.isFinite(parsed) ? clamp(parsed) : fallback)
      }}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        setText(format(value))
        onBlur?.(e)
      }}
    />
  )
}
