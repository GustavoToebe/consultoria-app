import { colecoesQueOAlunoVe, numerosDasColecoes, textosDoCabecalho } from './cabecalhoDaColecao';
import { agruparPorPlaylist, buscarAuloes, playlistsEmOrdem } from './comunidade';

const p = (id: string, nome: string, ordem: number) => ({ id, nome, ordem, totalAulas: 0 });
const a = (id: string, titulo: string, playlistId: string | null, ordem: number, publicada = true) =>
  ({ id, titulo, descricao: null, playlistId, ordem, publicada });
const COLECOES = [p('p2', 'Mobilidade', 1), p('p1', 'Treinos', 0), p('p3', 'Vazia', 2)];

describe('colecoesQueOAlunoVe e numerosDasColecoes no treinador', () => {
  it('a coleção vazia ou só com rascunho não consome número; as outras numeram como o aluno vê', () => {
    const p0 = p('p0', 'Novidades', -1);
    const aulas = [a('v1', 'Agachamento', 'p1', 0), a('r1', 'Rascunho', 'p0', 0, false), a('v2', 'Alongamento', 'p2', 0), a('s1', 'Solto', null, 0)];
    const n = numerosDasColecoes(colecoesQueOAlunoVe(playlistsEmOrdem([...COLECOES, p0]), aulas));
    expect([n.get('p0'), n.get('p1'), n.get('p2'), n.get('p3')]).toEqual([undefined, 1, 2, undefined]);
    // O mesmo N que o aluno vê (a API dele só manda os publicados).
    const doAluno = numerosDasColecoes(agruparPorPlaylist(aulas.filter((x) => x.publicada), COLECOES).flatMap((g) => (g.playlist ? [g.playlist] : [])));
    expect([doAluno.get('p1'), doAluno.get('p2')]).toEqual([1, 2]);
    expect(textosDoCabecalho({ playlist: p0, itens: [aulas[1]] }, n))
      .toEqual({ sobretitulo: 'Coleção', nome: 'Novidades', total: 1, nomeAcessivel: 'Coleção: Novidades, 1 vídeo' });
  });

  it('a busca não renumera: o número vem da lista inteira, não do grupo que sobrou', () => {
    const aulas = [a('v1', 'Agachamento', 'p1', 0), a('v2', 'Alongamento', 'p2', 0)];
    const numeros = numerosDasColecoes(agruparPorPlaylist(aulas, COLECOES).flatMap((g) => (g.playlist ? [g.playlist] : [])));
    const [soMobilidade] = agruparPorPlaylist(buscarAuloes(aulas, 'along'), COLECOES);
    expect(textosDoCabecalho(soMobilidade, numeros).sobretitulo).toBe('Coleção 2');
  });
});

describe('textosDoCabecalho', () => {
  const numeros = numerosDasColecoes(playlistsEmOrdem(COLECOES));

  it('coleção: sobretítulo com o número, nome e nome acessível no singular', () => {
    expect(textosDoCabecalho({ playlist: COLECOES[1], itens: [1] }, numeros))
      .toEqual({ sobretitulo: 'Coleção 1', nome: 'Treinos', total: 1, nomeAcessivel: 'Coleção 1: Treinos, 1 vídeo' });
  });

  it('plural e zero: "N vídeos" e "0 vídeos"', () => {
    expect(textosDoCabecalho({ playlist: COLECOES[0], itens: [1, 2, 3] }, numeros).nomeAcessivel).toBe('Coleção 2: Mobilidade, 3 vídeos');
    expect(textosDoCabecalho({ playlist: COLECOES[2], itens: [] }, numeros).nomeAcessivel).toBe('Coleção 3: Vazia, 0 vídeos');
  });

  it('"Sem coleção" não tem número nem nome', () => {
    expect(textosDoCabecalho({ playlist: null, itens: [1, 2] }, numeros))
      .toEqual({ sobretitulo: 'Sem coleção', nome: null, total: 2, nomeAcessivel: 'Sem coleção, 2 vídeos' });
  });

  it('coleção fora do mapa (a vazia no treinador) fica só "Coleção", sem número', () => {
    expect(textosDoCabecalho({ playlist: p('px', 'Novidades', 9), itens: [] }, numeros))
      .toEqual({ sobretitulo: 'Coleção', nome: 'Novidades', total: 0, nomeAcessivel: 'Coleção: Novidades, 0 vídeos' });
  });
});
