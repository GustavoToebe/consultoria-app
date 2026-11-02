import type { Carga } from '../api/tipos';
import { descreverGrupo, textoCarga } from './agrupamento';
import { calcularCargasDoExercicio, metaDaSerie } from './cargas';
import { carga, exercicio, serie } from './exemplosDeTreino.apoioTeste';
import { cargaIlegivel, modoConhecido, semCargaNaSerieIlegivel, TEXTO_CARGA_ILEGIVEL } from './modoDeCarga';
import { previaDoGrupo } from './resumoDaSerie';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

/** Uma forma de carga que não existe neste app (o treinador usou algo mais novo que o app instalado). */
const desconhecida = { modo: 'MODO_QUE_NAO_EXISTE', percentualMin: 80, percentualMax: null, referenciaUid: null } as unknown as Carga;
const CONFIG = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };

describe('forma de carga que o app não conhece', () => {
  it('o texto é um só e diz o que fazer', () => {
    expect(TEXTO_CARGA_ILEGIVEL).toBe('Carga: atualize o app para ver');
  });

  it('modoConhecido: os sete de hoje; o resto, não', () => {
    for (const m of ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'ABAIXO_DA_REFERENCIA', 'CARGA_FIXA', 'NENHUMA']) expect(modoConhecido(m)).toBe(true);
    for (const m of ['MODO_QUE_NAO_EXISTE', '', 'carga_fixa', null, undefined]) expect(modoConhecido(m)).toBe(false);
  });

  it('cargaIlegivel: só a carga com modo de fora; série sem carga é legível', () => {
    expect(cargaIlegivel(desconhecida)).toBe(true);
    expect(cargaIlegivel(carga('PERCENTUAL_WS', 80))).toBe(false);
    expect(cargaIlegivel(carga('NENHUMA'))).toBe(false);
    expect(cargaIlegivel(null)).toBe(false);
    expect(cargaIlegivel(undefined)).toBe(false);
  });

  it('os leitores não lançam e mostram o texto no lugar da carga', () => {
    const s = serie('a', { carga: desconhecida });
    expect(textoCarga(desconhecida)).toBe(TEXTO_CARGA_ILEGIVEL);
    expect(metaDaSerie(s, 'WS')).toBe(`Meta: 6 reps · ${TEXTO_CARGA_ILEGIVEL}`);
    expect(descreverGrupo({ inicio: 0, series: [s] }, CONFIGURACAO_PADRAO, [s])).toContain(TEXTO_CARGA_ILEGIVEL);
    const previa = previaDoGrupo({ series: [s] }, [s], CONFIGURACAO_PADRAO, {});
    expect(previa.linhas.filter((l) => l.includes('atualize o app'))).toEqual([TEXTO_CARGA_ILEGIVEL]);
  });

  it('exercício sem carga (elástico) não mostra o texto', () => {
    const s = serie('a', { carga: desconhecida });
    expect(metaDaSerie(s, 'WS', true)).toBe('Meta: 6 reps');
  });

  it('nunca sugere carga nem referência, mesmo com etapa em % da WS e uma WS feita antes', () => {
    const trabalho = serie('t', { carga: carga('CARGA_TRABALHO') });
    const nova = serie('n', {
      carga: desconhecida,
      tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15, cargasDosBlocos: [{ modo: 'DA_SERIE', percentual: null }, { modo: 'PERCENTUAL_WS', percentual: 90 }] },
    });
    const e = exercicio('e', { series: [trabalho, nova] });
    const [, calculada] = calcularCargasDoExercicio(e, 40, { t: 40 }, CONFIG);
    expect(calculada.sugestao).toBeNull();
    expect(calculada.referencia).toBeNull();
    expect(calculada.meta).toContain(TEXTO_CARGA_ILEGIVEL);
  });

  it('a série seguinte "acima da anterior" não parte da carga de uma série ilegível', () => {
    const e = exercicio('e', { series: [serie('a', { carga: desconhecida }), serie('b', { carga: carga('ACIMA_DA_ANTERIOR', 5, null) })] });
    const [, seguinte] = calcularCargasDoExercicio(e, 40, { a: null }, CONFIG);
    expect(seguinte.sugestao).toBeNull();
  });

  describe('semCargaNaSerieIlegivel: o ✓ vale, a carga fica em branco ("—")', () => {
    const marcada = { carga: 60, repeticoes: 8, concluida: true, referenciaCarga: 50, referenciaOrigem: 'BASE_DO_DIA' as const, etapas: [{ posicao: 1, repeticoes: 4, carga: 60, situacao: 'FEITA' }] };

    it('série ilegível: carga, etapas e referência vão em branco; repetições e ✓ ficam', () => {
      const r = semCargaNaSerieIlegivel({ carga: desconhecida }, marcada);
      expect(r).toEqual({ carga: null, repeticoes: 8, concluida: true, referenciaCarga: null, referenciaOrigem: null, etapas: [{ posicao: 1, repeticoes: 4, carga: null, situacao: 'FEITA' }] });
      expect(marcada.carga).toBe(60);
    });

    it('sem carga digitada, o ✓ continua permitido (concluída segue verdadeira)', () => {
      expect(semCargaNaSerieIlegivel({ carga: desconhecida }, { carga: null, repeticoes: null, concluida: true })).toEqual({ carga: null, repeticoes: null, concluida: true });
    });

    it('série legível devolve os mesmos dados', () => {
      expect(semCargaNaSerieIlegivel({ carga: carga('CARGA_TRABALHO') }, marcada)).toBe(marcada);
      expect(semCargaNaSerieIlegivel({ carga: null }, marcada)).toBe(marcada);
    });
  });
});
