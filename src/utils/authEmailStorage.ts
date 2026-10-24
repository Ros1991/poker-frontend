/**
 * E-mails guardados no navegador pelas telas de conta (login, cadastro, confirmação, "Esqueci minha senha").
 *
 * - poker_remembered_email: o "Lembrar e-mail e senha" do login (vem com a senha guardada).
 * - poker_last_email: o e-mail do último cadastro feito neste navegador. É mais novo que o "Lembrar": num aparelho
 *   emprestado (o celular do organizador usado para cadastrar um amigo) o "Lembrar" é de OUTRA conta.
 */
export const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'
export const LAST_EMAIL_KEY = 'poker_last_email'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** E-mail para pré-preencher um formulário de conta: o do último cadastro primeiro, depois o do "Lembrar". */
export function readStoredEmail(): string {
  return readStorage(LAST_EMAIL_KEY) || readStorage(REMEMBERED_EMAIL_KEY) || ''
}

/** Mesma máscara do backend (PasswordResetEmail.Mask): "ro***@gmail.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}***${email.slice(at)}`
}

/** O e-mail guardado é o da conta mostrada mascarada? (compara sem distinguir maiúsculas, como o backend grava) */
export function matchesMaskedEmail(email: string, masked: string): boolean {
  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 && maskEmail(normalized) === masked.trim().toLowerCase()
}

/**
 * E-mail do último cadastro neste navegador, só se for o da conta mostrada mascarada (tela do link de confirmação);
 * senão ''. O "Lembrar" nunca entra aqui: ele é do login deste aparelho — quase sempre uma conta já confirmada, e um
 * link de confirmação válido é sempre de conta NÃO confirmada. A máscara só mostra 2 letras e o domínio, então ela
 * descarta o e-mail guardado que com certeza é de outra conta, mas não prova que é o mesmo: o campo continua visível
 * e editável no /esqueci-senha. Na dúvida, melhor o campo vazio do que o link de redefinição ir para a caixa errada.
 */
export function lastEmailMatching(masked: string): string {
  const email = readStorage(LAST_EMAIL_KEY)?.trim()
  return email && matchesMaskedEmail(email, masked) ? email : ''
}

/**
 * Estado da navegação para o /esqueci-senha: o e-mail que a tela de origem já sabe (o digitado no login, o da conta
 * do vínculo com o Google, o do cadastro). `email: ''` pede o campo vazio (a tela de origem sabe que o e-mail
 * guardado é de outra conta); sem estado, o /esqueci-senha usa o {@link readStoredEmail}.
 */
export interface ForgotPasswordState {
  email?: string
}
