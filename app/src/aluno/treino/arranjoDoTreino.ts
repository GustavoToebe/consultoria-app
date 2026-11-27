import type { Sessao } from '../../api/tipos';
import { dataParaTela } from '../../dominio/formatos';
import { ehDeHoje } from '../../dominio/inicioDoAluno';
import type { FaixaDeLargura } from '../../tema/tokens';

/**
 * Regras puras do Treino e do Treino do dia na web (`docs/planos/orientacoes-de-design-26-11.md`, 1.2 e 1.3). O celular
 * (faixa `compacta`) não passa por aqui: continua com o desenho de antes.
 */

/**
 * Da faixa `normal` em diante a tela monta a principal + apoio (`ui/PrincipalComApoio`, que ainda empilha abaixo de 952 de
 * área); na `compacta` (celular, tablet e janela estreita) fica o desenho de antes.
 */
export const temColunasDoAluno = (faixa: FaixaDeLargura) => faixa !== 'compacta';

/** Como uma divisão aparece na lista da semana: hoje em destaque, dia sem exercício discreto (sem seta), o resto igual. */
export type LinhaDaSemana = 'hoje' | 'treino' | 'descanso';

export function linhaDaSemana(sessao: Sessao, diaDeHoje: number): LinhaDaSemana {
  if (ehDeHoje(sessao, diaDeHoje)) return 'hoje';
  return sessao.exercicios.length ? 'treino' : 'descanso';
}

/**
 * A frase da data no resumo do dia: as duas de antes ("Você está registrando o treino de …" e "Você poderá concluir este
 * treino a partir de …") viram uma só quando aparecem juntas (data futura com o "Concluir treino" ligado). Hoje = nada.
 */
export function fraseDaDataDoTreino(data: string, hoje: string, concluirLigado: boolean): string | null {
  if (data === hoje) return null;
  const dia = dataParaTela(data);
  return concluirLigado && data > hoje
    ? `Você está registrando o treino de ${dia} e poderá concluí-lo a partir desse dia.`
    : `Você está registrando o treino de ${dia}.`;
}
