import type { ConteudoQuestionario, PerguntaAtualizacao } from '../api/tipos';
import {
  ajudaDoNumero, alternarMarcado, escolhaParaSimNao, perguntaPeso, perguntasDestaque, rascunhoVigente, respostasCompativeis,
  progressoDasSecoes, resumoDoTreinador, simNaoParaEscolha, textoDaResposta, textoDoProgresso, textoDaNota, notaEmDuasPartes, respostasDaGrade,
  colunasDasOpcoes, arranjoDaLeitura, diasNaSemana, notasPorDiaEmTabela, fraseDaMediaDeTreino, linhaDaMediaDeTreino, respostaLida, temImagemNasOpcoes, textoDasPerguntas,
} from './atualizacaoQuestionario';
import { errosRespostasAtualizacao, respondida, respostaDeItens } from './respostasAtualizacao';

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
    expect(textoDaResposta(p('sono'), 0)).toBe('0 de 0 a 10');
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
    expect(textoDaResposta(dias, { '1': 0, '2': null })).toBe('Dia 1: 0 de 0 a 10\nDia 2: —');
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
      { id: 'sono', rotulo: 'Sono', texto: '0 de 0 a 10', nota: { valor: '0', escala: 'de 0 a 10' } },
      { id: 'dor', rotulo: 'Sentiu dor?', texto: 'Não' },
      { id: 'humor', rotulo: 'Humor', texto: 'Ruim' },
      { id: 'passos', rotulo: 'Passos', texto: '12 mil' },
    ]);
    expect(r.diasComTreino).toBe(8);
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
    expect(r).toEqual({ peso: null, destaques: [], diasComTreino: null, mediaDiasPorSemana: null, pesoAnterior: null });
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

describe('respostasCompativeis com fotos', () => {
  const ID = '0b8f6f0e-6a53-4c3b-9d5a-2f1a4f3f9a11';
  const comFotos: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'Fictício', perguntas: [
    { id: 'fotos', tipo: 'FOTOS', rotulo: 'Fotos', obrigatoria: false },
  ] }] };
  it('mantém os ids das fotos já enviadas e descarta lista malformada', () => {
    expect(respostasCompativeis(comFotos, { fotos: [ID] })).toEqual({ respostas: { fotos: [ID] }, descartadas: [] });
    expect(respostasCompativeis(comFotos, { fotos: ['nao-e-id'] })).toEqual({ respostas: {}, descartadas: ['fotos'] });
  });
  it('descarta fotos se o questionário novo não tem a pergunta', () => {
    expect(respostasCompativeis(modelo, { fotos: [ID] })).toEqual({ respostas: {}, descartadas: ['fotos'] });
  });
});

