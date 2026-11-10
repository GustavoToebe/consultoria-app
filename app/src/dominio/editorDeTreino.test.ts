import type { ConteudoTreino } from '../api/tipos';
import { agrupar } from './agrupamento';
import { contarSessao } from './contagemDoTreino';
import { blocosESeries, estadoDaSessao, primeiraPendencia, resumoDoBloco, textoAcessivelDoBloco, textoDaVariacao, textoDeBlocosESeries } from './editorDeTreino';
import { exercicio, rir, serie, sessao, tecnica } from './exemplosDeTreino.apoioTeste';
import { validarTreino } from './validacaoDoTreino';

const bloco = (...series: ReturnType<typeof serie>[]) => ({ inicio: 0, series });
const conteudo = (...sessoes: ReturnType<typeof sessao>[]): ConteudoTreino => ({ objetivo: null, orientacoes: null, sessoes });

describe('resumoDoBloco', () => {
  it('bloco uniforme: nome, quantidade, repetições e descanso reais, sem variação', () => {
    const r = resumoDoBloco(bloco(serie('a', { repsMin: 3, repsMax: 6, descansoSegundos: 90 }), serie('b', { repsMin: 3, repsMax: 6, descansoSegundos: 90 })), null);
    expect(r).toEqual({ nome: 'Trabalho · WS', quantidade: 2, repeticoes: '3 a 6 reps', descanso: '1 min 30 s', variacao: [] });
  });

  it('repetições exatas, AMRAP e por tempo', () => {
    expect(resumoDoBloco(bloco(serie('a', { repsMin: 8, repsMax: 8 })), null).repeticoes).toBe('8 reps');
    expect(resumoDoBloco(bloco(serie('a', { repsMin: null, repsMax: null, amrap: true })), null).repeticoes).toBe('AMRAP');
    expect(resumoDoBloco(bloco(serie('a', { repsMin: null, repsMax: null })), null).repeticoes).toBe('por tempo');
  });

  it('sem descanso mostra "—"; descanso vem com a unidade', () => {
    expect(resumoDoBloco(bloco(serie('a')), null).descanso).toBe('—');
    expect(resumoDoBloco(bloco(serie('a', { descansoSegundos: 30 })), null).descanso).toBe('30 s');
    expect(resumoDoBloco(bloco(serie('a', { descansoSegundos: 120 })), null).descanso).toBe('2 min');
  });

  it('descanso diferente entre as séries do bloco: cada valor em ordem e variação, nunca um valor só', () => {
    const grupos = agrupar([serie('a', { descansoSegundos: 60 }), serie('b', { descansoSegundos: 120 }), serie('c')]);
    expect(grupos).toHaveLength(1); // descanso não separa blocos em `agrupar`
    const r = resumoDoBloco(grupos[0], null);
    expect(r.quantidade).toBe(3);
    expect(r.descanso).toBe('1 min, 2 min, —');
    expect(r.variacao).toEqual(['descanso']);
  });

  it('RIR e percentual diferentes entre as séries do bloco aparecem na variação', () => {
    const grupos = agrupar([serie('a', { esforco: rir(2) }), serie('b', { esforco: rir(1) })]);
    expect(resumoDoBloco(grupos[0], null).variacao).toEqual(['esforco']);
    const iguais = agrupar([serie('a', { esforco: rir(2) }), serie('b', { esforco: rir(2) })]);
    expect(resumoDoBloco(iguais[0], null).variacao).toEqual([]);
    const pct = (min: number) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin: min, percentualMax: min });
    const aquec = agrupar([serie('a', { tipo: 'WARM_UP', carga: pct(50) }), serie('b', { tipo: 'WARM_UP', carga: pct(70) })]);
    expect(resumoDoBloco(aquec[0], null).variacao).toEqual(['carga']);
  });

  it('repetições diferentes (grupo montado à mão) listam cada uma e marcam variação', () => {
    const r = resumoDoBloco(bloco(serie('a', { repsMin: 8, repsMax: 8 }), serie('b', { repsMin: 6, repsMax: 6 })), null);
    expect(r.repeticoes).toBe('8 reps, 6 reps');
    expect(r.variacao).toEqual(['repeticoes']);
  });

  it('a técnica entra no nome', () => {
    expect(resumoDoBloco(bloco(serie('a', { tecnica: tecnica('REST_PAUSE', { pausas: 1, pausaSegundos: 20 }) })), null).nome).toBe('Trabalho · WS + Rest pause');
  });
});

describe('blocos e séries', () => {
  it('conta blocos por agrupar e séries por inteiro, como contarSessao', () => {
    const series = [serie('a'), serie('b'), serie('c', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 8 })];
    expect(blocosESeries(series)).toEqual({ blocos: 2, series: 3 });
    expect(contarSessao(sessao('s', [exercicio('e', { series })])).series).toBe(blocosESeries(series).series);
    expect(textoDeBlocosESeries({ blocos: 2, series: 3 })).toBe('2 blocos · 3 séries');
    expect(textoDeBlocosESeries({ blocos: 1, series: 1 })).toBe('1 bloco · 1 série');
    expect(blocosESeries([])).toEqual({ blocos: 0, series: 0 });
  });
});

