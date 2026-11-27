import type { PerguntaDaRegra, RegraDeAtencao } from '../api/tipos';
import {
  alternarModelo, corpoDoLote, ehTipoDeRegra, errosDasRegras, errosDoLoteDaApi, juntarPerguntas, legendaDaRegra, MODELOS_DE_REGRA, modeloLigado,
  motivoDoTeto, novaRegra, perguntaDaRegra, perguntaFora, perguntasDoModelo, rascunhoDasRegras, rascunhoMudou, regrasDoModelo,
  resumoDasRegras, rotuloDaPergunta, temErros, textoDaLeitura, textoDaRegra, textoDosQuestionarios, TIPOS_DE_REGRA,
  vaiNoLote, type RegraEmEdicao,
} from './regrasDeAtencao';

const PADRAO = { id: 'q1', nome: 'Padrão da consultoria' };
const OUTRO = { id: 'q2', nome: 'Hipertrofia fictícia' };
const sono: PerguntaDaRegra = { perguntaId: 'sono', tipo: 'NOTA', rotulo: 'Sono', escala: { min: 1, max: 10 }, questionarios: [PADRAO] };
const humor: PerguntaDaRegra = { perguntaId: 'humor', tipo: 'NOTA', rotulo: 'Humor', escala: null, questionarios: [PADRAO] };
const dor: PerguntaDaRegra = { perguntaId: 'dor', tipo: 'SIM_NAO', rotulo: 'Sentiu dores', escala: null, questionarios: [PADRAO] };
const trocar: PerguntaDaRegra = { perguntaId: 'trocar', tipo: 'ITENS_DO_PLANO', rotulo: 'Quer trocar', escala: null, questionarios: [OUTRO] };
const PERGUNTAS = [sono, humor, dor, trocar];

const regra = (extra: Partial<RegraEmEdicao> & Pick<RegraEmEdicao, 'tipo'>): RegraEmEdicao =>
  ({ chave: extra.id ?? `nova-${extra.tipo}`, id: null, perguntaId: null, limite: '', ativa: true, ...extra });

describe('modelos', () => {
  test('seis modelos, na ordem do plano, cada um com título, descrição e o que pede', () => {
    expect(TIPOS_DE_REGRA).toEqual(['NOTA_ABAIXO', 'NOTA_CAIU', 'SIM', 'PESO_MUDOU', 'POUCOS_TREINOS', 'ITEM_MARCADO']);
    for (const t of TIPOS_DE_REGRA) {
      const m = MODELOS_DE_REGRA[t];
      expect(m.tipo).toBe(t);
      expect(m.titulo).toBeTruthy();
      expect(m.descricao).toBeTruthy();
      expect(m.pergunta === null).toBe(m.semPergunta === null);
    }
    expect(Object.fromEntries(TIPOS_DE_REGRA.map((t) => [t, [MODELOS_DE_REGRA[t].pergunta, MODELOS_DE_REGRA[t].campo !== null]]))).toEqual({
      NOTA_ABAIXO: ['NOTA', true], NOTA_CAIU: [null, true], SIM: ['SIM_NAO', false],
      PESO_MUDOU: [null, true], POUCOS_TREINOS: [null, true], ITEM_MARCADO: ['ITENS_DO_PLANO', false],
    });
    expect(MODELOS_DE_REGRA.SIM.semPergunta).toBe('Nenhum questionário de atualização publicado tem pergunta de Sim ou Não.');
  });

  test('os textos usam o operador inclusivo: nada de "abaixo de", "mais de" ou "menos de"', () => {
    const textos = TIPOS_DE_REGRA.flatMap((t) => [MODELOS_DE_REGRA[t].titulo, MODELOS_DE_REGRA[t].descricao, MODELOS_DE_REGRA[t].campo ?? '']);
    for (const t of textos) expect(t).not.toMatch(/abaixo de\b|mais de\b|menos de\b|\bMais de|\bMenos de/);
  });

  test('tipo conhecido e desconhecido', () => {
    expect(ehTipoDeRegra('SIM')).toBe(true);
    expect(ehTipoDeRegra('OUTRO')).toBe(false);
    expect(ehTipoDeRegra(null)).toBe(false);
  });
});

