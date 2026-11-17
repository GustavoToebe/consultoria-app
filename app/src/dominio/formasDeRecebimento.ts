import {
  cnpjValido, codigoApi, cpfValido, emailValido, erroDeConexao, errosPorCampo, formatarCnpj, formatarCpf, formatarTelefone, mensagemApi, telefoneValido,
} from '@plataforma/web';

import type { FormaDeRecebimento, FormasDeRecebimento, FormasDeRecebimentoRequest, PixConfigRequest, TipoDeChavePix } from '../api/financeiroTipos';

/**
 * Formas de recebimento do treinador (Fase 1 do financeiro, `docs/planos/financeiro-em-fases.md`): estado do formulário, validação,
 * corpo do `PUT /financeiro/formas-de-recebimento` e tradução do erro. A chave Pix é DADO PESSOAL (pode ser CPF): a regra
 * pura nunca a guarda além do campo que a pessoa digita, nunca a devolve em mensagem de erro e só a coloca no corpo quando
 * ela digitou uma nova (a resposta da API só traz `chaveMascarada` e `chaveConfigurada`). O código Pix é do servidor.
 */

export const ROTULO_DA_FORMA: Readonly<Record<FormaDeRecebimento, string>> = {
  INFINITEPAY: 'InfinitePay',
  LINK_PROPRIO: 'Link de pagamento próprio',
  PIX: 'Pix copia e cola',
  MANUAL: 'Manual',
};

/** A ordem do formulário. O Manual está sempre ligado: a tela o mostra ligado e travado. */
export const FORMAS_DO_FORMULARIO: readonly { valor: FormaDeRecebimento; rotulo: string; fixa: boolean }[] = (
  ['INFINITEPAY', 'LINK_PROPRIO', 'PIX', 'MANUAL'] as const
).map((valor) => ({ valor, rotulo: ROTULO_DA_FORMA[valor], fixa: valor === 'MANUAL' }));

export function rotuloDaFormaDeRecebimento(f: FormaDeRecebimento | null | undefined): string {
  return f ? (ROTULO_DA_FORMA[f] ?? '—') : '—';
}

export const TIPOS_DE_CHAVE_PIX: readonly { valor: TipoDeChavePix; rotulo: string }[] = [
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'CNPJ', rotulo: 'CNPJ' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  // Curto: os cinco cabem numa linha da escolha no celular; o grupo já se chama "Tipo da chave".
  { valor: 'ALEATORIA', rotulo: 'Aleatória' },
];

/** Os tamanhos do BR Code e da coluna: nome do recebedor até 25, cidade até 15 e a chave até 77. */
export const LIMITES_DO_PIX = { nomeRecebedor: 25, cidade: 15, chave: 77 } as const;

// ---- Estado do formulário ----

export interface EstadoDasFormas {
  infinitePay: boolean;
  linkProprio: boolean;
  pix: boolean;
  tipoChave: TipoDeChavePix | null;
  /** O que a pessoa digitou agora. NUNCA vem preenchido pela resposta da API. */
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  chaveConfigurada: boolean;
  chaveMascarada: string | null;
  /** O tipo da chave gravada: mudar o tipo exige digitar a chave de novo. */
  tipoChaveGravado: TipoDeChavePix | null;
  versao: number | null;
}

/** Sem resposta (ainda carregando) ou sem gravação: o padrão do servidor, InfinitePay ligada e o resto desligado. */
export function estadoDasFormas(r: FormasDeRecebimento | null | undefined): EstadoDasFormas {
  const p = r?.pixConfig ?? null;
  return {
    infinitePay: r?.infinitePay ?? true,
    linkProprio: r?.linkProprio ?? false,
    pix: r?.pix ?? false,
    tipoChave: p?.tipoChave ?? null,
    chave: '',
    nomeRecebedor: p?.nomeRecebedor ?? '',
    cidade: p?.cidade ?? '',
    chaveConfigurada: p?.chaveConfigurada ?? false,
    chaveMascarada: p?.chaveMascarada ?? null,
    tipoChaveGravado: p?.tipoChave ?? null,
    versao: r?.versao ?? null,
  };
}

