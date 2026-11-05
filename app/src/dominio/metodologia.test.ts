import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import {
  cargaInicial,
  codigoTrabalho,
  combinacaoDaMetodologia,
  esforcoInicial,
  explicacaoDaCombinacao,
  explicacaoDaTecnica,
  explicacaoDoTipo,
  nomeDaCombinacao,
  nomeDaSerieDeTrabalho,
  nomeDaTecnica,
  nomeDoTipo,
  padraoDaTecnica,
  papelDe,
  resumoDoTipo,
  percentuaisDaRegra,
  repeticoesDoTipo,
  tipoPorCodigo,
  tiposETecnicasUsados,
  tipoTrabalho,
} from './metodologia';
import { adicionarSerie, alterarGrupo, alterarPercentuais, mudarQuantidade, normalizarTreino, novaSerie, tecnicaVazia } from './editorTreino';
import { agrupar, descreverGrupo, textoCarga, textoCargaEEsforco, textoEsforco, textoTecnicaPorExtenso } from './agrupamento';
import { carga, exercicio, grupo, rir, serie as serieDeTeste, sessao } from './exemplosDeTreino.apoioTeste';

jest.mock('./uid', () => {
  let n = 0;
  return { novoUid: () => `novo-${++n}` };
});

test('o cartão fechado resume só o que o tipo já tem', () => {
  expect(resumoDoTipo(c.tipos[1], 'WS')).toBe('Preparação · 3 a 5 reps · 85% da WS');
  expect(resumoDoTipo(c.tipos[2], 'WS')).toBe('Trabalho · 3 a 6 reps · carga de trabalho · até a falha');
  expect(resumoDoTipo({ ...c.tipos[0], cargaPadrao: { modo: 'CARGA_FIXA', percentualMin: null, percentualMax: null, valorKg: 20 } }, 'WS')).toContain('20 kg');
  expect(resumoDoTipo(c.tipos[0], 'WS')).toBe('Aquecimento · 10 a 15 reps');
  expect(resumoDoTipo(c.tipos[3], 'WS')).toBe('Pós-trabalho · 6 a 8 reps · 85% da WS · até a falha');
  expect(resumoDoTipo({
    papel: 'OUTRO',
    repeticoes: { min: 4, max: null },
    cargaPadrao: { modo: 'PERCENTUAL_WS', percentualMin: null, percentualMax: null },
    esforcoPadrao: { rir: 0, rpe: null },
  }, null)).toBe('Outro · até a falha');
});

test('o primeiro papel de trabalho dá nome à referência; o tipo é procurado pelo CÓDIGO', () => {
  expect(tipoTrabalho(c)).toBe('WS');
  expect(codigoTrabalho(c)).toBe('WORKING');
  expect(tipoTrabalho(null)).toBeNull();
  expect(codigoTrabalho(null)).toBeNull();
  expect(nomeDaSerieDeTrabalho(c)).toBe('WS');
  expect(nomeDaSerieDeTrabalho(null)).toBe('série de trabalho');
  expect(tipoPorCodigo(c, ' FEEDER ')).toBe(c.tipos[1]);
  expect(tipoPorCodigo(c, 'FS')).toBeNull(); // nome não é código
  expect(tipoPorCodigo(c, null)).toBeNull();
  expect(papelDe(c, 'FEEDER')).toBe('PREPARACAO');
  expect(papelDe(c, 'PIRAMIDE')).toBeNull();
  expect(explicacaoDoTipo(c, 'FEEDER')).toContain('Feeder set');
  expect(explicacaoDoTipo(c, null)).toBeNull();
  expect(explicacaoDaTecnica(c, 'CLUSTER')).toContain('Muscle Round');
});

test('nome exibido: o da metodologia, o código para tipo fora dela e vazio sem tipo', () => {
  expect(nomeDoTipo(c, 'WORKING')).toBe('WS');
  expect(nomeDoTipo(c, 'PIRAMIDE')).toBe('PIRAMIDE');
  expect(nomeDoTipo(c, null)).toBe('');
  expect(nomeDoTipo(null, 'WORKING')).toBe('WORKING');
});