describe('texto e legenda da regra (operador inclusivo, em palavras)', () => {
  test('cada tipo, com o plural', () => {
    expect(textoDaRegra('NOTA_ABAIXO', 5, 'Sono')).toBe('Sono 5 ou menos');
    expect(textoDaRegra('NOTA_CAIU', 2)).toBe('nota caiu 2 pontos ou mais');
    expect(textoDaRegra('NOTA_CAIU', 1)).toBe('nota caiu 1 ponto ou mais');
    expect(textoDaRegra('SIM', null, 'Sentiu dores')).toBe('resposta Sim em Sentiu dores');
    expect(textoDaRegra('PESO_MUDOU', 2)).toBe('peso mudou 2 kg ou mais');
    expect(textoDaRegra('PESO_MUDOU', 1.5)).toBe('peso mudou 1,5 kg ou mais');
    expect(textoDaRegra('POUCOS_TREINOS', 3)).toBe('3 dias com treino ou menos');
    expect(textoDaRegra('POUCOS_TREINOS', 1)).toBe('1 dia com treino ou menos');
    expect(textoDaRegra('ITEM_MARCADO', null, 'Quer trocar')).toBe('item marcado em Quer trocar');
  });

  test('sem rótulo, "Pergunta"; sem número, "—" (nunca um número inventado)', () => {
    expect(textoDaRegra('NOTA_ABAIXO', 5, '  ')).toBe('Pergunta 5 ou menos');
    expect(textoDaRegra('NOTA_ABAIXO', null, 'Sono')).toBe('Sono — ou menos');
  });

  test('legenda: "Sua regra:" com o limite gravado; dias com treino dizem que a conta foi no envio', () => {
    expect(legendaDaRegra('NOTA_ABAIXO', 5, 'Sono')).toBe('Sua regra: Sono 5 ou menos');
    expect(legendaDaRegra('NOTA_CAIU', 2, 'Sono')).toBe('Sua regra: nota caiu 2 pontos ou mais');
    expect(legendaDaRegra('PESO_MUDOU', 2, 'Peso')).toBe('Sua regra: peso mudou 2 kg ou mais');
    expect(legendaDaRegra('POUCOS_TREINOS', 3)).toBe('Sua regra: 3 dias com treino ou menos, contados no envio');
    expect(legendaDaRegra('SIM', null, 'Sentiu dores')).toBe('Sua regra: resposta Sim em Sentiu dores');
  });

  test('rótulo da pergunta: o curto, o completo ou "Pergunta"', () => {
    expect(rotuloDaPergunta({ rotulo: 'Como foi o sono', rotuloCurto: ' Sono ' })).toBe('Sono');
    expect(rotuloDaPergunta({ rotulo: 'Como foi o sono' })).toBe('Como foi o sono');
    expect(rotuloDaPergunta({ rotulo: ' ', rotuloCurto: '' })).toBe('Pergunta');
  });
});

