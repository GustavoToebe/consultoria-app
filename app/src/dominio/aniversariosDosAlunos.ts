/**
 * Aniversariantes dos próximos dias no Início do treinador (plano `docs/planos/aniversarios.md`). Só dia e mês: o ano e a
 * idade nunca entram aqui (D1). Espelha `AniversariantesService` da API, que já manda só quem cai na janela; a regra repete
 * a conta no app para o rótulo ("hoje", "amanhã") seguir o dia de Brasília mesmo com a lista aberta há horas.
 *
 * 29/02: em ano não bissexto comemora em 28/02 (decisão do plano, a mesma da API).
 */
import type { TamanhoDoBloco } from './painelBlocos';

/** Janelas do "Mostrar aniversários de" do bloco (`painelDoInicio.opcoes.aniversarios.dias`): 0 = só quem faz hoje. */
export const OPCOES_DIAS_ANIVERSARIO: readonly number[] = [0, 3, 7, 15];

export interface NascimentoSemAno {
  nome: string;
  dia: number;
  mes: number;
}

export type Aniversariante<T extends NascimentoSemAno> = T & {
  /** 0 = hoje. */
  diasAte: number;
  /** Dia em que se comemora, "dd/mm" (28/02 para quem nasceu em 29/02, num ano não bissexto). */
  data: string;
  /** "hoje", "amanhã" ou "em N dias". */
  quando: string;
};

const MS_POR_DIA = 86_400_000;
const bissexto = (ano: number) => ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
const diasDoMes = (mes: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Dias até a próxima comemoração a partir de `hoje` ("aaaa-mm-dd", dia de Brasília) e o dia dela em "dd/mm"; dia ou mês inválido = null. */
function proximaComemoracao(n: NascimentoSemAno, hoje: string): { diasAte: number; data: string } | null {
  if (!(Number.isInteger(n.mes) && n.mes >= 1 && n.mes <= 12 && Number.isInteger(n.dia) && n.dia >= 1 && n.dia <= diasDoMes(n.mes))) return null;
  const [ano, mes, dia] = hoje.slice(0, 10).split('-').map(Number);
  const inicio = Date.UTC(ano, mes - 1, dia);
  const comemoracao = (anoAlvo: number) => Date.UTC(anoAlvo, n.mes - 1, n.mes === 2 && n.dia === 29 && !bissexto(anoAlvo) ? 28 : n.dia);
  let alvo = comemoracao(ano);
  if (alvo < inicio) alvo = comemoracao(ano + 1);
  const d = new Date(alvo);
  return { diasAte: Math.round((alvo - inicio) / MS_POR_DIA), data: `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}` };
}

/** Aniversariantes dos próximos `dias` dias (0 = hoje), do mais próximo ao mais distante, empate por nome. Dia ou mês inválido fica de fora. */
export function aniversariantesDosProximosDias<T extends NascimentoSemAno>(lista: readonly T[], hoje: string, dias: number): Aniversariante<T>[] {
  return lista
    .flatMap((n) => {
      const c = proximaComemoracao(n, hoje);
      if (!c || c.diasAte > dias) return [];
      return [{ ...n, ...c, quando: c.diasAte === 0 ? 'hoje' : c.diasAte === 1 ? 'amanhã' : `em ${c.diasAte} dias` }];
    })
    .sort((a, b) => a.diasAte - b.diasAte || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/**
 * O que o bloco do Início mostra ao lado do nome: "Hoje", "Amanhã" ou o dia "dd/mm", contado de novo a partir de `hoje`
 * (a lista pode ficar aberta na virada do dia). Nunca o ano nem a idade.
 */
export function rotuloDoAniversario(item: NascimentoSemAno, hoje: string): string {
  const c = proximaComemoracao(item, hoje);
  if (!c) return '';
  return c.diasAte === 0 ? 'Hoje' : c.diasAte === 1 ? 'Amanhã' : c.data;
}

/** Quantos nomes cabem no bloco pelo tamanho (colunas da grade): Pequeno 3, Médio 6, Grande 10. */
export const limiteDoTamanho = (tamanho: TamanhoDoBloco): 3 | 6 | 10 => (tamanho === 1 ? 3 : tamanho === 2 ? 6 : 10);

/** Quantos ficam para o "+N" (nunca negativo). */
export const restantes = (total: number, limite: number): number => Math.max(0, total - limite);

/** Uma linha só, no lugar da lista, quando ninguém faz aniversário na janela escolhida (o bloco não some). */
export const fraseSemAniversarios = (dias: number): string =>
  dias === 0 ? 'Nenhum aniversário hoje' : `Nenhum aniversário nos próximos ${dias} dias`;

/** Linha de cima do bloco: "Hoje", "Hoje e nos próximos 7 dias" (o "Mostrar aniversários de" do bloco). */
export const descricaoDaJanela = (dias: number): string => (dias === 0 ? 'Hoje' : `Hoje e nos próximos ${dias} dias`);
