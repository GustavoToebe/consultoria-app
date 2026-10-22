import type { Configuracao, ExercicioPlano, Serie } from '../api/tipos';
import { carga, exercicio, grupo, rir, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { problemasDaSerieNoExercicio, serieDeTrabalho, validarExercicio, validarSessao, validarTreino } from './validacaoDoTreino';

const ws = (uid: string, extra: Partial<Serie> = {}) => serie(uid, { repsMin: 3, repsMax: 6, ...extra });
const comSeries = (series: Serie[], extra: Partial<ExercicioPlano> = {}) => exercicio('e', { nome: 'Remada', series, ...extra });
const caminhos = (lista: { caminho: string }[]) => lista.map((p) => p.caminho);

describe('exercício', () => {
  it('exercício completo e correto não tem erro nem aviso', () => {
    expect(validarExercicio(comSeries([ws('a'), serie('b', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'a') })]), CONFIGURACAO_PADRAO)).toEqual({ erros: [], avisos: [] });
  });

  it('nome, séries, cadência e isometria', () => {
    const r = validarExercicio(comSeries([], { nome: ' ', cadencia: '3-1-1', isometriaSegundos: 121 }), null);
    expect(r.erros).toEqual([
      { caminho: 'nome', mensagem: 'Exercício sem nome.' },
      { caminho: 'cadencia', mensagem: 'Cadência em 4 partes separadas por hífen, cada uma de 0 a 9 ou X (ex.: 3-1-1-0).' },
      { caminho: 'isometriaSegundos', mensagem: 'Isometria de 1 a 120 segundos.' },
      { caminho: 'series', mensagem: 'Exercício sem série.' },
    ]);
    expect(validarExercicio(comSeries([ws('a')], { cadencia: '3-1-X-0', isometriaSegundos: 30 }), null).erros).toEqual([]);
  });

  it('os problemas da série saem com o caminho completo e o prefixo pedido', () => {
    const e = comSeries([ws('a'), ws('b', { carga: carga('PERCENTUAL_WS', 0) })]);
    expect(caminhos(validarExercicio(e, null).erros)).toEqual(['series[1].carga.percentualMin']);
    expect(caminhos(validarExercicio(e, null, 'sessoes[0].exercicios[2]').erros)).toEqual(['sessoes[0].exercicios[2].series[1].carga.percentualMin']);
  });

  it('mesma carga precisa de uma série de trabalho antes', () => {
    const r = validarExercicio(comSeries([serie('a', { carga: carga('MESMA_CARGA') }), ws('b')]), null);
    expect(r.erros).toEqual([{ caminho: 'series[0].carga.modo', mensagem: 'Mesma carga da WS: precisa de uma série de trabalho antes, no mesmo exercício.' }]);
    expect(validarExercicio(comSeries([ws('b'), serie('a', { carga: carga('MESMA_CARGA') })]), null).erros).toEqual([]);
  });

  it('acima da anterior na primeira série é aviso, não erro', () => {
    const r = validarExercicio(comSeries([serie('a', { tipo: 'TOP_SET', carga: carga('ACIMA_DA_ANTERIOR', 1, 5) })]), null);
    expect(r.erros).toEqual([]);
    expect(caminhos(r.avisos)).toEqual(['series[0].carga.modo']);
    expect(validarExercicio(comSeries([ws('a'), serie('b', { tipo: 'TOP_SET', carga: carga('ACIMA_DA_ANTERIOR', 1, 5) })]), null).avisos).toEqual([]);
  });

  it('a referência do back off precisa ser uma série anterior do mesmo exercício', () => {
    const back = (ref: string) => serie('b', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, ref) });
    expect(validarExercicio(comSeries([ws('a'), back('a')]), null).erros).toEqual([]);
    for (const ref of ['sumiu', 'b']) {
      expect(validarExercicio(comSeries([ws('a'), back(ref)]), null).erros).toEqual([
        { caminho: 'series[1].carga.referenciaUid', mensagem: 'A referência precisa ser uma série anterior, no mesmo exercício.' },
      ]);
    }
    const depois = comSeries([serie('b', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'a') }), ws('a')]);
    expect(caminhos(validarExercicio(depois, null).erros)).toEqual(['series[0].carga.referenciaUid']);
    expect(caminhos(validarExercicio(comSeries([ws('a'), serie('b', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15) })]), null).erros)).toEqual(['series[1].carga.referenciaUid']);
  });

  it('avisos: tipo fora da metodologia (uma vez por tipo), RIR 0 em preparação, % sem trabalho, sem progressão, forced reps', () => {
    const e = comSeries([serie('a', { tipo: 'PIRAMIDE' }), serie('b', { tipo: 'PIRAMIDE' })]);
    const r = validarExercicio(e, CONFIGURACAO_PADRAO);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0].caminho).toBe('series[0].tipo');
    expect(r.avisos[0].mensagem).toContain('"PIRAMIDE" não está na metodologia do plano');
    expect(validarExercicio(e, null).avisos).toEqual([]);

    const fs = serie('f', { tipo: 'FEEDER', carga: carga('PERCENTUAL_WS', 85), esforco: rir(0), repsMin: 3, repsMax: 3 });
    expect(caminhos(validarExercicio(comSeries([fs]), CONFIGURACAO_PADRAO).avisos)).toEqual(['series[0].esforco.rir', 'series']);
    expect(caminhos(validarExercicio(comSeries([ws('a')], { progressao: false }), null).avisos)).toEqual(['progressao']);
    const forced = ws('a', { tecnica: { tipo: 'FORCED_REPS', repsAssistidas: 2 } });
    expect(caminhos(validarExercicio(comSeries([forced]), null).avisos)).toEqual(['series[0].tecnica']);
  });

  it('exercício de cardio: só a prescrição de cardio e nada das regras de carga', () => {
    const cardio = serie('c', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20 } });
    expect(validarExercicio(comSeries([cardio], { modalidade: 'CARDIO', progressao: false }), CONFIGURACAO_PADRAO)).toEqual({ erros: [], avisos: [] });
    expect(caminhos(validarExercicio(comSeries([ws('a')], { modalidade: 'CARDIO' }), null).erros).sort()).toEqual(['series[0].carga', 'series[0].repsMin', 'series[0].tipo', 'series[0].cardio'].sort());
  });

  it('série de trabalho é a de carga de trabalho, nunca pelo nome do tipo', () => {
    expect(serieDeTrabalho(ws('a'))).toBe(true);
    expect(serieDeTrabalho(serie('b', { tipo: 'WS', carga: carga('MESMA_CARGA') }))).toBe(false);
    expect(serieDeTrabalho(serie('c', { carga: null }))).toBe(false);
  });

  it('erros e avisos de uma série por campo, relativos a ela', () => {
    const e = comSeries([ws('a'), ws('b', { carga: carga('PERCENTUAL_WS', 0), esforco: rir(0), tipo: 'FEEDER' })]);
    const r = problemasDaSerieNoExercicio(e, 1, CONFIGURACAO_PADRAO);
    expect(r.erros).toEqual({ 'carga.percentualMin': 'Percentual da WS entre 1 e 200.' });
    expect(Object.keys(r.avisos)).toEqual(['esforco.rir']);
    expect(problemasDaSerieNoExercicio(e, 0, CONFIGURACAO_PADRAO)).toEqual({ erros: {}, avisos: {} });
  });
});

