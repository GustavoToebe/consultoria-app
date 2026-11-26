import type { OpcaoRefeicao } from '../api/tipos';
import { ehRotuloPadrao, nomeDaOpcao, somar, type TotaisComFibra } from './dieta';
import { numeroParaTela, SEM_DADO } from './formatos';

/**
 * Opções da refeição em abas no editor (19/11): o texto de cada aba, a linha da comparação e qual aba abre depois de uma
 * mudança. Só apresentação: cada opção mostra o próprio total (`somar`), nada é calculado entre elas e o total do dia
 * continua contando só a primeira (`totalDoDia`).
 */

/** Seis opções (A a F) por refeição; no limite o "+ Opção" fica desabilitado com o motivo. */
export const MAXIMO_DE_OPCOES = 6;
export const MOTIVO_NO_LIMITE_DE_OPCOES = `No máximo ${MAXIMO_DE_OPCOES} opções por refeição.`;
/** Selo da primeira opção (a que entra no "Total do dia"), na aba e na comparação. */
export const CONTA_NO_TOTAL = 'Conta no total do dia';

/** "Opção A" (rótulo padrão) ou o rótulo personalizado como está ("Opção Principal": sem prefixo dobrado). */
export const tituloDaOpcao = (o: OpcaoRefeicao) => nomeDaOpcao(o.rotulo);

/** O que cabe no círculo da aba: a letra (ou o número) do padrão; no personalizado, a inicial do nome ("Opção Principal" → "P"). */
export const letraDoMarcador = (rotulo: string) => (ehRotuloPadrao(rotulo)
  ? rotulo.trim()
  : (rotulo.trim().replace(/^Opção\s+(?=\S)/i, '')[0] ?? '').toUpperCase());

/** Totais da opção; `null` sem item (opção vazia nunca vira "0 kcal": `somar([])` daria zero). */
export const totaisDaOpcao = (o: OpcaoRefeicao): TotaisComFibra | null => (o.itens.length ? somar(o.itens) : null);

/** O que vem depois de "Opção A ·" na aba: "98 kcal", "— kcal" quando algum item não tem valor, "vazia" sem item. */
export function kcalDaAba(o: OpcaoRefeicao): string {
  const t = totaisDaOpcao(o);
  if (!t) return 'vazia';
  return `${t.kcal === null ? SEM_DADO : numeroParaTela(t.kcal, 0)} kcal`;
}

/** Nome acessível da aba: "Opção A, 98 kcal, conta no total do dia, com problema a corrigir". */
export function nomeDaAba(o: OpcaoRefeicao, primeira: boolean, comProblema: boolean): string {
  return [tituloDaOpcao(o), kcalDaAba(o), primeira ? CONTA_NO_TOTAL.toLowerCase() : null, comProblema ? 'com problema a corrigir' : null]
    .filter(Boolean).join(', ');
}

/** Gramas da comparação, sem a unidade (o "(g)" fica no cabeçalho) e com uma casa para a coluna alinhar; "—" sem valor. */
export const gramasSemUnidade = (v: number | null) => (v === null ? SEM_DADO : v.toFixed(1).replace('.', ','));

/**
 * A aba que fica aberta quando os problemas da validação mudam: a aberta, se ela tem problema ou nenhuma tem; senão a
 * primeira com problema (o erro não fica escondido atrás de uma aba fechada).
 */
export function abaComProblema(opcoes: OpcaoRefeicao[], aberta: string, comProblema: ReadonlySet<string>): string {
  if (comProblema.has(aberta)) return aberta;
  return opcoes.find((o) => comProblema.has(o.uid))?.uid ?? aberta;
}

/** Chave estável do conjunto de problemas de uma refeição: o mesmo conjunto (outra instância a cada desenho) não muda a aba. */
export const chaveDosProblemas = (opcoes: OpcaoRefeicao[], comProblema: ReadonlySet<string>) =>
  opcoes.filter((o) => comProblema.has(o.uid)).map((o) => o.uid).join(',');
