import type { Atualizacao, ConteudoQuestionario, FatoDeAtencao, TipoPergunta } from '../api/tipos';
import { mudancasDaAtualizacao } from './mudancasDaAtualizacao';
import { respostaDeItens } from './respostasAtualizacao';
import { CHAVE_DIAS_COM_TREINO, outrasMudancas, pontosDeAtencao, textoDosPontos } from './pontosDeAtencao';

const modelo: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [{ uid: 's', titulo: 'Fictícia', perguntas: [
    { id: 'p-peso', tipo: 'PESO', rotulo: 'Peso em jejum', obrigatoria: true },
    { id: 'sono', tipo: 'NOTA', rotulo: 'Como foi o sono', rotuloCurto: 'Sono', obrigatoria: false },
    { id: 'dor', tipo: 'SIM_NAO', rotulo: 'Sentiu dores', obrigatoria: false },
    { id: 'humor', tipo: 'NOTA', rotulo: 'Humor', obrigatoria: false },
    { id: 'trocar', tipo: 'ITENS_DO_PLANO' as TipoPergunta, rotulo: 'Quer trocar', obrigatoria: false },
  ] }],
};

type Base = Pick<Atualizacao, 'id' | 'dataAtualizacao' | 'enviadaEm' | 'fase' | 'modelo' | 'respostas' | 'resumo' | 'atencao'>;
const base = (id: string, data: string, respostas: Atualizacao['respostas'], extra: Partial<Base> = {}): Base => ({
  id, dataAtualizacao: data, enviadaEm: `${data}T12:00:00Z`, fase: 'ENVIADA', modelo, respostas,
  resumo: { diasComTreino: 2, mediaDiasPorSemana: 1, pesoAnterior: null }, ...extra,
});
const fato = (tipo: FatoDeAtencao['tipo'], perguntaId: string | null, limiteVigente: number | null, valorObservado: number | null = null): FatoDeAtencao =>
  ({ tipo, perguntaId, limiteVigente, valorObservado });

const respostasAtuais: Atualizacao['respostas'] = {
  'p-peso': 72.5, sono: 4, dor: true, humor: 6,
  trocar: respostaDeItens([{ id: 'i1', nome: 'Batata-doce' }, { id: 'i2', nome: 'Arroz branco' }]),
};
const TODOS: FatoDeAtencao[] = [
  fato('PESO_MUDOU', 'p-peso', 2, 2.5),
  fato('POUCOS_TREINOS', null, 3, 2),
  fato('ITEM_MARCADO', 'trocar', null),
  fato('NOTA_CAIU', 'sono', 2, -3),
  fato('SIM', 'dor', null),
  fato('NOTA_ABAIXO', 'sono', 5, 4),
];

describe('textoDosPontos', () => {
  test('singular, plural e nada com 0, nulo ou ausente', () => {
    expect(textoDosPontos(1)).toBe('1 ponto de atenção');
    expect(textoDosPontos(3)).toBe('3 pontos de atenção');
    expect(textoDosPontos(0)).toBeNull();
    expect(textoDosPontos(null)).toBeNull();
    expect(textoDosPontos(undefined)).toBeNull();
  });
});