/** "Chave gravada: ***.456.789-**. Deixe em branco para manter." Nada quando não há chave. */
export function textoDaChaveGravada(e: Pick<EstadoDasFormas, 'chaveConfigurada' | 'chaveMascarada'>): string | null {
  if (!e.chaveConfigurada) return null;
  return e.chaveMascarada ? `Chave gravada: ${e.chaveMascarada}. Deixe em branco para manter.` : 'Há uma chave gravada. Deixe em branco para manter.';
}

// ---- Chave Pix ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A chave no formato canônico do Pix, ou `null` se não vale para o tipo: CPF e CNPJ só os caracteres (com dígito verificador;
 * o CNPJ alfanumérico em maiúsculas), e-mail em minúsculas (até 77), telefone BR `+55DDDNÚMERO` e chave aleatória (UUID) em
 * minúsculas. A API confere de novo.
 */
export function normalizarChavePix(tipo: TipoDeChavePix, texto: string): string | null {
  const t = texto.trim();
  switch (tipo) {
    case 'CPF': return cpfValido(t) ? t.replace(/\D/g, '') : null;
    case 'CNPJ': return cnpjValido(t) ? t.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : null;
    case 'EMAIL': return emailValido(t) && t.length <= LIMITES_DO_PIX.chave ? t.toLowerCase() : null;
    case 'TELEFONE': {
      if (!telefoneValido(t)) return null;
      const d = t.replace(/\D/g, '');
      return `+55${(d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d}`;
    }
    case 'ALEATORIA': return UUID.test(t) ? t.toLowerCase() : null;
    default: return null;
  }
}

/**
 * A máscara da chave enquanto a pessoa digita: CPF `123.456.789-09`, CNPJ `12.345.678/0001-95` (alfanumérico em maiúsculas),
 * telefone `(45) 99999-8888`; e-mail e chave aleatória sem espaços, como vieram. O corpo leva a forma canônica (`normalizarChavePix`).
 */
export function mascaraDaChavePix(tipo: TipoDeChavePix | null, texto: string): string {
  switch (tipo) {
    case 'CPF': return formatarCpf(texto);
    case 'CNPJ': return formatarCnpj(texto).toUpperCase();
    case 'TELEFONE': return formatarTelefone(texto);
    default: return texto.replace(/\s/g, '').slice(0, LIMITES_DO_PIX.chave);
  }
}

/** "12 de 25 caracteres": o contador do nome do recebedor e da cidade (contado sem os espaços das pontas, como o servidor). */
export function contadorDoPix(texto: string, limite: number): string {
  return `${texto.trim().length} de ${limite} caracteres`;
}

/**
 * Algo mudou desde a última gravação? Sem nada a salvar o "Salvar" fica apagado com o motivo. O Pix desligado não compara os
 * campos do Pix (eles nem vão no corpo); a chave digitada sempre conta como mudança.
 */
export function formasAlteradas(atual: EstadoDasFormas, gravado: EstadoDasFormas): boolean {
  if (atual.infinitePay !== gravado.infinitePay || atual.linkProprio !== gravado.linkProprio || atual.pix !== gravado.pix) return true;
  if (!atual.pix) return false;
  return !!atual.chave.trim() || atual.tipoChave !== gravado.tipoChave
    || atual.nomeRecebedor.trim() !== gravado.nomeRecebedor.trim() || atual.cidade.trim() !== gravado.cidade.trim();
}

const MENSAGEM_DA_CHAVE: Readonly<Record<TipoDeChavePix, string>> = {
  CPF: 'Informe um CPF válido.',
  CNPJ: 'Informe um CNPJ válido.',
  EMAIL: 'Informe um e-mail válido.',
  TELEFONE: 'Informe um telefone com DDD, como (45) 99999-8888.',
  ALEATORIA: 'A chave aleatória tem 36 caracteres, como a copiada do seu banco.',
};

