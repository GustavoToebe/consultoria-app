import type { CampoDaKiwify, KiwifyRequest } from '../api/financeiroKiwify';
import type { CobrancaAutomatica, MotivoDaConferencia, PeriodoDoPlano, ProvedorDaConferencia } from '../api/financeiroTipos';

/**
 * Regras puras da Kiwify automática (D16 a D20; contrato em `api/financeiroKiwify.ts`). A API confere tudo de novo; aqui
 * ficam a validação da credencial e do produto (sem nunca repetir o valor digitado), as máscaras, os textos e quando cada
 * coisa aparece. Nada daqui guarda, registra ou devolve segredo.
 */

export const NOME_DA_KIWIFY = 'Kiwify';

/** Limites da credencial (os mesmos da API). O token do webhook tem mínimo: sem ele a assinatura do aviso não prova nada. */
export const TOKEN_MINIMO = 16;
export const CAMPO_MAXIMO = 200;
export const PRODUTO_MAXIMO = 100;

export const CAMPOS_DA_KIWIFY: readonly CampoDaKiwify[] = ['tokenDoWebhook', 'clientId', 'clientSecret', 'accountId'];

/** Rótulo de cada campo e a ajuda, com o nome que o painel da Kiwify usa. */
export const ROTULOS_DA_KIWIFY: Record<CampoDaKiwify, { rotulo: string; ajuda: string; falta: string }> = {
  tokenDoWebhook: {
    rotulo: 'Token do webhook',
    ajuda: `O mesmo token do webhook na Kiwify, com pelo menos ${TOKEN_MINIMO} caracteres. Ele prova que o aviso veio da Kiwify.`,
    falta: 'Informe o token do webhook.',
  },
  clientId: { rotulo: 'Client ID', ajuda: 'Em Apps › API, na chave criada: client_id.', falta: 'Informe o Client ID.' },
  clientSecret: { rotulo: 'Client secret', ajuda: 'Em Apps › API, na chave criada: client_secret.', falta: 'Informe o Client secret.' },
  accountId: { rotulo: 'Account ID', ajuda: 'Em Apps › API, na chave criada: account_id.', falta: 'Informe o Account ID.' },
};

/** Os segredos vão em campo de senha (o token e o client secret); os ids, em campo comum. */
export const ehCampoSecreto = (campo: CampoDaKiwify): boolean => campo === 'tokenDoWebhook' || campo === 'clientSecret';

export type ValoresDaKiwify = Record<CampoDaKiwify, string>;
export type ErrosDaKiwify = Partial<Record<CampoDaKiwify, string>>;

export const VALORES_VAZIOS: ValoresDaKiwify = { tokenDoWebhook: '', clientId: '', clientSecret: '', accountId: '' };

/** Espaço ou caractere de controle no meio: a API recusa (nada disso aparece num id nem num segredo copiado do painel). */
const TEM_ESPACO_OU_CONTROLE = /[\s\u0000-\u001f\u007f]/;

/**
 * Erro de cada campo, sem nunca repetir o valor. Criando (`versao` nula), os quatro são obrigatórios. Trocando, campo em
 * branco mantém o gravado e só o que foi digitado é conferido; trocar sem digitar nada é erro do formulário (`nada`).
 */
export function validarCredenciaisKiwify(valores: ValoresDaKiwify, criando: boolean): { campos: ErrosDaKiwify; nada: boolean } {
  const campos: ErrosDaKiwify = {};
  for (const campo of CAMPOS_DA_KIWIFY) {
    const v = valores[campo].trim();
    if (!v) {
      if (criando) campos[campo] = ROTULOS_DA_KIWIFY[campo].falta;
      continue;
    }
    if (TEM_ESPACO_OU_CONTROLE.test(v)) campos[campo] = 'Sem espaços: copie de novo do painel da Kiwify.';
    else if (v.length > CAMPO_MAXIMO) campos[campo] = `Use até ${CAMPO_MAXIMO} caracteres.`;
    else if (campo === 'tokenDoWebhook' && v.length < TOKEN_MINIMO) campos[campo] = `Use pelo menos ${TOKEN_MINIMO} caracteres.`;
  }
  const nada = !criando && CAMPOS_DA_KIWIFY.every((c) => !valores[c].trim());
  return { campos, nada };
}

/** O corpo do `PUT`: os campos digitados, sem espaço nas pontas; em branco fica fora (o servidor mantém o gravado). */
export function corpoDaKiwify(valores: ValoresDaKiwify, versao: number | null): KiwifyRequest {
  const corpo: KiwifyRequest = { versao };
  for (const campo of CAMPOS_DA_KIWIFY) {
    const v = valores[campo].trim();
    if (v) corpo[campo] = v;
  }
  return corpo;
}

