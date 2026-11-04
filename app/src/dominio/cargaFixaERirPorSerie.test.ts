import type { Serie } from '../api/tipos';
import { opcoesDaCargaDaEtapa, OPCOES_DE_RIR } from '../treinador/treino/opcoesDoEditor';
import { pacoteNoFormatoAtual } from '../offline/formatoDoPacote';
import { agrupar, descreverGrupo, textoCarga, textoEsforcoDoGrupo } from './agrupamento';
import { calcularCargasDoExercicio, metaDaSerie, textoDaOrigem } from './cargas';
import { alterarGrupo, alterarPercentuais, alterarRirDaSerie, cargaDoModo, modosDeCarga, seriesDaReceita } from './editorTreino';
import { carga, exercicio, rir, rpe, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { mostraRpe, mostraRpeNoPapel } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { previaDoGrupo } from './resumoDaSerie';
import { problemasDaCarga, problemasDaSerie } from './validacaoDeSerie';
import { validarExercicio } from './validacaoDoTreino';

/** Carga fixa: kg escritos pelo treinador. */
const fixa = (kg: number | null) => ({ ...carga('CARGA_FIXA'), valorKg: kg });
const aquecimento = (uid: string, extra: Partial<Serie> = {}) => serie(uid, { tipo: 'WARM_UP', carga: fixa(12), ...extra });
const modos = (papel?: Parameters<typeof modosDeCarga>[1]) => modosDeCarga(CONFIGURACAO_PADRAO, papel).map((m) => m.valor);
const mensagens = (e: ReturnType<typeof validarExercicio>['erros']) => e.map((x) => x.mensagem);

describe('carga fixa: validação', () => {
  it('exige kg maiores que zero, até 1000 e com no máximo 2 casas; sem percentual', () => {
    expect(problemasDaCarga(fixa(12))).toEqual({});
    expect(problemasDaCarga(fixa(12.25))).toEqual({});
    expect(problemasDaCarga(fixa(1000))).toEqual({});
    for (const kg of [null, 0, -5, 1000.5, 12.345]) {
      expect(problemasDaCarga(fixa(kg))).toEqual({ valorKg: 'Carga fixa: maior que zero e até 1000 kg.' });
    }
    expect(problemasDaCarga({ ...fixa(12), percentualMin: 10 })).toEqual({ percentualMin: 'Carga fixa não leva percentual.' });
  });

  it('as outras formas recusam valorKg', () => {
    expect(problemasDaCarga({ ...carga('CARGA_TRABALHO'), valorKg: 10 })).toEqual({ valorKg: 'Só a carga fixa leva valor em kg.' });
    expect(problemasDaCarga({ ...carga('CARGA_TRABALHO'), valorKg: null })).toEqual({});
  });

  it('a série com carga fixa passa pelo validador da série', () => {
    expect(problemasDaSerie(aquecimento('a'), false)).toEqual({});
    expect(problemasDaSerie(aquecimento('a', { carga: fixa(null) }), false)).toHaveProperty(['carga.valorKg']);
  });

  it('só em exercício com carga', () => {
    const semCarga = exercicio('e', { unidade: 'nenhuma', series: [aquecimento('a')] });
    expect(mensagens(validarExercicio(semCarga, null).erros)).toContain('Carga fixa só em exercício com carga.');
    const comCarga = exercicio('e', { unidade: 'kg', series: [aquecimento('a'), serie('ws')] });
    expect(validarExercicio(comCarga, null).erros).toEqual([]);
  });

  it('WS de 12 kg seguida de Back off em %: avisa que não há série de trabalho (a fixa não é a base do %)', () => {
    const aviso = 'Há série em % da WS sem série de trabalho: a referência será a carga de trabalho que o aluno digitar.';
    const backOff = serie('bo', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 8, carga: carga('PERCENTUAL_WS', 85) });
    const wsFixa = serie('ws', { repsMin: 12, repsMax: 12, carga: fixa(12) });
    const comFixa = validarExercicio(exercicio('e', { unidade: 'kg', series: [wsFixa, backOff] }), CONFIGURACAO_PADRAO);
    expect(comFixa.erros).toEqual([]);
    expect(mensagens(comFixa.avisos)).toContain(aviso);
    const comTrabalho = validarExercicio(exercicio('e', { unidade: 'kg', series: [serie('ws', { repsMin: 12, repsMax: 12 }), backOff] }), CONFIGURACAO_PADRAO);
    expect(mensagens(comTrabalho.avisos)).not.toContain(aviso);
  });
});

