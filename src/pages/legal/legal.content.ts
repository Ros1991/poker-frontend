/**
 * Termos de uso e política de privacidade do Poker da Galera (SPEC-20261023-1207) — texto-base em português,
 * fonte ÚNICA de duas saídas:
 *   1. as páginas da SPA `/termos` e `/privacidade` (`TermsPage`/`PrivacyPage`, via `LegalDocumentView`);
 *   2. as versões estáticas `public/termos.html` e `public/privacidade.html`, servidas pelo nginx em
 *      `location = /termos` e `= /privacidade` para quem lê sem JavaScript (robô de verificação da marca do Google).
 *      Depois de mudar qualquer texto aqui, rode `node scripts/legal/build-legal-pages.mjs` (o modo `--check` do
 *      mesmo script acusa versão estática desatualizada).
 *
 * Este arquivo NÃO importa nada (o gerador lê o .ts direto pelo Node) e só usa sintaxe apagável de TypeScript.
 *
 * Formato: `LegalBlock` = parágrafo (string) ou lista (array de strings). Endereços de e-mail e URLs `https://`
 * dentro do texto viram link nas duas saídas.
 *
 * Revisão jurídica fica fora da SPEC (texto-base). Dados do responsável informados pelo usuário em 2026-10-23:
 * controlador pessoa física, sem CPF exibido; contato que recebe pelo Cloudflare Email Routing.
 */

export const LEGAL_INFO = {
  /** Controlador dos dados (LGPD art. 5º, VI) */
  controller: 'Rodrigo Oliveira Silva',
  /** Contato do controlador e do encarregado (= CONTACT_EMAIL de constants/contact.ts; conferido pelo script da SPEC) */
  email: 'contato@pokerdagalera.com.br',
  site: 'https://pokerdagalera.com.br',
  siteHost: 'pokerdagalera.com.br',
  /** Data da versão em vigor dos dois documentos */
  updatedAt: '25/10/2026',
} as const

/** Parágrafo (string) ou lista com marcadores (array). */
export type LegalBlock = string | readonly string[]

export interface LegalSection {
  /** Âncora da seção (id do <h2>) */
  id: string
  title: string
  blocks: readonly LegalBlock[]
}

export interface LegalDocument {
  /** Caminho público da página (também o nome do arquivo estático: /termos → public/termos.html) */
  path: '/termos' | '/privacidade'
  /** Título da página (h1) */
  title: string
  /** `document.title` e <title> da versão estática */
  pageTitle: string
  /** <meta name="description"> */
  description: string
  intro: readonly string[]
  sections: readonly LegalSection[]
}

const EMAIL = LEGAL_INFO.email

