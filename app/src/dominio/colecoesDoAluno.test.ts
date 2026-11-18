import { chaveDoGrupo, numerosNaColecao } from './colecoesDoAluno';
import { agruparPorPlaylist } from './comunidade';

const a = (id: string, playlistId: string | null, ordem: number) => ({ id, playlistId, ordem });
const p = (id: string, ordem: number) => ({ id, nome: `Coleção ${id}`, ordem, totalAulas: 0 });

describe('numerosNaColecao', () => {
  it('numera pela posição na coleção, nunca por ordem + 1, mesmo com buracos e resposta fora de ordem', () => {
    const n = numerosNaColecao([a('c', 'p1', 5), a('a', 'p1', 0), a('b', 'p1', 2), a('x', 'p2', 7)], [p('p1', 0), p('p2', 1)]);
    expect([n.get('a'), n.get('b'), n.get('c'), n.get('x')]).toEqual([1, 2, 3, 1]);
  });

  it('não numera os sem coleção nem os de coleção que a lista não traz', () => {
    const n = numerosNaColecao([a('s', null, 0), a('f', 'sumiu', 3)], [p('p1', 0)]);
    expect(n.size).toBe(0);
  });
});

describe('chaveDoGrupo', () => {
  it('usa o id da coleção e "" para Sem coleção', () => {
    expect(agruparPorPlaylist([a('a', 'p1', 0), a('s', null, 0)], [p('p1', 0)]).map(chaveDoGrupo)).toEqual(['p1', '']);
  });
});
