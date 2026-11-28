import { LARGURA_MENU_LATERAL } from '../tema/tokens';

/**
 * Histórico do aluno na web (`docs/planos/aluno-web-layout.md`, seção 7; medidas na 1.7 de
 * `docs/planos/orientacoes-de-design-26-11.md`): com o menu lateral (a web de PC) a tela vira abas no topo, cada uma com o
 * seu arranjo; no celular continua uma coluna só, na ordem de sempre. Pura: a tela só aplica. Nenhum cartão some: a união
 * das abas é a mesma lista da coluna única.
 */
export type AbaDoHistorico = 'treinos' | 'corpo' | 'atualizacoes';

export type BlocoDoHistorico = 'ainda' | 'registros' | 'progresso' | 'peso' | 'avaliacao' | 'fotos' | 'atualizacoes';

export const ABAS_DO_HISTORICO: readonly { valor: AbaDoHistorico; rotulo: string }[] = [
  { valor: 'treinos', rotulo: 'Treinos' },
  { valor: 'corpo', rotulo: 'Corpo' },
  { valor: 'atualizacoes', rotulo: 'Atualizações' },
];

/** Aba pedida pelo endereço (`?aba=`); valor desconhecido ou ausente abre Treinos. */
export function abaDoHistorico(parametro: string | string[] | undefined): AbaDoHistorico {
  const bruto = Array.isArray(parametro) ? parametro[0] : parametro;
  return ABAS_DO_HISTORICO.find((a) => a.valor === bruto)?.valor ?? 'treinos';
}

/** Ordem da coluna única (celular e app): as fotos depois da avaliação, como no Corpo em uma coluna (Peso, Avaliação, Fotos; 28/11). */
export const ORDEM_NUMA_COLUNA: readonly BlocoDoHistorico[] = ['atualizacoes', 'ainda', 'registros', 'progresso', 'peso', 'avaliacao', 'fotos'];

/**
 * "Ainda não enviados" pede ação (tentar enviar de novo) e vale para qualquer aba: fica no topo de todas, logo abaixo das
 * abas, e não escondido numa delas.
 */
export const NO_TOPO_DE_TODA_ABA: readonly BlocoDoHistorico[] = ['ainda'];

export interface ArranjoDaAba {
  principal: readonly BlocoDoHistorico[];
  /** Ao lado da principal (`ui/PrincipalComApoio`, fixa ao rolar); empilha embaixo quando a área não comporta. */
  apoio: readonly BlocoDoHistorico[];
  /** Nome da região de apoio para o leitor de tela (nulo sem apoio). */
  rotuloDoApoio: string | null;
  /** A principal são cartões soltos em colunas da faixa normal em diante (o Corpo, `aluno/historico/CorpoDoHistorico`). */
  emColunas: boolean;
}

/**
 * Treinos: Registros e cargas na principal (as divisões em colunas por dentro), Progresso por exercício no apoio. Corpo
 * (28/11): Peso e Fotos lado a lado com a mesma altura e a Avaliação na largura toda embaixo; numa coluna, Peso, Avaliação
 * e Fotos (a ordem de `principal`). Atualizações: a lista das enviadas, na
 * largura do contêiner (as linhas em colunas por dentro), começando na borda do título.
 */
export const ARRANJO_DA_ABA: Readonly<Record<AbaDoHistorico, ArranjoDaAba>> = {
  treinos: { principal: ['registros'], apoio: ['progresso'], rotuloDoApoio: 'Progresso por exercício', emColunas: false },
  corpo: { principal: ['peso', 'avaliacao', 'fotos'], apoio: [], rotuloDoApoio: null, emColunas: true },
  atualizacoes: { principal: ['atualizacoes'], apoio: [], rotuloDoApoio: null, emColunas: false },
};

/**
 * Abas só na web com o menu lateral (a mesma régua do `app/aluno/_layout`: janela ≥ `LARGURA_MENU_LATERAL`). É o modo da
 * navegação, não a medida de uma coluna: dentro da aba, o arranjo mede a própria área (`ui/PrincipalComApoio`). No celular e
 * no app nativo, a coluna única de sempre.
 */
export const historicoEmAbas = (web: boolean, larguraDaJanela: number) => web && larguraDaJanela >= LARGURA_MENU_LATERAL;
