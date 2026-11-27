import type { ValoresPdf } from '../dominio/configuracaoPdf';
import { CORES_EXATAS, LISTRA } from './cssDasOpcoes';

/**
 * Regras das opções que só valem para os seletores ESPECÍFICOS de cada gerador (plano `docs/planos/documentos-pdf-motor.md`,
 * "Nova direção"). `cssDasOpcoes` fala só dos seletores comuns (`.doc th`, `.doc h2`...), e os geradores escrevem depois
 * deles regras mais específicas (`.doc table.id td`, `.doc h2.sec`, `.doc .serie`...) que vencem pela especificidade: sem
 * este bloco, densidade e tamanho P/G mudavam as tabelas comuns e deixavam essas de fora, e a listra própria da dieta
 * ficava por cima da opção `LISTRADA`. O bloco vai por último no CSS do gerador, repetindo o seletor de cada regra que
 * ele corrige (mesma especificidade, vence pela ordem). Tudo fixo no código; o valor padrão (M e NORMAL) não acrescenta
 * nada, e o Clássico sem opções continua byte a byte o de antes.
 */
export type Gerador = 'DIETA' | 'TREINO' | 'CARGAS';

type Tamanho = ValoresPdf['texto']['tamanho'];
type Densidade = ValoresPdf['tabelas']['densidade'];

/** Tamanho em pt de cada regra fixa do gerador: M é o que o gerador já escreve (por isso não entra), P e G acompanham o `.doc`. */
const TAMANHOS: Record<Gerador, Record<Exclude<Tamanho, 'M'>, [seletor: string, pt: number][]>> = {
  DIETA: {
    P: [['.doc h2.sec', 10], ['.doc table.id td:first-child', 8.5], ['.doc .item .macros', 8], ['.doc .total', 8], ['.doc .escolha', 8], ['.doc .preparo strong', 8], ['.doc .refeicao > .cab', 9.5], ['.doc .opcao > .cab', 8]],
    G: [['.doc h2.sec', 12], ['.doc table.id td:first-child', 10.5], ['.doc .item .macros', 10], ['.doc .total', 10], ['.doc .escolha', 10], ['.doc .preparo strong', 10], ['.doc .refeicao > .cab', 11.5], ['.doc .opcao > .cab', 10]],
  },
  TREINO: { P: [], G: [] },
  CARGAS: { P: [['.doc .titulo-divisao', 10.5]], G: [['.doc .titulo-divisao', 13]] },
};

/** Só o espaçamento vertical do que não é célula (a linha de `padding-left` do LINHA, por exemplo, fica como está). */
const DENSIDADES: Record<Gerador, Record<Exclude<Densidade, 'NORMAL'>, string>> = {
  DIETA: {
    COMPACTA: `.doc table.id td, .doc table.macros td { padding: 2pt 4pt; }
.doc .item { margin: 1pt 0; }
`,
    ESPACOSA: `.doc table.id td, .doc table.macros td { padding: 7pt 8pt; }
.doc .item { margin: 4pt 0; }
`,
  },
  TREINO: {
    COMPACTA: `.doc table.instrucoes td { padding: 2pt 4pt; }
.doc .serie { margin: 0 0 2pt; padding: 0 0 0 5pt; }
`,
    ESPACOSA: `.doc table.instrucoes td { padding: 7pt 8pt; }
.doc .serie { margin: 0 0 7pt; padding: 2pt 0 2pt 5pt; }
`,
  },
  CARGAS: {
    COMPACTA: `.doc .titulo-divisao { padding-top: 3pt; padding-bottom: 3pt; }
.doc .exercicio .cab { padding-top: 2pt; padding-bottom: 2pt; }
`,
    ESPACOSA: `.doc .titulo-divisao { padding-top: 9pt; padding-bottom: 9pt; }
.doc .exercicio .cab { padding-top: 8pt; padding-bottom: 8pt; }
`,
  },
};

/**
 * Uma listra só (D7 e defeito 4): a dieta pinta por conta própria as linhas pares das três tabelas dela (e o LINHA as
 * apaga); com `LISTRADA` as três ficam na listra da opção, a mesma de todas as outras tabelas do documento.
 */
const LISTRA_DA_DIETA = `.doc table.id tr:nth-child(even) td, .doc table.macros tr:nth-child(even) td, .doc table.dark tr:nth-child(even) td { background: ${LISTRA}; ${CORES_EXATAS} }
`;

export function ajustesDoGerador(gerador: Gerador, valores: ValoresPdf): string {
  const { tamanho } = valores.texto;
  const { densidade, estilo } = valores.tabelas;
  const tamanhos = tamanho === 'M' ? [] : (TAMANHOS[gerador][tamanho] ?? []);
  return (
    tamanhos.map(([seletor, pt]) => `${seletor} { font-size: ${pt}pt; }\n`).join('') +
    (densidade === 'NORMAL' ? '' : (DENSIDADES[gerador][densidade] ?? '')) +
    (gerador === 'DIETA' && estilo === 'LISTRADA' ? LISTRA_DA_DIETA : '')
  );
}
