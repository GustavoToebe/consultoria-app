import { cmParaTela } from './avaliacaoFisica';
import { dataParaTela } from './formatos';

/**
 * Direito × esquerdo no mesmo gráfico (28/11): onde os dois lados têm o mesmo valor na mesma data, o ponto vazado da
 * série B cobria o cheio da A e parecia um lado só. Os dois marcadores se afastam um pouco na horizontal (a linha não
 * muda) e o balão traz os dois valores; com tudo igual, a legenda diz isso. Puro: o gráfico só aplica.
 */
type Ponto = { data: string; valor: number };

export const TEXTO_LADOS_IGUAIS = 'Direito e esquerdo iguais em todas as avaliações';

/** Afastamento de cada marcador (px, para um lado e para o outro): perto o bastante para ler como a mesma data. */
export const DESLOCAMENTO_DOS_LADOS = 3;

/** A tela mostra uma casa: 34,40 e 34,4 são o mesmo valor. */
const mesmoValor = (a: number, b: number) => Math.round(a * 10) === Math.round(b * 10);

/** Datas em que os dois lados foram medidos com o mesmo valor. */
export function datasCoincidentes(a: readonly Ponto[], b: readonly Ponto[]): Set<string> {
  const deB = new Map(b.map((p) => [p.data, p.valor]));
  return new Set(a.filter((p) => {
    const outro = deB.get(p.data);
    return outro !== undefined && mesmoValor(p.valor, outro);
  }).map((p) => p.data));
}

/** Os dois lados medidos nas mesmas datas e iguais em todas; um lado que falta numa data já não é "todas". */
export function ladosIguaisEmTodas(a: readonly Ponto[], b: readonly Ponto[]): boolean {
  return a.length > 0 && a.length === b.length && datasCoincidentes(a, b).size === a.length;
}

/** Deslocamento horizontal de cada ponto (na ordem de cada série): A para a esquerda e B para a direita, só onde coincidem. */
export function deslocamentoDosLados(a: readonly Ponto[], b: readonly Ponto[], px = DESLOCAMENTO_DOS_LADOS): { a: number[]; b: number[] } {
  const juntas = datasCoincidentes(a, b);
  return { a: a.map((p) => (juntas.has(p.data) ? -px : 0)), b: b.map((p) => (juntas.has(p.data) ? px : 0)) };
}

/** Balão do ponto onde os dois lados coincidem: a data e os dois valores, um por linha. */
export function linhasDaDicaDosDoisLados(data: string, a: { rotulo: string; valor: number }, b: { rotulo: string; valor: number }): string[] {
  return [dataParaTela(data), `${a.rotulo} · ${cmParaTela(a.valor)} cm`, `${b.rotulo} · ${cmParaTela(b.valor)} cm`];
}
