import type { ConteudoDieta, PlanoResumo } from '../api/tipos';
import {
  abasDoPrescrito, dietaDoPrescrito, dietaLida, outrosDoPrescrito, suplementosDoPrescrito, treinoDoPrescrito, versaoDoPrescrito,
} from './prescritoDaAtualizacao';

const plano = (id: string, extra: Partial<PlanoResumo>): PlanoResumo => ({
  id, alunoId: 'a', pastaId: 'p', titulo: id, inicio: null, fim: null, ativo: false, versaoPublicada: 1, publicadoEm: '2026-11-01T10:00:00Z',
  rascunhoAlteradoDepoisDePublicar: false, versao: 1, ...extra,
});

describe('abasDoPrescrito', () => {
  const com = (...codigos: string[]) => (c: string) => codigos.includes(c);
  it('cada aba só com a permissão que mostra aquele dado; sem ela, some', () => {
    expect(abasDoPrescrito(com('TREINO_LER', 'DIETA_LER', 'ERGOGENICO_LER'))).toEqual(['treino', 'dieta', 'suplementos', 'outros']);
    expect(abasDoPrescrito(com('TREINO_LER'))).toEqual(['treino']);
    expect(abasDoPrescrito(com('DIETA_LER'))).toEqual(['dieta', 'suplementos']);
    expect(abasDoPrescrito(com('ERGOGENICO_LER'))).toEqual([]);
  });
});

describe('versaoDoPrescrito', () => {
  it('o em uso da pasta, na versão que o aluno vê', () => {
    const lista = [plano('outra', { pastaId: 'x', ativo: true }), plano('velho', { versaoPublicada: 2 }), plano('ativo', { ativo: true, versaoPublicada: 3, versaoLiberada: 2 })];
    expect(versaoDoPrescrito(lista, 'p')).toEqual({ planoId: 'ativo', numero: 2, agendada: false });
  });
  it('sem o em uso: o publicado mais recente; rascunho nunca publicado não conta', () => {
    const lista = [plano('rascunho', { versaoPublicada: 0, publicadoEm: null }), plano('a', { publicadoEm: '2026-10-01T00:00:00Z' }), plano('b', { publicadoEm: '2026-11-05T00:00:00Z' })];
    expect(versaoDoPrescrito(lista, 'p')?.planoId).toBe('b');
  });
  it('só agendada (nada liberado ainda): a publicada, marcada como agendada', () => {
    expect(versaoDoPrescrito([plano('ag', { versaoPublicada: 1, versaoLiberada: 0, liberarEm: '2026-12-01' })], 'p')).toEqual({ planoId: 'ag', numero: 1, agendada: true });
  });
  it('sem pasta ou sem plano publicado na pasta: null', () => {
    expect(versaoDoPrescrito([plano('a', {})], null)).toBeNull();
    expect(versaoDoPrescrito([plano('a', { pastaId: 'x' })], 'p')).toBeNull();
  });
});

describe('treinoDoPrescrito', () => {
  it('uma linha por exercício, com as séries resumidas', () => {
    const sessoes = treinoDoPrescrito({ objetivo: null, orientacoes: null, sessoes: [{
      uid: 's1', nome: 'Treino A', diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
      exercicios: [{ uid: 'e1', exercicioId: null, nome: 'Supino reto', modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg',
        series: [1, 2, 3].map((n) => ({ uid: `x${n}`, tipo: null, repsMin: 6, repsMax: 8, carga: null, esforco: null, descansoSegundos: null })) },
      { uid: 'e2', exercicioId: null, nome: ' ', modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series: [] }],
    }] });
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].nome).toBe('Treino A');
    expect(sessoes[0].linhas[0].nome).toBe('Supino reto');
    expect(sessoes[0].linhas[0].detalhe).toContain('3x6 a 8');
    expect(sessoes[0].linhas[1]).toMatchObject({ nome: 'Exercício', detalhe: null });
  });
});

describe('dieta, suplementos e outros', () => {
  const item = (uid: string, nome: string, quantidade: number | null) => ({ uid, alimentoId: null, nome, quantidade, unidade: 'g' as const, kcal: 100, proteina: 1, carboidrato: 1, gordura: 1, manual: true });
  const dieta: ConteudoDieta = dietaLida({
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: 3, variacoes: [],
    refeicoes: [{ uid: 'r1', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [
      { uid: 'o1', rotulo: 'A', itens: [item('i1', 'Arroz branco', 100), item('i2', 'Salada', null)] },
      { uid: 'o2', rotulo: 'B', itens: [item('i3', 'Macarrão', 80)] }] }],
    suplementacao: [{ uid: 's1', nome: 'Creatina', dose: '5 g', horario: '', observacao: '', link: null }, { uid: 's2', nome: ' ', dose: '', horario: '', observacao: '', link: null }],
    ergogenicos: [{ uid: 'g1', nome: 'Item fictício', principioAtivo: '', concentracao: '10 mg', dose: '1', horario: 'manhã', observacao: '', prescricao: '' },
      { uid: 'g2', nome: '', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '' }],
  });
  it('refeições com os itens da primeira opção; quantidade ausente fica nula', () => {
    const [secao] = dietaDoPrescrito(dieta);
    expect(secao.rotulo).toBeNull();
    expect(secao.refeicoes[0]).toMatchObject({ nome: 'Almoço', horario: '12:00', outrasOpcoes: 1 });
    expect(secao.refeicoes[0].itens.map((i) => [i.nome, i.detalhe])).toEqual([['Arroz branco', '100 g'], ['Salada', null]]);
  });
  it('variações viram seções com o rótulo e os dias', () => {
    const comVariacoes = { ...dieta, refeicoes: [], variacoes: [{ uid: 'v1', rotulo: 'Dia de treino', dias: [1, 3, 5], refeicoes: dieta.refeicoes }] };
    expect(dietaDoPrescrito(comVariacoes)[0].rotulo).toBe('Dia de treino · Seg, Qua e Sex');
  });
  it('suplementos e outros só com o que foi escrito', () => {
    expect(suplementosDoPrescrito(dieta)).toEqual([{ chave: 's1', nome: 'Creatina', detalhe: '5 g' }]);
    expect(outrosDoPrescrito(dieta)).toEqual([{ chave: 'g1', nome: 'Item fictício', detalhe: '10 mg · 1 · manhã' }]);
    expect(outrosDoPrescrito({ ...dieta, ergogenicos: null })).toEqual([]);
  });
});
