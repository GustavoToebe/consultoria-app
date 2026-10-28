import type { Sessao } from '../api/tipos';
import {
  COMENTARIO_MAXIMO,
  conclusaoForaDaJanela,
  contagemDeSeries,
  duracaoDoTreino,
  duracaoValida,
  inicioDaJanelaDeConclusao,
  minutosParaSegundos,
  normalizarComentario,
  podeConcluirEm,
  precisaAjustarDuracao,
  segundosParaMinutos,
  sugestaoDoResultado,
  validarConclusao,
} from './conclusaoDoTreino';

const HOJE = '2026-10-28';

function entrada(extra: Partial<Parameters<typeof validarConclusao>[0]> = {}) {
  return { data: HOJE, hoje: HOJE, resultado: 'COMPLETA', duracaoSegundos: 3600, comentario: null, ...extra };
}

describe('podeConcluirEm', () => {
  it('aceita hoje e até 60 dias atrás; recusa amanhã e 61 dias atrás', () => {
    expect(podeConcluirEm(HOJE, HOJE)).toBe(true);
    expect(podeConcluirEm('2026-08-29', HOJE)).toBe(true); // hoje - 60
    expect(podeConcluirEm('2026-08-28', HOJE)).toBe(false); // hoje - 61
    expect(podeConcluirEm('2026-10-29', HOJE)).toBe(false); // amanhã
    expect(podeConcluirEm('2026-12-27', HOJE)).toBe(false); // +60 que o registro de série aceitaria
  });

  it('recusa data fora do formato', () => {
    expect(podeConcluirEm('28/10/2026', HOJE)).toBe(false);
    expect(podeConcluirEm('', HOJE)).toBe(false);
  });
});

describe('conclusaoForaDaJanela (retomada da chave)', () => {
  it('a janela começa em hoje - 60, o mesmo limite de podeConcluirEm', () => {
    expect(inicioDaJanelaDeConclusao(HOJE)).toBe('2026-08-29');
    expect(podeConcluirEm(inicioDaJanelaDeConclusao(HOJE), HOJE)).toBe(true);
  });

  it('só o que ficou antes da janela sai: hoje - 61 sim; hoje - 60, hoje e o futuro (relógio adiantado) não', () => {
    expect(conclusaoForaDaJanela('2026-08-28', HOJE)).toBe(true);
    expect(conclusaoForaDaJanela('2026-01-01', HOJE)).toBe(true);
    expect(conclusaoForaDaJanela('2026-08-29', HOJE)).toBe(false);
    expect(conclusaoForaDaJanela(HOJE, HOJE)).toBe(false);
    expect(conclusaoForaDaJanela('2026-10-29', HOJE)).toBe(false);
  });

  it('data ilegível não é descartada por esta regra', () => {
    expect(conclusaoForaDaJanela('28/08/2026', HOJE)).toBe(false);
    expect(conclusaoForaDaJanela('', HOJE)).toBe(false);
  });
});

describe('sugestaoDoResultado e contagemDeSeries', () => {
  it('COMPLETA só com todas as séries previstas feitas', () => {
    expect(sugestaoDoResultado(10, 10)).toBe('COMPLETA');
    expect(sugestaoDoResultado(10, 9)).toBe('PARCIAL');
    expect(sugestaoDoResultado(10, 0)).toBe('PARCIAL');
  });

  it('sessão sem série prevista nunca é sugerida como completa', () => {
    expect(sugestaoDoResultado(0, 0)).toBe('PARCIAL');
  });

  it('conta as séries da sessão e as feitas por uid', () => {
    const sessao = {
      exercicios: [{ series: [{ uid: 'a' }, { uid: 'b' }] }, { series: [{ uid: 'c' }] }],
    } as unknown as Sessao;
    expect(contagemDeSeries(sessao, (uid) => uid !== 'b')).toEqual({ total: 3, feitas: 2 });
    expect(contagemDeSeries(sessao, () => false)).toEqual({ total: 3, feitas: 0 });
  });
});

describe('duracaoDoTreino', () => {
  const inicio = '2026-10-28T10:00:00.000Z';
  const depois = (segundos: number) => new Date(Date.parse(inicio) + segundos * 1000);

  it('segundos entre o início e agora, arredondado', () => {
    expect(duracaoDoTreino(inicio, depois(3600))).toBe(3600);
    expect(duracaoDoTreino(inicio, new Date(Date.parse(inicio) + 90_400))).toBe(90);
    expect(duracaoDoTreino(inicio, new Date(Date.parse(inicio) + 90_600))).toBe(91);
  });

  it('sem início, ou início ilegível, não há duração', () => {
    expect(duracaoDoTreino(null, depois(100))).toBeNull();
    expect(duracaoDoTreino('ontem', depois(100))).toBeNull();
  });

  it('relógio que andou para trás não vira duração', () => {
    expect(duracaoDoTreino(inicio, depois(-1))).toBeNull();
    expect(duracaoDoTreino(inicio, depois(0))).toBe(0);
  });

  it('o teto é 6 h: acima disso devolve nulo para o aluno digitar', () => {
    expect(duracaoDoTreino(inicio, depois(21_600))).toBe(21_600);
    expect(duracaoDoTreino(inicio, depois(21_601))).toBeNull();
  });

  it('abaixo de 60 s devolve o valor cru (quem barra é a validação)', () => {
    expect(duracaoDoTreino(inicio, depois(59))).toBe(59);
  });
});