describe('perguntas', () => {
  test('junta o mesmo id e tipo de vários questionários, sem repetir; rótulo e escala da primeira', () => {
    const copia: PerguntaDaRegra = { ...sono, rotulo: 'Sono (cópia)', escala: { min: 0, max: 5 }, questionarios: [OUTRO, PADRAO] };
    const juntas = juntarPerguntas([sono, dor, copia]);
    expect(juntas).toEqual([{ ...sono, questionarios: [PADRAO, OUTRO] }, dor]);
    // Não mexe na entrada.
    expect(sono.questionarios).toEqual([PADRAO]);
  });

  test('o mesmo id com outro tipo são duas perguntas', () => {
    const outroTipo: PerguntaDaRegra = { ...dor, perguntaId: 'sono', questionarios: [OUTRO] };
    expect(juntarPerguntas([sono, outroTipo])).toHaveLength(2);
    expect(perguntasDoModelo('NOTA_ABAIXO', [sono, outroTipo])).toEqual([sono]);
    expect(perguntasDoModelo('SIM', [sono, outroTipo])).toEqual([outroTipo]);
  });

  test('perguntas por modelo; os modelos sem pergunta não têm', () => {
    expect(perguntasDoModelo('NOTA_ABAIXO', PERGUNTAS).map((p) => p.perguntaId)).toEqual(['sono', 'humor']);
    expect(perguntasDoModelo('SIM', PERGUNTAS).map((p) => p.perguntaId)).toEqual(['dor']);
    expect(perguntasDoModelo('ITEM_MARCADO', PERGUNTAS).map((p) => p.perguntaId)).toEqual(['trocar']);
    expect(perguntasDoModelo('NOTA_CAIU', PERGUNTAS)).toEqual([]);
  });

  test('pergunta da regra e "fora dos questionários" por id e tipo', () => {
    expect(perguntaDaRegra('NOTA_ABAIXO', 'sono', PERGUNTAS)).toEqual(sono);
    expect(perguntaDaRegra('NOTA_ABAIXO', 'dor', PERGUNTAS)).toBeNull();
    expect(perguntaDaRegra('NOTA_ABAIXO', null, PERGUNTAS)).toBeNull();
    expect(perguntaFora({ tipo: 'NOTA_ABAIXO', perguntaId: 'sumiu' }, PERGUNTAS)).toBe(true);
    // Mudou de tipo: o id existe, mas como Sim/Não.
    expect(perguntaFora({ tipo: 'NOTA_ABAIXO', perguntaId: 'dor' }, PERGUNTAS)).toBe(true);
    expect(perguntaFora({ tipo: 'NOTA_ABAIXO', perguntaId: 'sono' }, PERGUNTAS)).toBe(false);
    // Sem pergunta escolhida não é "fora" (é o erro "Escolha a pergunta."); modelo sem pergunta, nunca.
    expect(perguntaFora({ tipo: 'SIM', perguntaId: null }, PERGUNTAS)).toBe(false);
    expect(perguntaFora({ tipo: 'NOTA_CAIU', perguntaId: 'sumiu' }, [])).toBe(false);
  });

  test('texto dos questionários', () => {
    expect(textoDosQuestionarios(sono)).toBe('Questionário: Padrão da consultoria');
    expect(textoDosQuestionarios({ questionarios: [PADRAO, OUTRO] })).toBe('Questionários: Padrão da consultoria, Hipertrofia fictícia');
    expect(textoDosQuestionarios({ questionarios: [] })).toBe('');
  });
});

