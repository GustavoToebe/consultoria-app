import type { Configuracao, ConteudoTreino } from '../api/tipos';
import { aplicarReceitaDePlano, normalizarTreino, novaSerie, novaSessao } from './editorTreino';
import { detalheDoModelo, podeAplicarModelo } from './modelos';
import { conteudoInicial } from '../treinador/planejamento/modelos';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `modelo-uid-${++mockContador}` }));

const configuracao: Configuracao = { tiposSerie: ['Trabalho', 'Preparação'], tipoTrabalho: 'Trabalho', tipoPreparacao: 'Preparação', regraPreparacao: { '1': [60] }, arredondamentoKg: 1, instrucoesTreino: 'Instrução fictícia', rodapePdf: 'Modelo fictício' };

test('normalizar e aplicar semana preservam metodologia independente e renovam os identificadores', () => {
  const origem: ConteudoTreino = { ...normalizarTreino(null), sessoes: [novaSessao(1)], metodologia: { id: 'metodo', nome: 'Método', configuracao } };
  const atual = { ...normalizarTreino(null), objetivo: 'Objetivo do aluno' };
  const a = aplicarReceitaDePlano(atual, origem);
  const b = aplicarReceitaDePlano(atual, origem);
  expect(a.objetivo).toBe('Objetivo do aluno');
  expect(a.metodologia).toEqual(origem.metodologia);
  expect(a.metodologia).not.toBe(origem.metodologia);
  expect(a.sessoes[0].uid).not.toBe(b.sessoes[0].uid);
  expect(a.sessoes[0].uid).not.toBe(origem.sessoes[0].uid);
  a.metodologia!.configuracao.regraPreparacao['1'][0] = 90;
  expect(origem.metodologia!.configuracao.regraPreparacao['1']).toEqual([60]);
  expect(novaSerie(b.metodologia!.configuracao).tipo).toBe('Trabalho');
});

test('modelo antigo sem metodologia mantém a metodologia já vinculada ao aluno', () => {
  const atual = { ...normalizarTreino(null), metodologia: { id: 'metodo', nome: 'Método', configuracao } };
  expect(aplicarReceitaDePlano(atual, { sessoes: [] }).metodologia).toEqual(atual.metodologia);
});

test('conteúdos iniciais não inventam prescrições e modelos avulsos têm exatamente uma seção', () => {
  expect(conteudoInicial('SESSAO_TREINO', configuracao)).toMatchObject({ sessoes: [{ exercicios: [] }] });
  expect(conteudoInicial('REFEICAO', configuracao)).toMatchObject({ refeicoes: [expect.any(Object)] });
  expect(conteudoInicial('SERIES', configuracao)).toMatchObject({ series: [{ repsMin: null, repsMax: null }] });
  const copia = conteudoInicial('METODOLOGIA', configuracao) as Configuracao;
  copia.tiposSerie.push('Novo');
  expect(configuracao.tiposSerie).not.toContain('Novo');
});

test('adapter conserva revisão otimista sem simular publicação nem associar aluno', () => {
  const detalhe = detalheDoModelo({ id: 'modelo', tipo: 'PLANO_TREINO', nome: 'Semana', descricao: null, pastaId: null, ordem: 1, versao: 7, conteudo: normalizarTreino(null) });
  expect(detalhe.plano).toMatchObject({ titulo: 'Semana', versao: 7, versaoPublicada: 0, ativo: false, alunoId: '', inicio: null, fim: null });
  expect(detalhe.versoes).toEqual([]);
});

test('aplicar modelo pede a permissão de alterar o que ele cria (como a API)', () => {
  const tem = (...codigos: string[]) => (c: string) => codigos.includes(c);
  const nutricionista = tem('MODELO_APLICAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR');
  expect(podeAplicarModelo('PLANO_DIETA', nutricionista)).toBe(true);
  expect(podeAplicarModelo('REFEICAO', nutricionista)).toBe(true);
  expect(podeAplicarModelo('PLANO_TREINO', nutricionista)).toBe(false);
  expect(podeAplicarModelo('MOBILIDADE', nutricionista)).toBe(false);
  expect(podeAplicarModelo('PASTA_PLANO', nutricionista)).toBe(true);
  expect(podeAplicarModelo('METODOLOGIA', tem('MODELO_APLICAR', 'ALUNO_LER', 'TREINO_ALTERAR'))).toBe(false);
  expect(podeAplicarModelo('PLANO_TREINO', tem('MODELO_APLICAR', 'TREINO_ALTERAR'))).toBe(false);
  expect(podeAplicarModelo('PLANO_TREINO', tem('ALUNO_LER', 'TREINO_ALTERAR'))).toBe(false);
});
