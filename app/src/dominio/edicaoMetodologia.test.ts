import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { metodologiaParaSalvar, problemaDaMetodologia, problemaDaTecnica, type MetodologiaEmEdicao } from './edicaoMetodologia';
import { tecnicaVazia } from './editorTreino';

const copia = (): MetodologiaEmEdicao => JSON.parse(JSON.stringify(c));
test('obrigatório um trabalho, nomes únicos mesmo com caixa/acento/hífen e sem nome de técnica', () => {
  const config = copia();
  config.tipos = config.tipos.map((t) => ({ ...t, papel: 'OUTRO', regraPercentuais: null }));
  expect(problemaDaMetodologia(config)).toContain('trabalho');
  const nomes = copia(); nomes.tipos[0].nome = 'Báck-off';
  expect(problemaDaMetodologia(nomes)).toContain('únicos');
  nomes.tipos[0].nome = 'REST-PAUSE'; expect(problemaDaMetodologia(nomes)).toContain('técnica');
  nomes.tipos[0].nome = 'Muscle Round'; nomes.tecnicas[1].nome = 'Muscle Round';
  expect(problemaDaMetodologia(nomes)).toContain('técnica');
});
test('regra é só em preparação, completa, com chave exata e faixas válidas', () => {
  const config = copia(); config.tipos[1].papel = 'OUTRO';
  expect(problemaDaMetodologia(config)).toContain('preparação');
  config.tipos[1].papel = 'PREPARACAO'; config.tipos[1].regraPercentuais = { '2': [{ min: 50, max: null }] };
  expect(problemaDaMetodologia(config)).toContain('faixas');
  config.tipos[1].regraPercentuais = { '01': [{ min: 85, max: 90 }] };
  expect(problemaDaMetodologia(config)).toContain('faixas');
  config.tipos[1].regraPercentuais = { '1': [{ min: 90, max: 85 }] };
  expect(problemaDaMetodologia(config)).toContain('faixas');
  config.tipos[1].regraPercentuais = { '1': [{ min: 85, max: 90 }] };
  expect(problemaDaMetodologia(config)).toBeNull();
});
test('reps vazias somem ao salvar; reps incompletas, explicação longa e técnica repetida são recusadas', () => {
  const config = copia(); config.tipos[0].repeticoes = { min: null, max: null };
  expect(metodologiaParaSalvar(config).tipos[0].repeticoes).toBeNull();
  config.tipos[0].repeticoes.min = 5; expect(problemaDaMetodologia(config)).toContain('repetições');
  config.tipos[0].repeticoes = null; config.tipos[0].explicacao = 'a'.repeat(501);
  expect(problemaDaMetodologia(config)).toContain('500');
  config.tipos[0].explicacao = null; config.tecnicas[1] = config.tecnicas[0];
  expect(problemaDaMetodologia(config)).toContain('três técnicas');
});
test('padrão de técnica pode ser parcial mas respeita valores e a técnica correspondente', () => {
  const config = copia(); config.tecnicas[1].padrao = tecnicaVazia('CLUSTER');
  expect(problemaDaMetodologia(config)).toBeNull();
  config.tecnicas[1].padrao.pausaSegundos = 3;
  expect(problemaDaMetodologia(config)).toContain('Pausa');
  expect(problemaDaTecnica(tecnicaVazia('CLUSTER'))).toContain('pausa');
});