test('carga e esforço padrão são cópias independentes', () => {
  const ws = c.tipos[2];
  expect(esforcoInicial(ws)).toEqual(ws.esforcoPadrao);
  expect(esforcoInicial(ws)?.rir).toBe(0);
  expect(esforcoInicial(ws)).not.toBe(ws.esforcoPadrao);
  expect(esforcoInicial(null)).toBeNull();
  expect(cargaInicial(ws)).toEqual(ws.cargaPadrao);
  expect(cargaInicial(ws)).not.toBe(ws.cargaPadrao);
  expect(cargaInicial(null)).toBeNull();
  expect(repeticoesDoTipo(ws)).toEqual({ min: 3, max: 6 });
  expect(percentuaisDaRegra(c.tipos[1], 2)).toEqual([{ min: 70, max: null }, { min: 85, max: 90 }]);
  const tecnica = { ...tecnicaVazia('CLUSTER', padraoDaTecnica(c, 'CLUSTER')), blocos: [4, 2] };
  const config = { ...c, tecnicas: c.tecnicas.map((t) => (t.tipo === 'CLUSTER' ? { ...t, padrao: tecnica } : t)) };
  expect(novaSerie(config, 'WORKING', null, 'CLUSTER')).toMatchObject({ repsMin: 6, repsMax: 6 });
});

test('trocar o tipo busca a carga e o esforço do tipo', () => {
  const s = novaSerie(c, 'WARM_UP');
  const [ws] = alterarGrupo([s], agrupar([s])[0], { tipo: 'WORKING' }, c);
  expect(ws).toMatchObject({ repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 0 } });
});

test('normalizar preserva a metodologia sem compartilhar; o glossário tem só o usado, sem duplicar', () => {
  const conteudo = normalizarTreino({
    metodologia: { id: 'm', nome: 'Teste', configuracao: c },
    sessoes: [
      {
        exercicios: [
          { uid: 'e1', grupoUid: 'g', series: [novaSerie(c, 'WORKING'), novaSerie(c, 'WORKING'), novaSerie(c, 'WORKING', null, 'REST_PAUSE')] },
          { uid: 'e2', grupoUid: 'g', series: [] },
          { uid: 'e3', series: [] },
        ],
        grupos: [{ uid: 'g', tecnica: 'SUPERSET' }, { uid: 'sem-uso', tecnica: 'CIRCUITO' }],
      },
    ],
  });
  expect(conteudo.metodologia?.configuracao).toEqual(c);
  expect(conteudo.metodologia?.configuracao).not.toBe(c);
  expect(tiposETecnicasUsados(conteudo)).toEqual({ tipos: ['WORKING'], tecnicas: ['REST_PAUSE'], combinacoes: ['SUPERSET'] });
  const pelaSessao = tiposETecnicasUsados({ sessoes: [sessao('s', [exercicio('e', { grupoUid: 'g', series: [serieDeTeste('a', { tipo: 'PIRAMIDE' })] })], [grupo('g', 'CIRCUITO')])] });
  expect(pelaSessao).toEqual({ tipos: ['PIRAMIDE'], tecnicas: [], combinacoes: ['CIRCUITO'] });
});

test('texto da carga e do esforço: faixas, até a falha em qualquer forma e pausas por respirações', () => {
  expect(textoCargaEEsforco({ carga: carga('PERCENTUAL_WS', 85, 90), esforco: rir(0) }, 'WS')).toBe('85% a 90% da WS · até a falha');
  expect(textoCargaEEsforco({ carga: carga('PERCENTUAL_WS', 85), esforco: rir(2) }, 'WS')).toBe('85% da WS · 2 RIR');
  expect(textoCarga(carga('CARGA_TRABALHO'), 'WS')).toBe('');
  expect(textoEsforco({ rir: null, rpe: 8.5 })).toBe('RPE 8,5');
  const t = { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaRespiracoes: 5, pausaSegundos: 10 };
  expect(textoTecnicaPorExtenso(t)).toContain('5 respirações ou 10 s');
});

test('trocar a forma de carga preserva o esforço, inclusive o RIR zero; cópias não compartilham os blocos', () => {
  const original = novaSerie(c, 'WORKING', 'MAQUINA');
  const mudada = alterarGrupo([original], agrupar([original])[0], { modo: 'PERCENTUAL_WS' }, c)[0];
  expect(mudada.carga?.modo).toBe('PERCENTUAL_WS');
  expect(mudada.esforco).toEqual({ rir: 0, rpe: null });
  const cluster = { ...original, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaSegundos: 15 } };
  const copia = normalizarTreino({ sessoes: [{ exercicios: [{ series: [cluster] }] }] }).sessoes[0].exercicios[0].series[0];
  copia.tecnica!.blocos![0] = 10;
  expect(cluster.tecnica.blocos).toEqual([4, 2]);
});