describe('rascunho', () => {
  const gravadas: RegraDeAtencao[] = [
    { id: 'r3', tipo: 'PESO_MUDOU', perguntaId: null, limite: 1.5, ativa: false },
    { id: 'r1', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 5, ativa: true },
    { id: 'rx', tipo: 'NOVO' as RegraDeAtencao['tipo'], perguntaId: null, limite: null, ativa: true },
    { id: 'r2', tipo: 'NOTA_ABAIXO', perguntaId: 'humor', limite: 3, ativa: true },
  ];

  test('do gravado: ordem dos modelos, número em texto com vírgula, tipo desconhecido fora', () => {
    expect(rascunhoDasRegras(gravadas)).toEqual([
      { chave: 'r1', id: 'r1', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '5', ativa: true },
      { chave: 'r2', id: 'r2', tipo: 'NOTA_ABAIXO', perguntaId: 'humor', limite: '3', ativa: true },
      { chave: 'r3', id: 'r3', tipo: 'PESO_MUDOU', perguntaId: null, limite: '1,5', ativa: false },
    ]);
  });

  test('regra nova nasce ligada, sem pergunta e com o número vazio (nunca sugerido)', () => {
    for (const t of TIPOS_DE_REGRA) expect(novaRegra(t, 'k')).toEqual({ chave: 'k', id: null, tipo: t, perguntaId: null, limite: '', ativa: true });
  });

  test('por modelo, ligado e resumo da faixa', () => {
    const r = rascunhoDasRegras(gravadas);
    expect(regrasDoModelo(r, 'NOTA_ABAIXO').map((x) => x.id)).toEqual(['r1', 'r2']);
    expect(modeloLigado(r, 'NOTA_ABAIXO')).toBe(true);
    expect(modeloLigado(r, 'PESO_MUDOU')).toBe(false);
    expect(resumoDasRegras([])).toBe('Nenhuma regra ligada');
    expect(resumoDasRegras(r)).toBe('1 de 6 ligada');
    expect(resumoDasRegras([...r, regra({ tipo: 'SIM', perguntaId: 'dor' })])).toBe('2 de 6 ligadas');
  });

  test('interruptor do modelo: religa a gravada com o número dela, sem criar outra; cria vazia só sem nenhuma', () => {
    const r = rascunhoDasRegras(gravadas);
    const ligado = alternarModelo(r, 'PESO_MUDOU', true, 'nova');
    expect(regrasDoModelo(ligado, 'PESO_MUDOU')).toEqual([{ chave: 'r3', id: 'r3', tipo: 'PESO_MUDOU', perguntaId: null, limite: '1,5', ativa: true }]);
    expect(alternarModelo(ligado, 'PESO_MUDOU', false, 'outra')).toEqual(r);
    expect(rascunhoMudou(alternarModelo(ligado, 'PESO_MUDOU', false, 'outra'), gravadas)).toBe(false);
    expect(regrasDoModelo(alternarModelo(r, 'NOTA_CAIU', true, 'nova'), 'NOTA_CAIU')).toEqual([novaRegra('NOTA_CAIU', 'nova')]);
    // Desligar e religar uma nova não cria outra linha.
    const vaiEVolta = alternarModelo(alternarModelo(alternarModelo(r, 'NOTA_CAIU', true, 'a'), 'NOTA_CAIU', false, 'b'), 'NOTA_CAIU', true, 'c');
    expect(regrasDoModelo(vaiEVolta, 'NOTA_CAIU').map((x) => x.chave)).toEqual(['a']);
    // Com pergunta: desliga e religa todas as linhas do modelo.
    const notas = alternarModelo(r, 'NOTA_ABAIXO', false, 'x');
    expect(regrasDoModelo(notas, 'NOTA_ABAIXO').map((x) => x.ativa)).toEqual([false, false]);
    expect(regrasDoModelo(alternarModelo(notas, 'NOTA_ABAIXO', true, 'x'), 'NOTA_ABAIXO').map((x) => [x.chave, x.ativa])).toEqual([['r1', true], ['r2', true]]);
  });

  test('teto: toda linha conta', () => {
    const r = rascunhoDasRegras(gravadas);
    expect(motivoDoTeto(r, 4)).toBeNull();
    expect(motivoDoTeto(r, 3)).toBe('Limite de 3 regras de atenção.');
  });

  test('leitura sem permissão', () => {
    expect(textoDaLeitura(regra({ tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '5' }), PERGUNTAS)).toBe('Ligada: Sono 5 ou menos');
    expect(textoDaLeitura(regra({ tipo: 'POUCOS_TREINOS', limite: '3' }), PERGUNTAS)).toBe('Ligada: 3 dias com treino ou menos');
    expect(textoDaLeitura(regra({ tipo: 'SIM', perguntaId: 'sumiu' }), PERGUNTAS)).toBe('Ligada: resposta Sim em Pergunta');
    expect(textoDaLeitura(regra({ tipo: 'PESO_MUDOU', limite: '2', ativa: false }), PERGUNTAS)).toBe('Desligada');
  });

  test('mudou: editar, desligar a gravada ou ligar uma nova muda; ligar e desligar uma nova, não', () => {
    const r = rascunhoDasRegras(gravadas);
    expect(rascunhoMudou(r, gravadas)).toBe(false);
    expect(rascunhoMudou(r.map((x) => (x.id === 'r1' ? { ...x, limite: '4' } : x)), gravadas)).toBe(true);
    expect(rascunhoMudou(r.map((x) => (x.id === 'r1' ? { ...x, ativa: false } : x)), gravadas)).toBe(true);
    expect(rascunhoMudou(r.filter((x) => x.id !== 'r2'), gravadas)).toBe(true);
    expect(rascunhoMudou([...r, novaRegra('SIM', 'n')], gravadas)).toBe(true);
    expect(rascunhoMudou([...r, { ...novaRegra('SIM', 'n'), ativa: false, perguntaId: 'dor' }], gravadas)).toBe(false);
  });
});

