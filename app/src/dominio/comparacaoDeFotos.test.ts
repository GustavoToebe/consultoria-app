import type { FotoDaLinha } from '../api/tipos';
import { alternarComLimite } from './selecaoMultipla';
import {
  MAXIMO_DATAS,
  colunasNaTela,
  datasDaPosicao,
  layoutDaImagem,
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

  it('diferença só com peso nas duas pontas', () => {
    const de = foto({ fotoId: 'a', data: '2026-01-01', perguntaId: 'f', posicao: 'Frente', pesoKg: 80 });
    const ate = foto({ fotoId: 'b', data: '2026-01-22', perguntaId: 'f', posicao: 'Frente', pesoKg: 79.3 });
    expect(textoDaDiferenca(de, ate)).toBe('01/01 → 22/01: −0,7 kg em 21 dias');
    expect(textoDaDiferenca(de, { ...ate, pesoKg: null })).toBeNull();
  });

  it('layout espelha o servidor e a grade do celular', () => {
    const duas = layoutDaImagem(2, false);
    expect(duas.largura).toBe(1080);
    expect(duas.fotos).toHaveLength(2);
    expect(duas.fotos[0].y).toBe(duas.fotos[1].y);
    expect(duas.fotos[0].altura * 4).toBe(duas.fotos[0].largura * 5);
    const quatro = layoutDaImagem(4, true, 100, 40);
    expect(quatro.fotos[2].y).toBeGreaterThan(quatro.fotos[0].y);
    expect(quatro.logo).toEqual({ x: (1080 - 324) / 2, y: quatro.altura - 24 - 129, largura: 324, altura: 129 });
    expect(colunasNaTela(2, true)).toBe(2);
    expect(colunasNaTela(3, true)).toBe(2);
    expect(colunasNaTela(3, false)).toBe(3);
    expect(colunasNaTela(4, false)).toBe(2);
  });
});