/** "termina em a1b2" (os 4 finais que a API manda); sem credencial, "—". Nunca recebe nem mostra o id inteiro. */
export function clientIdParaTela(final: string | null | undefined): string {
  const f = (final ?? '').trim();
  return f ? `termina em ${f.slice(-4)}` : '—';
}

/** O passo a passo da configuração, numa ordem que funciona sem a URL antes de salvar (a API a gera no primeiro salvar). */
export const PASSOS_DA_KIWIFY: readonly string[] = [
  'Na Kiwify, em Apps › API, crie uma chave de API e copie client_id, client_secret e account_id.',
  `Escolha o token do webhook: um texto longo e aleatório, com pelo menos ${TOKEN_MINIMO} caracteres.`,
  'Cole os quatro aqui e salve. Depois de salvos, eles não aparecem mais nesta tela.',
  'Copie a URL do webhook que aparece aqui. Na Kiwify, em Apps › Webhooks, crie o webhook com essa URL e o mesmo token, para os produtos das assinaturas.',
];

export const TEXTO_DA_KIWIFY =
  'A Kiwify cobra a assinatura do aluno todo mês e avisa o app. O app confere a venda na Kiwify e dá baixa na mensalidade; o que não confere vai para "Para conferir". O app não recebe nem guarda dinheiro.';

export const MENSAGEM_REMOVER_KIWIFY =
  'A credencial é apagada e a URL do webhook deixa de valer: os avisos da Kiwify param de chegar e nenhuma baixa automática acontece. Apague também o webhook no painel da Kiwify, em Apps › Webhooks. As cobranças e baixas já registradas não mudam; as mensalidades dos planos com assinatura pela Kiwify voltam a aparecer para o aluno com as formas de pagamento de sempre.';

/** O 503 da chave desligada e o 409 da cobrança automática viram texto próprio; o resto fica com o texto da API. */
export function mensagemDoErroDaKiwify(codigo: string | null | undefined): string | null {
  if (codigo === 'KIWIFY_INDISPONIVEL') return 'A integração com a Kiwify não está disponível agora.';
  if (codigo === 'COBRANCA_AUTOMATICA') return 'Esta mensalidade é cobrada pela Kiwify: não tem link nem Pix.';
  return null;
}

// ---- Plano comercial ----

/** Só o plano mensal pode ser assinatura da Kiwify (D17). */
export const planoPodeTerKiwify = (periodicidade: PeriodoDoPlano | null | undefined): boolean => periodicidade === 'MENSAL';

export const ROTULO_DA_ASSINATURA = 'Assinatura cobrada pela Kiwify';
export const AJUDA_DA_ASSINATURA =
  'A Kiwify cobra o aluno todo mês e o app dá baixa sozinho na mensalidade, depois de conferir a venda. O aluno não vê "Pagar" nessas mensalidades. Só em plano mensal.';
export const ROTULO_DO_PRODUTO = 'ID do produto na Kiwify';
export const AJUDA_DO_PRODUTO = 'Na Kiwify, em Produtos, abra o produto da assinatura e copie o ID dele. Cada produto vale para um plano só.';
export const AVISO_PERDE_KIWIFY =
  'A assinatura pela Kiwify vale só no plano mensal: ao salvar com outra periodicidade, ela é desligada e o produto é apagado.';
/** Na lista dos planos, ao lado do valor e da periodicidade. */
export const TEXTO_DO_PLANO_KIWIFY = 'Assinatura pela Kiwify';

const PRODUTO_ACEITO = /^[A-Za-z0-9_-]+$/;

/** O id do produto: obrigatório com a assinatura ligada; letras, dígitos, `-` e `_`, até 100. Nunca repete o valor. */
export function validarProdutoKiwify(texto: string): string | null {
  const v = texto.trim();
  if (!v) return 'Informe o ID do produto na Kiwify.';
  if (v.length > PRODUTO_MAXIMO) return `Use até ${PRODUTO_MAXIMO} caracteres.`;
  if (!PRODUTO_ACEITO.test(v)) return 'Use só letras, números, - e _ (copie o ID do painel da Kiwify).';
  return null;
}

export interface KiwifyDoPlano {
  kiwifyAssinatura: boolean;
  kiwifyProdutoId: string | null;
  /** Erro do produto, para o campo; nulo = pode enviar. */
  erro: string | null;
}

/**
 * Os dois campos do plano para o `PUT` (que substitui inteiro). Com a chave desligada a tela não mostra o bloco e reenvia o
 * gravado, para renomear o plano não desligar a assinatura em silêncio. Fora do mensal vai desligado e sem produto. Ligado,
 * o produto é obrigatório.
 */