describe('grupos da sessão', () => {
  const ex = (uid: string, grupoUid: string | null = null) => comSeries([ws(`${uid}-s`)], { uid, grupoUid });
  const erros = (s: ReturnType<typeof sessao>) => validarSessao(s, null).erros;

  it('grupo correto não tem problema', () => {
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g'), ex('c')], [grupo('g', 'SUPERSET')]))).toEqual([]);
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g')], [grupo('g', 'PRE_EXAUSTAO')]))).toEqual([]);
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g'), ex('c', 'g')], [grupo('g', 'CIRCUITO', { voltas: 3, descansoAposSegundos: 60 })]))).toEqual([]);
  });

  it('circuito: voltas diferentes das séries de um membro só avisa (o aluno registra uma série por volta)', () => {
    const tres = [ex('a', 'g'), ex('b', 'g'), ex('c', 'g')];
    const r = validarSessao(sessao('s', tres, [grupo('g', 'CIRCUITO', { voltas: 2, descansoAposSegundos: 60 })]), null);
    expect(r.erros).toEqual([]);
    expect(r.avisos.map((a) => [a.caminho, a.mensagem])).toContainEqual(['grupos[0].voltas', 'Circuito de 2 voltas: o aluno registra uma série por volta, então cada exercício precisa de 2 séries (Remada tem 1).']);
    expect(validarSessao(sessao('s', tres, [grupo('g', 'CIRCUITO', { voltas: 1 })]), null).avisos.filter((a) => a.caminho.startsWith('grupos'))).toEqual([]);
  });

  it('o caminho das séries leva o índice do exercício dentro da sessão', () => {
    const s = sessao('s', [ex('a'), comSeries([ws('x', { carga: carga('PERCENTUAL_WS', 0) })], { uid: 'b' })]);
    expect(caminhos(validarSessao(s, null).erros)).toEqual(['exercicios[1].series[0].carga.percentualMin']);
  });

  it('técnica inválida, grupo sem exercícios e exercício apontando para grupo que não existe', () => {
    expect(caminhos(erros(sessao('s', [ex('a', 'g'), ex('b', 'g')], [grupo('g', 'XYZ' as never)])))).toContain('grupos[0].tecnica');
    expect(erros(sessao('s', [ex('a')], [grupo('g', 'SUPERSET')]))).toEqual([{ caminho: 'grupos[0]', mensagem: 'Grupo sem exercícios.' }]);
    expect(erros(sessao('s', [ex('a', 'fantasma')], []))).toEqual([{ caminho: 'exercicios[0].grupoUid', mensagem: 'O grupo do exercício não existe na sessão.' }]);
  });

  it('mínimos por técnica, pré e pós-exaustão com exatamente 2 e teto de 6', () => {
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g')], [grupo('g', 'TRI_SET')]))).toEqual([{ caminho: 'grupos[0]', mensagem: 'Esse grupo precisa de pelo menos 3 exercícios.' }]);
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g'), ex('c', 'g')], [grupo('g', 'GIANT_SET')])).map((p) => p.mensagem)).toEqual(['Esse grupo precisa de pelo menos 4 exercícios.']);
    expect(erros(sessao('s', [ex('a', 'g'), ex('b', 'g'), ex('c', 'g')], [grupo('g', 'POS_EXAUSTAO')]))).toEqual([{ caminho: 'grupos[0]', mensagem: 'Pré e pós-exaustão têm exatamente 2 exercícios.' }]);
    const sete = ['a', 'b', 'c', 'd', 'e', 'f', 'g7'].map((u) => ex(u, 'g'));
    expect(erros(sessao('s', sete, [grupo('g', 'GIANT_SET')]))).toEqual([{ caminho: 'grupos[0]', mensagem: 'Um grupo de exercícios feitos juntos vai até 6 exercícios.' }]);
  });

  it('os membros precisam ficar contíguos', () => {
    expect(erros(sessao('s', [ex('a', 'g'), ex('b'), ex('c', 'g')], [grupo('g', 'SUPERSET')]))).toEqual([
      { caminho: 'grupos[0]', mensagem: 'Os exercícios de um grupo precisam ficar um ao lado do outro na sessão.' },
    ]);
  });

  it('circuito: de 1 a 20 voltas; descanso depois do grupo de 0 a 3600 e nunca na pré e pós-exaustão', () => {
    const tres = [ex('a', 'g'), ex('b', 'g'), ex('c', 'g')];
    expect(caminhos(erros(sessao('s', tres, [grupo('g', 'CIRCUITO')])))).toEqual(['grupos[0].voltas']);
    expect(caminhos(erros(sessao('s', tres, [grupo('g', 'CIRCUITO', { voltas: 21 })])))).toEqual(['grupos[0].voltas']);
    expect(erros(sessao('s', tres, [grupo('g', 'TRI_SET', { descansoAposSegundos: 3601 })]))).toEqual([
      { caminho: 'grupos[0].descansoAposSegundos', mensagem: 'Descanso depois do grupo entre 0 e 3600 segundos.' },
    ]);
    expect(erros(sessao('s', tres.slice(0, 2), [grupo('g', 'PRE_EXAUSTAO', { descansoAposSegundos: 60 })]))).toEqual([
      { caminho: 'grupos[0].descansoAposSegundos', mensagem: 'Pré e pós-exaustão não têm descanso depois do grupo: cada série mantém o próprio.' },
    ]);
  });
});

