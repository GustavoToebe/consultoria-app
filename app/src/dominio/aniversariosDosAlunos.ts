/**
 * Aniversariantes dos próximos dias no Início do treinador (plano `docs/planos/aniversarios.md`). Só dia e mês: o ano e a
 * idade nunca entram aqui (D1). Espelha `AniversariantesService` da API, que já manda só quem cai na janela; a regra repete
 * a conta no app para o rótulo ("hoje", "amanhã") seguir o dia de Brasília mesmo com a lista aberta há horas.
 *
 * 29/02: em ano não bissexto comemora em 28/02 (decisão do plano, a mesma da API).
 */

/** Janelas da preferência `diasAniversario`: 0 = só quem faz hoje. */
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

/** Aniversariantes dos próximos `dias` dias (0 = hoje), do mais próximo ao mais distante, empate por nome. Dia ou mês inválido fica de fora. */
export function aniversariantesDosProximosDias<T extends NascimentoSemAno>(lista: readonly T[], hoje: string, dias: number): Aniversariante<T>[] {
  const [ano, mes, dia] = hoje.slice(0, 10).split('-').map(Number);
  const inicio = Date.UTC(ano, mes - 1, dia);
  const comemoracao = (n: NascimentoSemAno, anoAlvo: number) => Date.UTC(anoAlvo, n.mes - 1, n.mes === 2 && n.dia === 29 && !bissexto(anoAlvo) ? 28 : n.dia);
  return lista
    .filter((n) => Number.isInteger(n.mes) && n.mes >= 1 && n.mes <= 12 && Number.isInteger(n.dia) && n.dia >= 1 && n.dia <= diasDoMes(n.mes))
    .map((n) => {
      let alvo = comemoracao(n, ano);
      if (alvo < inicio) alvo = comemoracao(n, ano + 1);
      const diasAte = Math.round((alvo - inicio) / MS_POR_DIA);
      const quando = diasAte === 0 ? 'hoje' : diasAte === 1 ? 'amanhã' : `em ${diasAte} dias`;
      const d = new Date(alvo);
      return { ...n, diasAte, quando, data: `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}` };
    })
    .filter((n) => n.diasAte <= dias)
    .sort((a, b) => a.diasAte - b.diasAte || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Linha de cima do bloco: "Hoje", "Hoje e nos próximos 7 dias" (a janela escolhida em Aparência e preferências). */
export const descricaoDaJanela = (dias: number): string => (dias === 0 ? 'Hoje' : `Hoje e nos próximos ${dias} dias`);
