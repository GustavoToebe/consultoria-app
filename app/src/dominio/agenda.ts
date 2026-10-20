import type { AtualizacaoDaLista } from '../api/tipos';
import { dataSemAnoCorrente } from './datasRelativas';
import { somarDias } from './formatos';

/**
 * Agenda do treinador: as atualizações que vencem nos próximos dias (`GET /atualizacoes?situacao=PROXIMAS`, abertas com
 * `diasParaData` de 0 a 7) agrupadas por dia. Tudo em datas civis `YYYY-MM-DD` (o servidor conta o dia em Brasília), sem
 * `new Date()` e sem fuso: o "hoje" chega por parâmetro.
 */

/** PROXIMAS vai de hoje a hoje + 7: oito dias, com os que não têm atualização incluídos. */
export const DIAS_DA_AGENDA = 8;

const DIAS_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const;

const NOME_PADRAO = 'Aluno';

export type ItemDaAgenda = Pick<AtualizacaoDaLista, 'pastaId' | 'nomeAluno' | 'dataAtualizacao'>;

export interface DiaDaAgenda<T extends ItemDaAgenda = AtualizacaoDaLista> {
  /** Data civil do dia; `null` no grupo das atualizações sem data. */
  data: string | null;
  /** "Hoje", "Amanhã", "Quarta-feira" (o dia da semana) ou "Sem data". */
  rotulo: string;
  /** "22/10" (com o ano quando não é o corrente); vazio no grupo sem data. */
  dataCurta: string;
  /** "Quarta-feira, 22/10", "Hoje, 20/10"... */
  titulo: string;
  itens: T[];
}

const ehData = (texto: string | null | undefined): texto is string => !!texto && /^\d{4}-\d{2}-\d{2}/.test(texto);

/** Parte `YYYY-MM-DD` de uma data ISO (a API pode mandar com hora). */
const soData = (texto: string) => texto.slice(0, 10);

/** Dias de calendário entre duas datas civis (sem hora nem horário de verão). */
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(soData(ate)) - Date.parse(soData(de))) / 86_400_000);

/** Dia da semana de uma data civil, lido em UTC (`getDay()` local erraria um dia em fusos a oeste). */
export function diaDaSemana(data: string): string {
  const [a, m, d] = soData(data).split('-').map(Number);
  return DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Rótulo do dia em relação a `hoje`: Hoje, Amanhã ou o dia da semana. */
export function rotuloDoDia(data: string, hoje: string): string {
  const d = diasEntre(hoje, data);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  return diaDaSemana(data);
}

/**
 * "Hoje" do servidor deduzido da própria lista: `dataAtualizacao - diasParaData` é o dia que o servidor (Brasília) usou, e
 * evita comparar com o relógio do aparelho, que pode estar em outro fuso. Sem item que dê a conta, `null`.
 */
export function hojeDoServidor(itens: readonly Pick<AtualizacaoDaLista, 'dataAtualizacao' | 'diasParaData'>[]): string | null {
  for (const i of itens) {
    if (ehData(i.dataAtualizacao) && Number.isInteger(i.diasParaData)) return somarDias(soData(i.dataAtualizacao), -i.diasParaData);
  }
  return null;
}

/** Ordem do dia: nome do aluno (sem acento nem caixa) e, no empate, a pasta, para a lista não pular entre recargas. */
export function compararItens(a: ItemDaAgenda, b: ItemDaAgenda): number {
  const nome = (a.nomeAluno?.trim() || NOME_PADRAO).localeCompare(b.nomeAluno?.trim() || NOME_PADRAO, 'pt-BR', { sensitivity: 'base' });
  return nome || (a.pastaId ?? '').localeCompare(b.pastaId ?? '');
}

/**
 * Agrupa por `dataAtualizacao` na ordem do calendário e, dentro do dia, por nome. Os `DIAS_DA_AGENDA` dias a partir de
 * `hoje` sempre aparecem (dia sem atualização vem com `itens` vazio: a faixa do dia diz "Nenhuma atualização").
 * Atualização fora dessa janela (relógios discordando perto da meia-noite) ganha o próprio dia em vez de sumir, e a que
 * não tem data vai para um grupo no fim.
 */
export function agruparPorDia<T extends ItemDaAgenda>(itens: readonly T[], hoje: string, dias: number = DIAS_DA_AGENDA): DiaDaAgenda<T>[] {
  const porData = new Map<string, T[]>();
  for (let i = 0; i < dias; i++) porData.set(somarDias(soData(hoje), i), []);
  const semData: T[] = [];
  for (const item of itens) {
    if (!ehData(item.dataAtualizacao)) {
      semData.push(item);
      continue;
    }
    const data = soData(item.dataAtualizacao);
    const grupo = porData.get(data);
    if (grupo) grupo.push(item);
    else porData.set(data, [item]);
  }
  const lista: DiaDaAgenda<T>[] = [...porData.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([data, doDia]) => {
      const rotulo = rotuloDoDia(data, hoje);
      const curta = dataSemAnoCorrente(data, hoje);
      return { data, rotulo, dataCurta: curta, titulo: `${rotulo}, ${curta}`, itens: [...doDia].sort(compararItens) };
    });
  if (semData.length) lista.push({ data: null, rotulo: 'Sem data', dataCurta: '', titulo: 'Sem data', itens: semData.sort(compararItens) });
  return lista;
}

/** "3 atrasadas" / "1 atrasada" para a linha de resumo; só com número de verdade e maior que zero (senão `null`). */
export function resumoDeAtrasadas(total: number | null | undefined): string | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return null;
  return `${total} ${total === 1 ? 'atrasada' : 'atrasadas'}`;
}

/** Resumo na faixa do dia: "Nenhuma atualização", "1 atualização", "3 atualizações". */
export function contagemDoDia(n: number): string {
  if (n <= 0) return 'Nenhuma atualização';
  return `${n} ${n === 1 ? 'atualização' : 'atualizações'}`;
}