export const PRIVACY_DOC: LegalDocument = {
  path: '/privacidade',
  title: 'Política de privacidade',
  pageTitle: 'Política de privacidade — Poker da Galera',
  description:
    'Como o Poker da Galera coleta, usa, compartilha e protege dados pessoais, conforme a LGPD, e como pedir acesso, correção ou exclusão.',
  intro: [
    `Esta política explica quais dados pessoais o Poker da Galera (${LEGAL_INFO.siteHost}) coleta, para que usa, com quem compartilha e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).`,
  ],
  sections: [
    {
      id: 'quem-somos',
      title: '1. Quem somos e quem responde pelos dados',
      blocks: [
        'O Poker da Galera é um serviço on-line para organizar home games de poker: relógio de blinds, telão na TV, inscrições, rebuys e add-ons, pagamentos registrados, premiação e ranking da temporada.',
        `O controlador dos dados pessoais é ${LEGAL_INFO.controller}, pessoa física responsável pelo Poker da Galera. O contato do controlador e do encarregado pelo tratamento de dados (LGPD, art. 41) é ${EMAIL}.`,
      ],
    },
    {
      id: 'dados-coletados',
      title: '2. Dados que coletamos',
      blocks: [
        [
          'Conta de quem se cadastra: nome, apelido, e-mail, WhatsApp (opcional), foto (opcional) e senha. A senha é guardada só como um resumo criptográfico (hash), nunca em texto.',
          'Entrada com o Google: quando você escolhe “Entrar com Google”, recebemos do Google o seu nome, e-mail, foto de perfil e o identificador da sua conta Google. Não recebemos a sua senha do Google nem acesso a outros dados da conta (como contatos, e-mails ou arquivos).',
          'Jogadores cadastrados pelo organizador: nome, apelido e, se o organizador preencher, WhatsApp, e-mail, foto, documento e observações; e os resultados nos torneios (inscrições, rebuys, add-ons, eliminações, colocação, prêmios e pagamentos registrados).',
          'Dados do jogo informados pelo organizador: nome e logo do home game, estruturas de blinds, valores, custos e a chave PIX que ele escolhe mostrar para receber os pagamentos.',
          'Dealer: o nome digitado ao pedir acesso ao terminal do dealer e um identificador gerado no próprio aparelho.',
          'TV pareada: um identificador aleatório do aparelho, sem dados pessoais.',
          'Registros de uso e segurança: data e hora, endereço IP e navegador ou aparelho das sessões e de ações importantes (login, troca de senha, mudança de plano, pagamentos), para proteger as contas e prevenir abuso.',
        ],
      ],
    },
    {
      id: 'finalidades',
      title: '3. Para que usamos',
      blocks: [
        [
          'Criar e manter a sua conta, permitir a entrada com senha ou com o Google e manter a sessão aberta nos seus aparelhos.',
          'Fazer o serviço funcionar: torneios, telão, terminal do dealer, pagamentos registrados, premiação e ranking.',
          'Enviar os e-mails do próprio serviço: confirmação de cadastro, redefinição de senha e avisos da conta. Não enviamos propaganda.',
          'Atender pedidos de suporte e ativar planos.',
          'Segurança: limitar tentativas de acesso, investigar abuso e cumprir obrigações legais.',
        ],
      ],
    },
    {
      id: 'base-legal',
      title: '4. Base legal',
      blocks: [
        [
          'Execução de contrato (LGPD, art. 7º, V): os dados da conta e do uso do serviço que você pediu.',
          'Legítimo interesse (art. 7º, IX): os registros de segurança e os dados dos jogadores cadastrados pelo organizador para organizar o jogo do grupo, sempre no limite do necessário.',
          'Consentimento (art. 7º, I): dados opcionais que você escolhe informar, como foto e WhatsApp, e a entrada com o Google. Você pode retirá-lo apagando a informação ou desconectando o Google no seu perfil.',
          'Cumprimento de obrigação legal (art. 7º, II): quando a lei ou uma autoridade exigir.',
        ],
      ],
    },
    {
      id: 'compartilhamento',
      title: '5. Quem vê e com quem compartilhamos',
      blocks: [
        [
          'O dono e os membros de cada home game veem os jogadores, torneios e valores daquele home game. O dealer autorizado vê os jogadores e os valores do torneio em que foi autorizado.',
          'O telão mostra, para quem estiver no local, o nome ou apelido, a foto e a situação dos jogadores do torneio. Cada ranking tem uma página pública (/r/…) que qualquer pessoa com o link pode abrir, com o nome ou apelido, a foto e os resultados dos jogadores daquele ranking.',
          'Prestadores que operam o serviço para nós, só no necessário: Railway (hospedagem do site, da API e do banco de dados), Cloudflare (rede, proteção do site e encaminhamento do e-mail de contato), Resend (envio dos e-mails do serviço) e Google (entrada com a conta Google, quando você escolhe usá-la, e a caixa de e-mail onde chegam as mensagens enviadas ao contato).',
          'Autoridades, quando houver ordem judicial ou obrigação legal.',
        ],
        'Não vendemos, não alugamos e não compartilhamos dados pessoais para publicidade.',
      ],
    },
    {
      id: 'transferencia-internacional',
      title: '6. Transferência internacional',
      blocks: [
        'Alguns desses prestadores guardam ou processam dados fora do Brasil (por exemplo, nos Estados Unidos). A transferência acontece para executar o serviço que você pediu, com prestadores que adotam medidas de segurança e proteção compatíveis com a LGPD (art. 33).',
      ],
    },
    {
      id: 'retencao',
      title: '7. Por quanto tempo guardamos',
      blocks: [
        [
          'Os dados da conta ficam enquanto a conta estiver ativa.',
          'Ao excluir a conta, ela é anonimizada: o nome vira “Conta excluída”; apelido, WhatsApp, foto, senha e logins do Google são apagados; o e-mail é substituído; e todas as sessões são encerradas. Os registros de segurança podem ser mantidos pelo tempo necessário para proteger o serviço e cumprir a lei, sem o seu nome.',
          'Os jogadores e resultados cadastrados num home game fazem parte do histórico do organizador e ficam enquanto ele mantiver o home game. O jogador pode pedir a correção ou a exclusão dos próprios dados ao organizador ou a nós, pelo contato.',
        ],
      ],
    },
    {
      id: 'direitos',
      title: '8. Seus direitos',
      blocks: [
        'Pela LGPD (art. 18), você pode: confirmar se tratamos os seus dados; acessá-los; corrigir dados incompletos ou errados; pedir anonimização, bloqueio ou eliminação de dados desnecessários; pedir a portabilidade; saber com quem compartilhamos; revogar o consentimento; e reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
        `Em Meu perfil você mesmo edita os seus dados e a foto, troca a senha, desconecta o Google, encerra sessões de outros aparelhos e exclui a conta (quem é dono de home game precisa antes excluí-lo ou falar com o suporte). Para qualquer outro pedido, escreva para ${EMAIL}; respondemos em até 15 dias.`,
      ],
    },
    {
      id: 'armazenamento-local',
      title: '9. Cookies e armazenamento no navegador',
      blocks: [
        'O site não usa cookies de publicidade nem ferramentas de análise ou de rastreamento de terceiros.',
        'Guardamos no armazenamento local do navegador (localStorage) só o necessário para o serviço funcionar: a sessão de login, o identificador da TV pareada, o acesso do dealer autorizado e preferências da tela. Sair da conta ou limpar os dados do site no navegador apaga essas informações.',
        'Na tela de entrada, o botão “Entrar com Google” carrega o script do próprio Google, sujeito à política de privacidade do Google.',
      ],
    },
    {
      id: 'google',
      title: '10. Dados recebidos do Google (Uso Limitado)',
      blocks: [
        'Os dados recebidos do Google (nome, e-mail, foto e identificador da conta) servem só para criar a sua conta ou entrar nela e para mostrar o seu nome e a sua foto dentro do serviço. Não usamos esses dados para publicidade, não os vendemos e não os transferimos a terceiros, exceto aos prestadores que operam o serviço ou quando a lei exigir.',
        'O uso e a transferência, pelo Poker da Galera, de informações recebidas das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado: https://developers.google.com/terms/api-services-user-data-policy',
        'Você pode desconectar o Google em Meu perfil, em “Contas conectadas”, ou revogar o acesso a qualquer momento em https://myaccount.google.com/permissions',
      ],
    },
    {
      id: 'seguranca',
      title: '11. Segurança',
      blocks: [
        'A conexão com o site é sempre criptografada (HTTPS), as senhas ficam guardadas só em hash, as sessões podem ser encerradas aparelho por aparelho e cada home game só é acessado por quem faz parte dele. Nenhum sistema é totalmente imune a falhas: se houver um incidente que traga risco relevante, avisaremos as pessoas afetadas e a ANPD.',
      ],
    },
    {
      id: 'menores',
      title: '12. Menores de idade',
      blocks: ['O Poker da Galera é destinado a maiores de 18 anos. Não cadastre menores de idade como jogadores.'],
    },
    {
      id: 'mudancas',
      title: '13. Mudanças nesta política',
      blocks: [
        'Podemos atualizar esta política. A data no topo muda a cada versão e, se a mudança for importante, avisamos pelo e-mail da conta ou no próprio serviço.',
      ],
    },
    {
      id: 'contato',
      title: '14. Contato',
      blocks: [`Dúvidas, pedidos e reclamações sobre privacidade: ${EMAIL}.`],
    },
  ],
}