describe('tipos da anamnese', () => {
  const P = (id: string, tipo: PerguntaAtualizacao['tipo'], extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao =>
    ({ id, tipo, rotulo: id, obrigatoria: false, ...extra });
  it('texto das respostas novas; ausência é "—"', () => {
    expect(textoDaResposta(P('d', 'DATA'), '1990-05-10')).toBe('10/05/1990');
    expect(textoDaResposta(P('f', 'TELEFONE'), '(45) 99999-8888')).toBe('(45) 99999-8888');
    expect(textoDaResposta(P('a', 'ACEITE', { declaracao: 'Li e concordo.' }), true)).toBe('Aceito: “Li e concordo.”');
    expect(textoDaResposta(P('a', 'ACEITE'), null)).toBe('—');
    const g = P('g', 'GRADE', { linhas: [{ id: 'l1', rotulo: 'Item A' }, { id: 'l2', rotulo: 'Item B' }], colunas: [{ id: 'c1', rotulo: 'Nunca' }, { id: 'c2', rotulo: 'Sempre' }] });
    expect(textoDaResposta(g, { l1: 'c2' })).toBe('Item A: Sempre\nItem B: —');
  });
  it('progresso por seção conta só as visíveis e respondíveis', () => {
    const modelo = { instrucoes: [], secoes: [
      { uid: 's1', titulo: 'A', perguntas: [P('i', 'INFORMATIVO'), P('s', 'SIM_NAO'), P('t', 'TEXTO', { mostrarSe: { perguntaId: 's', valores: ['sim'] } })] },
      { uid: 's2', titulo: 'B', mostrarSe: { perguntaId: 's', valores: ['nao'] }, perguntas: [P('u', 'TEXTO')] },
    ] };
    expect(progressoDasSecoes(modelo, { s: true })).toEqual([{ respondidas: 1, total: 2 }, null]);
    expect(progressoDasSecoes(modelo, { s: false })).toEqual([{ respondidas: 1, total: 1 }, { respondidas: 0, total: 1 }]);
    expect(textoDoProgresso({ respondidas: 1, total: 2 })).toBe('1 de 2 respondidas');
    expect(textoDoProgresso({ respondidas: 0, total: 0 })).toBe('');
  });
});

describe('apoio da nota, da grade e das opções com imagem', () => {
  it('nota na leitura leva a ponta de cima; sem resposta, "—"', () => {
    expect(textoDaNota({ min: 1, max: 5 }, 4)).toBe('4/5');
    expect(textoDaNota({}, 0)).toBe('0 de 0 a 10');
    expect(textoDaNota({ min: 1, max: 10 }, 7)).toBe('7/10');
    expect(textoDaNota({}, null)).toBe('—');
    expect(notaEmDuasPartes({}, 0)).toEqual({ valor: '0', escala: 'de 0 a 10' });
    expect(notaEmDuasPartes({ min: 1, max: 5 }, 4)).toEqual({ valor: '4', escala: 'de 1 a 5' });
  });

  it('grade na leitura: uma linha por item, "—" na linha sem resposta', () => {
    const p = { linhas: [{ id: 'l1', rotulo: 'Azia' }, { id: 'l2', rotulo: 'Insônia' }], colunas: [{ id: 'c1', rotulo: 'Nunca' }, { id: 'c2', rotulo: 'Sempre' }] };
    expect(respostasDaGrade(p, { l2: 'c2' })).toEqual([{ id: 'l1', linha: 'Azia', resposta: '—' }, { id: 'l2', linha: 'Insônia', resposta: 'Sempre' }]);
    expect(respostasDaGrade(p, null).map((x) => x.resposta)).toEqual(['—', '—']);
    expect(respostasDaGrade(p, { l1: 'outra' })[0].resposta).toBe('—');
  });

  it('grade obrigatória só conta no progresso com todas as linhas', () => {
    const m: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'S', perguntas: [{ id: 'g', tipo: 'GRADE', rotulo: 'G', obrigatoria: true,
      linhas: [{ id: 'a', rotulo: 'A' }, { id: 'b', rotulo: 'B' }], colunas: [{ id: 'x', rotulo: 'X' }] }] }] };
    expect(progressoDasSecoes(m, { g: { a: 'x' } })).toEqual([{ respondidas: 0, total: 1 }]);
    expect(progressoDasSecoes(m, { g: { a: 'x', b: 'x' } })).toEqual([{ respondidas: 1, total: 1 }]);
  });

  it('N16: resposta fora do formato (data inválida, texto onde cabe número) não entra em "N de M respondidas"', () => {
    const m: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'S', perguntas: [
      { id: 'nasc', tipo: 'DATA', rotulo: 'Nascimento', obrigatoria: true, somentePassado: true },
      { id: 'tel', tipo: 'TELEFONE', rotulo: 'Telefone', obrigatoria: false },
      { id: 'nome', tipo: 'TEXTO', rotulo: 'Nome', obrigatoria: false },
    ] }] };
    expect(progressoDasSecoes(m, { nasc: '31/02/1990', tel: '12', nome: 'Ana' })).toEqual([{ respondidas: 1, total: 3 }]);
    expect(progressoDasSecoes(m, { nasc: '1990-02-10', tel: '(45) 99999-8888', nome: 'Ana' })).toEqual([{ respondidas: 3, total: 3 }]);
  });

  it('opções com imagem: 2 por linha no celular, 3 ou 4 no PC', () => {
    expect(colunasDasOpcoes(326)).toBe(2);
    expect(colunasDasOpcoes(640)).toBe(3);
    expect(colunasDasOpcoes(960)).toBe(4);
  });
});

