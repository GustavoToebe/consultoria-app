import type { FiltrosDoMural, PaginaDoMural, TipoDePost } from '../api/comunidadeTipos';
import { type FiltroDoMural, opcoesDoTipoDoMural, type PapelNoMural, type RascunhoDoPost, textoDoMuralVazio } from './comunidade';

/**
 * Mural em duas abas (C39, decisão D22 de `docs/planos/comunidade-playlists.md`): **Avisos** (aviso, vídeo e enquete) e
 * **Alunos** (conversa, dúvida e resultado), para a equipe e o aluno. É só o filtro por tipo que a API já aceita; o fixado
 * aparece na aba do tipo dele. A aba mora no endereço (`?mural=avisos|alunos`) e, no aluno, o grupo em `?grupo=meu`.
 */
export type AbaDoMural = 'avisos' | 'alunos';

/** Avisos: é onde ficam os fixados e os recados da equipe, o que todo aluno precisa ver primeiro. */
export const ABA_PADRAO_DO_MURAL: AbaDoMural = 'avisos';

export const ABAS_DO_MURAL: readonly { valor: AbaDoMural; rotulo: string }[] = [
  { valor: 'avisos', rotulo: 'Avisos' },
  { valor: 'alunos', rotulo: 'Alunos' },
];

const TIPOS: Record<AbaDoMural, readonly TipoDePost[]> = {
  avisos: ['AVISO', 'VIDEO', 'ENQUETE'],
  alunos: ['CONVERSA', 'DUVIDA', 'RESULTADO'],
};

export const tiposDaAba = (aba: AbaDoMural): readonly TipoDePost[] => TIPOS[aba];
export const abaDoTipo = (tipo: TipoDePost): AbaDoMural => (TIPOS.avisos.includes(tipo) ? 'avisos' : 'alunos');
const rotuloDaAba = (aba: AbaDoMural): string => ABAS_DO_MURAL.find((a) => a.valor === aba)?.rotulo ?? aba;

/** `?mural=`: valor desconhecido, repetido ou ausente = a aba padrão. */
export const abaDoParametro = (valor: string | string[] | undefined): AbaDoMural => (valor === 'alunos' ? 'alunos' : ABA_PADRAO_DO_MURAL);

/** `?grupo=meu` (aluno): só vale com o pod que a API mandou; sem ele, o Geral. */
export const PARAMETRO_DO_MEU_GRUPO = 'meu';
export const visaoDoParametro = (valor: string | string[] | undefined, temPod: boolean): 'geral' | 'grupo' =>
  valor === PARAMETRO_DO_MEU_GRUPO && temPod ? 'grupo' : 'geral';

/** O tipo escolhido no painel só vale na aba dele: trocar de aba tira o chip sem estado a corrigir. */
export const filtroNaAba = (filtro: FiltroDoMural, aba: AbaDoMural): FiltroDoMural =>
  filtro.tipo && !TIPOS[aba].includes(filtro.tipo) ? { ...filtro, tipo: null } : filtro;

/** "Todos" e os tipos da aba, na ordem da tela. */
export const opcoesDoTipoNaAba = (aba: AbaDoMural) =>
  opcoesDoTipoDoMural().filter((o) => o.valor === null || TIPOS[aba].includes(o.valor));

/** Os tipos que a aba pede à API: o do chip, se ele é da aba, ou os três. */
export const tiposParaBuscar = (filtro: FiltroDoMural, aba: AbaDoMural): readonly TipoDePost[] => {
  const tipo = filtroNaAba(filtro, aba).tipo;
  return tipo ? [tipo] : TIPOS[aba];
};

/** O mesmo teto do `PAGINA_DO_MURAL` do cliente: só a página mais recente. */
const POSTS_NA_PAGINA = 50;

/**
 * Junta as páginas de cada tipo na ordem da API (`fixado desc, criadoEm desc, id desc`) e corta no teto: os primeiros 50 da
 * união são exatos, porque cada tipo trouxe os seus 50 mais recentes. Post repetido entra uma vez.
 */
export function juntarPaginas(paginas: readonly PaginaDoMural[], teto = POSTS_NA_PAGINA): PaginaDoMural {
  const posts = [...new Map(paginas.flatMap((p) => p.content).map((p) => [p.id, p])).values()];
  posts.sort((a, b) => Number(b.fixado) - Number(a.fixado)
    || Date.parse(b.criadoEm) - Date.parse(a.criadoEm)
    || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return { content: posts.slice(0, teto), totalElements: paginas.reduce((t, p) => t + p.totalElements, 0) };
}

/**
 * A aba vem da API: uma chamada por tipo (a rota aceita um `tipo` só) e as páginas juntas. A falha de qualquer uma é a falha
 * da aba, uma vez só.
 * shortcut: até 3 pedidos e 150 posts por aba; trocar por uma chamada quando a API aceitar `tipo` repetível.
 */
export async function carregarMuralDaAba(
  listar: (f: FiltrosDoMural) => Promise<PaginaDoMural>, filtros: FiltrosDoMural, tipos: readonly TipoDePost[],
): Promise<PaginaDoMural> {
  if (tipos.length === 1) return listar({ ...filtros, tipo: tipos[0] });
  return juntarPaginas(await Promise.all(tipos.map((tipo) => listar({ ...filtros, tipo }))));
}

const intocado = (r: RascunhoDoPost): boolean => !r.texto.trim() && !r.videoUrl?.trim() && !r.fotoIds?.length && !r.capaId
  && !(r.opcoes ?? []).some((o) => o.trim()) && !r.encerraEm?.trim();

/**
 * A folha abre com o tipo da aba (Aviso na aba Avisos da equipe; Conversa no resto, que é o que o aluno publica) só
 * enquanto o rascunho está intocado: o que já foi digitado nunca muda de tipo.
 */
export function rascunhoAoAbrir(r: RascunhoDoPost, aba: AbaDoMural, papel: PapelNoMural): RascunhoDoPost {
  if (!intocado(r)) return r;
  const tipo: TipoDePost = papel === 'equipe' && aba === 'avisos' ? 'AVISO' : 'CONVERSA';
  return r.tipo === tipo && !r.opcoes ? r : { tipo, texto: r.texto };
}

/**
 * A "Nova publicação" tem algo a perder? O texto diferente do que abriu (fora espaços; o texto pronto do "Bom trabalho!"
 * não conta), algo mais digitado ou anexado, o tipo trocado em relação ao que abriu, ou as várias respostas da enquete
 * ligadas. `inicial` só tem tipo e texto.
 */
export const postAlterado = (r: RascunhoDoPost, inicial: RascunhoDoPost): boolean =>
  r.texto.trim() !== inicial.texto.trim() || !intocado({ ...r, texto: '' }) || r.tipo !== inicial.tipo || r.variasRespostas === true;

const VAZIO_DA_ABA: Record<AbaDoMural, string> = { avisos: 'Nenhum aviso, vídeo ou enquete', alunos: 'Nenhuma conversa, dúvida ou resultado' };

/** Vazio da aba: sem filtro diz o que falta nela (e no grupo); com tipo ou busca, o texto do filtro; só denunciadas diz a aba. */
export function textoDoVazioDaAba(aba: AbaDoMural, filtro: FiltroDoMural, busca: string, grupo?: string | null): string {
  if (filtro.tipo || busca.trim()) return textoDoMuralVazio(filtro, busca);
  if (filtro.denunciados) return `Nenhuma publicação denunciada em ${rotuloDaAba(aba)}.`;
  return `${VAZIO_DA_ABA[aba]}${grupo ? ` no grupo ${grupo}` : ''} ainda.`;
}