describe('carga fixa: texto, meta e sugestão', () => {
  it('mostra os kg e usa o valor como sugestão, sem arredondar nem usar a base do dia', () => {
    expect(textoCarga(fixa(12))).toBe('12 kg');
    expect(textoCarga(fixa(12.5))).toBe('12,5 kg');
    expect(textoCarga(fixa(null))).toBe('');
    const s = aquecimento('a', { repsMin: 10, repsMax: 10 });
    expect(metaDaSerie(s, 'WS', false, CONFIGURACAO_PADRAO)).toBe('Meta: 10 reps · 12 kg');
    const [calculada] = calcularCargasDoExercicio(exercicio('e', { series: [s] }), 80, {}, { arredondamentoKg: 2.5, tipoTrabalho: 'WS' });
    expect(calculada.sugestao).toBe(12);
    expect(calculada.referencia).toBeNull();
    expect(textoDaOrigem(calculada)).toBe('carga definida pelo treinador');
  });

  it('em exercício sem carga não mostra kg nem sugestão', () => {
    const s = aquecimento('a');
    expect(metaDaSerie(s, 'WS', true, CONFIGURACAO_PADRAO)).not.toContain('kg');
    const [calculada] = calcularCargasDoExercicio(exercicio('e', { unidade: 'nenhuma', series: [s] }), 80, {}, { arredondamentoKg: 2.5, tipoTrabalho: 'WS' });
    expect(calculada.sugestao).toBeNull();
  });

  it('a prévia do grupo (Para o aluno) traz a carga; sem kg ainda, sem linha de carga', () => {
    const [grupo] = agrupar([aquecimento('a')]);
    expect(previaDoGrupo(grupo, CONFIGURACAO_PADRAO, {}).linhas).toContain('Carga: 12 kg');
    const [vazio] = agrupar([aquecimento('a', { carga: fixa(null) })]);
    expect(previaDoGrupo(vazio, CONFIGURACAO_PADRAO, {}).linhas.some((l) => l.startsWith('Carga'))).toBe(false);
  });

  it('o resumo do grupo leva os kg; kg diferentes não se juntam', () => {
    const iguais = agrupar([aquecimento('a'), aquecimento('b')]);
    expect(iguais).toHaveLength(1);
    expect(descreverGrupo(iguais[0], CONFIGURACAO_PADRAO)).toContain('12 kg');
    expect(agrupar([aquecimento('a'), aquecimento('b', { carga: fixa(14) })])).toHaveLength(2);
  });
});

