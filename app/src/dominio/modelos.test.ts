import type { Configuracao, ConteudoTreino } from '../api/tipos';
import { aplicarReceitaDePlano, normalizarTreino, novaSerie, novaSessao } from './editorTreino';
import { destinosParaAplicar, detalheDoModelo, podeAplicarModelo, podeSalvarPastaComoModelo, SEM_PASTA_PARA_APLICAR, temAcaoNoMenuDaPasta } from './modelos';
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

test('sem PASTA_ALTERAR não há "criar nova pasta" ao aplicar um modelo', () => {
  const pastas = [{ id: 'p1', titulo: 'Pasta 1' }, { id: 'p2', titulo: 'Pasta 2' }];
  const quemCria = destinosParaAplicar(true, pastas);
  expect(quemCria.opcoes.map((o) => o.valor)).toEqual(['', 'p1', 'p2']);
  expect(quemCria.padrao).toBe('');
  const quemNaoCria = destinosParaAplicar(false, pastas);
  expect(quemNaoCria.opcoes.map((o) => o.valor)).toEqual(['p1', 'p2']);
  expect(quemNaoCria.padrao).toBe('p1');
  expect(quemNaoCria.semDestino).toBe(false);
  expect(destinosParaAplicar(false, []).semDestino).toBe(true);
  expect(destinosParaAplicar(false, null).semDestino).toBe(false);
  expect(destinosParaAplicar(true, []).semDestino).toBe(false);
  expect(SEM_PASTA_PARA_APLICAR).toBe('Peça a quem pode criar pastas para criar uma para este aluno.');
});

test('salvar pasta como pacote segue as permissões da rota e o ⋯ some sem ação', () => {
  const tem = (...codigos: string[]) => (c: string) => codigos.includes(c);
  // Perfis padrão da V018: Treinador e Nutricionista têm as quatro; o Assistente não tem MODELO_ALTERAR.
  const treinador = tem('PASTA_ALTERAR', 'MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER');
  const nutricionista = tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER');
  const assistente = tem('ALUNO_LER', 'TREINO_LER', 'DIETA_LER', 'MODELO_LER');
  expect(podeSalvarPastaComoModelo(treinador)).toBe(true);
  expect(podeSalvarPastaComoModelo(nutricionista)).toBe(true);
  expect(podeSalvarPastaComoModelo(assistente)).toBe(false);
  expect(podeSalvarPastaComoModelo(tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER'))).toBe(false);
  expect(podeSalvarPastaComoModelo(tem('MODELO_ALTERAR', 'TREINO_LER', 'DIETA_LER'))).toBe(false);
  expect(temAcaoNoMenuDaPasta(nutricionista)).toBe(true);
  expect(temAcaoNoMenuDaPasta(tem('PASTA_ALTERAR'))).toBe(true);
  expect(temAcaoNoMenuDaPasta(tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER'))).toBe(false);
});