describe('pontosDeAtencao', () => {
  test('sem fatos, nada', () => {
    expect(pontosDeAtencao(base('c', '2026-11-20', respostasAtuais), null)).toEqual([]);
    expect(pontosDeAtencao(base('c', '2026-11-20', respostasAtuais, { atencao: null }), null)).toEqual([]);
  });

  test('os seis tipos sem histórico: ordem do questionário, dias com treino e peso no fim; fatos da mesma pergunta numa linha', () => {
    const atual = base('c', '2026-11-20', respostasAtuais, { atencao: TODOS });
    expect(pontosDeAtencao(atual, null)).toEqual([
      { chave: 'sono', id: 'sono', rotulo: 'Sono', valor: '4', mudanca: null,
        legendas: ['Sua regra: Sono 5 ou menos', 'Sua regra: nota caiu 2 pontos ou mais'] },
      { chave: 'dor', id: 'dor', rotulo: 'Sentiu dores', valor: 'Sim', mudanca: null, legendas: ['Sua regra: resposta Sim em Sentiu dores'] },
      { chave: 'trocar', id: 'trocar', rotulo: 'Quer trocar', valor: 'Batata-doce, Arroz branco', mudanca: null,
        legendas: ['Sua regra: item marcado em Quer trocar'] },
      { chave: CHAVE_DIAS_COM_TREINO, id: CHAVE_DIAS_COM_TREINO, rotulo: 'Dias com treino registrado', valor: '2', mudanca: null,
        legendas: ['Sua regra: 3 dias com treino ou menos, contados no envio'] },
      { chave: 'p-peso', id: 'p-peso', rotulo: 'Peso em jejum', valor: '72,5 kg', mudanca: null, legendas: ['Sua regra: peso mudou 2 kg ou mais'] },
    ]);
  });

  test('com o histórico: casa o fato com a linha do "O que mudou" pela chave real (id da pergunta, PESO inclusive, e dias-com-treino)', () => {
    const anterior = base('b', '2026-10-20', { 'p-peso': 70, sono: 7, dor: true, humor: 6 }, { resumo: { diasComTreino: 5, mediaDiasPorSemana: 2, pesoAnterior: null } });
    const atual = base('c', '2026-11-20', respostasAtuais, { atencao: TODOS });
    const mudancas = mudancasDaAtualizacao(atual, anterior);
    const pontos = pontosDeAtencao(atual, mudancas);
    const porChave = Object.fromEntries(pontos.map((p) => [p.id, p.mudanca]));
    expect(porChave.sono).toEqual({ chave: 'sono', rotulo: 'Sono', anterior: '7', atual: '4' });
    expect(porChave['p-peso']).toEqual({ chave: 'p-peso', rotulo: 'Peso em jejum', anterior: '70,0 kg', atual: '72,5 kg' });
    expect(porChave[CHAVE_DIAS_COM_TREINO]).toEqual({ chave: CHAVE_DIAS_COM_TREINO, rotulo: 'Dias com treino registrado', anterior: '5', atual: '2' });
    // Sim repetido e item marcado não têm linha.
    expect(porChave.dor).toBeNull();
    expect(porChave.trocar).toBeNull();
  });

  test('fato sem linha: valor igual ao anterior e primeira atualização', () => {
    const atual = base('c', '2026-11-20', { sono: 4 }, { atencao: [fato('NOTA_ABAIXO', 'sono', 5, 4)] });
    const igual = base('b', '2026-10-20', { sono: 4 });
    expect(pontosDeAtencao(atual, mudancasDaAtualizacao(atual, igual))[0].mudanca).toBeNull();
    expect(pontosDeAtencao(atual, { tipo: 'primeira' })[0]).toMatchObject({ chave: 'sono', valor: '4', mudanca: null });
  });

  test('peso sem pergunta: linha "Peso" só com a legenda, no fim', () => {
    const atual = base('c', '2026-11-20', { sono: 4 }, { atencao: [fato('PESO_MUDOU', null, 2, -2.4), fato('NOTA_ABAIXO', 'sono', 5, 4)] });
    const pontos = pontosDeAtencao(atual, null);
    expect(pontos.map((p) => p.id)).toEqual(['sono', '#PESO_MUDOU']);
    expect(pontos[1]).toEqual({ chave: null, id: '#PESO_MUDOU', rotulo: 'Peso', valor: null, mudanca: null, legendas: ['Sua regra: peso mudou 2 kg ou mais'] });
  });

  test('chave desconhecida: pergunta fora desta versão vai depois das do questionário, sem linha', () => {
    const atual = base('c', '2026-11-20', { sono: 4 }, {
      atencao: [fato('POUCOS_TREINOS', null, 3, 2), fato('SIM', 'sumiu', null), fato('NOTA_ABAIXO', 'sono', 5, 4)],
    });
    const anterior = base('b', '2026-10-20', { sono: 7 });
    const pontos = pontosDeAtencao(atual, mudancasDaAtualizacao(atual, anterior));
    expect(pontos.map((p) => p.id)).toEqual(['sono', 'sumiu', CHAVE_DIAS_COM_TREINO]);
    expect(pontos[1]).toEqual({ chave: 'sumiu', id: 'sumiu', rotulo: 'Pergunta', valor: 'Sim', mudanca: null, legendas: ['Sua regra: resposta Sim em Pergunta'] });
  });

  test('tipo que o app não conhece fica fora, sem quebrar', () => {
    const atual = base('c', '2026-11-20', {}, { atencao: [fato('NOVO' as FatoDeAtencao['tipo'], 'sono', 1), fato('SIM', 'dor', null)] });
    expect(pontosDeAtencao(atual, null).map((p) => p.id)).toEqual(['dor']);
  });

  test('valores: rótulo da versão da própria atualização; sem resposta, o observado só na nota até e nos dias', () => {
    const semResposta = base('c', '2026-11-20', {}, { resumo: null, atencao: [
      fato('NOTA_ABAIXO', 'sono', 5, 3), fato('NOTA_CAIU', 'humor', 2, -4), fato('POUCOS_TREINOS', null, 3, 1),
      fato('ITEM_MARCADO', 'trocar', null), fato('PESO_MUDOU', 'p-peso', 2, 3),
    ] });
    expect(pontosDeAtencao(semResposta, null).map((p) => [p.id, p.valor])).toEqual([
      ['sono', '3'], ['humor', null], ['trocar', null], [CHAVE_DIAS_COM_TREINO, '1'], ['p-peso', null],
    ]);
    const outraVersao = base('c', '2026-11-20', { sono: 4 }, {
      modelo: { instrucoes: [], secoes: [{ titulo: 'x', perguntas: [{ id: 'sono', tipo: 'NOTA', rotulo: 'Qualidade do sono', obrigatoria: false }] }] },
      atencao: [fato('NOTA_ABAIXO', 'sono', 5, 4)],
    });
    expect(pontosDeAtencao(outraVersao, null)[0].legendas).toEqual(['Sua regra: Qualidade do sono 5 ou menos']);
  });

  test('itens marcados: o nome da resposta; sem ele, o da API', () => {
    const daApi = base('c', '2026-11-20', { trocar: respostaDeItens([{ id: 'i1' }]) }, {
      atencao: [{ ...fato('ITEM_MARCADO', 'trocar', null), itensMarcados: [' Ovo ', ''] }],
    });
    expect(pontosDeAtencao(daApi, null)[0].valor).toBe('Ovo');
  });

  test('o limite é o gravado no envio, não o da regra de hoje', () => {
    const atual = base('c', '2026-11-20', { sono: 6 }, { atencao: [fato('NOTA_ABAIXO', 'sono', 6, 6)] });
    expect(pontosDeAtencao(atual, null)[0].legendas).toEqual(['Sua regra: Sono 6 ou menos']);
  });
});

describe('outrasMudancas', () => {
  test('tira as linhas que os pontos já mostram e mantém o resto na ordem', () => {
    const anterior = base('b', '2026-10-20', { 'p-peso': 70, sono: 7, humor: 8 });
    const atual = base('c', '2026-11-20', { 'p-peso': 72.5, sono: 4, humor: 6 }, { atencao: [fato('NOTA_ABAIXO', 'sono', 5, 4), fato('PESO_MUDOU', null, 2, 2.5)] });
    const mudancas = mudancasDaAtualizacao(atual, anterior);
    if (mudancas.tipo !== 'comparada') throw new Error('esperava comparada');
    const pontos = pontosDeAtencao(atual, mudancas);
    // O peso sem pergunta não ocupa a linha do peso: ela continua nas outras mudanças.
    expect(outrasMudancas(mudancas.mudancas, pontos).map((m) => m.chave)).toEqual(['p-peso', 'humor']);
  });
});
