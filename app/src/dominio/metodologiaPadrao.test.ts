import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { problemaDaMetodologia } from './edicaoMetodologia';
import { tipoTrabalho } from './metodologia';
import { nomeDeTecnica } from './tiposDeSerie';

test('a metodologia padrão tem todos os papéis, as três técnicas e passa pela validação', () => {
  expect(problemaDaMetodologia(c)).toBeNull();
  expect(tipoTrabalho(c)).toBe('WS');
  expect(c.tipos.find((t) => t.nome === 'FS')?.papel).toBe('PREPARACAO');
  expect(c.tecnicas.map((t) => t.tipo).sort()).toEqual(['CLUSTER', 'DROP_SET', 'REST_PAUSE']);
});
test('nenhum tipo é técnica e Cardio não tem reps nem intensidade', () => {
  expect(c.tipos.some((t) => nomeDeTecnica(t.nome))).toBe(false);
  expect(c.tipos.find((t) => t.nome === 'Cardio')).toMatchObject({ papel: 'OUTRO', repeticoes: null, intensidadePadrao: null });
});
test('só preparação tem regra e cada quantidade tem uma faixa por série', () => {
  for (const tipo of c.tipos) for (const [quantidade, faixas] of Object.entries(tipo.regraPercentuais ?? {})) {
    expect(tipo.papel).toBe('PREPARACAO');
    expect(faixas).toHaveLength(Number(quantidade));
  }
  expect(c.tipos[1].regraPercentuais!['3']).toEqual([{min:50,max:null},{min:70,max:null},{min:85,max:90}]);
});
test('rest pause padrão usa uma pausa de 20 s, sem prescrição de reps nas retomadas', () => {
  expect(c.tecnicas.find((t) => t.tipo === 'REST_PAUSE')?.padrao).toMatchObject({ pausaSegundos: 20, pausas: 1 });
});