describe('sessão', () => {
  const treino = (extra = {}, exercicios = [comSeries([ws('a')])]) => sessao('s', exercicios, [], extra);
  const erros = (s: ReturnType<typeof sessao>) => validarSessao(s, null).erros;

  it('sessão correta não tem problema', () => {
    expect(validarSessao(treino({ diaSemana: 1, frequenciaSemanal: 2 }), null)).toEqual({ erros: [], avisos: [] });
  });

  it('nome, tipo, dia da semana e frequência, com o caminho e a mensagem do servidor', () => {
    expect(erros(treino({ nome: ' ' }))).toEqual([{ caminho: 'nome', mensagem: 'Sessão sem nome.' }]);
    expect(erros(treino({ tipo: 'OUTRO' as never }))).toEqual([{ caminho: 'tipo', mensagem: 'Tipo de sessão inválido.' }]);
    for (const dia of [0, 8]) {
      expect(erros(treino({ diaSemana: dia }))).toEqual([{ caminho: 'diaSemana', mensagem: 'Dia da semana precisa ser de 1 (segunda) a 7 (domingo).' }]);
    }
    for (const f of [0, 8]) {
      expect(erros(treino({ frequenciaSemanal: f }))).toEqual([{ caminho: 'frequenciaSemanal', mensagem: 'Frequência semanal precisa ser de 1 a 7.' }]);
    }
  });

  it('sessão de treino sem exercício é erro; descanso e acessórios sem exercício, não', () => {
    expect(erros(treino({}, []))).toEqual([{ caminho: 'exercicios', mensagem: 'Sessão de treino sem exercício.' }]);
    expect(erros(treino({ tipo: 'DESCANSO' }, []))).toEqual([]);
    expect(erros(treino({ tipo: 'ACESSORIOS' }, []))).toEqual([]);
  });

  it('sessão sem uid é erro', () => {
    expect(erros({ ...treino(), uid: '' })).toEqual([{ caminho: 'uid', mensagem: 'Item sem identificador.' }]);
  });
});

