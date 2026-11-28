import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { CorDaTag, TagDeAluno } from '../api/tipos';
import { ehId, lista, type Parametro } from './filtrosComuns';

/**
 * Tags de aluno (`docs/planos/tags-de-aluno.md`, passo 3): nome, comparação, limite, cor, resumo na linha, textos dos
 * painéis, filtro no endereço e tradução dos erros. Funções puras. A tag é rótulo de organização do treinador: o aluno
 * nunca a vê e nada aqui opina sobre saúde.
 */

export const LIMITE_DE_TAGS = 10;
export const MAXIMO_DO_NOME_DA_TAG = 30;

/** Cores das tags, na ordem do seletor. O rótulo é o nome da cor (a cor nunca vai sozinha); a cor do tema vem de `useTema().identificacao[cor]`. */
export const COR_DAS_TAGS: readonly { valor: CorDaTag; rotulo: string }[] = [
  { valor: 'CIANO', rotulo: 'Ciano' },
  { valor: 'AZUL', rotulo: 'Azul' },
  { valor: 'INDIGO', rotulo: 'Índigo' },
  { valor: 'VIOLETA', rotulo: 'Violeta' },
  { valor: 'MAGENTA', rotulo: 'Magenta' },
];

/** Cor de uma tag nova na tela. */
export const COR_PADRAO_DA_TAG: CorDaTag = 'AZUL';

/** O nome como a API grava: sem espaços nas pontas e em NFC. */
export const nomeDaTagParaEnviar = (texto: string): string => texto.trim().normalize('NFC');

/** Chave de comparação (igual à da API): sem acento, sem diferença de caixa, espaços colapsados. */
export const chaveDaTag = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const MENSAGEM_NOME_DA_TAG_VAZIO = 'Informe o nome da tag.';
export const MENSAGEM_NOME_DA_TAG_LONGO = `O nome da tag pode ter até ${MAXIMO_DO_NOME_DA_TAG} caracteres.`;

/** Mensagem fixa (nunca repete o que foi digitado), ou `null` se o nome serve. O tamanho conta em UTF-16, como a API. */
export function erroDoNomeDaTag(texto: string): string | null {
  const nome = nomeDaTagParaEnviar(texto);
  if (!nome) return MENSAGEM_NOME_DA_TAG_VAZIO;
  return nome.length > MAXIMO_DO_NOME_DA_TAG ? MENSAGEM_NOME_DA_TAG_LONGO : null;
}

export const podeAdicionarTag = (tagsDoAluno: readonly unknown[]): boolean => tagsDoAluno.length < LIMITE_DE_TAGS;

export const MENSAGEM_LIMITE_DE_TAGS = `O aluno pode ter até ${LIMITE_DE_TAGS} tags.`;

/** A tag que já existe com esse nome (pela chave de comparação), para digitar "treino" e não criar outra "Treino". */
export function tagPeloNome<T extends { nome: string }>(tags: readonly T[], texto: string): T | undefined {
  const chave = chaveDaTag(texto);
  return chave ? tags.find((t) => chaveDaTag(t.nome) === chave) : undefined;
}

const soATag = (t: TagDeAluno): TagDeAluno => ({ id: t.id, nome: t.nome, cor: t.cor });

/**
 * As tags do aluno depois de adicionar ou remover uma. Adicionar uma que já está, ou além do limite, não muda nada; a ordem
 * é a de inclusão. Remover (pelo id) o que não está também não muda.
 */
export function proximasTags(atuais: readonly TagDeAluno[], mudanca: { adicionar: TagDeAluno } | { remover: string }): TagDeAluno[] {
  if ('remover' in mudanca) return atuais.filter((t) => t.id !== mudanca.remover);
  const nova = mudanca.adicionar;
  if (atuais.some((t) => t.id === nova.id) || !podeAdicionarTag(atuais)) return [...atuais];
  return [...atuais, soATag(nova)];
}

/** O corpo do `PUT /alunos/{id}/tags`. */
export const idsDasTags = (tags: readonly { id: string }[]): string[] => tags.map((t) => t.id);

export interface ResumoDasTagsNaLinha {
  visiveis: TagDeAluno[];
  restantes: number;
  /** "+N" quando há restantes; vazio sem eles. */
  texto: string;
}

/** Na linha da lista aparecem no máximo `max` tags e o resto vira "+N". */
export function resumoDasTagsNaLinha(tags: readonly TagDeAluno[], max = 2): ResumoDasTagsNaLinha {
  const restantes = Math.max(0, tags.length - max);
  return { visiveis: tags.slice(0, max), restantes, texto: restantes > 0 ? `+${restantes}` : '' };
}