describe('validação', () => {
  const erroDe = (r: RegraEmEdicao, perguntas = PERGUNTAS) => errosDasRegras([r], perguntas)[r.chave] ?? {};

  test('pergunta obrigatória nos modelos com pergunta; nos outros, não', () => {
    expect(erroDe(regra({ tipo: 'SIM' }))).toEqual({ perguntaId: 'Escolha a pergunta.' });
    expect(erroDe(regra({ tipo: 'ITEM_MARCADO' }))).toEqual({ perguntaId: 'Escolha a pergunta.' });
    expect(erroDe(regra({ tipo: 'NOTA_ABAIXO' }))).toEqual({ perguntaId: 'Escolha a pergunta.', limite: 'Digite o número da regra.' });
    expect(erroDe(regra({ tipo: 'SIM', perguntaId: 'dor' }))).toEqual({});
    expect(erroDe(regra({ tipo: 'NOTA_CAIU', limite: '2' }))).toEqual({});
  });

  test('número obrigatório nos modelos com número', () => {
    for (const tipo of ['NOTA_CAIU', 'PESO_MUDOU', 'POUCOS_TREINOS'] as const) {
      expect(erroDe(regra({ tipo, limite: '  ' }))).toEqual({ limite: 'Digite o número da regra.' });
    }
  });

  test('nota até: inteiro dentro da escala da pergunta (sem escala, 0 a 10)', () => {
    const nota = (limite: string, perguntaId = 'sono') => erroDe(regra({ tipo: 'NOTA_ABAIXO', perguntaId, limite })).limite;
    expect(nota('1')).toBeUndefined();
    expect(nota('10')).toBeUndefined();
    expect(nota('0')).toBe('Use um número de 1 a 10, a escala desta pergunta.');
    expect(nota('11')).toBe('Use um número de 1 a 10, a escala desta pergunta.');
    expect(nota('4,5')).toBe('Use um número inteiro.');
    expect(nota('abc')).toBe('Use um número inteiro.');
    expect(nota('0', 'humor')).toBeUndefined();
    expect(nota('11', 'humor')).toBe('Use um número de 0 a 10, a escala desta pergunta.');
    // Pergunta fora dos questionários: a regra fica, conferida na escala padrão.
    expect(nota('7', 'sumiu')).toBeUndefined();
    const escala = { ...sono, escala: { min: 0, max: 5 } };
    expect(erroDe(regra({ tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '6' }), [escala]).limite).toBe('Use um número de 0 a 5, a escala desta pergunta.');
  });

  test('nota caiu: inteiro de 1 a 10', () => {
    const caiu = (limite: string) => erroDe(regra({ tipo: 'NOTA_CAIU', limite })).limite;
    expect(caiu('1')).toBeUndefined();
    expect(caiu('10')).toBeUndefined();
    expect(caiu('0')).toBe('Use um número de 1 a 10.');
    expect(caiu('11')).toBe('Use um número de 1 a 10.');
    expect(caiu('1,5')).toBe('Use um número inteiro.');
  });

  test('peso mudou: 0,1 a 50 kg, com 1 casa', () => {
    const peso = (limite: string) => erroDe(regra({ tipo: 'PESO_MUDOU', limite })).limite;
    expect(peso('0,1')).toBeUndefined();
    expect(peso('50')).toBeUndefined();
    expect(peso('2.5')).toBeUndefined();
    expect(peso('0')).toBe('Use um número de 0,1 a 50.');
    expect(peso('50,1')).toBe('Use um número de 0,1 a 50.');
    expect(peso('-1')).toBe('Use um número de 0,1 a 50.');
    expect(peso('abc')).toBe('Use um número de 0,1 a 50.');
    expect(peso('1,25')).toBe('Use no máximo 1 casa decimal.');
  });

  test('poucos dias com treino: inteiro de 1 a 31', () => {
    const dias = (limite: string) => erroDe(regra({ tipo: 'POUCOS_TREINOS', limite })).limite;
    expect(dias('1')).toBeUndefined();
    expect(dias('31')).toBeUndefined();
    expect(dias('0')).toBe('Use um número de 1 a 31.');
    expect(dias('32')).toBe('Use um número de 1 a 31.');
    expect(dias('2,5')).toBe('Use um número inteiro.');
  });

  test('pergunta repetida no mesmo modelo, contando as desligadas gravadas; em outro modelo pode', () => {
    const a = regra({ chave: 'a', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '5' });
    const b = regra({ chave: 'b', id: 'b', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '3', ativa: false });
    expect(errosDasRegras([a, b], PERGUNTAS)).toEqual({ b: { perguntaId: 'Esta pergunta já tem uma regra deste tipo.' } });
    const sim = regra({ chave: 's', tipo: 'SIM', perguntaId: 'sono' });
    expect(errosDasRegras([a, sim], PERGUNTAS)).toEqual({});
  });

  test('nova desligada não vai no lote e não é validada; a gravada desligada é', () => {
    const nova = regra({ chave: 'n', tipo: 'SIM', ativa: false });
    const gravada = regra({ chave: 'g', id: 'g', tipo: 'PESO_MUDOU', limite: '', ativa: false });
    expect(vaiNoLote(nova)).toBe(false);
    expect(vaiNoLote(gravada)).toBe(true);
    const erros = errosDasRegras([nova, gravada], PERGUNTAS);
    expect(erros).toEqual({ g: { limite: 'Digite o número da regra.' } });
    expect(temErros(erros)).toBe(true);
    expect(temErros({})).toBe(false);
  });
});

