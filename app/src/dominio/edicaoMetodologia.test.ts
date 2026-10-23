import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { metodologiaParaSalvar, novoTipoDeSerie, problemasDaMetodologia, type MetodologiaEmEdicao } from './edicaoMetodologia';
import { tecnicaVazia } from './editorTreino';

const copia = (): MetodologiaEmEdicao => JSON.parse(JSON.stringify(c));

test('a metodologia padrão não tem nenhum problema', () => {
  expect(problemasDaMetodologia(copia())).toEqual({});
});

test('obrigatório um trabalho, nomes únicos mesmo com caixa/acento/hífen e sem nome de técnica ou de combinação', () => {
  const config = copia();
  config.tipos = config.tipos.map((t) => ({ ...t, papel: 'OUTRO', regraPercentuais: null }));
  expect(problemasDaMetodologia(config).tipos).toContain('trabalho');

  const nomes = copia();
  nomes.tipos[4].nome = 'Báck-off'; // o tipo 3 já se chama Back off
  nomes.tipos[3].nome = 'Back off';
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('Já existe');

  nomes.tipos[4].nome = 'REST-PAUSE';
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('técnica');
  nomes.tipos[4].nome = 'Muscle Round';
  nomes.tecnicas[1].nome = 'Muscle Round';
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('técnica');
  nomes.tipos[4].nome = 'Pré-exaustão';
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('combinação');
  nomes.tipos[4].nome = '';
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('nome');
  nomes.tipos[4].nome = 'x'.repeat(31);
  expect(problemasDaMetodologia(nomes)['tipos[4].nome']).toContain('30');
});

test('devolve vários problemas de uma vez, cada um no seu campo', () => {
  const config = copia();
  config.tipos[0].repeticoes = { min: 20, max: 10 };
  config.tipos[1].cargaPadrao = { modo: 'PERCENTUAL_WS', percentualMin: 0, percentualMax: null, referenciaUid: null };
  config.tipos[2].esforcoPadrao = { rir: 1, rpe: 8 };
  config.tipos[4].codigo = 'back off';
  config.tecnicas[0].nome = '';
  config.combinacoes[0].explicacao = 'a'.repeat(501);
  config.arredondamentoKg = 3;
  config.rodapePdf = 'a'.repeat(501);
  const p = problemasDaMetodologia(config);
  expect(Object.keys(p).sort()).toEqual(
    [
      'tipos[0].repeticoes',
      'tipos[1].cargaPadrao.percentualMin',
      'tipos[2].esforcoPadrao.rpe',
      'tipos[4].codigo',
      'tecnicas[0].nome',
      'combinacoes[0].explicacao',
      'arredondamentoKg',
      'rodapePdf',
    ].sort(),
  );
});

test('código do tipo: formato e unicidade', () => {
  const config = copia();
  config.tipos[1].codigo = 'WARM_UP';
  expect(problemasDaMetodologia(config)['tipos[1].codigo']).toContain('Já existe');
  config.tipos[1].codigo = '';
  expect(problemasDaMetodologia(config)['tipos[1].codigo']).toContain('30');
  config.tipos[1].codigo = 'a'.repeat(31);
  expect(problemasDaMetodologia(config)['tipos[1].codigo']).toContain('30');
});

test('papel, de 1 a 20 tipos e arredondamento', () => {
  const config = copia();
  (config.tipos[0] as { papel: string }).papel = 'QUALQUER';
  expect(problemasDaMetodologia(config)['tipos[0].papel']).toContain('papel');
  config.tipos = [];
  expect(problemasDaMetodologia(config).tipos).toContain('1 a 20');
  expect(problemasDaMetodologia({ ...copia(), tipos: Array.from({ length: 21 }, (_, i) => novoTipoDeSerie(`Tipo ${i}`, [])) }).tipos).toBeDefined();
});

test('regra é só em preparação, completa, com chave exata e faixas válidas', () => {
  const config = copia();
  config.tipos[1].papel = 'OUTRO';
  expect(problemasDaMetodologia(config)['tipos[1].regraPercentuais']).toContain('preparação');
  config.tipos[1].papel = 'PREPARACAO';
  config.tipos[1].regraPercentuais = { '2': [{ min: 50, max: null }] };
  expect(problemasDaMetodologia(config)['tipos[1].regraPercentuais.2']).toContain('faixas');
  config.tipos[1].regraPercentuais = { '01': [{ min: 85, max: 90 }] };
  expect(problemasDaMetodologia(config)['tipos[1].regraPercentuais.01']).toContain('faixas');
  config.tipos[1].regraPercentuais = { '1': [{ min: 90, max: 85 }] };
  expect(problemasDaMetodologia(config)['tipos[1].regraPercentuais.1']).toContain('faixas');
  config.tipos[1].regraPercentuais = { '1': [{ min: 85, max: 90 }] };
  expect(problemasDaMetodologia(config)).toEqual({});
});