export function kiwifyDoPlanoParaEnvio(o: {
  habilitada: boolean;
  periodicidade: PeriodoDoPlano;
  ligado: boolean;
  produtoTexto: string;
  gravado?: { kiwifyAssinatura?: boolean; kiwifyProdutoId?: string | null } | null;
}): KiwifyDoPlano {
  if (!o.habilitada) {
    return { kiwifyAssinatura: o.gravado?.kiwifyAssinatura === true, kiwifyProdutoId: o.gravado?.kiwifyProdutoId ?? null, erro: null };
  }
  if (!planoPodeTerKiwify(o.periodicidade) || !o.ligado) return { kiwifyAssinatura: false, kiwifyProdutoId: null, erro: null };
  const erro = validarProdutoKiwify(o.produtoTexto);
  return { kiwifyAssinatura: true, kiwifyProdutoId: erro ? null : o.produtoTexto.trim(), erro };
}

/** O plano gravado era Kiwify e a nova periodicidade não deixa: a tela avisa antes de salvar. */
export function perdeAKiwify(gravado: { kiwifyAssinatura?: boolean } | null | undefined, periodicidade: PeriodoDoPlano): boolean {
  return gravado?.kiwifyAssinatura === true && !planoPodeTerKiwify(periodicidade);
}

// ---- Cobranças ----

/** A mensalidade é cobrada pela Kiwify (D18)? */
export const ehCobradaPelaKiwify = (c: { cobrancaAutomatica?: CobrancaAutomatica | null } | null | undefined): boolean =>
  c?.cobrancaAutomatica === 'KIWIFY';

/** O que o aluno vê nessa mensalidade, na web e no celular com a chave da loja ligada, no lugar de "Pagar", link, Pix e forma (celular com a chave desligada só informa a cobrança, D16). */
export const TEXTO_COBRANCA_AUTOMATICA = 'Cobrança automática pela Kiwify';
/** O que a equipe vê na folha da cobrança (a baixa, o desfazer da manual e o cancelar continuam). */
export const TEXTO_COBRADA_PELA_KIWIFY = 'Cobrada pela Kiwify';
export const DETALHE_COBRADA_PELA_KIWIFY =
  'A Kiwify cobra esta mensalidade e o app dá baixa sozinho quando ela confirma. Sem lembrete por e-mail: a Kiwify tenta de novo por conta própria. Se o aluno pagou de outro jeito, registre o pagamento à mão.';
/** Na aba Lembretes, com a Kiwify ligada (D18; primeira versão: nem antes nem depois de vencer). */
export const TEXTO_KIWIFY_NOS_LEMBRETES =
  'Mensalidades de planos com assinatura pela Kiwify não recebem lembrete por e-mail, nem antes nem depois de vencer: a Kiwify cobra e tenta de novo por conta própria. Se uma vencer, fale com o aluno pelo WhatsApp na cobrança.';

// ---- Para conferir (D19) ----

/** Os motivos da Kiwify, em português (o `rotuloDoMotivoDaConferencia` do financeiro junta estes aos da InfinitePay). */
export const MOTIVOS_DA_KIWIFY: Record<Extract<MotivoDaConferencia, `KIWIFY_${string}`>, string> = {
  KIWIFY_EMAIL_SEM_ALUNO: 'O e-mail da compra não é de nenhum aluno',
  KIWIFY_EMAIL_DE_VARIOS_ALUNOS: 'O e-mail da compra é de mais de um aluno',
  // D4 (18/11): também é o motivo da compra de um produto que não é de plano algum (a API a manda para conferir, não ignora).
  KIWIFY_SEM_CONTRATACAO_NO_PLANO: 'O produto não é de um plano ou o aluno não tem contratação ativa nele',
  KIWIFY_SEM_MENSALIDADE_ABERTA: 'Nenhuma mensalidade em aberto para dar baixa',
  // Curtos (cabem na coluna da tabela); o "o que fazer" é o texto do cartão e da folha (nada é encerrado nem estornado sozinho).
  KIWIFY_ASSINATURA_CANCELADA: 'A Kiwify informou a assinatura cancelada',
  KIWIFY_REEMBOLSO: 'A Kiwify informou reembolso desta venda',
  KIWIFY_CHARGEBACK: 'A Kiwify informou chargeback desta venda',
};

/** Os motivos que dependem do provedor: na Kiwify, a falha de consulta cita a Kiwify e a "cobrança não encontrada" é a compra sem plano nem cobrança (D4). */
export function motivoComProvedor(motivo: MotivoDaConferencia, provedor: ProvedorDaConferencia | null | undefined): string | null {
  if (provedor === 'KIWIFY' && motivo === 'CONSULTA_FALHOU') return 'Não foi possível confirmar a venda com a Kiwify';
  if (provedor === 'KIWIFY' && motivo === 'COBRANCA_NAO_ENCONTRADA') return 'Nenhum plano nem cobrança corresponde ao produto desta compra';
  return null;
}

/** O nome do provedor na lista; ausente (aviso antigo) = InfinitePay. */
export const rotuloDoProvedor = (p: ProvedorDaConferencia | null | undefined): string => (p === 'KIWIFY' ? NOME_DA_KIWIFY : 'InfinitePay');
