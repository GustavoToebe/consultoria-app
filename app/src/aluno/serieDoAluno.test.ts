import { calcularCargasDoExercicio } from '../dominio/cargas';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { carga, exercicio, rir, rpe, serie, tecnica } from '../dominio/exemplosDeTreino.apoioTeste';
import { dicaDaCarga, ehExercicioDeCardio, linhasDoCardio, nomeDaSerieNoHistorico, selosDaSerie, textosDaSerie } from './serieDoAluno';

const metodologia = {
  ...CONFIGURACAO_PADRAO,
  tipos: CONFIGURACAO_PADRAO.tipos.map((t) => (t.codigo === 'WORKING' ? { ...t, nome: 'Trabalho', explicacao: 'Série principal.' } : t)),
  tecnicas: CONFIGURACAO_PADRAO.tecnicas.map((t) => (t.tipo === 'REST_PAUSE' ? { ...t, nome: 'Muscle Round', explicacao: 'Pausa curta e continue.' } : t)),
};

describe('selos da série', () => {
  it('tipo e técnica são selos separados, pelo nome da metodologia e nunca pelo código', () => {
    const s = serie('a', { tipo: 'WORKING', tecnica: tecnica('REST_PAUSE', { pausas: 1, pausaSegundos: 20 }) });
    const selos = selosDaSerie(s, metodologia);
    expect(selos.tipo).toEqual({ nome: 'Trabalho', explicacao: 'Série principal.' });
    expect(selos.tecnica).toEqual({ nome: 'Muscle Round', explicacao: 'Pausa curta e continue.' });
    expect(JSON.stringify(selos)).not.toMatch(/WORKING|REST_PAUSE/);
  });

  it('série sem técnica não tem selo de técnica; série sem tipo (só técnica) não tem selo de tipo', () => {
    expect(selosDaSerie(serie('a'), metodologia).tecnica).toBeNull();
    const soTecnica = selosDaSerie(serie('b', { tipo: null, tecnica: tecnica('DROP_SET', { quedas: 1 }) }), metodologia);
    expect(soTecnica.tipo).toBeNull();
    expect(soTecnica.tecnica).not.toBeNull();
  });

  it('explicação ausente fica nula (a tela diz que o treinador não escreveu)', () => {
    const semExplicacao = { ...metodologia, tipos: metodologia.tipos.map((t) => ({ ...t, explicacao: null })) };
    expect(selosDaSerie(serie('a'), semExplicacao).tipo?.explicacao).toBeNull();
  });
});

describe('textos da série', () => {
  const contexto = { tipoTrabalho: 'Trabalho', semCarga: false, metodologia, descansoPorSerie: true };

  it('meta sem técnica nem alvo extra, que têm linha própria; descanso e AMRAP à parte', () => {
    const s = serie('a', {
      repsMin: 3,
      repsMax: 6,
      esforco: rir(1),
      descansoSegundos: 90,
      alvoExtra: 'Parar se perder a postura',
      tecnica: tecnica('REST_PAUSE', { pausas: 1, pausaSegundos: 20 }),
    });
    const t = textosDaSerie(s, { ...contexto, seriesDoExercicio: [s] });
    expect(t.meta).toBe('Meta: 3 a 6 reps · carga de trabalho · 1 RIR');
    expect(t.descanso).toBe('Descanso 1 min 30 s');
    expect(t.alvoExtra).toBe('Parar se perder a postura');
    expect(t.tecnica).toContain('Muscle Round');
    expect(t.amrap).toBe(false);
  });

  it('descanso vale para o grupo: a série não repete o descanso', () => {
    const s = serie('a', { descansoSegundos: 90 });
    expect(textosDaSerie(s, { ...contexto, descansoPorSerie: false, seriesDoExercicio: [s] }).descanso).toBeNull();
  });

  it('AMRAP é explícito e RIR 0 é "até a falha"; RPE aparece como RPE', () => {
    const amrap = serie('a', { repsMin: null, repsMax: null, amrap: true, esforco: rir(0) });
    const t = textosDaSerie(amrap, { ...contexto, seriesDoExercicio: [amrap] });
    expect(t.amrap).toBe(true);
    expect(t.meta).toContain('AMRAP');
    expect(t.meta).toContain('até a falha');
    const comRpe = serie('b', { esforco: rpe(8.5) });
    expect(textosDaSerie(comRpe, { ...contexto, seriesDoExercicio: [comRpe] }).meta).toContain('RPE 8,5');
  });

  it('alvo extra em branco não aparece', () => {
    const s = serie('a', { alvoExtra: '   ' });
    expect(textosDaSerie(s, { ...contexto, seriesDoExercicio: [s] }).alvoExtra).toBeNull();
  });
});

