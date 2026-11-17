import { exercicio, sessao } from './exemplosDeTreino.apoioTeste';
import { equipamentosDoDia } from './equipamentosDoDia';

const com = (uid: string, equipamento: string | null | undefined, extra = {}) => exercicio(uid, { equipamento, ...extra });

describe('equipamentosDoDia', () => {
  it('lista os equipamentos na ordem em que aparecem', () => {
    const s = sessao('s', [com('a', 'Barra'), com('b', 'Halteres'), com('c', 'Polia')]);
    expect(equipamentosDoDia(s)).toEqual(['Barra', 'Halteres', 'Polia']);
  });

  it('tira espaços, descarta vazio e não repete ignorando maiúsculas (fica a primeira grafia)', () => {
    const s = sessao('s', [com('a', '  Barra olímpica '), com('b', ''), com('c', '   '), com('d', 'barra OLÍMPICA'), com('e', 'Halteres')]);
    expect(equipamentosDoDia(s)).toEqual(['Barra olímpica', 'Halteres']);
  });

  it('cardio e exercícios de grupo contam como os outros', () => {
    const s = sessao('s', [com('a', 'Esteira', { modalidade: 'CARDIO' }), com('b', 'Banco', { grupoUid: 'g' }), com('c', 'Banco', { grupoUid: 'g' })]);
    expect(equipamentosDoDia(s)).toEqual(['Esteira', 'Banco']);
  });

  it('sem equipamento nenhum (ausente, nulo ou versão antiga) devolve lista vazia', () => {
    expect(equipamentosDoDia(sessao('s', [com('a', null), com('b', undefined), exercicio('c')]))).toEqual([]);
    expect(equipamentosDoDia(sessao('s', []))).toEqual([]);
  });
});
