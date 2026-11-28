import type { PastaModelo, Receita, TipoReceita } from '../api/tipos';
import { plural } from './formatos';

/**
 * Regras do Planejamento agrupado por coleção (sem tela). Coleção é a pasta de modelos da API (`PastaModelo`); os
 * modelos de um tipo aparecem em grupos, um por coleção, como a Biblioteca › Outros agrupa por categoria
 * (`dominio/ergogenicos`). Não há filtro de coleção: a busca procura em todas e os grupos vazios somem.
 */

/** Modelo sem coleção (ou de uma coleção que não existe mais) fica no grupo "Sem coleção", sempre por último. */
export const SEM_COLECAO = 'Sem coleção';

export interface GrupoDeModelos {
  /** Id da coleção; `null` no grupo "Sem coleção". */
  pastaId: string | null;
  rotulo: string;
  itens: Receita[];
}

/**
 * Agrupa por coleção em ordem alfabética (português), "Sem coleção" por último; coleção sem modelo não aparece;
 * dentro do grupo, a ordem recebida (a da API).
 */
export function agruparPorColecao(modelos: readonly Receita[], colecoes: readonly PastaModelo[]): GrupoDeModelos[] {
  const ids = new Set(colecoes.map((c) => c.id));
  const grupos: GrupoDeModelos[] = [...colecoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => ({ pastaId: c.id, rotulo: c.nome, itens: modelos.filter((m) => m.pastaId === c.id) }))
    .filter((g) => g.itens.length > 0);
  const sem = modelos.filter((m) => !m.pastaId || !ids.has(m.pastaId));
  return sem.length ? [...grupos, { pastaId: null, rotulo: SEM_COLECAO, itens: sem }] : grupos;
}

/** "1 modelo" / "13 modelos". */
export function resumoDeModelos(quantidade: number): string {
  return quantidade === 1 ? '1 modelo' : `${quantidade} modelos`;
}

/** Quantos modelos cada coleção tem, de TODOS os tipos (a exclusão da API solta todos eles, sem olhar o tipo). */
export function modelosPorColecao(modelos: readonly Receita[]): ReadonlyMap<string, number> {
  const contagem = new Map<string, number>();
  for (const m of modelos) if (m.pastaId) contagem.set(m.pastaId, (contagem.get(m.pastaId) ?? 0) + 1);
  return contagem;
}

/** Contagem na linha da coleção, em "Organizar coleções": "Nenhum modelo", "1 modelo", "12 modelos". */
export function contagemDaColecao(quantidade: number): string {
  return quantidade === 0 ? 'Nenhum modelo' : plural(quantidade, 'modelo', 'modelos');
}

/**
 * O que a exclusão faz com os modelos (`PastaModeloService.excluir`: tira a coleção de cada um e apaga só a coleção).
 * `undefined` = os modelos não carregaram: a frase não arrisca número.
 */
export function mensagemDeExcluirColecao(quantidade: number | undefined): string {
  if (quantidade === undefined) return `Os modelos dela continuam no Planejamento, em ${SEM_COLECAO}.`;
  if (quantidade === 0) return 'Nenhum modelo será afetado.';
  if (quantidade === 1) return `O modelo continua no Planejamento, em ${SEM_COLECAO}.`;
  return `Os ${quantidade} modelos continuam no Planejamento, em ${SEM_COLECAO}.`;
}

export const ERRO_NOME_VAZIO = 'Informe o nome da coleção.';
export const ERRO_NOME_REPETIDO = 'Já existe uma coleção com esse nome. Escolha outro.';

/**
 * Nome vazio ou repetido (sem acento, caixa nem espaços sobrando) entre as coleções; `idIgnorado` é a que está sendo
 * renomeada. A regra é só do app: a API (`pasta_modelo`) aceita nome repetido.
 */
export function erroDoNomeDaColecao(nome: string, colecoes: readonly PastaModelo[], idIgnorado?: string): string | null {
  const termo = semAcentoMinusculo(nome);
  if (!termo) return ERRO_NOME_VAZIO;
  return colecoes.some((c) => c.id !== idIgnorado && semAcentoMinusculo(c.nome) === termo) ? ERRO_NOME_REPETIDO : null;
}

/**
 * O que o texto da busca do seletor de coleção (folha de novo modelo) vira: vazio = `semNome` (a opção "+ Nova coleção…"
 * abre o campo do nome); igual a uma coleção que já existe (mesma comparação de `erroDoNomeDaColecao`) = essa coleção, para
 * não nascer outra repetida; senão o nome limpo (espaços sobrando fora) para criar ali mesmo.
 */
export function colecaoDoDigitado(texto: string, colecoes: readonly PastaModelo[]): { semNome: true } | { existente: PastaModelo } | { nova: string } {
  const nome = texto.replace(/\s+/g, ' ').trim();
  if (!nome) return { semNome: true };
  const termo = semAcentoMinusculo(nome);
  const existente = colecoes.find((c) => semAcentoMinusculo(c.nome) === termo);
  return existente ? { existente } : { nova: nome };
}

export const ERRO_NOME_DO_MODELO_VAZIO = 'Informe o nome do modelo.';

/** Nome do modelo (folha de novo modelo e "Renomear ou mudar de coleção"): só espaços conta como vazio. */
export function erroDoNomeDoModelo(nome: string): string | null {
  return nome.trim() ? null : ERRO_NOME_DO_MODELO_VAZIO;
}

/** Modelos do tipo cujo nome ou descrição contém a busca (sem acento nem caixa); busca vazia = todos do tipo. */
export function filtrarModelos(modelos: readonly Receita[], tipo: TipoReceita, busca: string): Receita[] {
  const termo = semAcentoMinusculo(busca);
  return modelos.filter((m) => m.tipo === tipo && (!termo || semAcentoMinusculo(`${m.nome} ${m.descricao ?? ''}`).includes(termo)));
}

function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