describe('lote', () => {
  test('corpo: só o que vai, número convertido, pergunta e número só onde o modelo usa; chaves na ordem enviada', () => {
    const rascunho: RegraEmEdicao[] = [
      regra({ chave: 'r1', id: 'r1', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: '5' }),
      regra({ chave: 'n1', tipo: 'SIM', perguntaId: 'dor', limite: '9' }),
      regra({ chave: 'n2', tipo: 'ITEM_MARCADO', perguntaId: 'trocar', ativa: false }),
      regra({ chave: 'r3', id: 'r3', tipo: 'PESO_MUDOU', perguntaId: 'peso', limite: '1,5', ativa: false }),
      regra({ chave: 'n3', tipo: 'POUCOS_TREINOS', limite: ' 3 ' }),
    ];
    expect(corpoDoLote(7, rascunho)).toEqual({
      corpo: {
        versao: 7,
        regras: [
          { id: 'r1', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 5, ativa: true },
          { tipo: 'SIM', perguntaId: 'dor', limite: null, ativa: true },
          { id: 'r3', tipo: 'PESO_MUDOU', perguntaId: null, limite: 1.5, ativa: false },
          { tipo: 'POUCOS_TREINOS', perguntaId: null, limite: 3, ativa: true },
        ],
      },
      chaves: ['r1', 'n1', 'r3', 'n3'],
    });
  });

  test('regra gravada nunca sai do corpo sozinha (sair apaga a regra e as exceções)', () => {
    const gravadas: RegraDeAtencao[] = [
      { id: 'r1', tipo: 'SIM', perguntaId: 'dor', limite: null, ativa: false },
      { id: 'r2', tipo: 'NOTA_CAIU', perguntaId: null, limite: 2, ativa: true },
    ];
    expect(corpoDoLote(1, rascunhoDasRegras(gravadas)).corpo.regras.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  test('regra de tipo que o app não conhece volta como está (não é apagada)', () => {
    const gravadas: RegraDeAtencao[] = [
      { id: 'r1', tipo: 'SIM', perguntaId: 'dor', limite: null, ativa: true },
      { id: 'rx', tipo: 'NOVO' as RegraDeAtencao['tipo'], perguntaId: 'p', limite: 4, ativa: true },
    ];
    expect(corpoDoLote(2, rascunhoDasRegras(gravadas), gravadas)).toEqual({
      corpo: { versao: 2, regras: [
        { id: 'r1', tipo: 'SIM', perguntaId: 'dor', limite: null, ativa: true },
        { id: 'rx', tipo: 'NOVO', perguntaId: 'p', limite: 4, ativa: true },
      ] },
      chaves: ['r1', 'rx'],
    });
  });

  test('lote vazio', () => {
    expect(corpoDoLote(3, [])).toEqual({ corpo: { versao: 3, regras: [] }, chaves: [] });
  });

  test('422 por campo volta à linha enviada; o resto vai para o geral', () => {
    const chaves = ['r1', 'n1'];
    expect(errosDoLoteDaApi({
      'regras[0].limite': 'Use um número de 1 a 10, a escala desta pergunta.',
      'regras[1].perguntaId': 'Escolha a pergunta.',
      'regras[1].limite': 'Digite o número da regra.',
    }, chaves)).toEqual({
      porRegra: { r1: { limite: 'Use um número de 1 a 10, a escala desta pergunta.' }, n1: { perguntaId: 'Escolha a pergunta.', limite: 'Digite o número da regra.' } },
    });
    expect(errosDoLoteDaApi({ 'regras[5].limite': 'X', regras: 'Limite de 50 regras de atenção.' }, chaves))
      .toEqual({ porRegra: {}, geral: 'X' });
    expect(errosDoLoteDaApi({}, chaves)).toEqual({ porRegra: {} });
  });
});
