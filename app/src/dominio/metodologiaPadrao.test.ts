import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { problemasDaMetodologia } from './edicaoMetodologia';
import { tipoTrabalho } from './metodologia';
import { nomeDeCombinacao, nomeDeTecnica } from './tiposDeSerie';

test('a metodologia padrão tem os cinco tipos, as seis técnicas, as sete combinações e passa pela validação', () => {
  expect(problemasDaMetodologia(c)).toEqual({});
  expect(tipoTrabalho(c)).toBe('WS');
  expect(c.tipos.map((t) => t.codigo)).toEqual(['WARM_UP', 'FEEDER', 'WORKING', 'TOP_SET', 'BACK_OFF']);
  expect(c.tipos.find((t) => t.codigo === 'FEEDER')).toMatchObject({ nome: 'FS', papel: 'PREPARACAO' });
  expect(c.tecnicas.map((t) => t.tipo).sort()).toEqual(['CLUSTER', 'DROP_SET', 'FORCED_REPS', 'MYO_REPS', 'PARTIAL_REPS', 'REST_PAUSE']);
  expect(c.combinacoes.map((x) => x.tipo).sort()).toEqual(['AGONISTA_ANTAGONISTA', 'CIRCUITO', 'GIANT_SET', 'POS_EXAUSTAO', 'PRE_EXAUSTAO', 'SUPERSET', 'TRI_SET']);
  expect(c.arredondamentoKg).toBe(0.5);
});

test('nenhum tipo é técnica nem combinação', () => {
  expect(c.tipos.some((t) => nomeDeTecnica(t.nome) || nomeDeCombinacao(t.nome))).toBe(false);
});

test('só preparação tem regra e cada quantidade tem uma faixa por série', () => {
  for (const tipo of c.tipos) {
    for (const [quantidade, faixas] of Object.entries(tipo.regraPercentuais ?? {})) {
      expect(tipo.papel).toBe('PREPARACAO');
      expect(faixas).toHaveLength(Number(quantidade));
    }
  }
  expect(c.tipos[1].regraPercentuais!['3']).toEqual([{ min: 50, max: null }, { min: 70, max: null }, { min: 85, max: 90 }]);
});

test('carga e esforço padrão: Top set por modalidade, WS com 1 RIR no livre e 0 na máquina, back off a 85%', () => {
  const por = (codigo: string) => c.tipos.find((t) => t.codigo === codigo)!;
  expect(por('WORKING').cargaPadrao).toMatchObject({ modo: 'CARGA_TRABALHO' });
  expect(por('WORKING').porModalidade).toMatchObject({ LIVRE: { esforco: { rir: 1 } }, MAQUINA: { esforco: { rir: 0 } } });
  expect(por('TOP_SET').porModalidade).toMatchObject({ LIVRE: { carga: { percentualMin: 1, percentualMax: 5 } }, MAQUINA: { carga: { percentualMin: 5, percentualMax: 10 } } });
  expect(por('BACK_OFF').cargaPadrao).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 85 });
  expect(por('WARM_UP')).toMatchObject({ cargaPadrao: null, esforcoPadrao: null });
});

test('rest pause padrão usa uma pausa de 20 s, sem prescrição de reps nas retomadas', () => {
  expect(c.tecnicas.find((t) => t.tipo === 'REST_PAUSE')?.padrao).toMatchObject({ pausaSegundos: 20, pausas: 1 });
  expect(c.tecnicas.find((t) => t.tipo === 'CLUSTER')?.padrao).toMatchObject({ pausaSegundos: 15 });
  expect(c.tecnicas.find((t) => t.tipo === 'DROP_SET')?.padrao).toMatchObject({ quedas: 1 });
});
