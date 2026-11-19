import type { TagDaConsultoria, TagDeAluno } from '../../api/tipos';
import { opcoesDoCampo, opcoesDoFiltroDeTags, rotuloDasTagsNaLinha } from './textosDasTags';

const tag = (id: string, nome: string): TagDeAluno => ({ id, nome, cor: 'AZUL' });
const ONLINE = tag('t1', 'Online');
const RETORNO = tag('t2', 'Retorno');
const PRESENCIAL = tag('t3', 'Presencial');
const ON = tag('t4', 'Online plus');

describe('rotuloDasTagsNaLinha', () => {
  it('sem tags não diz nada; até duas, os nomes; mais, "e mais N"', () => {
    expect(rotuloDasTagsNaLinha([])).toBeNull();
    expect(rotuloDasTagsNaLinha([ONLINE])).toBe('Tags: Online');
    expect(rotuloDasTagsNaLinha([ONLINE, RETORNO])).toBe('Tags: Online, Retorno');
    expect(rotuloDasTagsNaLinha([ONLINE, RETORNO, PRESENCIAL, ON])).toBe('Tags: Online, Retorno e mais 2');
  });
});

describe('opcoesDoCampo', () => {
  const consultoria = [ON, ONLINE, RETORNO, PRESENCIAL];

  it('texto vazio: as da consultoria que o aluno não tem, sem "Criar"', () => {
    expect(opcoesDoCampo(consultoria, [RETORNO], '')).toEqual([ON, ONLINE, PRESENCIAL].map((t) => ({ tipo: 'tag', tag: t })));
  });

  it('filtra sem acento nem caixa e põe o nome igual primeiro', () => {
    expect(opcoesDoCampo(consultoria, [], 'ONLÍNE').map((o) => (o.tipo === 'tag' ? o.tag.id : o.tipo))).toEqual(['t1', 't4']);
  });

  it('nome novo ganha "Criar" no fim; nome que já existe (na consultoria ou no aluno) não', () => {
    expect(opcoesDoCampo(consultoria, [], ' Avançado ')).toEqual([{ tipo: 'criar', nome: 'Avançado' }]);
    expect(opcoesDoCampo(consultoria, [], 'retorno')).toEqual([{ tipo: 'tag', tag: RETORNO }]);
    expect(opcoesDoCampo(consultoria, [RETORNO], 'retorno')).toEqual([]);
    expect(opcoesDoCampo([], [tag('x', 'Só no aluno')], 'só no aluno')).toEqual([]);
  });

  it('corta no máximo, mas o "Criar" continua', () => {
    const muitas = Array.from({ length: 12 }, (_, i) => tag(`m${i}`, `Grupo ${i}`));
    const opcoes = opcoesDoCampo(muitas, [], 'grupo', 8);
    expect(opcoes.filter((o) => o.tipo === 'tag')).toHaveLength(8);
    expect(opcoes.at(-1)).toEqual({ tipo: 'criar', nome: 'grupo' });
  });
});

it('opcoesDoFiltroDeTags: id e nome, em ordem alfabética', () => {
  const lista: TagDaConsultoria[] = [{ ...RETORNO, totalAlunos: 2, versao: 0 }, { ...ONLINE, totalAlunos: 0, versao: 1 }];
  expect(opcoesDoFiltroDeTags(lista)).toEqual([{ valor: 't1', rotulo: 'Online' }, { valor: 't2', rotulo: 'Retorno' }]);
});
