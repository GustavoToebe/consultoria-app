import type { PerguntaDaRegra, RegraDoAluno } from '../api/tipos';
import {
  aceitaNumero, corpoDaExcecao, erroDoNumeroDaExcecao, excecaoMudou, modoDaExcecao, numeroDaExcecao, resumoDasExcecoes,
  textoDaExcecao, textoDaRegraGeral, textoDosAlunosComExcecao,
} from './excecoesDeAtencao';

const PERGUNTAS: PerguntaDaRegra[] = [
  { perguntaId: 'sono', tipo: 'NOTA', rotulo: 'Sono', escala: { min: 1, max: 5 }, questionarios: [] },
  { perguntaId: 'dores', tipo: 'SIM_NAO', rotulo: 'Sentiu dores', escala: null, questionarios: [] },
];
const NOTA: RegraDoAluno = { regraId: 'r1', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 3, excecao: null };
const SIM: RegraDoAluno = { regraId: 'r2', tipo: 'SIM', perguntaId: 'dores', limite: null, excecao: null };
const PESO: RegraDoAluno = { regraId: 'r3', tipo: 'PESO_MUDOU', perguntaId: null, limite: 2, excecao: { ativa: true, limite: 1.5, versao: 4 } };

describe('exceção por aluno', () => {
  it('modo, textos e o que aceita número', () => {
    expect(modoDaExcecao(NOTA)).toBe('GERAL');
    expect(modoDaExcecao(PESO)).toBe('NUMERO');
    expect(modoDaExcecao({ excecao: { ativa: false, limite: null, versao: 0 } })).toBe('DESLIGADA');
    expect(aceitaNumero(NOTA)).toBe(true);
    expect(aceitaNumero(SIM)).toBe(false);
    expect(textoDaRegraGeral(NOTA, PERGUNTAS)).toBe('Sono 3 ou menos');
    expect(textoDaRegraGeral(SIM, PERGUNTAS)).toBe('Resposta Sim em Sentiu dores');
    expect(textoDaExcecao(NOTA, PERGUNTAS)).toBe('Regra geral');
    expect(textoDaExcecao(PESO, PERGUNTAS)).toBe('Peso mudou 1,5 kg ou mais para este aluno');
    expect(textoDaExcecao({ ...SIM, excecao: { ativa: false, limite: null, versao: 0 } }, PERGUNTAS)).toBe('Desligada para este aluno');
  });

  it('resumo da ficha e contagem da tela de regras', () => {
    expect(resumoDasExcecoes([])).toBe('Nenhuma regra ligada na consultoria');
    expect(resumoDasExcecoes([NOTA, SIM])).toBe('Segue as regras gerais');
    expect(resumoDasExcecoes([NOTA, PESO])).toBe('1 regra ajustada');
    expect(resumoDasExcecoes([PESO, { ...SIM, excecao: { ativa: false, limite: null, versao: 0 } }])).toBe('2 regras ajustadas');
    expect(textoDosAlunosComExcecao(0)).toBeNull();
    expect(textoDosAlunosComExcecao(null)).toBeNull();
    expect(textoDosAlunosComExcecao(1)).toBe('1 aluno com exceção');
    expect(textoDosAlunosComExcecao(3)).toBe('3 alunos com exceção');
  });

  it('o número nunca é sugerido e segue a faixa da regra geral', () => {
    expect(numeroDaExcecao(NOTA)).toBe('');
    expect(numeroDaExcecao(PESO)).toBe('1,5');
    expect(erroDoNumeroDaExcecao(NOTA, '', PERGUNTAS)).toBe('Digite o número da regra.');
    expect(erroDoNumeroDaExcecao(NOTA, '6', PERGUNTAS)).toBe('Use um número de 1 a 5, a escala desta pergunta.');
    expect(erroDoNumeroDaExcecao(NOTA, '2', PERGUNTAS)).toBeUndefined();
    expect(erroDoNumeroDaExcecao(PESO, '1,55', PERGUNTAS)).toBe('Use no máximo 1 casa decimal.');
  });

  it('mudou e o corpo do PUT (com a versão gravada)', () => {
    expect(excecaoMudou(NOTA, 'GERAL', '')).toBe(false);
    expect(excecaoMudou(NOTA, 'DESLIGADA', '')).toBe(true);
    expect(excecaoMudou(PESO, 'NUMERO', '1,5')).toBe(false);
    expect(excecaoMudou(PESO, 'NUMERO', '1')).toBe(true);
    expect(corpoDaExcecao(NOTA, 'NUMERO', '2')).toEqual({ ativa: true, limite: 2, versao: null });
    expect(corpoDaExcecao(PESO, 'DESLIGADA', '1,5')).toEqual({ ativa: false, limite: null, versao: 4 });
  });
});