// ---- Validação e corpo ----

export type CampoDasFormas = 'tipoChave' | 'chave' | 'nomeRecebedor' | 'cidade';
export type ErrosDasFormas = Partial<Record<CampoDasFormas, string>>;

export type CorpoDasFormas = { ok: true; corpo: FormasDeRecebimentoRequest } | { ok: false; erros: ErrosDasFormas };

/**
 * O corpo do `PUT`. O Manual vai sempre ligado. Só com o Pix ligado se valida e se envia `pixConfig`: tipo da chave, nome do
 * recebedor (1 a 25) e cidade (1 a 15), e a chave só quando digitada (válida para o tipo). Chave já gravada com o mesmo tipo e
 * campo em branco mantém a gravada; trocar o tipo pede digitar a chave de novo. Nenhuma mensagem repete a chave.
 */
export function corpoDasFormas(e: EstadoDasFormas): CorpoDasFormas {
  const base = { infinitePay: e.infinitePay, linkProprio: e.linkProprio, pix: e.pix, manual: true as const, versao: e.versao };
  if (!e.pix) return { ok: true, corpo: base };

  const erros: ErrosDasFormas = {};
  const nome = e.nomeRecebedor.trim();
  const cidade = e.cidade.trim();
  if (!nome) erros.nomeRecebedor = 'Informe o nome de quem recebe.';
  else if (nome.length > LIMITES_DO_PIX.nomeRecebedor) erros.nomeRecebedor = `O nome pode ter até ${LIMITES_DO_PIX.nomeRecebedor} caracteres.`;
  if (!cidade) erros.cidade = 'Informe a cidade.';
  else if (cidade.length > LIMITES_DO_PIX.cidade) erros.cidade = `A cidade pode ter até ${LIMITES_DO_PIX.cidade} caracteres.`;

  let chave: string | undefined;
  if (!e.tipoChave) erros.tipoChave = 'Escolha o tipo da chave.';
  else if (e.chave.trim()) {
    const normal = normalizarChavePix(e.tipoChave, e.chave);
    if (normal === null) erros.chave = MENSAGEM_DA_CHAVE[e.tipoChave];
    else chave = normal;
  } else if (!e.chaveConfigurada) erros.chave = 'Informe a chave Pix.';
  else if (e.tipoChave !== e.tipoChaveGravado) erros.chave = 'Você mudou o tipo: informe a chave deste tipo.';

  if (Object.keys(erros).length > 0 || !e.tipoChave) return { ok: false, erros };
  const pixConfig: PixConfigRequest = { tipoChave: e.tipoChave, ...(chave === undefined ? {} : { chave }), nomeRecebedor: nome, cidade };
  return { ok: true, corpo: { ...base, pixConfig } };
}

// ---- Link do plano ----

export const LINK_DO_PLANO_MAXIMO = 500;
export const MENSAGEM_LINK_DO_PLANO = 'O link precisa começar com https://.';
export const MENSAGENS_DO_LINK_DO_PLANO = {
  http: 'Use https.',
  usuario: 'O link não pode ter usuário ou senha.',
  porta: 'O link não pode ter porta.',
  tamanho: `Até ${LINK_DO_PLANO_MAXIMO} caracteres.`,
} as const;

/**
 * "Link de pagamento" do plano: vazio apaga (`valor` nulo, o `PUT` do plano substitui inteiro). As recusas que o servidor
 * (`LinksExternos`) também faz e que dá para dizer aqui têm mensagem própria: `http://`, usuário ou senha antes do host,
 * porta diferente de 443 e mais de 500 caracteres. O resto (`javascript:`, sem esquema, espaço, sem host) fica na genérica.
 * Sem `new URL()`: no React Native ela não traz `port` nem `username`.
 */
