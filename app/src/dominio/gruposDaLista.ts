/**
 * Lista de compras agrupada pelo grupo do alimento (pedido do Gustavo em 28/10, como a lista de um concorrente:
 * "Cereais e derivados", "Carnes e derivados", "Leite e derivados"...). O grupo vem do alimento da biblioteca e a
 * versão publicada o leva em cada item (`ItemDieta.grupo`, copiado na publicação como os fatores). Só muda a
 * apresentação: a conta, a ordem dentro do grupo e o "N de M comprados" continuam os mesmos.
 *
 * Ordem (pedido do Gustavo em 29/10, percurso de mercado): primeiro os grupos do CATÁLOGO na ordem fixa de
 * `GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO`; depois os que o treinador criou (fora do catálogo), em ordem alfabética
 * (português, sem acento e sem caixa: "carnes" e "Carnes" são o mesmo grupo, com o nome escrito como apareceu primeiro);
 * depois "Outros itens" (sem grupo) e, por último, "Adicionados por você" (itens avulsos do aluno). Grupo sem item não
 * aparece.
 */

export const TITULO_SEM_GRUPO = 'Outros itens';
export const TITULO_DO_ALUNO = 'Adicionados por você';

export interface GrupoDaLista<T> {
  /** Chave estável do grupo (para `key`): `grupo:<nome sem acento>`, `sem-grupo` ou `do-aluno`. */
  chave: string;
  titulo: string;
  itens: T[];
}

/**
 * Todos os nomes de grupo que o catálogo público tem hoje (`GET /catalogo/alimentos/grupos`: os 14 do TACO nas V002 e
 * V027 e as 13 seções do Batel Grill da V030), na ordem em que aparecem num percurso de mercado. A posição na lista é a
 * ordem na tela, no PDF da lista e no PDF Detalhado da dieta. Comparação sem acento e sem caixa (`chaveDoNome`).
 *
 * Blocos, em ordem: hortifrúti (verduras, hortaliças e frutas) · carnes e ovos · pescados · leite e derivados · cereais,
 * pães e massas · leguminosas · óleos e gorduras · açúcares e doces · bebidas · o resto da mercearia.
 *
 * Os grupos do Batel que são prato pronto de restaurante (massas, polentas, risotos, saladas, sobremesas, pratos
 * quentes, molhos, sushis) não têm corredor de mercado: ficam no fim, com o resto da mercearia, em vez de um palpite.
 * Grupo novo no catálogo (fonte nova = migration nova) entra aqui; enquanto não entrar, ele cai junto dos grupos do
 * treinador, em ordem alfabética. Nome fora desta lista é tratado como grupo do treinador.
 */
export const GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO: readonly string[] = [
  // Hortifrúti
  'Verduras, hortaliças e derivados',
  'Frutas e derivados',
  // Carnes e ovos
  'Carnes e derivados',
  'Carnes', // Batel Grill
  'Ovos e derivados',
  // Pescados
  'Pescados e frutos do mar',
  // Leite e derivados
  'Leite e derivados',
  'Queijos', // Batel Grill
  // Cereais, pães e massas
  'Cereais e derivados',
  // Leguminosas
  'Leguminosas e derivados',
  // Óleos e gorduras
  'Gorduras e óleos',
  // Açúcares e doces
  'Produtos açucarados',
  // Bebidas
  'Bebidas (alcoólicas e não alcoólicas)',
  'Sucos naturais', // Batel Grill
  'Sucos de polpas com água', // Batel Grill
  'Sucos de polpas com leite condensado', // Batel Grill
  // O resto da mercearia
  'Nozes e sementes',
  'Miscelâneas',
  'Outros alimentos industrializados',
  'Molhos frios', // Batel Grill
  'Massas com molhos', // Batel Grill
  'Polentas com molhos', // Batel Grill
  'Risotos', // Batel Grill
  'Saladas', // Batel Grill
  'Pratos quentes e acompanhamentos', // Batel Grill
  'Sushis e yakissoba', // Batel Grill
  'Sobremesas', // Batel Grill
];

const chaveDoNome = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const POSICAO_NO_MERCADO: ReadonlyMap<string, number> = new Map(GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO.map((nome, i) => [chaveDoNome(nome), i]));

/** Catálogo primeiro, na ordem do mercado; os demais (do treinador) depois, em ordem alfabética. */
function compararGrupos(a: string, b: string): number {
  const pa = POSICAO_NO_MERCADO.get(a);
  const pb = POSICAO_NO_MERCADO.get(b);
  if (pa !== undefined && pb !== undefined) return pa - pb;
  if (pa !== undefined) return -1;
  if (pb !== undefined) return 1;
  return a.localeCompare(b, 'pt-BR');
}

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
  const grupos = [...porChave.entries()].sort(([a], [b]) => compararGrupos(a, b)).map(([, g]) => g);
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
