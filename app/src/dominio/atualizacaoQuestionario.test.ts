import type { ConteudoQuestionario, PerguntaAtualizacao } from '../api/tipos';
import {
  ajudaDoNumero, alternarMarcado, escolhaParaSimNao, perguntaPeso, perguntasDestaque, rascunhoVigente, respostasCompativeis,
  resumoDoTreinador, simNaoParaEscolha, textoDaResposta,
} from './atualizacaoQuestionario';
import { errosRespostasAtualizacao, respondida } from './respostasAtualizacao';

const opcoes = [{ id: 'a', rotulo: 'Ruim' }, { id: 'b', rotulo: 'Bom' }, { id: 'c', rotulo: 'Ótimo' }];
const modelo: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [{ uid: 's1', titulo: 'Fictício', perguntas: [
    { id: 'peso', tipo: 'PESO', rotulo: 'Peso', obrigatoria: true },
    { id: 'sono', tipo: 'NOTA', rotulo: 'Como foi o sono nesta semana inteira de treinos', obrigatoria: false, destaque: true, rotuloCurto: 'Sono' },
    { id: 'dor', tipo: 'SIM_NAO', rotulo: 'Sentiu dor?', obrigatoria: false, destaque: true },
    { id: 'humor', tipo: 'ESCOLHA_UNICA', rotulo: 'Humor', obrigatoria: false, destaque: true, opcoes },
    { id: 'passos', tipo: 'NUMERO', rotulo: 'Passos', obrigatoria: false, destaque: true, unidade: 'mil', min: 0, max: 50, casas: 1 },
    { id: 'extras', tipo: 'MULTIPLA_ESCOLHA', rotulo: 'Extras', obrigatoria: false, opcoes },
    { id: 'obs', tipo: 'TEXTO', rotulo: 'Observações', obrigatoria: false, destaque: true },
    { id: 'data', tipo: 'DATA_AUTOMATICA', rotulo: 'Data', obrigatoria: false },
  ] }],
};
const p = (id: string) => modelo.secoes[0].perguntas.find((x) => x.id === id) as PerguntaAtualizacao;
const resumoApi = { diasComTreino: 8, mediaDiasPorSemana: 4, pesoAnterior: 81 };

describe('textoDaResposta', () => {
  it('mostra "Não" e o zero como respostas, e só a ausência como "—"', () => {
    expect(textoDaResposta(p('dor'), false)).toBe('Não');
    expect(textoDaResposta(p('dor'), true)).toBe('Sim');
    expect(textoDaResposta(p('dor'), null)).toBe('—');
    expect(textoDaResposta(p('passos'), 0)).toBe('0 mil');
    expect(textoDaResposta(p('sono'), 0)).toBe('0');
    expect(textoDaResposta(p('sono'), undefined)).toBe('—');
  });
  it('formata peso, número com casas e unidade, e escolhas pelo rótulo', () => {
    expect(textoDaResposta(p('peso'), 80.5)).toBe('80,5 kg');
    expect(textoDaResposta(p('passos'), 7.25)).toBe('7,3 mil');
    expect(textoDaResposta(p('humor'), 'b')).toBe('Bom');
    expect(textoDaResposta(p('extras'), ['c', 'a'])).toBe('Ruim, Ótimo');
  });
  it('opção que não existe mais e lista vazia viram "—"', () => {
    expect(textoDaResposta(p('humor'), 'removida')).toBe('—');
    expect(textoDaResposta(p('extras'), ['removida'])).toBe('—');
    expect(textoDaResposta(p('extras'), [])).toBe('—');
    expect(textoDaResposta(p('obs'), '  ')).toBe('—');
  });
  it('notas por dia mostram cada dia', () => {
    const dias: PerguntaAtualizacao = { id: 'd', tipo: 'NOTAS_POR_DIA', rotulo: 'Dias', obrigatoria: false, dias: [1, 2] };
    expect(textoDaResposta(dias, { '1': 0, '2': null })).toBe('Dia 1: 0\nDia 2: —');
  });
});

describe('papéis das perguntas', () => {
  it('acha a pergunta de peso pelo tipo e os destaques na ordem, no máximo quatro e só dos tipos permitidos', () => {
    expect(perguntaPeso(modelo)?.id).toBe('peso');
    expect(perguntasDestaque(modelo).map((x) => x.id)).toEqual(['sono', 'dor', 'humor', 'passos']);
  });
  it('questionário sem PESO não tem pergunta de peso', () => {
    expect(perguntaPeso({ instrucoes: [], secoes: [{ titulo: 'x', perguntas: [p('sono')] }] })).toBeUndefined();
  });
});

