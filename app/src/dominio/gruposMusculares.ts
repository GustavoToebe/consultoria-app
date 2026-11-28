import { semAcento } from './telas';

export interface GrupoContado { nome: string; contagem: number }

/** Uma linha da lista de filtros: um grupo ou as variações do mesmo grupo (decisão do Gustavo, 27/11). */
export interface GrupoAgrupado {
  /** Nome sem acento, sem diferença de maiúsculas e sem o "s" do plural simples: identifica o grupo. */
  chave: string;
  /** O que a linha mostra: a variação mais curta (empate, a primeira em ordem alfabética). */
  rotulo: string;
  total: number;
  /** As variações que existem de fato, em ordem alfabética (uma só quando não há nada a juntar). */
  variacoes: GrupoContado[];
  /** Os nomes exatos que o filtro e a junção usam: marcar a linha marca todos. */
  nomes: string[];
}

/**
 * O nome do grupo como a união o compara no servidor: `trim()` do JPQL/Postgres na coluna, que tira só o espaço comum
 * (U+0020) das pontas. NBSP e tabulação ficam, para o nome enviado casar com o gravado ("Ombro " vai como está).
 * shortcut: tab nas pontas nunca casa (o `strip()` do Java tira do pedido e o `trim()` do banco não tira da coluna);
 * trocar quando a API normalizar os dois lados igual.
 */
export const nomeDoGrupoNoServidor = (nome: string): string => nome.replace(/^ +| +$/g, '');

/**
 * Chave de comparação: sem acento, sem maiúsculas, espaços compactados (NBSP e tab contam como espaço) e sem UM "s" no fim
 * do nome inteiro ("Panturrilhas" e "Panturrilha" são o mesmo grupo). "Abdômen / Core" e "Posterior de Coxa" não se
 * juntam a nada por isso.
 * shortcut: só o plural simples do nome inteiro, sem sinônimos nem "ões"/"ais"; trocar quando aparecer um caso real.
 */
export function chaveDoGrupo(nome: string): string {
  const base = semAcento(nome).replace(/\s+/g, ' ');
  return base.length > 3 && base.endsWith('s') ? base.slice(0, -1) : base;
}

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/**
 * Quantos exercícios há em cada grupo, pelo nome como o servidor o compara ({@link nomeDoGrupoNoServidor}): é a lista da
 * "Organizar grupos musculares", cujos nomes vão exatos à união. Sem grupo (ou só espaços) fica de fora.
 */
export function gruposParaUnir(exercicios: readonly { grupoMuscular?: string | null }[]): GrupoContado[] {
  const contagem = new Map<string, number>();
  for (const e of exercicios) {
    const nome = nomeDoGrupoNoServidor(e.grupoMuscular ?? '');
    if (nome.trim()) contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }
  return [...contagem].map(([nome, n]) => ({ nome, contagem: n }));
}

/**
 * Junta as variações do mesmo grupo numa linha só, em ordem alfabética pelo rótulo. Grupo vazio ou sem nome fica de fora.
 * Os `nomes` ficam como o servidor os compara ({@link nomeDoGrupoNoServidor}), para a união casar com o gravado.
 */
export function agruparGruposParecidos(grupos: readonly GrupoContado[]): GrupoAgrupado[] {
  const porChave = new Map<string, GrupoContado[]>();
  for (const g of grupos) {
    const nome = nomeDoGrupoNoServidor(g.nome);
    if (!nome.trim()) continue;
    const chave = chaveDoGrupo(nome);
    const lista = porChave.get(chave) ?? [];
    const existente = lista.find((v) => v.nome === nome);
    if (existente) existente.contagem += g.contagem;
    else lista.push({ nome, contagem: g.contagem });
    porChave.set(chave, lista);
  }
  return [...porChave.entries()]
    .map(([chave, lista]) => {
      const variacoes = [...lista].sort((a, b) => porNome(a.nome, b.nome));
      const rotulo = [...variacoes].sort((a, b) => a.nome.length - b.nome.length || porNome(a.nome, b.nome))[0].nome;
      return { chave, rotulo, total: variacoes.reduce((s, v) => s + v.contagem, 0), variacoes, nomes: variacoes.map((v) => v.nome) };
    })
    .sort((a, b) => porNome(a.rotulo, b.rotulo));
}

/** "Panturrilha 1 · Panturrilhas 5", o texto do ⓘ; vazio quando a linha não junta nada. */
export function textoDasVariacoes(g: GrupoAgrupado): string {
  return g.variacoes.length > 1 ? g.variacoes.map((v) => `${v.nome} ${v.contagem}`).join(' · ') : '';
}