test('reps vazias somem ao salvar; reps incompletas, explicação longa e técnica repetida são recusadas', () => {
  const config = copia();
  config.tipos[0].repeticoes = { min: null, max: null };
  expect(problemasDaMetodologia(config)).toEqual({});
  expect(metodologiaParaSalvar(config).tipos[0].repeticoes).toBeNull();
  config.tipos[0].repeticoes.min = 5;
  expect(problemasDaMetodologia(config)['tipos[0].repeticoes']).toContain('Repetições');
  config.tipos[0].repeticoes = null;
  config.tipos[0].explicacao = 'a'.repeat(501);
  expect(problemasDaMetodologia(config)['tipos[0].explicacao']).toContain('500');
  config.tipos[0].explicacao = null;
  config.tecnicas[1] = config.tecnicas[0];
  expect(problemasDaMetodologia(config).tecnicas).toContain('sem repetir');
});

test('zero técnicas e zero combinações são válidas; repetir combinação não', () => {
  const config = copia();
  config.tecnicas = [];
  config.combinacoes = [];
  expect(problemasDaMetodologia(config)).toEqual({});
  const repetida = copia();
  repetida.combinacoes[1] = repetida.combinacoes[0];
  expect(problemasDaMetodologia(repetida).combinacoes).toBeDefined();
  const semNome = copia();
  semNome.combinacoes[2].nome = ' ';
  expect(problemasDaMetodologia(semNome)['combinacoes[2].nome']).toBeDefined();
});

test('padrão de técnica pode ser parcial mas respeita os valores e a técnica correspondente', () => {
  const config = copia();
  config.tecnicas[1].padrao = tecnicaVazia('CLUSTER');
  expect(problemasDaMetodologia(config)).toEqual({});
  config.tecnicas[1].padrao.pausaSegundos = 3;
  expect(problemasDaMetodologia(config)['tecnicas[1].padrao.pausaSegundos']).toContain('Pausa');
  config.tecnicas[1].padrao = tecnicaVazia('REST_PAUSE');
  expect(problemasDaMetodologia(config)['tecnicas[1].padrao']).toContain('própria técnica');
});

test('carga e esforço padrão do tipo e da modalidade', () => {
  const config = copia();
  config.tipos[2].porModalidade = {
    LIVRE: { carga: { modo: 'ACIMA_DA_ANTERIOR', percentualMin: 120, percentualMax: null, referenciaUid: null }, esforco: { rir: 9, rpe: null } },
  };
  const p = problemasDaMetodologia(config);
  expect(p['tipos[2].porModalidade.LIVRE.carga.percentualMin']).toBeDefined();
  expect(p['tipos[2].porModalidade.LIVRE.esforco.rir']).toBeDefined();
  // Back off sem referência é válido num padrão: a referência só nasce na série.
  const back = copia();
  back.tipos[4].cargaPadrao = { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, percentualMax: null, referenciaUid: null };
  expect(problemasDaMetodologia(back)).toEqual({});
  // Esforço padrão sem RIR nem RPE não trava o salvar: vira nenhum.
  const vazio = copia();
  vazio.tipos[2].esforcoPadrao = { rir: null, rpe: null };
  expect(problemasDaMetodologia(vazio)).toEqual({});
  expect(metodologiaParaSalvar(vazio).tipos[2].esforcoPadrao).toBeNull();
});

test('salvar tira espaços, variação por modalidade vazia e a referência do back off', () => {
  const config = copia();
  config.tipos[0].nome = '  Aquecimento ';
  config.tipos[0].explicacao = '   ';
  config.tipos[4].cargaPadrao = { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, percentualMax: null, referenciaUid: 'qualquer' };
  config.tipos[3].porModalidade = { LIVRE: { carga: null, esforco: { rir: null, rpe: null } } };
  const salva = metodologiaParaSalvar(config);
  expect(salva.tipos[0].nome).toBe('Aquecimento');
  expect(salva.tipos[0].explicacao).toBeNull();
  expect(salva.tipos[4].cargaPadrao?.referenciaUid).toBeNull();
  expect(salva.tipos[3].porModalidade).toBeNull();
});

test('tipo novo: código gerado do nome, único e sem padrões', () => {
  const existentes = c.tipos;
  expect(novoTipoDeSerie('Back off', existentes).codigo).toBe('BACK_OFF_2');
  const novo = novoTipoDeSerie('Série de ação', existentes, 'TRABALHO');
  expect(novo).toMatchObject({ codigo: 'SERIE_DE_ACAO', nome: 'Série de ação', papel: 'TRABALHO', repeticoes: null, cargaPadrao: null, esforcoPadrao: null });
});
