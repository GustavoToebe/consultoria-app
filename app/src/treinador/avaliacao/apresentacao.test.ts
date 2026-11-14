import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import { medidasVazias } from '../../dominio/avaliacaoFisica';
import { escalaDoGrafico, graficoDoPdf, linhasDaDica, seriesDaEvolucao, textoDaEscala } from './apresentacao';

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

  test('com duas séries o nome da série vem primeiro; índice fora devolve vazio', () => {
    expect(linhasDaDica(pontos, 0, 'Braço esquerdo')[0]).toBe('Braço esquerdo');
    expect(linhasDaDica(pontos, 9)).toEqual([]);
  });
});
