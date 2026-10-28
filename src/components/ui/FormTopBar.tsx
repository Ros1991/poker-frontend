import type { ButtonHTMLAttributes } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '../../utils/cn'

/**
 * X e ✓ no topo dos formulários, só no celular (SPEC-20261027-2132; abaixo de `sm`, 640 px).
 *
 * Nos modais e telas de formulário cujo rodapé é Cancelar + Salvar (ou Criar, Cadastrar, Salvar alterações…), o X do
 * topo cancela e o ✓ ao lado dele salva — o MESMO efeito do botão do rodapé: mesma função ou o mesmo `<form>` (mesma
 * validação, e o erro rola até o campo como hoje), o mesmo `disabled`/`loading` (girando enquanto salva) e o verbo do
 * botão no `aria-label`. No celular o rodapé some; no computador (`sm`+) continuam Cancelar e Salvar embaixo e o ✓ não
 * aparece. Avisos de confirmação (ConfirmDialog) e diálogos com verbo próprio (Rebuy, Pagar, Eliminar, Mover, Usar esta
 * foto…) NÃO usam este padrão: um ✓ sozinho não diz o que vai acontecer.
 *
 * - Modal: `<Modal submitAction={…}>` (o ✓ entra no cabeçalho, ao lado do X que já existe, e o rodapé some no celular).
 * - Tela inteira: `<FormPageBar>` (barra fixa no topo com X, título e ✓, no lugar do cabeçalho do app) e o rodapé da
 *   página com `hidden sm:flex`.
 */
export interface SubmitAction {
  /** Texto do botão do rodapé ("Salvar", "Criar torneio"…): vira o `aria-label` do ✓ */
  label: string
  /** Mesma função do botão do rodapé (botão fora de `<form>`) */
  onClick?: () => void
  /** `id` do `<form>` que o botão do rodapé envia: o ✓ é `type="submit" form=…` (mesma validação) */
  form?: string
  loading?: boolean
  /** Como no Button: sem `disabled`, fica desabilitado enquanto `loading` */
  disabled?: boolean
}

const iconButton =
  'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg transition-colors touch-manipulation ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

type ExtraButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'form' | 'onClick' | 'disabled' | 'className'>

/**
 * O ✓: salva (mesmo efeito, validação e estado do botão do rodapé). Atributos extras (ex.: `data-picker-primary` no
 * cadastro do PlayerPicker) passam para o `<button>`.
 */
export function SubmitCheckButton({ action, className, ...rest }: { action: SubmitAction; className?: string } & ExtraButtonProps) {
  const loading = !!action.loading
  return (
    <button
      {...rest}
      type={action.form ? 'submit' : 'button'}
      form={action.form}
      onClick={action.onClick}
      disabled={action.disabled ?? loading}
      aria-label={action.label}
      title={action.label}
      aria-busy={loading || undefined}
      data-submit-check
      className={cn(iconButton, 'bg-accent-blue text-white hover:bg-accent-blue-hover active:scale-[0.98]', className)}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
    </button>
  )
}

interface FormPageBarProps {
  /** Título da tela ("Editar torneio") */
  title: string
  /** Linha pequena embaixo do título (ex.: o nome do home game) */
  subtitle?: string | null
  /** Mesmo efeito do Cancelar do rodapé (voltar) */
  onCancel: () => void
  /** Mesmo `disabled` do Cancelar do rodapé */
  cancelDisabled?: boolean
  /** Nome do X para o leitor de tela (padrão "Cancelar", o texto do botão do rodapé) */
  cancelLabel?: string
  submit: SubmitAction
}

/**
 * Barra fixa no topo das telas inteiras de formulário, só no celular: X (cancela/volta), título e ✓ (salva). Cobre o
 * cabeçalho do app (mesma altura, 64 px), então o conteúdo da página não fica atrás dela e os campos ganham o espaço.
 */
export function FormPageBar({ title, subtitle, onCancel, cancelDisabled, cancelLabel = 'Cancelar', submit }: FormPageBarProps) {
  return (
    <div
      data-form-bar
      className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2 border-b border-border-default bg-bg-secondary px-2 sm:hidden"
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        aria-label={cancelLabel}
        title={cancelLabel}
        data-form-bar-cancel
        className={cn(iconButton, 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary')}
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        {/* Até 2 linhas, sem cortar a 320 px (revisão da onda 15): 2 × 22,5 px + o subtítulo cabem nos 64 px da barra */}
        <h1 className="line-clamp-2 break-words text-lg font-semibold leading-tight text-text-primary">{title}</h1>
        {subtitle && <p className="truncate text-xs text-text-secondary">{subtitle}</p>}
      </div>
      <SubmitCheckButton action={submit} />
    </div>
  )
}
