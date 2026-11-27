import type { Sessao } from '../api/tipos';
import type { FaixaDeLargura } from '../tema/tokens';

/**
 * Treino do aluno no computador (pedido do Gustavo de 27/11, padrão do treinador): lista das divisões à esquerda e o treino
 * da divisão escolhida à direita, preenchendo; orientações, PDF e mobilidade no apoio. Regras puras: o arranjo por faixa da
 * `Tela` e qual divisão abre escolhida.
 */

/**
 * `pilha`: celular e faixa `compacta`, o desenho de antes. `duas` (`normal` e `larga`): lista + apoio numa coluna de 380/420
 * e o treino ao lado. `tres` (`ultralarga`): lista | treino | apoio.
 */
export type ColunasDoTreino = 'pilha' | 'duas' | 'tres';

export function colunasDoTreino(faixa: FaixaDeLargura): ColunasDoTreino {
  if (faixa === 'compacta') return 'pilha';
  return faixa === 'ultralarga' ? 'tres' : 'duas';
}

/**
 * Onde a Mobilidade fica no computador, para as colunas terminarem perto da mesma altura (regra 3 do pedido de 27/11; visto
 * nas capturas). `abaixo`: na `normal` o treino é uma coluna só de cartões (~580 px) e fica com a altura da lista + orientações
 * + PDF; a mobilidade embaixo da lista a deixava ~800 px mais alta, então ela desce para depois das duas colunas, na largura
 * toda. `treino`: da `larga` em diante o treino vira duas colunas de cartões e fica baixo; a mobilidade vai embaixo dele, em
 * grade, ao lado da lista e do apoio, que grudam ao rolar. Ela é o que se faz (com ✓), não um resumo: nunca vai no apoio.
 */
export function ondeFicaAMobilidade(faixa: FaixaDeLargura): 'pilha' | 'abaixo' | 'treino' {
  if (faixa === 'compacta') return 'pilha';
  return faixa === 'normal' ? 'abaixo' : 'treino';
}

/** Dias até a divisão (0 = hoje), na ordem da semana a partir de hoje; sem dia fixo, nulo. */
const diasAte = (s: Sessao, diaDeHoje: number) => (s.diaSemana ? (s.diaSemana - diaDeHoje + 7) % 7 : null);

/**
 * A divisão que aparece à direita: a pedida no endereço (`?divisao=`), se existe no plano e tem exercício; senão a de hoje;
 * senão o próximo dia de treino da semana; senão a primeira com exercício. Dia sem exercício (descanso) nunca é escolhido.
 */
export function divisaoEscolhida(sessoes: Sessao[], pedida: string | null | undefined, diaDeHoje: number): Sessao | null {
  const comTreino = sessoes.filter((s) => s.exercicios.length > 0);
  const doEndereco = pedida ? comTreino.find((s) => s.uid === pedida) : undefined;
  if (doEndereco) return doEndereco;
  let proxima: Sessao | null = null;
  let menor = Infinity;
  for (const s of comTreino) {
    const dias = diasAte(s, diaDeHoje);
    if (dias !== null && dias < menor) {
      menor = dias;
      proxima = s;
    }
  }
  return proxima ?? comTreino[0] ?? null;
}