describe('resumoDoTreinador', () => {
  it('traz peso com variação, destaques com o nome curto e os dados do período', () => {
    const r = resumoDoTreinador(modelo, { peso: 80.5, sono: 0, dor: false, humor: 'a', passos: 12 }, resumoApi);
    expect(r.peso).toEqual({ valor: 80.5, variacao: -0.5 });
    expect(r.destaques).toEqual([
      { id: 'sono', rotulo: 'Sono', texto: '0' },
      { id: 'dor', rotulo: 'Sentiu dor?', texto: 'Não' },
      { id: 'humor', rotulo: 'Humor', texto: 'Ruim' },
      { id: 'passos', rotulo: 'Passos', texto: '12 mil' },
    ]);
    expect(r.mediaDiasPorSemana).toBe(4);
    expect(r.pesoAnterior).toBe(81);
  });
  it('pergunta de peso sem resposta fica "sem valor" e sem variação; sem peso anterior não há variação', () => {
    expect(resumoDoTreinador(modelo, {}, resumoApi).peso).toEqual({ valor: null, variacao: null });
    expect(resumoDoTreinador(modelo, { peso: 80 }, { ...resumoApi, pesoAnterior: null }).peso).toEqual({ valor: 80, variacao: null });
  });
  it('sem pergunta PESO e sem destaque, só os dados do período; sem resumo da API tudo nulo', () => {
    const simples: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'x', perguntas: [p('obs')] }] };
    const r = resumoDoTreinador({ ...simples, secoes: [{ titulo: 'x', perguntas: [{ ...p('obs'), destaque: false }] }] }, { obs: 'ok' }, null);
    expect(r).toEqual({ peso: null, destaques: [], mediaDiasPorSemana: null, pesoAnterior: null });
  });
  it('corta rótulo de destaque comprido sem nome curto', () => {
    const longo: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'x', perguntas: [{ ...p('sono'), rotuloCurto: undefined }] }] };
    const [d] = resumoDoTreinador(longo, { sono: 7 }, null).destaques;
    expect(d.rotulo.length).toBeLessThanOrEqual(32);
    expect(d.rotulo.endsWith('…')).toBe(true);
  });
});

describe('respostasCompativeis', () => {
  it('mantém o que ainda vale, inclusive false e 0, e descarta id novo, opção removida e valor fora da faixa', () => {
    const r = respostasCompativeis(modelo, {
      dor: false, passos: 0, sono: 5, humor: 'removida', extras: ['a', 'zzz'], antiga: 'x', data: '2026-01-01', obs: '', peso: null,
    });
    expect(r.respostas).toEqual({ dor: false, passos: 0, sono: 5 });
    expect(r.descartadas.sort()).toEqual(['antiga', 'data', 'extras', 'humor']);
  });
  it('tipo diferente do id novo é descartado', () => {
    expect(respostasCompativeis(modelo, { dor: 'sim', sono: true }).respostas).toEqual({});
  });
});

describe('rascunhoVigente', () => {
  const atual = (id: string) => ({ modelo, questionarioVersaoId: id });
  it('sem rascunho não há o que mostrar', () => {
    expect(rascunhoVigente(null, atual('v1'))).toEqual({ respostas: {}, mudou: false, adaptado: false });
  });
  it('mesma versão: respostas como estão, sem aviso', () => {
    const r = rascunhoVigente({ questionarioVersaoId: 'v1', respostas: { dor: false, antiga: 'x' } }, atual('v1'));
    expect(r).toEqual({ respostas: { dor: false, antiga: 'x' }, mudou: false, adaptado: false });
  });
  it('outra versão: reconcilia e avisa', () => {
    const r = rascunhoVigente({ questionarioVersaoId: 'v0', respostas: { dor: false } }, atual('v1'));
    expect(r).toEqual({ respostas: { dor: false }, mudou: true, adaptado: true });
  });
  it('outra versão que perde resposta avisa e descarta só o que não vale mais', () => {
    const r = rascunhoVigente({ questionarioVersaoId: 'v0', respostas: { dor: false, antiga: 'x' } }, atual('v1'));
    expect(r.respostas).toEqual({ dor: false });
    expect(r.mudou).toBe(true);
  });
});

describe('apoio dos controles', () => {
  it('Sim/Não: false não vira "sem resposta"', () => {
    expect(simNaoParaEscolha(false)).toBe('nao');
    expect(simNaoParaEscolha(true)).toBe('sim');
    expect(simNaoParaEscolha(null)).toBeNull();
    expect(escolhaParaSimNao('nao')).toBe(false);
    expect(escolhaParaSimNao('sim')).toBe(true);
    expect(escolhaParaSimNao(null)).toBeNull();
  });
  it('múltipla escolha devolve na ordem das opções', () => {
    expect(alternarMarcado(['c'], opcoes, 'a')).toEqual(['a', 'c']);
    expect(alternarMarcado(['a', 'c'], opcoes, 'a')).toEqual(['c']);
    expect(alternarMarcado([], opcoes, 'b')).toEqual(['b']);
  });
  it('ajuda do número diz só o que a pergunta define', () => {
    expect(ajudaDoNumero(p('passos'))).toBe('De 0 a 50, até 1 casa decimal.');
    expect(ajudaDoNumero({ id: 'n', tipo: 'NUMERO', rotulo: 'N', obrigatoria: false })).toBe('Número inteiro.');
    expect(ajudaDoNumero({ id: 'n', tipo: 'NUMERO', rotulo: 'N', obrigatoria: false, min: 1, casas: 2 })).toBe('A partir de 1, até 2 casas decimais.');
    expect(ajudaDoNumero({ id: 'n', tipo: 'NUMERO', rotulo: 'N', obrigatoria: false, max: 10 })).toBe('Até 10, número inteiro.');
  });
});

describe('false e 0 de ponta a ponta', () => {
  const obrigatorias: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'x', perguntas: [
    { id: 'dor', tipo: 'SIM_NAO', rotulo: 'Dor', obrigatoria: true },
    { id: 'n', tipo: 'NUMERO', rotulo: 'N', obrigatoria: true, min: 0, max: 5, casas: 0 },
  ] }] };
  it('respondida e a validação obrigatória tratam false e 0 como resposta', () => {
    expect(respondida(false)).toBe(true);
    expect(respondida(0)).toBe(true);
    expect(respondida('')).toBe(false);
    expect(respondida([])).toBe(false);
    expect(errosRespostasAtualizacao(obrigatorias, { dor: false, n: 0 })).toEqual({});
    expect(Object.keys(errosRespostasAtualizacao(obrigatorias, { dor: null, n: null }))).toEqual(['dor', 'n']);
  });
});
