import { requisicao } from './cliente';
import { listarAlunos } from './rotas';

/**
 * Convite de acesso em lote (28/11). Contrato: `POST /alunos/lote/convites {alunoIds}` (1 a 100 distintos, a permissão do
 * convite individual, `ALUNO_CONVITE`; auditoria `ALUNOS_CONVITES_GERADOS`) → `{resultados}` na ordem do pedido, com `link` e
 * `validoAte` só em `GERADO`. A resposta vem `no-store`; o app guarda os links só no estado da folha.
 */
export type SituacaoDoConvite = 'GERADO' | 'JA_TEM_ACESSO' | 'INATIVO' | 'ANONIMIZADO' | 'NAO_ENCONTRADO' | 'ACESSO_DESATIVADO';

export interface ResultadoDoConvite {
  alunoId: string;
  nome: string;
  /** Como a API grava, `(45) 99999-8888`; nulo = sem telefone. */
  telefone: string | null;
  /** Valor desconhecido (a API pode crescer) = não gerado. */
  situacao: SituacaoDoConvite | (string & {});
  link: string | null;
  /** Instante ISO. */
  validoAte: string | null;
}

export const gerarConvitesEmLote = (alunoIds: readonly string[]) =>
  requisicao<{ resultados: ResultadoDoConvite[] }>('/alunos/lote/convites', { metodo: 'POST', corpo: { alunoIds }, semCache: true });

/** Páginas de 100 (o teto do `GET /alunos`). */
const POR_PAGINA = 100;

/**
 * Os ids de TODOS os alunos do filtro (busca e filtros da lista), paginando o `GET /alunos` que já existe, na ordem dela.
 * shortcut: uma chamada por 100 alunos (2000 alunos = 20 chamadas em sequência); trocar por um `GET /alunos/ids` se a base passar disso.
 */
export async function idsDoFiltro(pedido: { busca: string; filtros: readonly [string, string][] }): Promise<string[]> {
  const ids: string[] = [];
  for (let pagina = 0; ; pagina++) {
    const r = await listarAlunos({ busca: pedido.busca, filtros: pedido.filtros, pagina, tamanho: POR_PAGINA });
    ids.push(...r.itens.map((a) => a.id));
    if (r.itens.length < POR_PAGINA || ids.length >= r.total) return [...new Set(ids)];
  }
}