describe('dica da carga', () => {
  const top = serie('top', { tipo: 'TOP_SET', repsMin: 3, repsMax: 5, carga: carga('ACIMA_DA_ANTERIOR', 1, 5) });
  const back = serie('back', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'top') });
  const base = { digitou: false, tipoTrabalho: 'Trabalho', metodologia: CONFIGURACAO_PADRAO, seriesDoExercicio: [top, back] };

  it('back off abaixo da referência sem a referência registrada: não há sugestão e a dica diz o que falta', () => {
    const dica = dicaDaCarga(back, { ...base, sugestao: null });
    expect(dica).toContain('Registre a carga da série de referência');
    expect(dica).toContain('Top set');
  });

  it('back off com referência registrada: a dica explica de onde vem o peso', () => {
    const dica = dicaDaCarga(back, { ...base, sugestao: 85 });
    expect(dica).toContain('registrou hoje na série de referência');
    expect(dica).toContain('Top set');
  });

  it('a dica some quando o aluno digita o próprio peso', () => {
    expect(dicaDaCarga(back, { ...base, sugestao: 85, digitou: true })).toBeNull();
  });

  it('mesma carga da WS usa o nome do tipo de trabalho da metodologia', () => {
    const mesma = serie('m', { carga: carga('MESMA_CARGA') });
    expect(dicaDaCarga(mesma, { ...base, sugestao: 100 })).toBe('Mesma carga da Trabalho; mude se usar outra.');
  });

  it('série em percentual com sugestão: peso sugerido pelo plano', () => {
    const fs = serie('f', { tipo: 'FEEDER', carga: carga('PERCENTUAL_WS', 50) });
    expect(dicaDaCarga(fs, { ...base, sugestao: 50 })).toBe('Peso sugerido pelo plano; mude se usar outro.');
  });

  it('sem sugestão e sem ser abaixo da referência: nenhuma dica', () => {
    expect(dicaDaCarga(serie('w'), { ...base, sugestao: null })).toBeNull();
  });
});

describe('top set e back off sobre a carga registrada hoje', () => {
  const top = serie('top', { tipo: 'TOP_SET', repsMin: 3, repsMax: 5, carga: carga('ACIMA_DA_ANTERIOR', 5, 10) });
  const back1 = serie('b1', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'top') });
  const back2 = serie('b2', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'top') });
  const ex = exercicio('e', { series: [serie('w'), top, back1, back2] });
  const config = { arredondamentoKg: 2.5, tipoTrabalho: 'WS', metodologia: CONFIGURACAO_PADRAO };

  it('sem registro da referência, o back off não tem sugestão', () => {
    const calculadas = calcularCargasDoExercicio(ex, 80, { w: 80 }, config);
    expect(calculadas[2].sugestao).toBeNull();
    expect(calculadas[3].sugestao).toBeNull();
  });

  it('com a Top registrada, as duas séries de back off saem dela menos 15%, arredondado', () => {
    const calculadas = calcularCargasDoExercicio(ex, 80, { w: 80, top: 100 }, config);
    expect(calculadas[2].sugestao).toBe(85);
    expect(calculadas[3].sugestao).toBe(85);
  });
});

describe('cardio', () => {
  it('uma informação por linha', () => {
    expect(linhasDoCardio({ duracaoMin: 30, distanciaKm: 5, ritmo: '6:00', zona: 2, intervalos: null })).toEqual([
      'Duração: 30 min',
      'Distância: 5 km',
      'Ritmo: 6:00',
      'Zona: 2',
    ]);
  });

  it('intervalos com voltas, esforço e descanso', () => {
    expect(linhasDoCardio({ intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } })).toEqual(['Intervalos: 8 voltas · 30 s de esforço · 60 s de descanso']);
    expect(linhasDoCardio({ intervalos: { trabalhoSeg: null, descansoSeg: null, voltas: 1 } })).toEqual(['Intervalos: 1 volta']);
  });

  it('sem prescrição, nenhuma linha', () => {
    expect(linhasDoCardio(null)).toEqual([]);
    expect(linhasDoCardio(undefined)).toEqual([]);
  });

  it('exercício é de cardio pela modalidade ou por ter série de cardio', () => {
    expect(ehExercicioDeCardio({ modalidade: 'CARDIO', series: [] })).toBe(true);
    expect(ehExercicioDeCardio({ modalidade: null, series: [serie('a', { cardio: { duracaoMin: 20 } })] })).toBe(true);
    expect(ehExercicioDeCardio({ modalidade: 'LIVRE', series: [serie('a')] })).toBe(false);
  });
});

describe('nome da série no histórico', () => {
  it('usa o nome do tipo da metodologia, nunca o código', () => {
    expect(nomeDaSerieNoHistorico(serie('a', { tipo: 'WORKING' }), metodologia)).toBe('Trabalho');
    expect(nomeDaSerieNoHistorico(serie('b', { tipo: 'BACK_OFF' }), metodologia)).not.toContain('BACK_OFF');
  });

  it('série sem tipo (cardio) ou fora do plano salvo vira "Série"', () => {
    expect(nomeDaSerieNoHistorico(serie('c', { tipo: null }), metodologia)).toBe('Série');
    expect(nomeDaSerieNoHistorico(undefined, metodologia)).toBe('Série');
  });
});