describe('leitura das respostas (bloco B)', () => {
  const P = (id: string, tipo: PerguntaAtualizacao['tipo'], extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao =>
    ({ id, tipo, rotulo: id, obrigatoria: false, ...extra });
  it('nota: "4/10" sem escala em 0 a 10; a escala aparece nas outras; o texto falado mantém a escala', () => {
    expect(respostaLida(P('n', 'NOTA'), 4)).toEqual({ forma: 'nota', nota: '4/10', escala: null, texto: '4 de 0 a 10' });
    expect(respostaLida(P('n', 'NOTA'), 0)).toMatchObject({ nota: '0/10', escala: null });
    expect(respostaLida(P('n', 'NOTA', { min: 1, max: 10 }), 7)).toMatchObject({ nota: '7/10', escala: 'Escala de 1 a 10' });
    expect(respostaLida(P('n', 'NOTA', { min: 1, max: 5 }), 3)).toMatchObject({ nota: '3/5', escala: 'Escala de 1 a 5' });
    expect(respostaLida(P('n', 'NOTA'), null)).toEqual({ forma: 'vazia' });
  });
  it('sem resposta é vazia; false e 0 são respostas; opção que não existe é vazia', () => {
    expect(respostaLida(P('s', 'SIM_NAO'), false)).toEqual({ forma: 'simNao', texto: 'Não' });
    expect(respostaLida(P('s', 'SIM_NAO'), true)).toEqual({ forma: 'simNao', texto: 'Sim' });
    expect(respostaLida(P('s', 'SIM_NAO'), undefined)).toEqual({ forma: 'vazia' });
    expect(respostaLida(P('t', 'TEXTO'), '  ')).toEqual({ forma: 'vazia' });
    expect(respostaLida(P('x', 'NUMERO', { unidade: 'mil', casas: 1 }), 0)).toEqual({ forma: 'texto', texto: '0 mil', numerico: true });
    expect(respostaLida(P('e', 'ESCOLHA_UNICA', { opcoes }), 'removida')).toEqual({ forma: 'vazia' });
    expect(respostaLida(P('e', 'MULTIPLA_ESCOLHA', { opcoes }), ['c', 'a'])).toEqual({ forma: 'texto', texto: 'Ruim, Ótimo' });
    expect(respostaLida(P('l', 'TEXTO_LONGO'), 'Linha 1\nLinha 2')).toEqual({ forma: 'texto', texto: 'Linha 1\nLinha 2', numerico: false });
    expect(respostaLida(P('end', 'ENDERECO'), { cep: '', logradouro: '' })).toEqual({ forma: 'vazia' });
  });
  it('notas por dia: uma célula por dia, "—" no dia sem nota', () => {
    const r = respostaLida(P('d', 'NOTAS_POR_DIA', { dias: [1, 2, 3] }), { '1': 8, '2': null, '3': 0 });
    expect(r).toEqual({ forma: 'notasPorDia', dias: [{ dia: 1, nota: '8' }, { dia: 2, nota: '—' }, { dia: 3, nota: '0' }],
      texto: 'Dia 1: 8, Dia 2: —, Dia 3: 0 (notas de 0 a 10)' });
  });
  it('grade, opções com imagem, fotos, informativo, data automática e tipo desconhecido', () => {
    const g = P('g', 'GRADE', { linhas: [{ id: 'l1', rotulo: 'Item A' }, { id: 'l2', rotulo: 'Item B' }], colunas: [{ id: 'c1', rotulo: 'Sempre' }] });
    expect(respostaLida(g, { l1: 'c1' })).toEqual({ forma: 'grade', linhas: [{ id: 'l1', linha: 'Item A', resposta: 'Sempre' }, { id: 'l2', linha: 'Item B', resposta: '—' }], texto: 'Item A: Sempre; Item B: —' });
    const comImagem = P('i', 'ESCOLHA_UNICA', { opcoes: [{ id: 'a', rotulo: 'Leg press', imagemId: 'img-1' }, { id: 'b', rotulo: 'Hack' }] });
    expect(temImagemNasOpcoes(comImagem)).toBe(true);
    expect(respostaLida(comImagem, 'a')).toEqual({ forma: 'opcoesComImagem', texto: 'Leg press' });
    expect(respostaLida(P('f', 'FOTOS'), null)).toEqual({ forma: 'fotos' });
    expect(respostaLida(P('info', 'INFORMATIVO'), undefined)).toEqual({ forma: 'informativo' });
    expect(respostaLida(P('dt', 'DATA_AUTOMATICA'), undefined, '2026-10-20')).toEqual({ forma: 'texto', texto: '20/10/2026', numerico: true });
    expect(respostaLida(P('dt', 'DATA_AUTOMATICA'), undefined, null)).toEqual({ forma: 'texto', texto: '—', numerico: true });
    expect(respostaLida(P('z', 'TIPO_DO_FUTURO' as PerguntaAtualizacao['tipo']), 'x')).toEqual({ forma: 'desconhecida' });
  });
  it('arranjo da lista na leitura: limite de 760 de cartão menos os recuos, pergunta em 40% até 320, 12 até o fio', () => {
    expect(arranjoDaLeitura(20)).toEqual({ empilharAbaixoDe: 720, rotulo: { fracao: 0.4, maximo: 320 }, respiro: 12, entre: 4 });
    expect(arranjoDaLeitura(16).empilharAbaixoDe).toBe(728);
    expect(notasPorDiaEmTabela(6)).toBe(false);
    expect(notasPorDiaEmTabela(7)).toBe(true);
  });
  it('"N perguntas": data automática e informativo não contam', () => {
    expect(textoDasPerguntas([P('a', 'DATA_AUTOMATICA'), P('b', 'INFORMATIVO'), P('c', 'NOTA')])).toBe('1 pergunta');
    expect(textoDasPerguntas([P('c', 'NOTA'), P('d', 'TEXTO')])).toBe('2 perguntas');
    expect(textoDasPerguntas([])).toBe('0 perguntas');
  });
  it('plural da média de treinos pelo número mostrado ("0 dia" saiu)', () => {
    expect(diasNaSemana(0)).toBe('0 dias');
    expect(diasNaSemana(0.96)).toBe('1 dia');
    expect(diasNaSemana(1.5)).toBe('1,5 dia');
    expect(diasNaSemana(1.96)).toBe('2 dias');
    expect(diasNaSemana(4)).toBe('4 dias');
    expect(fraseDaMediaDeTreino(0, false)).toBe('Pelo app, você treinou em média 0 dias por semana neste período.');
    expect(fraseDaMediaDeTreino(2.5, true)).toBe('Pelo app: média de 2,5 dias de treino por semana no período.');
  });

  it('linha da média de treinos vem do resumo, sem depender de pergunta marcada', () => {
    expect(linhaDaMediaDeTreino(null)).toBeNull();
    expect(linhaDaMediaDeTreino(undefined)).toBeNull();
    expect(linhaDaMediaDeTreino({ mediaDiasPorSemana: null })).toBeNull();
    expect(linhaDaMediaDeTreino({ mediaDiasPorSemana: 0 })).toBe('Pelo app: média de 0 dias de treino por semana no período.');
    expect(linhaDaMediaDeTreino({ mediaDiasPorSemana: 1.5 })).toBe('Pelo app: média de 1,5 dia de treino por semana no período.');
  });
});

describe('ITENS_DO_PLANO na leitura', () => {
  const pergunta: PerguntaAtualizacao = { id: 'i', tipo: 'ITENS_DO_PLANO', rotulo: 'Quais?', obrigatoria: false, fonte: 'ALIMENTOS_DA_DIETA', motivo: 'OPCIONAL' };
  const gravada = respostaDeItens([{ id: 'a', nome: 'Frango grelhado', motivo: 'enjoei' }, { id: 'b', nome: 'Arroz' }]);
  const texto = 'Frango grelhado — enjoei\nArroz';

  it('uma linha por item, "Nome — motivo", com o nome gravado pelo servidor', () => {
    expect(textoDaResposta(pergunta, gravada)).toBe(texto);
    expect(respostaLida(pergunta, gravada)).toEqual({ forma: 'texto', texto, numerico: false });
  });

  it('sem resposta, ou só com ids do rascunho (sem nome), é "Não respondeu"', () => {
    expect(respostaLida(pergunta, undefined)).toEqual({ forma: 'vazia' });
    expect(respostaLida(pergunta, respostaDeItens([]))).toEqual({ forma: 'vazia' });
    expect(respostaLida(pergunta, respostaDeItens([{ id: 'a' }]))).toEqual({ forma: 'vazia' });
    expect(textoDaResposta(pergunta, respostaDeItens([{ id: 'a' }]))).toBe('—');
  });

  it('o progresso conta a escolha só quando a lista do aparelho a aceita', () => {
    const m: ConteudoQuestionario = { instrucoes: [], secoes: [{ titulo: 'F', perguntas: [pergunta] }] };
    const escolha = { i: respostaDeItens([{ id: 'a' }]) };
    expect(progressoDasSecoes(m, escolha)).toEqual([{ respondidas: 0, total: 1 }]);
    expect(progressoDasSecoes(m, escolha, false, { ALIMENTOS_DA_DIETA: [{ id: 'a', nome: 'Frango' }] })).toEqual([{ respondidas: 1, total: 1 }]);
  });
});
