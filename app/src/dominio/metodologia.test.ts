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

test('carga e esforço por modalidade e padrão são cópias independentes', () => {
  const ws = c.tipos[2];
  expect(esforcoInicial(ws, 'LIVRE')?.rir).toBe(1);
  expect(esforcoInicial(ws, 'MAQUINA')?.rir).toBe(0);
  expect(esforcoInicial(ws, 'CABO')).toEqual(ws.esforcoPadrao);
  expect(esforcoInicial(ws, null)).not.toBe(ws.esforcoPadrao);
  expect(esforcoInicial(null, null)).toBeNull();
  expect(cargaInicial(ws, null)).toEqual(ws.cargaPadrao);
  expect(cargaInicial(ws, null)).not.toBe(ws.cargaPadrao);
  const top = c.tipos[3];
  expect(cargaInicial(top, 'MAQUINA')).toMatchObject({ percentualMin: 5, percentualMax: 10 });
  expect(cargaInicial(top, 'LIVRE')).toMatchObject({ percentualMin: 1, percentualMax: 5 });
  expect(cargaInicial(top, 'CABO')).toMatchObject({ percentualMin: 1, percentualMax: 5 });
  expect(cargaInicial(null, null)).toBeNull();
  expect(repeticoesDoTipo(ws)).toEqual({ min: 3, max: 6 });
  expect(repeticoesDoTipo(top)).toBeNull();
  expect(percentuaisDaRegra(c.tipos[1], 2)).toEqual([{ min: 70, max: null }, { min: 85, max: 90 }]);
  expect(percentuaisDaRegra(c.tipos[1], 4)).toBeNull();
});

test('técnicas e combinações usam o nome configurado e o padrão copiado, com reserva para o nome fixo', () => {
  expect(nomeDaTecnica(null, 'CLUSTER')).toBe('Cluster');
  expect(nomeDaTecnica(null, 'MYO_REPS')).toBe('Myo-reps');
  const config = { ...c, tecnicas: c.tecnicas.map((t) => ({ ...t, nome: t.tipo === 'CLUSTER' ? 'Muscle Round' : t.nome })) };
  expect(nomeDaTecnica(config, 'CLUSTER')).toBe('Muscle Round');
  expect(padraoDaTecnica(c, 'REST_PAUSE')).toEqual(c.tecnicas[0].padrao);
  expect(padraoDaTecnica(c, 'REST_PAUSE')).not.toBe(c.tecnicas[0].padrao);
  expect(nomeDaCombinacao(null, 'SUPERSET')).toBeTruthy();
  expect(nomeDaCombinacao({ ...c, combinacoes: c.combinacoes.map((x) => (x.tipo === 'SUPERSET' ? { ...x, nome: 'Super-série' } : x)) }, 'SUPERSET')).toBe('Super-série');
  expect(combinacaoDaMetodologia(c, 'CIRCUITO')?.nome).toBe('Circuito');
  expect(explicacaoDaCombinacao(c, 'TRI_SET')).toContain('Três exercícios');
  expect(explicacaoDaCombinacao(null, 'TRI_SET')).toBeNull();
});

test('séries novas nascem dos papéis, da modalidade e do padrão da técnica', () => {
  expect(novaSerie(c, 'WARM_UP')).toMatchObject({ repsMin: 10, repsMax: 15, carga: null, esforco: null });
  expect(novaSerie(c, 'WORKING', 'MAQUINA').esforco?.rir).toBe(0);
  expect(novaSerie(c, 'TOP_SET', 'MAQUINA').carga).toMatchObject({ modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: 10 });
  expect(novaSerie(c, 'WORKING', null, 'REST_PAUSE')).toMatchObject({ tipo: 'WORKING', tecnica: { pausas: 1, pausaSegundos: 20 } });
  expect(novaSerie(c, 'WORKING').tecnica).toBeNull();
});