describe('primeiraPendencia', () => {
  const plano = conteudo(
    sessao('s0', [exercicio('e0', { series: [serie('a')] })]),
    sessao('s1', [exercicio('e1', { series: [serie('b'), serie('c'), serie('d', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 8 })] })]),
  );

  it('sem erro, nulo', () => {
    expect(primeiraPendencia(plano, [])).toBeNull();
  });

  it('erro de série: sessão, exercício, série, bloco e campo, com a contagem total', () => {
    const r = primeiraPendencia(plano, [{ caminho: 'sessoes[1].exercicios[0].series[2].carga.modo', mensagem: 'x' }, { caminho: 'titulo', mensagem: 'y' }])!;
    expect(r).toMatchObject({ total: 2, sessao: 1, sessaoUid: 's1', exercicio: 0, exercicioUid: 'e1', serie: 2, serieUid: 'd', bloco: 1, campo: 'carga.modo' });
  });

  it('erro de exercício e de sessão não têm bloco', () => {
    expect(primeiraPendencia(plano, [{ caminho: 'sessoes[0].exercicios[0].series', mensagem: 'Exercício sem série.' }])).toMatchObject({ sessao: 0, exercicio: 0, serie: null, bloco: null, campo: 'series' });
    expect(primeiraPendencia(plano, [{ caminho: 'sessoes[1].exercicios', mensagem: 'Sessão de treino sem exercício.' }])).toMatchObject({ sessao: 1, exercicio: null, bloco: null, campo: 'exercicios' });
    expect(primeiraPendencia(plano, [{ caminho: 'sessoes[1].grupos[0].tecnica', mensagem: 'g' }])).toMatchObject({ sessao: 1, campo: 'grupos[0].tecnica' });
  });

  it('erro fora de sessão ou com índice que não existe: sem sessão, com o caminho inteiro', () => {
    expect(primeiraPendencia(plano, [{ caminho: 'fim', mensagem: 'z' }])).toMatchObject({ total: 1, sessao: null, bloco: null, campo: 'fim' });
    expect(primeiraPendencia(plano, [{ caminho: 'sessoes[9].nome', mensagem: 'z' }])).toMatchObject({ sessao: null, campo: 'sessoes[9].nome' });
    expect(primeiraPendencia(plano, [{ caminho: 'sessoes[0].exercicios[5].nome', mensagem: 'z' }])).toMatchObject({ sessao: 0, exercicio: null });
  });

  it('parte do que validarTreino devolve', () => {
    const quebrado = conteudo(sessao('s0', [exercicio('e0', { series: [serie('a', { tipo: null })] })]), sessao('s1'));
    const { erros } = validarTreino(quebrado);
    const r = primeiraPendencia(quebrado, erros)!;
    expect(r.total).toBe(erros.length);
    expect(r.total).toBeGreaterThanOrEqual(2); // série sem tipo e treino sem exercício
    expect(r).toMatchObject({ sessao: 0, exercicio: 0, serie: 0, bloco: 0 });
  });
});

describe('estadoDaSessao', () => {
  it('treino sem exercício é vazia; com exercício, preenchida', () => {
    expect(estadoDaSessao(sessao('s'))).toBe('vazia');
    expect(estadoDaSessao(sessao('s', [exercicio('e')]))).toBe('preenchida');
  });

  it('dia de descanso nunca é vazio', () => {
    expect(estadoDaSessao(sessao('s', [], [], { tipo: 'DESCANSO' }))).toBe('descanso');
    expect(estadoDaSessao(sessao('s', [], [], { tipo: 'DESCANSO_ATIVO' }))).toBe('descanso');
    expect(validarTreino(conteudo(sessao('s', [], [], { tipo: 'DESCANSO' }))).erros).toEqual([]);
  });

  it('descanso ativo com exercício é preenchida; acessórios sem exercício é vazia (sem erro na validação)', () => {
    expect(estadoDaSessao(sessao('s', [exercicio('e')], [], { tipo: 'DESCANSO_ATIVO' }))).toBe('preenchida');
    expect(estadoDaSessao(sessao('s', [], [], { tipo: 'ACESSORIOS' }))).toBe('vazia');
  });
});

describe('linha da tabela de blocos', () => {
  it('a variação só cita o que a linha não mostra (RIR e carga); repetições e descanso já aparecem em ordem', () => {
    expect(textoDaVariacao([])).toBe('');
    expect(textoDaVariacao(['repeticoes', 'descanso'])).toBe('');
    expect(textoDaVariacao(['descanso', 'esforco', 'carga'])).toBe('Varia entre as séries: RIR e carga');
  });
  it('o nome acessível começa por "Série N · tipo" e diz os quatro valores', () => {
    const r = { nome: 'Trabalho · WS', quantidade: 3, repeticoes: '8 a 12 reps', descanso: '2 min', variacao: ['esforco' as const] };
    expect(textoAcessivelDoBloco('Série 2 · WS', r)).toBe('Série 2 · WS, 3 séries, repetições 8 a 12 reps, descanso 2 min, Varia entre as séries: RIR');
    expect(textoAcessivelDoBloco('Série 1', { ...r, quantidade: 1, variacao: [] })).toBe('Série 1, 1 série, repetições 8 a 12 reps, descanso 2 min');
  });
});
