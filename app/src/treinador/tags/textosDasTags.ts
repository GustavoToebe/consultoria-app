import type { TagDaConsultoria, TagDeAluno } from '../../api/tipos';
import { chaveDaTag, resumoDasTagsNaLinha, tagPeloNome } from '../../dominio/tagsDeAluno';

/**
 * Regras de tela das tags (`docs/planos/tags-de-aluno.md`, passo 4) que o `dominio/tagsDeAluno` ainda não tem: o nome
 * acessível da linha, as sugestões do campo e as opções do filtro. Puras e testadas; candidatas a ir para o `dominio/`.
 */

/** Aviso fixo (D6) do campo e da tela de gestão. */
export const AVISO_DAS_TAGS = 'Rótulos só da equipe: o aluno não vê. Não use para saúde.';

/** Tela de gestão (28/11): o "só da equipe" vai no ⓘ do título; o "não use para saúde" fica à vista, com o cadeado. */
export const SOBRE_A_TELA_DAS_TAGS = 'Rótulos só da equipe para achar e filtrar alunos: o aluno não vê. Renomear ou trocar a cor vale em todos os alunos que têm a tag.';
export const AVISO_DE_SAUDE_DAS_TAGS = 'Não use tags para dado de saúde.';

/** "Tags: Online, Retorno e mais 2" (o mesmo corte de {@link resumoDasTagsNaLinha}); sem tags, `null`. */
export function rotuloDasTagsNaLinha(tags: readonly TagDeAluno[]): string | null {
  if (!tags.length) return null;
  const { visiveis, restantes } = resumoDasTagsNaLinha(tags);
  return `Tags: ${visiveis.map((t) => t.nome).join(', ')}${restantes ? ` e mais ${restantes}` : ''}`;
}

/** "Online, Retorno" (o valor lido pelo leitor de tela nos Dados do aluno). */
export const nomesDasTags = (tags: readonly TagDeAluno[]): string => tags.map((t) => t.nome).join(', ');

export type OpcaoDoCampo = { tipo: 'tag'; tag: TagDeAluno } | { tipo: 'criar'; nome: string };

/**
 * Sugestões do campo: as tags da consultoria que o aluno ainda não tem, filtradas pelo texto (sem acento nem caixa), com a
 * de nome igual primeiro, até `max`; no fim, "Criar tag" se o texto não é o nome de nenhuma tag (nem da consultoria nem do
 * aluno). Texto vazio: só as sugestões, sem criar.
 */
export function opcoesDoCampo(consultoria: readonly TagDeAluno[], doAluno: readonly TagDeAluno[], texto: string, max = 8): OpcaoDoCampo[] {
  const chave = chaveDaTag(texto);
  const ja = new Set(doAluno.map((t) => t.id));
  const livres = consultoria.filter((t) => !ja.has(t.id) && (!chave || chaveDaTag(t.nome).includes(chave)));
  const iguais = livres.filter((t) => chaveDaTag(t.nome) === chave);
  const ordenadas = [...iguais, ...livres.filter((t) => !iguais.includes(t))].slice(0, max);
  const opcoes: OpcaoDoCampo[] = ordenadas.map((tag) => ({ tipo: 'tag', tag }));
  if (chave && !tagPeloNome(consultoria, texto) && !tagPeloNome(doAluno, texto)) opcoes.push({ tipo: 'criar', nome: texto.trim() });
  return opcoes;
}

/** Opções do seletor "Tags" do painel de filtros, em ordem alfabética (português). */
export function opcoesDoFiltroDeTags(tags: readonly TagDaConsultoria[]): { valor: string; rotulo: string }[] {
  return tags.map((t) => ({ valor: t.id, rotulo: t.nome })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
