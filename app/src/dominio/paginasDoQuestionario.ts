import type { ConteudoQuestionario, RespostasAtualizacao } from '../api/tipos';
import { avaliarRespostas } from './respostasAtualizacao';

/**
 * Anamnese em páginas, como o formulário em que o treinador já trabalhava: uma página por seção **visível**. As páginas
 * são índices em `modelo.secoes` (estáveis na versão), não posições: responder pode esconder ou mostrar uma seção
 * (`mostrarSe`) e as posições mudam, mas a seção em que o aluno está continua a mesma.
 */

/**
 * Seções que viram página, na ordem: visíveis pela condição e com algo para mostrar (descrição ou alguma pergunta
 * visível). Seção visível com todas as perguntas escondidas e sem texto seria uma página em branco: fica de fora.
 */
export function paginasVisiveis(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao): number[] {
  const { escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas);
  return modelo.secoes.flatMap((secao, i) => {
    if (secoesEscondidas.has(i)) return [];
    const temTexto = !!secao.descricao?.trim();
    return temTexto || secao.perguntas.some((p) => !escondidas.has(p.id)) ? [i] : [];
  });
}

/**
 * Posição (0 a n-1) da seção `secao` entre as páginas. Se ela sumiu (uma resposta a escondeu), fica na última página
 * visível antes dela: o aluno nunca pula para a frente sem passar pela conferência. Sem páginas, 0.
 */
export function posicaoSegura(paginas: readonly number[], secao: number): number {
  const exata = paginas.indexOf(secao);
  if (exata >= 0) return exata;
  let posicao = 0;
  paginas.forEach((s, i) => { if (s < secao) posicao = i; });
  return posicao;
}

/** Seção onde está a pergunta (para levar o aluno ao erro que veio do servidor); `null` se não é de nenhuma. */
export function secaoDaPergunta(modelo: ConteudoQuestionario, perguntaId: string): number | null {
  const i = modelo.secoes.findIndex((s) => s.perguntas.some((p) => p.id === perguntaId));
  return i >= 0 ? i : null;
}

/** Só os erros das perguntas da seção, na ordem em que vieram (a da tela). */
export function errosDaPagina(modelo: ConteudoQuestionario, secao: number, erros: Readonly<Record<string, string>>): Record<string, string> {
  const ids = new Set((modelo.secoes[secao]?.perguntas ?? []).map((p) => p.id));
  return Object.fromEntries(Object.entries(erros).filter(([id]) => ids.has(id)));
}

/** A página pode ser deixada para trás: nenhuma pergunta dela tem erro (obrigatória vazia, formato, limite). */
export const paginaCompleta = (modelo: ConteudoQuestionario, secao: number, erros: Readonly<Record<string, string>>) =>
  Object.keys(errosDaPagina(modelo, secao, erros)).length === 0;

/** Posição da primeira página com erro, ou `null` quando todas estão completas. */
export function primeiraPaginaComErro(modelo: ConteudoQuestionario, paginas: readonly number[], erros: Readonly<Record<string, string>>): number | null {
  const posicao = paginas.findIndex((s) => !paginaCompleta(modelo, s, erros));
  return posicao >= 0 ? posicao : null;
}

/** "Parte 2 de 9". */
export const textoDaParte = (posicao: number, total: number) => `Parte ${posicao + 1} de ${total}`;