const alunos = (n: number) => `${n} ${n === 1 ? 'aluno' : 'alunos'}`;

/** Frase do formulário de renomear ou trocar a cor. */
export function textoDeRenomear(tag: { totalAlunos: number }): string {
  const n = tag.totalAlunos;
  if (n <= 0) return 'Nenhum aluno usa esta tag.';
  return `A tag está em ${alunos(n)}; a mudança vale ${n === 1 ? 'nele' : 'em todos'}.`;
}

// ---- Filtro no endereço ----

/** Ids de tag válidos de um parâmetro do endereço (`?tag=a&tag=b` ou `?tag=a,b`); o resto é ignorado, nunca vai à API (lá seria 400). */
export function lerTagsDoEndereco(valor: Parametro): string[] {
  return [...new Set(lista(valor).filter(ehId))];
}

/** Os ids como vão para o endereço: sem vazios nem repetidos, na ordem dada. */
export function tagsParaEndereco(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

// ---- Erros ----

export interface ErroDeTag {
  mensagem: string;
  /** Campo do formulário que mostra a mensagem; sem ele, a mensagem vai no alerta da folha. */
  noCampo?: 'nome' | 'cor';
  /** A tela deve buscar de novo a lista de tags (e a ficha, se for o caso). */
  recarregar: boolean;
}

export const MENSAGEM_TAG_NOME_EM_USO = 'Já existe uma tag com esse nome.';
export const MENSAGEM_TAG_INVALIDA_NOME = `Confira o nome da tag: de 1 a ${MAXIMO_DO_NOME_DA_TAG} caracteres.`;
export const MENSAGEM_TAG_INVALIDA_COR = 'Escolha uma das cores da lista.';
export const MENSAGEM_TAG_MUDOU = 'A tag mudou enquanto você editava. Confira e tente de novo.';
export const MENSAGEM_TAG_NAO_ENCONTRADA = 'Não encontramos a tag ou o aluno. Atualize a tela.';
export const MENSAGEM_ALUNO_ANONIMIZADO_NAS_TAGS = 'Este aluno foi anonimizado: as tags não podem mais ser alteradas.';
export const MENSAGEM_PADRAO_DA_TAG = 'Não foi possível salvar a tag. Tente de novo.';

function statusDoErro(erro: unknown): number | null {
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  return typeof status === 'number' ? status : null;
}

/**
 * Traduz o erro de criar, renomear, apagar tag e de definir as tags do aluno (404, 409 e 422) numa frase fixa, nunca com o
 * que a pessoa digitou. 409 `TAG_NOME_EM_USO` não traz o id da tag: a tela recarrega a lista e acha a tag por
 * {@link tagPeloNome}.
 */
export function traduzirErroDeTag(erro: unknown): ErroDeTag {
  switch (codigoApi(erro)) {
    case 'TAG_NOME_EM_USO': return { mensagem: MENSAGEM_TAG_NOME_EM_USO, noCampo: 'nome', recarregar: true };
    case 'TAG_INVALIDA': {
      const campos = errosPorCampo(erro);
      if ('nome' in campos) return { mensagem: MENSAGEM_TAG_INVALIDA_NOME, noCampo: 'nome', recarregar: false };
      if ('cor' in campos) return { mensagem: MENSAGEM_TAG_INVALIDA_COR, noCampo: 'cor', recarregar: false };
      return { mensagem: `${MENSAGEM_TAG_INVALIDA_NOME} ${MENSAGEM_TAG_INVALIDA_COR}`, recarregar: false };
    }
    case 'TAGS_LIMITE': return { mensagem: MENSAGEM_LIMITE_DE_TAGS, recarregar: false };
    case 'CONFLITO_EDICAO': return { mensagem: MENSAGEM_TAG_MUDOU, recarregar: true };
    case 'ALUNO_ANONIMIZADO': return { mensagem: MENSAGEM_ALUNO_ANONIMIZADO_NAS_TAGS, recarregar: true };
    default: {
      if (statusDoErro(erro) === 404) return { mensagem: MENSAGEM_TAG_NAO_ENCONTRADA, recarregar: true };
      // Sem conexão e sem permissão (403): a API explica o que houve e a frase fixa esconderia isso.
      const daApi = erroDeConexao(erro) || statusDoErro(erro) === 403;
      return { mensagem: daApi ? mensagemApi(erro, MENSAGEM_PADRAO_DA_TAG) : MENSAGEM_PADRAO_DA_TAG, recarregar: false };
    }
  }
}
