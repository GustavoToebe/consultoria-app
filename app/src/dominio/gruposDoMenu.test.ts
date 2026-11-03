import { gruposDoMenu, rotuloCurtoDoMenu, type GrupoDoMenu } from './gruposDoMenu';

const item = (rotulo: string, grupo?: GrupoDoMenu) => ({ rotulo, grupo });

describe('gruposDoMenu', () => {
  it('sem grupo em nenhum item, devolve um bloco só, sem título, na ordem do array', () => {
    expect(gruposDoMenu([item('Início'), item('Alunos'), item('Biblioteca')])).toEqual([
      { grupo: undefined, itens: [item('Início'), item('Alunos'), item('Biblioteca')] },
    ]);
  });

  it('Início fora de grupo no topo e os grupos na ordem em que aparecem', () => {
    const blocos = gruposDoMenu([
      item('Início'),
      item('Alunos', 'Alunos e acompanhamento'),
      item('Agenda', 'Alunos e acompanhamento'),
      item('Interessados', 'Negócio'),
      item('Equipe', 'Configurações'),
      item('Ajuda', 'Configurações'),
    ]);
    expect(blocos.map((b) => [b.grupo, b.itens.map((i) => i.rotulo)])).toEqual([
      [undefined, ['Início']],
      ['Alunos e acompanhamento', ['Alunos', 'Agenda']],
      ['Negócio', ['Interessados']],
      ['Configurações', ['Equipe', 'Ajuda']],
    ]);
  });

  it('item fora do lugar entra no grupo dele sem mudar a ordem dos outros', () => {
    const blocos = gruposDoMenu([item('Alunos', 'Alunos e acompanhamento'), item('Números', 'Negócio'), item('Agenda', 'Alunos e acompanhamento')]);
    expect(blocos.map((b) => b.itens.map((i) => i.rotulo))).toEqual([['Alunos', 'Agenda'], ['Números']]);
  });

  it('grupo sem item permitido não vira bloco', () => {
    // O perfil só vê Alunos e Ajuda: "Negócio" não tem nenhum item depois do filtro de permissão.
    const blocos = gruposDoMenu([item('Alunos', 'Alunos e acompanhamento'), item('Ajuda', 'Configurações')]);
    expect(blocos.map((b) => b.grupo)).toEqual(['Alunos e acompanhamento', 'Configurações']);
  });

  it('lista vazia, nenhum bloco', () => {
    expect(gruposDoMenu([])).toEqual([]);
  });
});

describe('rotuloCurtoDoMenu', () => {
  it('usa o curto quando existe e o nome inteiro quando não', () => {
    expect(rotuloCurtoDoMenu({ rotulo: 'Planejamento', rotuloCurto: 'Planos' })).toBe('Planos');
    expect(rotuloCurtoDoMenu({ rotulo: 'Biblioteca' })).toBe('Biblioteca');
  });
});
