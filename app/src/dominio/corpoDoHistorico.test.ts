import type { AvaliacaoFisica } from '../api/avaliacaoFisicaTipos';
import type { FotoDaLinha } from '../api/tipos';
import { medidasVazias } from './avaliacaoFisica';
import { enviosDasFotos, gradeDasMiniaturas, rotuloDoEnvio } from './gradeDeFotos';
import { datasCoincidentes, deslocamentoDosLados, ladosIguaisEmTodas, linhasDaDicaDosDoisLados, TEXTO_LADOS_IGUAIS } from './ladosDoGrafico';
import { variacoesDaMedida } from './variacaoDaMedida';

const av = (id: string, data: string, medidas: Partial<AvaliacaoFisica['medidas']>): AvaliacaoFisica => ({
  id, data, medidas: { ...medidasVazias(), ...medidas }, observacao: null, pesoKg: null, versao: 0, criadoEm: `${data}T12:00:00Z`, alteradoEm: `${data}T12:00:00Z`,
});

describe('variacoesDaMedida', () => {
  const tres = [av('c', '2026-11-21', { cintura: 70, bracoDireito: 30 }), av('a', '2026-11-01', { cintura: 60, bracoDireito: 30 }), av('b', '2026-11-11', { cintura: 90, bracoDireito: 31 })];

  it('desde a anterior e desde a primeira, com seta, sinal, data e a cor da meta só na cintura', () => {
    expect(variacoesDaMedida(tres, 'cintura', 'REDUZIR')).toEqual({
      tipo: 'comAnterior',
      anterior: { tipo: 'mudou', texto: '▼ −20,0 cm', data: '11/11', tom: 'positivo', falado: 'desceu 20,0 cm, a favor da meta, desde 11/11' },
      primeira: { tipo: 'mudou', texto: '▲ +10,0 cm', data: '01/11', tom: 'problema', falado: 'subiu 10,0 cm, contra a meta, desde 01/11' },
    });
    const braco = variacoesDaMedida(tres, 'bracoDireito', 'REDUZIR');
    expect(braco.tipo === 'comAnterior' && braco.anterior).toMatchObject({ texto: '▼ −1,0 cm', tom: 'neutro' });
    expect(braco.tipo === 'comAnterior' && braco.primeira).toMatchObject({ tipo: 'igual', texto: '0,0 cm', tom: 'neutro', falado: 'sem variação, desde 01/11' });
  });

  it('sem meta tudo neutro; dois pontos não repetem a primeira; um ponto é "Primeira"; sem medida nada', () => {
    const r = variacoesDaMedida(tres, 'cintura', null);
    expect(r.tipo === 'comAnterior' && [r.anterior.tom, r.primeira?.tom]).toEqual(['neutro', 'neutro']);
    expect(variacoesDaMedida(tres.slice(1), 'cintura', 'REDUZIR')).toMatchObject({ tipo: 'comAnterior', primeira: null, anterior: { data: '01/11' } });
    expect(variacoesDaMedida([tres[0]], 'cintura', 'REDUZIR')).toEqual({ tipo: 'primeira', texto: 'Primeira' });
    expect(variacoesDaMedida(tres, 'quadril', 'REDUZIR')).toEqual({ tipo: 'semMedida' });
  });

  it('a data que não mediu fica de fora e o ano aparece quando as datas cruzam o ano', () => {
    const lista = [av('x', '2026-02-01', { cintura: 88 }), av('y', '2026-01-01', {}), av('z', '2025-11-01', { cintura: 90 })];
    expect(variacoesDaMedida(lista, 'cintura', null)).toMatchObject({ anterior: { data: '01/11/2025', texto: '▼ −2,0 cm' }, primeira: null });
  });
});

describe('ladosDoGrafico', () => {
  const d = [{ data: '2026-07-01', valor: 34.4 }, { data: '2026-09-01', valor: 35.2 }, { data: '2026-11-01', valor: 34.6 }];
  const e = [{ data: '2026-07-01', valor: 34.4 }, { data: '2026-09-01', valor: 34.6 }, { data: '2026-11-01', valor: 34.6 }];

  it('acha as datas com o mesmo valor (a uma casa) e afasta só esses marcadores', () => {
    expect([...datasCoincidentes(d, e)]).toEqual(['2026-07-01', '2026-11-01']);
    expect(datasCoincidentes([{ data: '2026-07-01', valor: 34.4 }], [{ data: '2026-07-01', valor: 34.40001 }]).size).toBe(1);
    expect(deslocamentoDosLados(d, e)).toEqual({ a: [-3, 0, -3], b: [3, 0, 3] });
  });

  it('"todas iguais" só com os dois lados nas mesmas datas e iguais em todas', () => {
    expect(ladosIguaisEmTodas(d, e)).toBe(false);
    expect(ladosIguaisEmTodas(e, e)).toBe(true);
    expect(ladosIguaisEmTodas(e, e.slice(1))).toBe(false);
    expect(ladosIguaisEmTodas([], [])).toBe(false);
    expect(TEXTO_LADOS_IGUAIS).toBe('Direito e esquerdo iguais em todas as avaliações');
  });

  it('balão com a data e os dois valores', () => {
    expect(linhasDaDicaDosDoisLados('2026-07-01', { rotulo: 'Braço direito', valor: 34.4 }, { rotulo: 'Braço esquerdo', valor: 34.4 }))
      .toEqual(['01/07/2026', 'Braço direito · 34,4 cm', 'Braço esquerdo · 34,4 cm']);
  });
});

describe('gradeDeFotos', () => {
  const foto = (fotoId: string, origem: FotoDaLinha['origem'], origemId: string, data: string, ordem: number, pesoKg: number | null): FotoDaLinha =>
    ({ fotoId, origem, origemId, data, perguntaId: 'q', posicao: 'Frente', ordem, pesoKg });

  it('um grupo por envio, do mais recente ao mais antigo, com o rótulo e as fotos na ordem', () => {
    const envios = enviosDasFotos([
      foto('f1', 'ANAMNESE', 'an', '2026-10-01', 0, null),
      foto('f3', 'ATUALIZACAO', 'at', '2026-11-11', 1, 90),
      foto('f2', 'ATUALIZACAO', 'at', '2026-11-11', 0, 90),
      foto('f4', 'ATUALIZACAO', 'at2', '2026-10-01', 0, 91.5),
    ]);
    expect(envios.map((e) => [e.rotulo, e.fotos.map((f) => f.fotoId)])).toEqual([
      ['11/11/2026 · Atualização · 90 kg', ['f2', 'f3']],
      ['01/10/2026 · Anamnese · —', ['f1']],
      ['01/10/2026 · Atualização · 91,5 kg', ['f4']],
    ]);
    expect(rotuloDoEnvio({ data: '2026-11-11', origem: 'ATUALIZACAO', pesoKg: 90 })).toBe('11/11/2026 · Atualização · 90 kg');
  });

  it('a grade fecha na largura com miniaturas perto de 120 px', () => {
    expect(gradeDasMiniaturas(0, 8)).toBeNull();
    expect(gradeDasMiniaturas(748, 8)).toEqual({ colunas: 6, tamanho: 118 });
    expect(gradeDasMiniaturas(326, 8)).toEqual({ colunas: 3, tamanho: 103 });
    expect(gradeDasMiniaturas(80, 8)).toEqual({ colunas: 1, tamanho: 80 });
  });
});