test('a regra reaplica faixas por série ao mudar a quantidade; percentual individual não altera a vizinha', () => {
  const series = [novaSerie(c, 'FEEDER')];
  const tres = mudarQuantidade(series, agrupar(series)[0], 3, c);
  expect(tres.map((s) => [s.carga?.percentualMin, s.carga?.percentualMax])).toEqual([[50, null], [70, null], [85, 90]]);
  expect(descreverGrupo(agrupar(tres)[0], c)).toBe('3x3 - FS 50/70/85 a 90% da WS');
  const duas = mudarQuantidade(tres, agrupar(tres)[0], 2, c);
  expect(duas[1].carga?.percentualMax).toBe(90);
  const outra = alterarPercentuais(tres, 1, 75, 80);
  expect(outra[1].carga).toMatchObject({ percentualMin: 75, percentualMax: 80 });
  expect(tres[1].carga?.percentualMin).toBe(70);
});

test('técnica sem tipo fixo: série de trabalho com rest pause continua separada da simples', () => {
  const ws = adicionarSerie([], c, 'WORKING');
  const resultado = adicionarSerie(ws, c, 'WORKING', 'REST_PAUSE');
  expect(agrupar(resultado)).toHaveLength(2);
  expect(descreverGrupo(agrupar(resultado)[1], c)).toBe('1x3 a 6 - WS + Rest pause 20 s · 1 RIR');
});

test('cluster soma os blocos ao criar e ao alterar; a faixa digitada nunca supera a soma', () => {
  const s = novaSerie(c, 'WORKING');
  const tecnica = { ...tecnicaVazia('CLUSTER', padraoDaTecnica(c, 'CLUSTER')), blocos: [4, 2] };
  const [cluster] = alterarGrupo([s], agrupar([s])[0], { tecnica, repsMin: 100, repsMax: 100 }, c);
  expect(cluster).toMatchObject({ repsMin: 6, repsMax: 6 });
  const config = { ...c, tecnicas: c.tecnicas.map((t) => (t.tipo === 'CLUSTER' ? { ...t, padrao: tecnica } : t)) };
  expect(novaSerie(config, 'WORKING', null, 'CLUSTER')).toMatchObject({ repsMin: 6, repsMax: 6 });
});

test('trocar o tipo busca a carga e o esforço da modalidade', () => {
  const s = novaSerie(c, 'WARM_UP');
  const [ws] = alterarGrupo([s], agrupar([s])[0], { tipo: 'WORKING' }, c, 'MAQUINA');
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
  const pelaSessao = tiposETecnicasUsados({ sessoes: [sessao('s', [exercicio('e', { grupoUid: 'g', series: [serieDeTeste('a', { tipo: 'TOP_SET' })] })], [grupo('g', 'CIRCUITO')])] });
  expect(pelaSessao).toEqual({ tipos: ['TOP_SET'], tecnicas: [], combinacoes: ['CIRCUITO'] });
});

test('texto da carga e do esforço: faixas, mesma carga, até a falha em qualquer forma e pausas por respirações', () => {
  expect(textoCargaEEsforco({ carga: carga('PERCENTUAL_WS', 85, 90), esforco: rir(0) }, 'WS')).toBe('85 a 90% da WS · até a falha');
  expect(textoCargaEEsforco({ carga: carga('MESMA_CARGA'), esforco: rir(2) }, 'WS')).toBe('mesma carga da WS · 2 RIR');
  expect(textoCarga(carga('ABAIXO_DA_REFERENCIA', 15), 'WS', 'Top set')).toBe('15% abaixo da referência (Top set)');
  expect(textoCarga(carga('CARGA_TRABALHO'), 'WS')).toBe('');
  expect(textoEsforco({ rir: null, rpe: 8.5 })).toBe('RPE 8,5');
  const t = { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaRespiracoes: 5, pausaSegundos: 10 };
  expect(textoTecnicaPorExtenso(t)).toContain('5 respirações ou 10 s');
});

test('trocar a forma de carga preserva o esforço, inclusive o RIR zero; cópias não compartilham os blocos', () => {
  const original = novaSerie(c, 'WORKING', 'MAQUINA');
  const mudada = alterarGrupo([original], agrupar([original])[0], { modo: 'MESMA_CARGA' }, c)[0];
  expect(mudada.carga?.modo).toBe('MESMA_CARGA');
  expect(mudada.esforco).toEqual({ rir: 0, rpe: null });
  const cluster = { ...original, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaSegundos: 15 } };
  const copia = normalizarTreino({ sessoes: [{ exercicios: [{ series: [cluster] }] }] }).sessoes[0].exercicios[0].series[0];
  copia.tecnica!.blocos![0] = 10;
  expect(cluster.tecnica.blocos).toEqual([4, 2]);
});
