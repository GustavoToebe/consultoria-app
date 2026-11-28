import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import { medidasVazias } from '../../dominio/avaliacaoFisica';
import { formatadorDeDatas } from '../../dominio/comparacaoDeAvaliacoes';
import { corDaVariacao, escalaDoGrafico, graficoDoPdf, graficoDoPdfDasMarcadas, linhasDaDica, seriesDaEvolucao, textoDaEscala } from './apresentacao';

const av = (id: string, data: string, medidas: Partial<AvaliacaoFisica['medidas']>): AvaliacaoFisica =>
  ({ id, data, medidas: { ...medidasVazias(), ...medidas }, observacao: null, pesoKg: null, versao: 0 }) as unknown as AvaliacaoFisica;

describe('séries da Evolução', () => {
  const lista = [
    av('1', '2026-11-01', { bracoDireito: 34.4, bracoEsquerdo: 34, cintura: 82 }),
    av('2', '2026-11-13', { bracoDireito: 35.2, coxaDireita: 55 }),
  ];

  test('par com os dois lados: direita em A e esquerda em B, e o PDF recebe o mesmo', () => {
    const s = seriesDaEvolucao(lista, 'bracoEsquerdo', true);
    expect(s.a.rotulo).toBe('Braço direito');
    expect(s.b?.pontos).toEqual([{ data: '2026-11-01', valor: 34 }]);
    expect(graficoDoPdf(s)).toEqual({ rotulo: 'Braço direito', unidade: 'cm', pontos: s.a.pontos, serieB: { rotulo: 'Braço esquerdo', pontos: s.b?.pontos } });
  });

  test('par desligado ou medida sem par: só a medida escolhida', () => {
    const s = seriesDaEvolucao(lista, 'bracoEsquerdo', false);
    expect(s.a.rotulo).toBe('Braço esquerdo');
    expect(s.b).toBeNull();
    expect(s.par).not.toBeNull();
    expect(seriesDaEvolucao(lista, 'cintura', true)).toMatchObject({ b: null, par: null, semOutroLado: null });
    expect(graficoDoPdf(seriesDaEvolucao(lista, 'cintura', true)).serieB).toBeUndefined();
  });

  test('lado nunca registrado: volta à medida e diz qual lado falta', () => {
    const s = seriesDaEvolucao(lista, 'coxaDireita', true);
    expect(s).toMatchObject({ b: null, par: null });
    expect(s.semOutroLado).toBe('Sem registro de coxa esquerda: o gráfico mostra só coxa direita.');
  });
});

describe('gráfico do PDF segue as datas marcadas (D9)', () => {
  const lista = [
    av('1', '2026-07-01', { bracoDireito: 34, bracoEsquerdo: 33 }),
    av('2', '2026-09-01', { bracoDireito: 35, bracoEsquerdo: 34 }),
    av('3', '2026-10-01', { bracoDireito: 35.5 }),
    av('4', '2026-11-01', { bracoDireito: 36, bracoEsquerdo: 35 }),
  ];

  test('só os pontos das datas marcadas, na medida escolhida, em qualquer ordem da seleção', () => {
    const g = graficoDoPdfDasMarcadas(lista, ['4', '2'], 'bracoDireito', false);
    expect(g.pontos).toEqual([{ data: '2026-09-01', valor: 35 }, { data: '2026-11-01', valor: 36 }]);
    expect(g.rotulo).toBe('Braço direito');
    expect(g.serieB).toBeUndefined();
  });

  test('direito × esquerdo: os dois lados só nas datas marcadas; lado sem nenhuma data marcada fica só com a medida', () => {
    const par = graficoDoPdfDasMarcadas(lista, ['1', '2', '4'], 'bracoEsquerdo', true);
    expect(par.pontos.map((p) => p.data)).toEqual(['2026-07-01', '2026-09-01', '2026-11-01']);
    expect(par.serieB?.pontos).toEqual([{ data: '2026-07-01', valor: 33 }, { data: '2026-09-01', valor: 34 }, { data: '2026-11-01', valor: 35 }]);
    // A data 3 não tem braço esquerdo, mas também não está marcada: nada dela entra.
    expect(par.pontos.some((p) => p.data === '2026-10-01')).toBe(false);
    expect(graficoDoPdfDasMarcadas(lista, ['2', '3'], 'bracoDireito', true).serieB?.pontos).toEqual([{ data: '2026-09-01', valor: 34 }]);
    expect(graficoDoPdfDasMarcadas(lista, ['3'], 'bracoDireito', true).serieB).toBeUndefined();
  });
});