export function lerLinkDoPlano(texto: string): { valor: string | null; erro: string | null } {
  const t = texto.trim();
  if (!t) return { valor: null, erro: null };
  const recusa = (erro: string) => ({ valor: null, erro });
  if (/^http:\/\//i.test(t)) return recusa(MENSAGENS_DO_LINK_DO_PLANO.http);
  if (!/^https:\/\/[^\s/?#]+\S*$/i.test(t)) return recusa(MENSAGEM_LINK_DO_PLANO);
  const autoridade = t.slice('https://'.length).split(/[/?#]/)[0];
  if (autoridade.includes('@')) return recusa(MENSAGENS_DO_LINK_DO_PLANO.usuario);
  const porta = /:(\d*)$/.exec(autoridade)?.[1];
  if (porta !== undefined && porta !== '443') return recusa(MENSAGENS_DO_LINK_DO_PLANO.porta);
  if (t.length > LINK_DO_PLANO_MAXIMO) return recusa(MENSAGENS_DO_LINK_DO_PLANO.tamanho);
  return { valor: t, erro: null };
}

// ---- Erros ----

export const MENSAGEM_CONFLITO_DAS_FORMAS = 'As formas de recebimento foram alteradas por outra pessoa ou aba. Mostramos as mais recentes: confira e salve de novo.';
export const MENSAGEM_CAMPOS_DAS_FORMAS = 'Confira os campos destacados.';
const MENSAGEM_PADRAO_DAS_FORMAS = 'Não foi possível salvar as formas de recebimento. Tente de novo.';

const CAMPOS_DA_API: readonly CampoDasFormas[] = ['tipoChave', 'chave', 'nomeRecebedor', 'cidade'];

export interface ErroDasFormas {
  mensagem: string;
  campos: ErrosDasFormas;
  /** A tela busca as formas de novo (e a `versao`) antes de deixar salvar outra vez. */
  recarregar: boolean;
}

function statusDoErro(erro: unknown): number | null {
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  return typeof status === 'number' ? status : null;
}

/**
 * Tradução do erro do `PUT`: 409 `CONFLITO_EDICAO` (recarrega), 422 `FORMAS_INVALIDAS` por campo (`pixConfig.chave` etc.;
 * campo que a tela não mostra vai ao texto geral), o texto da API em 403, 503 `FINANCEIRO_INDISPONIVEL` e sem conexão, e o
 * resto numa frase fixa. O texto de campo vem da API (sem repetir valor); a frase fixa nunca leva o que foi digitado.
 */
export function traduzirErroDasFormas(erro: unknown): ErroDasFormas {
  const base = { campos: {} as ErrosDasFormas, recarregar: false };
  const codigo = codigoApi(erro);
  if (codigo === 'CONFLITO_EDICAO') return { ...base, mensagem: MENSAGEM_CONFLITO_DAS_FORMAS, recarregar: true };
  if (codigo === 'FORMAS_INVALIDAS') {
    const campos: ErrosDasFormas = {};
    const fora: string[] = [];
    for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
      const nosso = CAMPOS_DA_API.find((c) => campo === c || campo === `pixConfig.${c}`);
      if (nosso) campos[nosso] ??= mensagem;
      else fora.push(mensagem);
    }
    if (fora.length > 0) return { ...base, mensagem: fora.join(' '), campos };
    if (Object.keys(campos).length === 0) return { ...base, mensagem: mensagemApi(erro, MENSAGEM_CAMPOS_DAS_FORMAS) };
    return { ...base, mensagem: MENSAGEM_CAMPOS_DAS_FORMAS, campos };
  }
  const daApi = erroDeConexao(erro) || statusDoErro(erro) === 403 || codigo === 'FINANCEIRO_INDISPONIVEL';
  return { ...base, mensagem: daApi ? mensagemApi(erro, MENSAGEM_PADRAO_DAS_FORMAS) : MENSAGEM_PADRAO_DAS_FORMAS };
}
