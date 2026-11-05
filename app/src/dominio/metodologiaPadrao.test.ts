import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { problemasDaMetodologia } from './edicaoMetodologia';
import { tipoTrabalho } from './metodologia';
import { nomeDeCombinacao, nomeDeTecnica } from './tiposDeSerie';

test('a metodologia padrão tem os cinco tipos, as seis técnicas, as sete combinações e passa pela validação', () => {
  expect(problemasDaMetodologia(c)).toEqual({});
  expect(tipoTrabalho(c)).toBe('WS');
  expect(c.tipos.map((t) => t.codigo)).toEqual(['WARM_UP', 'FEEDER', 'WORKING', 'BACK_OFF', 'TOP_SET']);
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

test('padrão de cinco tipos: aquecimento, FS, WS, back off e Top set, cada um com a carga e o esforço da planilha', () => {
  const por = (codigo: string) => c.tipos.find((t) => t.codigo === codigo)!;
  expect(c.tipos.map((t) => t.codigo)).toEqual(['WARM_UP', 'FEEDER', 'WORKING', 'BACK_OFF', 'TOP_SET']);
  expect(por('WARM_UP')).toMatchObject({ repeticoes: { min: 10, max: 15 }, cargaPadrao: null, esforcoPadrao: null });
  expect(por('FEEDER')).toMatchObject({ repeticoes: { min: 3, max: 5 }, cargaPadrao: { modo: 'PERCENTUAL_WS', percentualMin: 85 }, esforcoPadrao: null });
  expect(por('WORKING')).toMatchObject({ repeticoes: { min: 3, max: 6 }, cargaPadrao: { modo: 'CARGA_TRABALHO' }, esforcoPadrao: { rir: 0 } });
  expect(por('BACK_OFF')).toMatchObject({ repeticoes: { min: 6, max: 8 }, cargaPadrao: { modo: 'PERCENTUAL_WS', percentualMin: 85 }, esforcoPadrao: { rir: 0 } });
  expect(por('TOP_SET')).toMatchObject({ nome: 'Top set', papel: 'TRABALHO', repeticoes: { min: 6, max: 8 }, cargaPadrao: { modo: 'CARGA_TRABALHO' }, esforcoPadrao: { rir: 0 } });
  expect(por('TOP_SET').explicacao).toContain('maior que a da série anterior');
  expect(c.tipos.some((t) => 'porModalidade' in t)).toBe(false);
});

test('rest pause padrão usa uma pausa de 20 s, sem prescrição de reps nas retomadas', () => {
  expect(c.tecnicas.find((t) => t.tipo === 'REST_PAUSE')?.padrao).toMatchObject({ pausaSegundos: 20, pausas: 1 });
  expect(c.tecnicas.find((t) => t.tipo === 'CLUSTER')?.padrao).toMatchObject({ pausaSegundos: 15 });
  expect(c.tecnicas.find((t) => t.tipo === 'DROP_SET')?.padrao).toMatchObject({ quedas: 1 });
});
