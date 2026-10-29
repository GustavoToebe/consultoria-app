/**
 * Lista de compras agrupada pelo grupo do alimento (pedido do Gustavo em 28/10, como a lista de um concorrente:
 * "Cereais e derivados", "Carnes e derivados", "Leite e derivados"...). O grupo vem do alimento da biblioteca e a
 * versão publicada o leva em cada item (`ItemDieta.grupo`, copiado na publicação como os fatores). Só muda a
 * apresentação: a conta, a ordem dentro do grupo e o "N de M comprados" continuam os mesmos.
 *
 * Ordem: os grupos em ordem alfabética (português, sem acento e sem caixa: "carnes" e "Carnes" são o mesmo grupo, com o
 * nome escrito como apareceu primeiro), depois "Outros itens" (sem grupo) e, por último, "Adicionados por você" (itens
 * avulsos do aluno). Grupo sem item não aparece.
 */

export const TITULO_SEM_GRUPO = 'Outros itens';
export const TITULO_DO_ALUNO = 'Adicionados por você';

export interface GrupoDaLista<T> {
  /** Chave estável do grupo (para `key`): `grupo:<nome sem acento>`, `sem-grupo` ou `do-aluno`. */
  chave: string;
  titulo: string;
  itens: T[];
}

const chaveDoNome = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Agrupa os itens já ordenados (a ordem de cada grupo é a recebida). `grupoDe` dá o grupo do item (vazio = sem grupo);
 * `doAluno` marca o que o aluno acrescentou, que vai para o último grupo independentemente do grupo.
 */
export function agruparLista<T>(
  itens: readonly T[],
  grupoDe: (item: T) => string | null | undefined,
  doAluno: (item: T) => boolean = () => false,
): GrupoDaLista<T>[] {
  const porChave = new Map<string, GrupoDaLista<T>>();
  const semGrupo: T[] = [];
  const doAlunoItens: T[] = [];
  for (const item of itens) {
    if (doAluno(item)) {
      doAlunoItens.push(item);
      continue;
    }
    const titulo = (grupoDe(item) ?? '').replace(/\s+/g, ' ').trim();
    if (!titulo) {
      semGrupo.push(item);
      continue;
    }
    const chave = chaveDoNome(titulo);
    const grupo = porChave.get(chave);
    if (grupo) grupo.itens.push(item);
    else porChave.set(chave, { chave: `grupo:${chave}`, titulo, itens: [item] });
  }
  const grupos = [...porChave.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([, g]) => g);
  if (semGrupo.length) grupos.push({ chave: 'sem-grupo', titulo: TITULO_SEM_GRUPO, itens: semGrupo });
  if (doAlunoItens.length) grupos.push({ chave: 'do-aluno', titulo: TITULO_DO_ALUNO, itens: doAlunoItens });
  return grupos;
}

/** "1 item" / "3 itens", no cabeçalho do grupo. */
export function contagemDoGrupo(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

/** Cabeçalho do grupo no PDF: "Carnes e derivados (3)". */
export function tituloDoGrupoNoPdf(grupo: { titulo: string; itens: readonly unknown[] }): string {
  return `${grupo.titulo} (${grupo.itens.length})`;
}

/**
 * Grupos já usados na biblioteca da consultoria e os do catálogo público, sem repetir (sem acento e sem caixa) e em
 * ordem alfabética, para as sugestões do campo "Grupo" do alimento. Sugere só os que contêm o que foi digitado; some o
 * que já é exatamente o texto digitado.
 */
export function sugerirGrupos(daConsultoria: readonly (string | null)[], doCatalogo: readonly string[], digitado: string): string[] {
  const vistos = new Map<string, string>();
  for (const g of [...daConsultoria, ...doCatalogo]) {
    const nome = (g ?? '').replace(/\s+/g, ' ').trim();
    if (nome && !vistos.has(chaveDoNome(nome))) vistos.set(chaveDoNome(nome), nome);
  }
  const termo = chaveDoNome(digitado);
  return [...vistos.entries()]
    .filter(([chave]) => chave !== termo && chave.includes(termo))
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([, nome]) => nome);
}