export const TERMS_DOC: LegalDocument = {
  path: '/termos',
  title: 'Termos de uso',
  pageTitle: 'Termos de uso — Poker da Galera',
  description:
    'Regras para usar o Poker da Galera: conta, planos, o que o serviço faz e não faz, conteúdo cadastrado, responsabilidades e contato.',
  intro: [
    `Estes termos valem para quem usa o Poker da Galera (${LEGAL_INFO.siteHost}). Ao criar uma conta ou usar o serviço, você concorda com eles e com a Política de Privacidade (${LEGAL_INFO.site}/privacidade).`,
  ],
  sections: [
    {
      id: 'servico',
      title: '1. O serviço',
      blocks: [
        'O Poker da Galera é uma ferramenta on-line para organizar home games de poker: jogadores, estruturas de blinds, torneios, relógio, telão na TV, terminal do dealer, pagamentos registrados, premiação e ranking da temporada.',
        `O responsável pelo serviço é ${LEGAL_INFO.controller}, pessoa física, com contato em ${EMAIL}.`,
      ],
    },
    {
      id: 'dinheiro',
      title: '2. O que o serviço não faz',
      blocks: [
        'O Poker da Galera não é casa de apostas, não organiza jogos e não recebe, guarda nem transfere dinheiro. Os pagamentos (PIX ou dinheiro) acontecem direto entre os jogadores e o organizador; o sistema só registra o que o organizador informa.',
        'O organizador é o único responsável pelo jogo que organiza, pelos valores combinados, cobrados e pagos, e por cumprir a legislação que se aplica ao seu jogo.',
      ],
    },
    {
      id: 'conta',
      title: '3. Sua conta',
      blocks: [
        [
          'O serviço é destinado a maiores de 18 anos.',
          'Use dados verdadeiros e confirme o seu e-mail. A conta é pessoal: guarde a sua senha e não a compartilhe.',
          'Você responde pelo que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha, encerre as sessões em Meu perfil e avise o suporte.',
          'Ao entrar com o Google, a sua conta do Google passa a dar acesso à sua conta do Poker da Galera; você pode desconectá-la em Meu perfil.',
        ],
      ],
    },
    {
      id: 'planos',
      title: '4. Planos',
      blocks: [
        'Há um plano gratuito (Mesa) e planos pagos (Clube e Liga), com os limites, recursos e preços mostrados na seção de planos do site.',
        'Nesta fase de testes não há cobrança automática: os planos pagos são ativados pelo suporte, pelo WhatsApp. Preços e limites podem mudar; mudanças que afetem um plano já ativo serão avisadas com antecedência.',
        'Quando um plano pago vence ou é cancelado, a conta volta ao Mesa e nada é apagado: os dados continuam guardados e legíveis; só a criação de recursos acima do limite e os recursos exclusivos dos planos pagos ficam bloqueados.',
      ],
    },
    {
      id: 'conteudo',
      title: '5. Conteúdo que você cadastra',
      blocks: [
        [
          'Os dados que você cadastra (jogadores, torneios, fotos, logos e chaves PIX) continuam seus. Você nos autoriza a guardá-los e exibi-los só para o serviço funcionar: no painel, no telão, no terminal do dealer e na página pública do ranking.',
          'Ao cadastrar jogadores, fotos e contatos de outras pessoas, você declara ter a autorização delas e avisá-las de que o telão e o ranking público mostram nome ou apelido, foto e resultados.',
          'Não cadastre conteúdo ilegal, ofensivo, discriminatório ou que viole direitos de outras pessoas.',
        ],
      ],
    },
    {
      id: 'uso-permitido',
      title: '6. Uso permitido',
      blocks: [
        'É proibido tentar acessar contas ou home games de outras pessoas, burlar os limites dos planos ou as proteções de segurança, sobrecarregar o serviço, copiar o sistema ou os dados por meios automatizados e usar o serviço para fraude ou qualquer atividade ilegal.',
        'Podemos suspender ou encerrar contas que violem estes termos, avisando sempre que possível.',
      ],
    },
    {
      id: 'disponibilidade',
      title: '7. Disponibilidade e suporte',
      blocks: [
        'O serviço está em evolução. Trabalhamos para mantê-lo no ar, mas pode haver interrupções para manutenção ou por falhas de terceiros (hospedagem, internet, energia). Para a noite de jogo, vale ter um plano B simples, como anotar as eliminações.',
        `O suporte atende pelo WhatsApp informado no site e pelo e-mail ${EMAIL}.`,
      ],
    },
    {
      id: 'responsabilidade',
      title: '8. Responsabilidade',
      blocks: [
        'O serviço é oferecido no estado em que se encontra. No limite permitido pela lei, não respondemos por prejuízos decorrentes de decisões do jogo, de valores combinados entre os jogadores, de dados informados de forma errada ou de períodos de indisponibilidade. Nada nestes termos limita direitos garantidos pelo Código de Defesa do Consumidor.',
      ],
    },
    {
      id: 'encerramento',
      title: '9. Encerramento',
      blocks: [
        'Você pode excluir a sua conta quando quiser, em Meu perfil (quem é dono de home game precisa antes excluí-lo ou falar com o suporte). O que acontece com os dados está na Política de Privacidade.',
      ],
    },
    {
      id: 'mudancas',
      title: '10. Mudanças nestes termos',
      blocks: [
        'Podemos atualizar estes termos. A data no topo muda a cada versão e, se a mudança for importante, avisamos pelo e-mail da conta ou no próprio serviço. Continuar usando o serviço depois do aviso significa concordar com a nova versão.',
      ],
    },
    {
      id: 'lei',
      title: '11. Lei aplicável',
      blocks: [
        'Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do usuário para resolver qualquer questão.',
      ],
    },
    {
      id: 'contato',
      title: '12. Contato',
      blocks: [`Dúvidas sobre estes termos: ${EMAIL}.`],
    },
  ],
}

export const LEGAL_DOCS = [TERMS_DOC, PRIVACY_DOC] as const

/** Pedaço de texto: trecho comum ou link (e-mail → mailto:, https:// → o próprio endereço). */
export type LegalTextPart = { text: string; href?: string }

const LINK_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https:\/\/[^\s]+)/g

/**
 * Quebra um parágrafo em trechos, marcando e-mails e URLs `https://` como links. Ponto final colado na URL fica fora
 * do link. Usado pela página da SPA e pelo gerador das páginas estáticas (a mesma regra nas duas).
 */
export function splitLegalText(text: string): LegalTextPart[] {
  const parts: LegalTextPart[] = []
  let last = 0
  for (const match of text.matchAll(LINK_RE)) {
    let value = match[0]
    const start = match.index ?? 0
    // Pontuação final não faz parte do link
    const trailing = /[.,;:)]+$/.exec(value)?.[0] ?? ''
    if (trailing) value = value.slice(0, -trailing.length)
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: value, href: value.includes('@') && !value.startsWith('https://') ? `mailto:${value}` : value })
    last = start + value.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