describe('exercício: vídeo e unidade', () => {
  it('só https do YouTube, até 500 caracteres e sem outra porta', () => {
    const erro = { caminho: 'videoUrl', mensagem: 'Link de vídeo não aceito (só https do YouTube).' };
    expect(validarExercicio(comSeries([ws('a')], { videoUrl: 'https://youtu.be/abc' }), null).erros).toEqual([]);
    expect(validarExercicio(comSeries([ws('a')], { videoUrl: 'https://www.youtube.com:443/watch?v=abc' }), null).erros).toEqual([]);
    expect(validarExercicio(comSeries([ws('a')], { videoUrl: ' ' }), null).erros).toEqual([]);
    for (const url of ['http://youtu.be/abc', 'https://exemplo.com/v', 'javascript:alert(1)', 'https://youtu.be:8443/a', `https://youtu.be/${'a'.repeat(500)}`]) {
      expect(validarExercicio(comSeries([ws('a')], { videoUrl: url }), null).erros).toEqual([erro]);
    }
  });

  it('unidade: kg ou nenhuma', () => {
    expect(validarExercicio(comSeries([ws('a')], { unidade: 'nenhuma' }), null).erros).toEqual([]);
    expect(validarExercicio(comSeries([ws('a')], { unidade: 'lb' as never }), null).erros).toEqual([{ caminho: 'unidade', mensagem: 'Unidade precisa ser kg ou nenhuma.' }]);
  });
});