describe('precisaAjustarDuracao', () => {
  it('pergunta abaixo de 10 minutos', () => {
    expect(precisaAjustarDuracao(599)).toBe(true);
    expect(precisaAjustarDuracao(600)).toBe(false);
    expect(precisaAjustarDuracao(0)).toBe(true);
    expect(precisaAjustarDuracao(3600)).toBe(false);
  });

  it('sem duração não há o que perguntar', () => {
    expect(precisaAjustarDuracao(null)).toBe(false);
  });
});

describe('minutos e segundos', () => {
  it('converte nos dois sentidos, arredondando', () => {
    expect(minutosParaSegundos(45)).toBe(2700);
    expect(minutosParaSegundos(1.5)).toBe(90);
    expect(segundosParaMinutos(2700)).toBe(45);
    expect(segundosParaMinutos(89)).toBe(1);
    expect(segundosParaMinutos(90)).toBe(2);
  });
});

describe('duracaoValida', () => {
  it('nula ou de 60 a 21600 s, inteira', () => {
    expect(duracaoValida(null)).toBe(true);
    expect(duracaoValida(59)).toBe(false);
    expect(duracaoValida(60)).toBe(true);
    expect(duracaoValida(21_600)).toBe(true);
    expect(duracaoValida(21_601)).toBe(false);
    expect(duracaoValida(60.5)).toBe(false);
    expect(duracaoValida(Number.NaN)).toBe(false);
  });
});

describe('normalizarComentario', () => {
  it('tira os espaços das pontas e transforma branco em nulo', () => {
    expect(normalizarComentario('  bom treino \n')).toBe('bom treino');
    expect(normalizarComentario('   ')).toBeNull();
    expect(normalizarComentario('')).toBeNull();
    expect(normalizarComentario(null)).toBeNull();
    expect(normalizarComentario(undefined)).toBeNull();
    expect(normalizarComentario('bom\u0000 treino')).toBe('bom treino');
    expect(normalizarComentario('\u0000 \u0000')).toBeNull();
  });
});

describe('validarConclusao', () => {
  it('conclusão boa devolve o registro normalizado', () => {
    expect(validarConclusao(entrada({ comentario: '  ótimo  ' }))).toEqual({
      valida: true,
      registro: { data: HOJE, resultado: 'COMPLETA', duracaoSegundos: 3600, comentario: 'ótimo' },
    });
  });

  it('duração: 59/60 s e 21600/21601 s', () => {
    expect(validarConclusao(entrada({ duracaoSegundos: 59 }))).toEqual({
      valida: false,
      problemas: { duracao: expect.stringContaining('mínimo') },
    });
    expect(validarConclusao(entrada({ duracaoSegundos: 60 })).valida).toBe(true);
    expect(validarConclusao(entrada({ duracaoSegundos: 21_600 })).valida).toBe(true);
    expect(validarConclusao(entrada({ duracaoSegundos: 21_601 }))).toMatchObject({ valida: false, problemas: { duracao: expect.any(String) } });
  });

  it('"Manter" uma duração abaixo de 10 min mas de 1 min ou mais salva; abaixo de 1 min não', () => {
    expect(validarConclusao(entrada({ duracaoSegundos: 599 })).valida).toBe(true);
    expect(validarConclusao(entrada({ duracaoSegundos: 30 })).valida).toBe(false);
  });

  it('duração nula ou ausente vale (o servidor aceita sem duração)', () => {
    expect(validarConclusao(entrada({ duracaoSegundos: null }))).toMatchObject({ valida: true, registro: { duracaoSegundos: null } });
    expect(validarConclusao(entrada({ duracaoSegundos: undefined }))).toMatchObject({ valida: true, registro: { duracaoSegundos: null } });
  });

  it('comentário: 300 passa, 301 não, em branco vira nulo; o tamanho conta depois do strip', () => {
    const texto = (n: number) => 'a'.repeat(n);
    expect(validarConclusao(entrada({ comentario: texto(COMENTARIO_MAXIMO) })).valida).toBe(true);
    expect(validarConclusao(entrada({ comentario: texto(COMENTARIO_MAXIMO + 1) }))).toMatchObject({
      valida: false,
      problemas: { comentario: expect.stringContaining('300') },
    });
    expect(validarConclusao(entrada({ comentario: `  ${texto(300)}  ` })).valida).toBe(true);
    expect(validarConclusao(entrada({ comentario: '   ' }))).toMatchObject({ valida: true, registro: { comentario: null } });
  });

  it('data: hoje e hoje - 60 passam; amanhã e hoje - 61 não', () => {
    expect(validarConclusao(entrada({ data: HOJE })).valida).toBe(true);
    expect(validarConclusao(entrada({ data: '2026-08-29' })).valida).toBe(true);
    expect(validarConclusao(entrada({ data: '2026-10-29' }))).toMatchObject({ valida: false, problemas: { data: expect.any(String) } });
    expect(validarConclusao(entrada({ data: '2026-08-28' }))).toMatchObject({ valida: false, problemas: { data: expect.any(String) } });
  });

  it('resultado incoerente (ausente ou fora de COMPLETA/PARCIAL) é problema do campo', () => {
    for (const resultado of [null, undefined, '', 'completa', 'TUDO']) {
      expect(validarConclusao(entrada({ resultado }))).toMatchObject({ valida: false, problemas: { resultado: expect.any(String) } });
    }
    expect(validarConclusao(entrada({ resultado: 'PARCIAL' })).valida).toBe(true);
  });

  it('junta os problemas de vários campos', () => {
    const r = validarConclusao(entrada({ data: '2026-11-01', resultado: null, duracaoSegundos: 5, comentario: 'a'.repeat(301) }));
    expect(r.valida).toBe(false);
    if (!r.valida) expect(Object.keys(r.problemas).sort()).toEqual(['comentario', 'data', 'duracao', 'resultado']);
  });
});
