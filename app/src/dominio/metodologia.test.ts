import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';
import { explicacaoDaTecnica, explicacaoDoTipo, intensidadeInicial, nomeDaTecnica, padraoDaTecnica, papelDe, percentuaisDaRegra, repeticoesDoTipo, tipoDaMetodologia, tiposETecnicasUsados, tipoTrabalho } from './metodologia';
import { adicionarSerie, alterarGrupo, alterarPercentuais, modosDeIntensidade, mudarQuantidade, normalizarTreino, novaSerie, tecnicaVazia } from './editorTreino';
import { agrupar, descreverGrupo, textoIntensidade, textoTecnicaPorExtenso } from './agrupamento';

jest.mock('./uid', () => { let n = 0; return { novoUid: () => `novo-${++n}` }; });

test('o primeiro papel de trabalho dá nome à referência; tipo e explicações são procurados pelo nome', () => {
  expect(tipoTrabalho(c)).toBe('WS');
  expect(tipoTrabalho(null)).toBeNull();
  expect(tipoDaMetodologia(c, ' FS ')).toBe(c.tipos[1]);
  expect(tipoDaMetodologia(c, 'não existe')).toBeNull();
  expect(papelDe(c, 'FS')).toBe('PREPARACAO');
  expect(explicacaoDoTipo(c, 'FS')).toContain('Feeder set');
  expect(explicacaoDoTipo(c, null)).toBeNull();
  expect(explicacaoDaTecnica(c, 'CLUSTER')).toContain('Muscle Round');
});
test('intensidade por modalidade e padrão são cópias independentes', () => {
  const ws = c.tipos[2];
  expect(intensidadeInicial(ws, 'LIVRE')?.rir).toBe(1);
  expect(intensidadeInicial(ws, 'MAQUINA')?.rir).toBe(0);
  expect(intensidadeInicial(ws, 'CABO')).toEqual(ws.intensidadePadrao);
  expect(intensidadeInicial(ws, null)).not.toBe(ws.intensidadePadrao);
  expect(intensidadeInicial(null, null)).toBeNull();
  expect(repeticoesDoTipo(ws)).toEqual({ min: 3, max: 6 });
  expect(percentuaisDaRegra(c.tipos[1], 2)).toEqual([{ min: 70, max: null }, { min: 85, max: 90 }]);
  expect(percentuaisDaRegra(c.tipos[1], 4)).toBeNull();
});
test('técnicas usam o nome configurado e o padrão copiado, com reserva para o nome fixo', () => {
  expect(nomeDaTecnica(null, 'CLUSTER')).toBe('Cluster');
  const config = { ...c, tecnicas: c.tecnicas.map((t) => ({ ...t, nome: t.tipo === 'CLUSTER' ? 'Muscle Round' : t.nome })) };
  expect(nomeDaTecnica(config, 'CLUSTER')).toBe('Muscle Round');
  expect(padraoDaTecnica(c, 'REST_PAUSE')).toEqual(c.tecnicas[0].padrao);
  expect(padraoDaTecnica(c, 'REST_PAUSE')).not.toBe(c.tecnicas[0].padrao);
});
test('séries novas nascem dos papéis, modalidade e padrão da técnica', () => {
  expect(novaSerie(c, 'Aquecimento')).toMatchObject({ repsMin: 10, repsMax: 15, intensidade: null });
  expect(novaSerie(c, 'WS', 'MAQUINA').intensidade?.rir).toBe(0);
  expect(novaSerie(c, 'Top set', 'MAQUINA').intensidade).toMatchObject({ modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: 10 });
  expect(novaSerie(c, null, null, 'REST_PAUSE', true)).toMatchObject({ tipo: null, intensidade: { modo: 'MESMA_CARGA' }, tecnica: { pausas: 1, pausaSegundos: 20 } });
  expect(novaSerie(c, null, null, 'REST_PAUSE').intensidade).toBeNull();
  const opcoes = modosDeIntensidade(c, 'PREPARACAO');
  expect(opcoes[0]).toEqual({ valor: 'PERCENTUAL_WS', rotulo: '% da WS' });
  expect(opcoes).toHaveLength(6);
});
test('a regra reaplica faixas por série ao mudar quantidade; percentual individual não altera a vizinha', () => {
  const series = [novaSerie(c, 'FS')];
  const tres = mudarQuantidade(series, agrupar(series)[0], 3, c);
  expect(tres.map((s) => [s.intensidade?.percentualMin, s.intensidade?.percentualMax])).toEqual([[50, null], [70, null], [85, 90]]);
  expect(descreverGrupo(agrupar(tres)[0])).toBe('3x3 - FS 50/70/85 a 90%');
  const duas = mudarQuantidade(tres, agrupar(tres)[0], 2, c);
  expect(duas[1].intensidade?.percentualMax).toBe(90);
  const outra = alterarPercentuais(tres, 1, 75, 80);
  expect(outra[1].intensidade).toMatchObject({ percentualMin: 75, percentualMax: 80 });
  expect(tres[1].intensidade?.percentualMin).toBe(70);
});
test('série só técnica depois de WS nasce com mesma carga e continua separada', () => {
  const ws = adicionarSerie([], c, 'WS');
  const resultado = adicionarSerie(ws, c, null, 'REST_PAUSE');
  expect(agrupar(resultado)).toHaveLength(2);
  expect(resultado[1]).toMatchObject({ tipo: null, intensidade: { modo: 'MESMA_CARGA' } });
  expect(descreverGrupo(agrupar(resultado)[1], c)).toBe('1x - Rest pause 20 s · mesma carga da WS');
});
test('cluster soma os blocos ao criar e ao alterar; a faixa digitada nunca supera a soma', () => {
  const s = novaSerie(c, 'WS');
  const tecnica = { ...tecnicaVazia('CLUSTER', padraoDaTecnica(c, 'CLUSTER')), blocos: [4, 2] };
  const [cluster] = alterarGrupo([s], agrupar([s])[0], { tecnica, repsMin: 100, repsMax: 100 }, c);
  expect(cluster).toMatchObject({ repsMin: 6, repsMax: 6 });
  const config = { ...c, tecnicas: c.tecnicas.map((t) => t.tipo === 'CLUSTER' ? { ...t, padrao: tecnica } : t) };
  expect(novaSerie(config, null, null, 'CLUSTER')).toMatchObject({ repsMin: 6, repsMax: 6 });
});
test('trocar tipo busca a intensidade da modalidade e recalcula reps do cluster', () => {
  const s = novaSerie(c, 'Aquecimento');
  const [ws] = alterarGrupo([s], agrupar([s])[0], { tipo: 'WS' }, c, 'MAQUINA');
  expect(ws).toMatchObject({ repsMin: 3, repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO', rir: 0 } });
});
test('normalizar preserva metodologia sem compartilhar e glossário contém apenas usados, sem duplicar', () => {
  const conteudo = normalizarTreino({ metodologia: { id: 'm', nome: 'Teste', configuracao: c }, sessoes: [{ exercicios: [{ series: [novaSerie(c, 'WS'), novaSerie(c, 'WS'), novaSerie(c, null, null, 'REST_PAUSE')] }] }] });
  expect(conteudo.metodologia?.configuracao).toEqual(c);
  expect(conteudo.metodologia?.configuracao).not.toBe(c);
  expect(tiposETecnicasUsados(conteudo)).toEqual({ tipos: ['WS'], tecnicas: ['REST_PAUSE'] });
});
test('faixas, mesma carga e até a falha em qualquer modo e pausas por respirações', () => {
  expect(textoIntensidade({ modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 90, rir: 0 }, 'WS')).toBe('85 a 90% da WS · até a falha');
  expect(textoIntensidade({ modo: 'MESMA_CARGA', rir: 2 }, 'WS')).toBe('mesma carga da WS · 2 RIR');
  const t = { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaRespiracoes: 5, pausaSegundos: 10 };
  expect(textoTecnicaPorExtenso(t)).toContain('5 respirações ou 10 s');
});

test('trocar modo preserva RIR, inclusive zero, e cópias de séries não compartilham os blocos', () => {
  const original = novaSerie(c, 'WS', 'MAQUINA');
  const mudada = alterarGrupo([original], agrupar([original])[0], { modo: 'RPE' }, c)[0];
  expect(mudada.intensidade).toMatchObject({ modo: 'RPE', rir: 0 });
  const cluster = { ...original, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaSegundos: 15 } };
  const copia = normalizarTreino({ sessoes: [{ exercicios: [{ series: [cluster] }] }] }).sessoes[0].exercicios[0].series[0];
  copia.tecnica!.blocos![0] = 10;
  expect(cluster.tecnica.blocos).toEqual([4, 2]);
});
