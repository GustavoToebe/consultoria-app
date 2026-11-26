/**
 * Apresentação da "Medicação e ergogênicos" e da "Suplementação" na dieta do aluno (25/11): os itens agrupados pelo
 * horário que o treinador escreveu e a dose com espaço entre o número e a unidade. Só exibição: o dado salvo não muda,
 * nada é calculado nem sugerido.
 */

export const SEM_HORARIO_DEFINIDO = 'Sem horário definido';

export interface GrupoPorHorario<T> {
  /** O horário como o treinador escreveu (o da primeira aparição); nulo = "Sem horário definido". */
  horario: string | null;
  rotulo: string;
  itens: T[];
}

const HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const minutos = (h: string) => {
  const m = HORA.exec(h);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** "Primeira refeição" e "primeira  refeição" são o mesmo horário; "8:00" e "08:00" também. */
const chave = (h: string) => {
  const m = minutos(h);
  return m === null ? h.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ') : `@${m}`;
};

/**
 * Agrupa pelo horário, na ordem do dia: se todos os horários são hora ("HH:MM"), em ordem cronológica; senão (texto
 * como "Primeira refeição", ou misturado com hora), na ordem em que cada um aparece primeiro na lista. Os itens sem
 * horário vão para "Sem horário definido", sempre por último. Dentro do grupo, a ordem do treinador.
 */
export function agruparPorHorario<T extends { horario?: string | null }>(itens: readonly T[]): GrupoPorHorario<T>[] {
  const grupos = new Map<string, GrupoPorHorario<T>>();
  const sem: T[] = [];
  for (const item of itens) {
    const h = item.horario?.trim().replace(/\s+/g, ' ');
    if (!h) { sem.push(item); continue; }
    const k = chave(h);
    const grupo = grupos.get(k);
    if (grupo) grupo.itens.push(item);
    else grupos.set(k, { horario: h, rotulo: h, itens: [item] });
  }
  const lista = [...grupos.values()];
  if (lista.every((g) => minutos(g.rotulo) !== null)) lista.sort((a, b) => (minutos(a.rotulo) ?? 0) - (minutos(b.rotulo) ?? 0));
  return sem.length ? [...lista, { horario: null, rotulo: SEM_HORARIO_DEFINIDO, itens: sem }] : lista;
}

// Número (com "." ou "," de milhar e decimal) colado a uma unidade. O grupo 1 é o que vem antes: começo, espaço ou
// pontuação, nunca letra ou dígito ("D3", "B12" e "Ômega-3" ficam). Sem lookbehind (Hermes).
const COLADO = /(^|[^A-Za-zÀ-ÿµμ\d.,-])(\d+(?:[.,]\d+)*)([A-Za-zÀ-ÿµμ]+)/g;
/** Unidade que não leva espaço: "2x" (vezes), "3x12", "14h", "14h30". */
const SEM_ESPACO = /^(?:x|h)$/i;

/**
 * Espaço entre o número e a unidade, só para mostrar: "5mg" → "5 mg", "10.000UI" → "10.000 UI", "1,2g" → "1,2 g",
 * "2caps" → "2 caps". Texto já espaçado, palavras sem número, "D3", "2x", "3x12", "14h" e "5%" não mudam.
 */
export function espacarUnidades(texto: string): string {
  return texto.replace(COLADO, (tudo, antes: string, numero: string, unidade: string, fim: number, todo: string) => {
    const depois = todo[fim + tudo.length] ?? '';
    // "14h30", "3x12": a letra é separador entre números.
    if (SEM_ESPACO.test(unidade) || /\d/.test(depois)) return tudo;
    return `${antes}${numero} ${unidade}`;
  });
}

/**
 * A dose para a pílula, como a quantidade dos alimentos: o número do começo em destaque e o resto ao lado ("5" + "mg",
 * "1" + "scoop (30 g)"). Sem número no começo, tudo vai no `resto` ("Meia cápsula"); vazia, os dois nulos (a tela mostra "—").
 */
export function partesDaDose(dose: string | null | undefined): { numero: string | null; resto: string | null } {
  const texto = espacarUnidades(dose?.trim() ?? '');
  if (!texto) return { numero: null, resto: null };
  const m = /^(\d+(?:[.,/]\d+)*)\s+(.+)$/.exec(texto) ?? /^(\d+(?:[.,/]\d+)*)$/.exec(texto);
  if (!m) return { numero: null, resto: texto };
  return { numero: m[1], resto: m[2] ?? null };
}