describe('treino todo', () => {
  const metodologia = { id: 'm', nome: 'M', configuracao: CONFIGURACAO_PADRAO as Configuracao };
  const dia = (uid: string, extra = {}) => sessao(uid, [comSeries([ws(`${uid}-a`)], { uid: `${uid}-e` })], [], extra);
  const descanso = (uid: string) => sessao(uid, [], [], { tipo: 'DESCANSO' });

  it('caminhos completos a partir das sessões e avisos de tipo só com metodologia vinculada', () => {
    const s0 = dia('s0');
    const s1 = sessao('s1', [comSeries([ws('b', { tipo: 'PIRAMIDE' }), ws('c', { carga: carga('PERCENTUAL_WS', 0) })], { uid: 's1-e' })]);
    const sem = validarTreino({ sessoes: [s0, s1, descanso('d')] });
    expect(caminhos(sem.erros)).toEqual(['sessoes[1].exercicios[0].series[1].carga.percentualMin']);
    expect(sem.avisos).toEqual([]);
    const com = validarTreino({ sessoes: [s0, s1, descanso('d')], metodologia });
    expect(caminhos(com.avisos)).toEqual(['sessoes[1].exercicios[0].series[0].tipo']);
  });

  it('plano sem sessão é erro', () => {
    expect(validarTreino({ sessoes: [] })).toEqual({ erros: [{ caminho: 'sessoes', mensagem: 'O plano não tem nenhuma sessão.' }], avisos: [] });
  });

  it('plano sem dia de descanso é aviso; descanso ou descanso ativo resolvem', () => {
    const aviso = { caminho: 'sessoes', mensagem: 'O plano não tem dia de descanso.' };
    expect(validarTreino({ sessoes: [dia('a')] })).toEqual({ erros: [], avisos: [aviso] });
    expect(validarTreino({ sessoes: [dia('a'), descanso('d')] }).avisos).toEqual([]);
    expect(validarTreino({ sessoes: [dia('a'), sessao('d', [], [], { tipo: 'DESCANSO_ATIVO' })] }).avisos).toEqual([]);
  });

  it('duas sessões no mesmo dia da semana é aviso, uma vez por dia repetido', () => {
    const r = validarTreino({ sessoes: [dia('a', { diaSemana: 1 }), dia('b', { diaSemana: 1 }), dia('c', { diaSemana: 1 }), dia('d', { diaSemana: 2 }), descanso('x')] });
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([{ caminho: 'sessoes[1].diaSemana', mensagem: 'Duas sessões no mesmo dia da semana.' }]);
  });

  it('o fim do período antes do início é aviso, só quando as datas são informadas', () => {
    const base = { sessoes: [dia('a'), descanso('d')] };
    expect(validarTreino(base, { inicio: '2026-10-20', fim: '2026-10-10' }).avisos).toEqual([{ caminho: 'fim', mensagem: 'O fim do período é antes do início.' }]);
    expect(validarTreino(base, { inicio: '2026-10-20', fim: '2026-10-20' }).avisos).toEqual([]);
    expect(validarTreino(base, { inicio: '2026-10-20', fim: null }).avisos).toEqual([]);
    expect(validarTreino(base).avisos).toEqual([]);
  });

  describe('identificadores', () => {
    it('item sem uid em exercício, série e grupo', () => {
      const e = comSeries([ws('a')], { uid: '' });
      expect(validarExercicio(e, null).erros).toEqual([{ caminho: 'uid', mensagem: 'Item sem identificador.' }]);
      expect(validarExercicio(comSeries([ws('')]), null).erros).toEqual([{ caminho: 'series[0].uid', mensagem: 'Item sem identificador.' }]);
      const s = sessao('s', [comSeries([ws('a')], { uid: 'e', grupoUid: 'g' }), comSeries([ws('b')], { uid: 'f', grupoUid: 'g' })], [grupo('', 'SUPERSET')]);
      expect(caminhos(validarSessao(s, null).erros)).toContain('grupos[0].uid');
    });

    it('o mesmo uid em dois exercícios é erro no segundo, com o caminho dele', () => {
      const s = sessao('s', [comSeries([ws('a')], { uid: 'igual' }), comSeries([ws('b')], { uid: 'igual' })]);
      expect(validarSessao(s, null).erros).toEqual([{ caminho: 'exercicios[1].uid', mensagem: 'Identificador repetido.' }]);
    });

    it('vale no plano todo: entre sessões, e entre tipos de item (série igual a exercício, grupo igual a exercício)', () => {
      const a = dia('a');
      const b = { ...dia('b'), uid: 'a' };
      expect(validarTreino({ sessoes: [a, b, descanso('d')] }).erros).toEqual([{ caminho: 'sessoes[1].uid', mensagem: 'Identificador repetido.' }]);
      const serieIgualAoExercicio = sessao('s', [comSeries([ws('x')], { uid: 'x' })]);
      expect(validarSessao(serieIgualAoExercicio, null).erros).toEqual([{ caminho: 'exercicios[0].series[0].uid', mensagem: 'Identificador repetido.' }]);
      const grupoIgualAoExercicio = sessao('s', [comSeries([ws('a')], { uid: 'g', grupoUid: 'g' }), comSeries([ws('b')], { uid: 'f', grupoUid: 'g' })], [grupo('g', 'SUPERSET')]);
      expect(validarSessao(grupoIgualAoExercicio, null).erros).toEqual([{ caminho: 'grupos[0].uid', mensagem: 'Identificador repetido.' }]);
    });

    it('o mesmo conteúdo colado duas vezes sem uids novos repete tudo', () => {
      const um = dia('a');
      const r = validarTreino({ sessoes: [um, um, descanso('d')] });
      expect(caminhos(r.erros)).toEqual(['sessoes[1].uid', 'sessoes[1].exercicios[0].uid', 'sessoes[1].exercicios[0].series[0].uid']);
    });
  });
});
