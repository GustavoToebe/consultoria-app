import type { FotoDaLinha } from '../api/tipos';
import { alternarComLimite } from './selecaoMultipla';
import {
  MAXIMO_DATAS,
  colunasNaTela,
  datasDaPosicao,
  layoutDaImagem,
  nomeDaComparacao,
  paresNaOrdem,
  posicoesDe,
  primeiraEUltima,
  textoDaDiferenca,
} from './comparacaoDeFotos';

function foto(parcial: Partial<FotoDaLinha> & Pick<FotoDaLinha, 'fotoId' | 'data' | 'perguntaId' | 'posicao'>): FotoDaLinha {
  return {
    origem: 'ATUALIZACAO',
    origemId: 'origem',
    ordem: 0,
    pesoKg: null,
    ...parcial,
  };
}

describe('comparação de fotos', () => {
  it('agrupa pelo id e junta o mesmo rótulo quando o id mudou', () => {
    const grupos = posicoesDe([
      foto({ fotoId: 'a', data: '2026-02-01', perguntaId: 'frente-nova', posicao: 'Foto de frente' }),
      foto({ fotoId: 'b', data: '2026-01-01', perguntaId: 'frente-velha', posicao: 'Foto de Frente' }),
      foto({ fotoId: 'c', data: '2026-01-01', perguntaId: 'lado', posicao: 'Foto de lado' }),
    ]);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Foto de frente', 'Foto de lado']);
    expect(grupos[0].fotos.map((f) => f.fotoId)).toEqual(['b', 'a']);
  });

  it('datas da posição, primeira × última e limite de 4', () => {
    const datas = datasDaPosicao([
      foto({ fotoId: '1', data: '2026-03-01', perguntaId: 'f', posicao: 'Frente' }),
      foto({ fotoId: '2', data: '2026-01-01', perguntaId: 'f', posicao: 'Frente' }),
      foto({ fotoId: '3', data: '2026-01-01', perguntaId: 'f', posicao: 'Frente', ordem: 1 }),
    ]);
    expect(datas).toEqual(['2026-01-01', '2026-03-01']);
    expect(primeiraEUltima(datas)).toEqual(['2026-01-01', '2026-03-01']);
    let marcados = new Set(datas);
    const quinta = alternarComLimite(marcados, '2026-04-01', true, MAXIMO_DATAS);
    expect(quinta.recusado).toBe(false);
    marcados = quinta.marcados;
    for (const extra of ['2026-05-01', '2026-06-01']) {
      const passo = alternarComLimite(marcados, extra, true, MAXIMO_DATAS);
      marcados = passo.marcados;
    }
    expect(marcados.size).toBe(4);
    expect(alternarComLimite(marcados, '2026-07-01', true, MAXIMO_DATAS).recusado).toBe(true);
  });

  it('o carrossel emparelha pela ordem e para na data mais curta', () => {
    const fotos = [
      foto({ fotoId: 'a2', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 2 }),
      foto({ fotoId: 'a0', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0 }),
      foto({ fotoId: 'a1', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1 }),
      foto({ fotoId: 'b1', data: '2026-03-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1 }),
      foto({ fotoId: 'b0', data: '2026-03-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0 }),
    ];
    const pares = paresNaOrdem(fotos, '2026-01-01', '2026-03-01');
    expect(pares.map((p) => p.rotulo)).toEqual(['Foto 1', 'Foto 2']);
    expect(pares[0].fotos.map((f) => f.fotoId)).toEqual(['a0', 'b0']);
    expect(pares[1].fotos.map((f) => f.fotoId)).toEqual(['a1', 'b1']);
    const muitas = [
      ...Array.from({ length: 7 }, (_, i) => foto({ fotoId: `x${i}`, data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: i })),
      ...Array.from({ length: 7 }, (_, i) => foto({ fotoId: `y${i}`, data: '2026-03-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: i })),
    ];
    expect(paresNaOrdem(muitas, '2026-01-01', '2026-03-01')).toHaveLength(6);
  });

  it('diferença só com peso nas duas pontas', () => {
    const de = foto({ fotoId: 'a', data: '2026-01-01', perguntaId: 'f', posicao: 'Frente', pesoKg: 80 });
    const ate = foto({ fotoId: 'b', data: '2026-01-22', perguntaId: 'f', posicao: 'Frente', pesoKg: 79.3 });
    expect(textoDaDiferenca(de, ate)).toBe('01/01 → 22/01: −0,7 kg em 21 dias');
    expect(textoDaDiferenca(de, { ...ate, pesoKg: null })).toBeNull();
  });

  it('layout espelha o servidor: fileira no Stories e no Feed', () => {
    const duas = layoutDaImagem('STORIES', 2, false);
    expect(duas.largura).toBe(1080);
    expect(duas.altura).toBe(1920);
    expect(duas.fotos).toHaveLength(2);
    expect(duas.fotos.every((f) => f.y === 0 && f.altura === 1920)).toBe(true);
    expect(duas.fotos[1].x).toBeGreaterThan(duas.fotos[0].x);
    const quatro = layoutDaImagem('FEED', 4, true, 100, 40);
    expect(quatro.altura).toBe(1350);
    expect(quatro.fotos.every((f) => f.y === 0)).toBe(true);
    expect(quatro.fotos[3].x).toBeGreaterThan(quatro.fotos[2].x);
    expect(quatro.logo).toEqual({ x: (1080 - 324) / 2, y: 1350 - 24 - 129, largura: 324, altura: 129 });
    const uma = layoutDaImagem('STORIES', 1, false);
    expect(uma.fotos[0]).toEqual({ x: 0, y: 0, largura: 1080, altura: 1920 });
    expect(colunasNaTela(1)).toBe(1);
    expect(colunasNaTela(4)).toBe(4);
    expect(nomeDaComparacao('STORIES', 1)).toBe('stories.jpg');
    expect(nomeDaComparacao('FEED', 1)).toBe('feed.jpg');
    expect(nomeDaComparacao('AMBOS', 1)).toBe('comparacao.zip');
    expect(nomeDaComparacao('STORIES', 2)).toBe('comparacao.zip');
  });
});
