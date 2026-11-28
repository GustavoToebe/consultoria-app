import type { PerguntaDaRegra, RegraDoAluno, SalvarRegraDoAluno } from '../api/tipos';
import { numeroDaTela, numeroParaTela } from './formatos';
import { errosDasRegras, MODELOS_DE_REGRA, perguntaDaRegra, textoDaRegra } from './regrasDeAtencao';

/**
 * Exceção por aluno (etapa 2 de `docs/planos/regras-de-atencao.md`, C8): na ficha, uma regra ligada da consultoria pode ficar
 * desligada só para o aluno ou ter o número dele. Vale a partir do próximo envio (o fato congela o número). O número continua
 * sendo do treinador: nada aqui sugere valor; trocar o número começa vazio. Pura (sem rede nem relógio).
 */

/** O que a linha da regra faz para este aluno. */
export type ModoDaExcecao = 'GERAL' | 'NUMERO' | 'DESLIGADA';

export const TEXTOS_DAS_EXCECOES = {
  linha: 'Regras de atenção',
  ajustar: 'Ajustar',
  ver: 'Ver regras',
  carregando: 'Carregando…',
  nenhumaLigada: 'Nenhuma regra ligada na consultoria',
  geral: 'Regra geral',
  numero: 'Outro número',
  desligada: 'Desligada',
  vale: 'Vale a partir do próximo envio. Atualizações já enviadas não mudam.',
  soLeitura: 'Para ajustar, peça a quem pode alterar as regras de atenção e o aluno.',
  anonimizado: 'Aluno anonimizado não tem exceção.',
  salva: 'Exceção salva.',
  voltou: 'Voltou à regra geral.',
  conflito: 'Esta exceção foi alterada por outra pessoa. Carregamos a versão atual; confira e salve de novo.',
  titulo: 'Exceções por aluno',
  semExcecao: 'Nenhum aluno com exceção · ajuste na ficha do aluno, em Configuração do acompanhamento.',
  ondeFica: 'Ajuste na ficha do aluno, em Configuração do acompanhamento.',
} as const;

/** O modo gravado: sem exceção = regra geral. */
export function modoDaExcecao(regra: Pick<RegraDoAluno, 'excecao'>): ModoDaExcecao {
  if (!regra.excecao) return 'GERAL';
  return regra.excecao.ativa ? 'NUMERO' : 'DESLIGADA';
}

/** Só os modelos com número aceitam "Outro número"; os de Sim e de item só desligam. */
export const aceitaNumero = (regra: Pick<RegraDoAluno, 'tipo'>) => MODELOS_DE_REGRA[regra.tipo].campo !== null;

/** A regra geral em palavras ("Sono 5 ou menos"), com o rótulo da pergunta quando se sabe. */
export function textoDaRegraGeral(regra: RegraDoAluno, perguntas: readonly PerguntaDaRegra[]): string {
  const texto = textoDaRegra(regra.tipo, regra.limite, perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas)?.rotulo);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O que vale para o aluno: "Regra geral", "Desligada para este aluno" ou "Sono 3 ou menos para este aluno". */
export function textoDaExcecao(regra: RegraDoAluno, perguntas: readonly PerguntaDaRegra[]): string {
  const modo = modoDaExcecao(regra);
  if (modo === 'GERAL') return TEXTOS_DAS_EXCECOES.geral;
  if (modo === 'DESLIGADA') return 'Desligada para este aluno';
  const texto = textoDaRegra(regra.tipo, regra.excecao?.limite ?? null, perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas)?.rotulo);
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} para este aluno`;
}

/** Resumo da linha da ficha: "Segue as regras gerais", "1 regra ajustada", "2 regras ajustadas"; sem regra ligada, o aviso. */
export function resumoDasExcecoes(regras: readonly RegraDoAluno[]): string {
  if (!regras.length) return TEXTOS_DAS_EXCECOES.nenhumaLigada;
  const n = regras.filter((r) => r.excecao).length;
  if (n === 0) return 'Segue as regras gerais';
  return n === 1 ? '1 regra ajustada' : `${n} regras ajustadas`;
}

/** O número digitado como texto da tela (vazio = sem número; o app nunca preenche sozinho). */
export const numeroDaExcecao = (regra: Pick<RegraDoAluno, 'excecao'>) =>
  regra.excecao?.ativa && regra.excecao.limite !== null ? numeroParaTela(regra.excecao.limite, 1) : '';

/** Erro do número do aluno: a mesma faixa da regra geral (C3), pela escala da pergunta na NOTA_ABAIXO. */
export function erroDoNumeroDaExcecao(regra: RegraDoAluno, texto: string, perguntas: readonly PerguntaDaRegra[]): string | undefined {
  const erros = errosDasRegras([{ chave: 'excecao', id: null, tipo: regra.tipo, perguntaId: regra.perguntaId, limite: texto, ativa: true }], perguntas);
  return erros.excecao?.limite;
}

/** A linha mudou em relação ao gravado (o "Salvar" da linha só aparece então). */
export function excecaoMudou(regra: RegraDoAluno, modo: ModoDaExcecao, texto: string): boolean {
  const gravado = modoDaExcecao(regra);
  if (modo !== gravado) return true;
  return modo === 'NUMERO' && numeroDaTela(texto.trim()) !== regra.excecao?.limite;
}

/** Corpo do `PUT` (modo NUMERO ou DESLIGADA); a versão gravada vai junto (sem exceção, sem versão = criar). */
export function corpoDaExcecao(regra: RegraDoAluno, modo: Exclude<ModoDaExcecao, 'GERAL'>, texto: string): SalvarRegraDoAluno {
  const n = modo === 'NUMERO' ? numeroDaTela(texto.trim()) : null;
  return { ativa: modo === 'NUMERO', limite: typeof n === 'number' ? n : null, versao: regra.excecao?.versao ?? null };
}

/** Contagem da tela de regras: "1 aluno com exceção", "3 alunos com exceção"; nula ou zero = nada a mostrar. */
export function textoDosAlunosComExcecao(n: number | null | undefined): string | null {
  if (!n) return null;
  return n === 1 ? '1 aluno com exceção' : `${n} alunos com exceção`;
}