describe('escala do gráfico da avaliação física', () => {
  test('folga de 15% dos dois lados, em inteiros', () => {
    expect(escalaDoGrafico([81.2, 82, 84])).toEqual({ min: 80, max: 85 });
  });

  test('um ponto só (ou valores iguais) ainda abre a escala', () => {
    const e = escalaDoGrafico([35.2]);
    expect(e).toEqual({ min: 34, max: 36 });
    expect(e.max).toBeGreaterThan(e.min);
  });

  test('nunca abaixo de zero, e o texto diz quando não começa em zero', () => {
    expect(escalaDoGrafico([0.2]).min).toBe(0);
    expect(textoDaEscala({ min: 80, max: 85 })).toBe('Escala vertical: 80 a 85 cm, não começa em zero.');
    expect(textoDaEscala({ min: 0, max: 2 })).toBe('Escala vertical: 0 a 2 cm.');
  });
});

describe('balão do ponto', () => {
  const pontos = [{ data: '2026-11-01', valor: 34.4 }, { data: '2026-11-13', valor: 35.2 }, { data: '2026-11-20', valor: 35.2 }];

  test('primeiro ponto, aumento e sem mudança, sempre com o sinal escrito', () => {
    expect(linhasDaDica(pontos, 0)).toEqual(['01/11/2026 · 34,4 cm', 'Primeiro registro']);
    expect(linhasDaDica(pontos, 1)).toEqual(['13/11/2026 · 35,2 cm', '+0,8 cm desde 01/11']);
    expect(linhasDaDica([{ data: '2026-11-01', valor: 36 }, pontos[1]], 1)[1]).toBe('−0,8 cm desde 01/11');
  });

  test('datas de anos diferentes: a referência "desde" leva o ano (o balão já traz a data completa)', () => {
    const virada = [{ data: '2025-11-01', valor: 34.4 }, { data: '2026-11-01', valor: 35.2 }];
    expect(linhasDaDica(virada, 1)).toEqual(['01/11/2026 · 35,2 cm', '+0,8 cm desde 01/11/2025']);
    // Formatador do gráfico todo: a série B, só de 2026, também leva o ano porque o gráfico abrange dois.
    const soDe2026 = [{ data: '2026-03-01', valor: 33 }, { data: '2026-11-01', valor: 34 }];
    expect(linhasDaDica(soDe2026, 1)[1]).toBe('+1,0 cm desde 01/03');
    expect(linhasDaDica(soDe2026, 1, undefined, formatadorDeDatas(['2025-11-01', '2026-11-01']))[1]).toBe('+1,0 cm desde 01/03/2026');
  });

  test('com duas séries o nome da série vem primeiro; índice fora devolve vazio', () => {
    expect(linhasDaDica(pontos, 0, 'Braço esquerdo')[0]).toBe('Braço esquerdo');
    expect(linhasDaDica(pontos, 9)).toEqual([]);
  });
});

describe('cor da variação', () => {
  const cores = { sucesso: 'verde', perigo: 'vermelho', texto: 'texto', textoSuave: 'suave' };
  it('a favor verde, contra vermelho, neutro suave', () => {
    expect(corDaVariacao('positivo', cores)).toBe('verde');
    expect(corDaVariacao('problema', cores)).toBe('vermelho');
    expect(corDaVariacao('neutro', cores)).toBe('suave');
  });
});