describe('carga fixa: editor', () => {
  it('é oferecida em todos os papéis que aceitam carga, e só neles', () => {
    for (const papel of ['AQUECIMENTO', 'PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'OUTRO', null] as const) {
      expect(modos(papel)).toContain('CARGA_FIXA');
    }
    expect(modos()).toContain('CARGA_FIXA');
  });

  it('a série de trabalho oferece a carga de trabalho e a fixa', () => {
    expect(modos('TRABALHO')).toEqual(['CARGA_TRABALHO', 'CARGA_FIXA']);
  });

  it('nasce vazia (kg nulos) e some ao trocar de forma; as outras formas não ganham valorKg', () => {
    expect(cargaDoModo('CARGA_FIXA')).toEqual({ modo: 'CARGA_FIXA', percentualMin: null, percentualMax: null, valorKg: null });
    expect(cargaDoModo('PERCENTUAL_WS')).not.toHaveProperty('valorKg');
    const series = [aquecimento('a'), aquecimento('b')];
    const [grupo] = agrupar(series);
    const trocado = alterarGrupo(series, grupo, { modo: 'PERCENTUAL_WS' }, CONFIGURACAO_PADRAO);
    expect(trocado.every((s) => s.carga?.modo === 'PERCENTUAL_WS' && s.carga.valorKg == null)).toBe(true);
    const fixado = alterarGrupo(series, grupo, { carga: { valorKg: 20 } }, CONFIGURACAO_PADRAO);
    expect(fixado.map((s) => s.carga?.valorKg)).toEqual([20, 20]);
    expect(alterarPercentuais(series, 0, 50, 60)[0].carga).toEqual({ modo: 'PERCENTUAL_WS', percentualMin: 50, percentualMax: 60 });
  });

  it('a cópia de séries (receita) preserva os kg', () => {
    expect(seriesDaReceita({ series: [aquecimento('a')] })[0].carga?.valorKg).toBe(12);
  });

  it('a carga das etapas usa o mesmo texto da carga da série (C03)', () => {
    expect(opcoesDaCargaDaEtapa('WS')[1].rotulo).toBe('Percentual da carga de trabalho (WS)');
    expect(opcoesDaCargaDaEtapa('série de trabalho')[1].rotulo).toBe('Percentual da carga de trabalho');
  });
});

describe('pacote offline com carga fixa', () => {
  const pacote = (c: unknown) => ({
    salvoEm: '2026-10-22T10:00:00Z',
    pacote: {
      configuracao: { tipoTrabalho: 'WS', arredondamentoKg: 0.5 },
      treino: { conteudo: { objetivo: null, orientacoes: null, sessoes: [sessao('s', [exercicio('e', { series: [serie('a', { carga: c as never })] })])] } },
    },
  });

  it('aceita valorKg numérico e recusa texto; chave a mais na carga é tolerada (treinador mais novo que o app)', () => {
    expect(pacoteNoFormatoAtual(pacote(fixa(12)))).toBe(true);
    expect(pacoteNoFormatoAtual(pacote({ ...fixa(12), valorKg: '12' }))).toBe(false);
    expect(pacoteNoFormatoAtual(pacote({ ...fixa(12), outro: 1 }))).toBe(true); // invertido de propósito: a carga é a parte tolerante
  });
});

describe('RIR de 0 a 10, por série, dentro do mesmo grupo', () => {
  const quatro = () => [3, 2, 2, 1].map((v, i) => serie(`s${i}`, { esforco: rir(v) }));

  it('as opções vão de 0 (até a falha) a 10', () => {
    expect(OPCOES_DE_RIR).toHaveLength(11);
    expect(OPCOES_DE_RIR[10]).toEqual({ valor: 10, rotulo: '10' });
  });

  it('quatro séries iguais com RIR diferentes continuam um grupo', () => {
    expect(agrupar(quatro())).toHaveLength(1);
  });

  it('RIR, RPE e esforço ausente na mesma série igual ainda são um grupo; o texto mostra cada um', () => {
    expect(agrupar([serie('a', { esforco: rir(2) }), serie('b', { esforco: rpe(8) })])).toHaveLength(1);
    expect(agrupar([serie('a', { esforco: rir(2) }), serie('b')])).toHaveLength(1);
    expect(textoEsforcoDoGrupo({ series: [serie('a', { esforco: rir(2) }), serie('b')] })).toBe('RIR 2, —');
  });

  it('o texto do grupo lista o RIR de cada série; igual vira um só', () => {
    const [g] = agrupar(quatro());
    expect(textoEsforcoDoGrupo(g)).toBe('RIR 3, 2, 2, 1');
    expect(descreverGrupo(g, CONFIGURACAO_PADRAO)).toContain('· RIR 3, 2, 2, 1');
    expect(textoEsforcoDoGrupo({ series: [serie('a', { esforco: rir(2) }), serie('b', { esforco: rir(2) })] })).toBe('2 RIR');
    expect(textoEsforcoDoGrupo({ series: [serie('a', { esforco: rir(1) }), serie('b', { esforco: rir(0) })] })).toBe('RIR 1, falha');
    expect(textoEsforcoDoGrupo({ series: [serie('a', { esforco: rpe(7) }), serie('b', { esforco: rpe(8.5) })] })).toBe('RPE 7, 8,5');
    expect(textoEsforcoDoGrupo({ series: [serie('a'), serie('b')] })).toBe('');
    expect(previaDoGrupo(g, CONFIGURACAO_PADRAO, {}).linhas).toContain('Esforço: RIR 3, 2, 2, 1');
  });

  it('alterarRirDaSerie muda só o RIR daquela série, sem tirar a série do grupo', () => {
    const depois = alterarRirDaSerie(quatro(), 1, 5);
    expect(depois.map((s) => s.esforco?.rir)).toEqual([3, 5, 2, 1]);
    expect(agrupar(depois)).toHaveLength(1);
    expect(alterarRirDaSerie(quatro(), 0, 0)[0].esforco).toEqual({ rir: 0, rpe: null });
    expect(alterarRirDaSerie([serie('a', { esforco: rpe(7) })], 0, 9)[0].esforco).toEqual({ rir: 9, rpe: null });
  });

  it('põe o RIR em série sem esforço, tira com nulo e ignora índice fora da lista', () => {
    const series = [serie('a'), serie('b', { esforco: rir(2) })];
    expect(alterarRirDaSerie(series, 0, 3)[0].esforco).toEqual({ rir: 3, rpe: null });
    expect(alterarRirDaSerie(series, 1, null)[1].esforco).toBeNull();
    expect(alterarRirDaSerie(series, 7, 3)).toEqual(series);
  });

  it('alterarGrupo segue copiando o esforço para todas as séries do grupo', () => {
    const series = quatro();
    const [g] = agrupar(series);
    expect(alterarGrupo(series, g, { esforco: rir(4) }, CONFIGURACAO_PADRAO).map((s) => s.esforco?.rir)).toEqual([4, 4, 4, 4]);
  });

  it('mexer em outro campo do grupo não apaga o RIR de cada série', () => {
    const series = quatro();
    const [g] = agrupar(series);
    const mudancas = [
      { repsMin: 10, repsMax: 12 }, { descansoSegundos: 90 }, { modo: 'CARGA_TRABALHO' as const },
      { carga: { modo: 'CARGA_FIXA' as const, valorKg: 12 } }, { tecnica: null }, { amrap: true },
    ];
    for (const mudanca of mudancas) {
      expect(alterarGrupo(series, g, mudanca, CONFIGURACAO_PADRAO).map((s) => s.esforco?.rir)).toEqual([3, 2, 2, 1]);
    }
  });
});

describe('mostraRpe', () => {
  it('esconde o RPE no aquecimento e na preparação, a menos que já esteja gravado', () => {
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'WARM_UP')).toBe(false);
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'FEEDER')).toBe(false);
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'WARM_UP', rir(2))).toBe(false);
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'WARM_UP', rpe(6))).toBe(true);
  });

  it('o esforço padrão do tipo na metodologia segue a mesma regra pelo papel', () => {
    expect(mostraRpeNoPapel('AQUECIMENTO', null)).toBe(false);
    expect(mostraRpeNoPapel('PREPARACAO', rir(1))).toBe(false);
    expect(mostraRpeNoPapel('PREPARACAO', rpe(7))).toBe(true);
    expect(mostraRpeNoPapel('TRABALHO', null)).toBe(true);
    expect(mostraRpeNoPapel('POS_TRABALHO', null)).toBe(true);
  });

  it('mostra nos outros papéis e em tipo fora da metodologia', () => {
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'WORKING')).toBe(true);
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'BACK_OFF')).toBe(true);
    expect(mostraRpe(CONFIGURACAO_PADRAO, 'INEXISTENTE')).toBe(true);
    expect(mostraRpe(null, null)).toBe(true);
  });
});
