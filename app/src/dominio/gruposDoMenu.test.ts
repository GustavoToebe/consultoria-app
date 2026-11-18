import {
  alternarGrupoRecolhido,
  GRUPOS_DO_MENU,
  gruposDoMenu,
  gruposRecolhidos,
  MENU_DO_TREINADOR,
  naConta,
  naOrdemDoMenu,
  posicaoNoMenu,
  resumoDoGrupoRecolhido,
  rotuloCurtoDoMenu,
  type GrupoDoMenu,
} from './gruposDoMenu';

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
      item('Alunos', 'Acompanhamento'),
      item('Agenda', 'Acompanhamento'),
      item('Biblioteca', 'Conteúdo'),
      item('Interessados', 'Negócio'),
      item('Equipe', 'Configurações'),
      item('Ajuda', 'Configurações'),
    ]);
    expect(blocos.map((b) => [b.grupo, b.itens.map((i) => i.rotulo)])).toEqual([
      [undefined, ['Início']],
      ['Acompanhamento', ['Alunos', 'Agenda']],
      ['Conteúdo', ['Biblioteca']],
      ['Negócio', ['Interessados']],
      ['Configurações', ['Equipe', 'Ajuda']],
    ]);
  });

  it('item fora do lugar entra no grupo dele sem mudar a ordem dos outros', () => {
    const blocos = gruposDoMenu([item('Alunos', 'Acompanhamento'), item('Números', 'Negócio'), item('Agenda', 'Acompanhamento')]);
    expect(blocos.map((b) => b.itens.map((i) => i.rotulo))).toEqual([['Alunos', 'Agenda'], ['Números']]);
  });

  it('grupo sem item permitido não vira bloco', () => {
    // O perfil só vê Alunos e Ajuda: "Negócio" não tem nenhum item depois do filtro de permissão.
    const blocos = gruposDoMenu([item('Alunos', 'Acompanhamento'), item('Ajuda', 'Configurações')]);
    expect(blocos.map((b) => b.grupo)).toEqual(['Acompanhamento', 'Configurações']);
  });

  it('lista vazia, nenhum bloco', () => {
    expect(gruposDoMenu([])).toEqual([]);
  });
});

describe('gruposRecolhidos', () => {
  const todos: GrupoDoMenu[] = [...GRUPOS_DO_MENU];

  it('devolve os salvos que têm item permitido, na ordem do menu', () => {
    expect(gruposRecolhidos(['Negócio', 'Acompanhamento'], todos)).toEqual(['Acompanhamento', 'Negócio']);
    expect(gruposRecolhidos([], todos)).toEqual([]);
  });

  it('o grupo da tela aberta nunca fica recolhido, mesmo salvo como recolhido', () => {
    expect(gruposRecolhidos(['Acompanhamento', 'Negócio'], todos, 'Negócio')).toEqual(['Acompanhamento']);
    // Tela aberta no Início (sem grupo): nada é protegido.
    expect(gruposRecolhidos(['Negócio'], [undefined, ...todos], undefined)).toEqual(['Negócio']);
  });

  it('id desconhecido é ignorado', () => {
    expect(gruposRecolhidos(['Inexistente', '', 'Conteúdo'], todos)).toEqual(['Conteúdo']);
  });

  it('grupo sem item permitido continua sumindo: não aparece nem recolhido', () => {
    expect(gruposRecolhidos(['Negócio', 'Conteúdo'], ['Conteúdo', 'Configurações'])).toEqual(['Conteúdo']);
  });
});

describe('alternarGrupoRecolhido', () => {
  it('recolhe o grupo aberto e abre o recolhido', () => {
    expect(alternarGrupoRecolhido([], 'Negócio')).toEqual(['Negócio']);
    expect(alternarGrupoRecolhido(['Negócio'], 'Negócio')).toEqual([]);
  });

  it('mantém a ordem do menu, sem repetir, e descarta o que não é grupo', () => {
    expect(alternarGrupoRecolhido(['Negócio', 'Negócio', 'Xis'], 'Acompanhamento')).toEqual(['Acompanhamento', 'Negócio']);
    expect(alternarGrupoRecolhido(['Negócio', 'Conteúdo', 'Negócio'], 'Conteúdo')).toEqual(['Negócio']);
  });
});

describe('resumoDoGrupoRecolhido', () => {
  const conta = (numero: number, descricao = 'para revisar') => ({ contagem: { numero, descricao } });

  it('soma as contagens dos itens e guarda as partes maiores que zero', () => {
    expect(resumoDoGrupoRecolhido([conta(3), conta(1, 'inscrição nova'), conta(0, 'outra')])).toEqual({
      numero: 4,
      ponto: false,
      partes: [{ numero: 3, descricao: 'para revisar' }, { numero: 1, descricao: 'inscrição nova' }],
    });
  });

  it('item sem contagem conta como ausente: a soma só usa os que têm', () => {
    expect(resumoDoGrupoRecolhido([{}, conta(2), { ponto: false }]).numero).toBe(2);
  });

  it('nenhum item com contagem: numero nulo, nunca zero inventado', () => {
    expect(resumoDoGrupoRecolhido([{}, { ponto: false }]).numero).toBeNull();
    expect(resumoDoGrupoRecolhido([]).numero).toBeNull();
  });

  it('contagem presente e zero soma zero (a tela não a mostra)', () => {
    expect(resumoDoGrupoRecolhido([conta(0)])).toEqual({ numero: 0, ponto: false, partes: [] });
  });

  it('o ponto vale com algum item com ponto e sem contagem maior que zero; "inferior" é só da barra do celular', () => {
    expect(resumoDoGrupoRecolhido([{ ponto: true }, {}]).ponto).toBe(true);
    expect(resumoDoGrupoRecolhido([{ ponto: true, ...conta(0) }]).ponto).toBe(true);
    expect(resumoDoGrupoRecolhido([{ ponto: true, ...conta(2) }]).ponto).toBe(false);
    expect(resumoDoGrupoRecolhido([{ ponto: 'inferior' }]).ponto).toBe(false);
    expect(resumoDoGrupoRecolhido([{ ponto: false }]).ponto).toBe(false);
  });
});

describe('rotuloCurtoDoMenu', () => {
  it('usa o curto quando existe e o nome inteiro quando não', () => {
    expect(rotuloCurtoDoMenu({ rotulo: 'Planejamento', rotuloCurto: 'Planos' })).toBe('Planos');
    expect(rotuloCurtoDoMenu({ rotulo: 'Biblioteca' })).toBe('Biblioteca');
  });
});

describe('MENU_DO_TREINADOR', () => {
  it('Início no topo, sem grupo, e os grupos do D6 na ordem de GRUPOS_DO_MENU', () => {
    expect(MENU_DO_TREINADOR[0]).toEqual({ caminho: '/treinador' });
    const grupos = MENU_DO_TREINADOR.slice(1).map((m) => m.grupo);
    expect(grupos.every((g) => g !== undefined)).toBe(true);
    expect([...new Set(grupos)]).toEqual([...GRUPOS_DO_MENU]);
    // Cada grupo contínuo: a lista não volta a um grupo que já fechou.
    expect(grupos.filter((g, i) => i === 0 || g !== grupos[i - 1])).toEqual([...GRUPOS_DO_MENU]);
  });

  it('a barra do celular (Início, Alunos, Biblioteca, Planejamento, Perfil) fica na mesma ordem', () => {
    const barra = ['/treinador', '/treinador/alunos', '/treinador/biblioteca', '/treinador/planejamento', '/treinador/perfil'];
    expect(MENU_DO_TREINADOR.map((m) => m.caminho).filter((c) => barra.includes(c))).toEqual(barra);
  });
});

describe('naOrdemDoMenu', () => {
  it('ordena pelo menu e preenche grupo e tambem, mantendo os outros campos', () => {
    const itens = naOrdemDoMenu([
      { caminho: '/treinador/ajuda', rotulo: 'Ajuda' },
      { caminho: '/treinador', rotulo: 'Início' },
      { caminho: '/treinador/numeros', rotulo: 'Números' },
    ]);
    expect(itens).toEqual([
      { caminho: '/treinador', rotulo: 'Início', grupo: undefined },
      { caminho: '/treinador/numeros', rotulo: 'Números', grupo: 'Negócio' },
      { caminho: '/treinador/ajuda', rotulo: 'Ajuda', grupo: 'Configurações', tambem: ['/treinador/termos'] },
    ]);
  });

  it('item fora do menu é erro de programação', () => {
    expect(() => naOrdemDoMenu([{ caminho: '/treinador/xyz' }])).toThrow('/treinador/xyz');
  });
});

describe('posicaoNoMenu', () => {
  it('o próprio item, a tela aberta por ele (tambem) e a subpágina', () => {
    expect(posicaoNoMenu('/treinador/numeros')).toMatchObject({ grupo: 'Negócio', propria: true });
    expect(posicaoNoMenu('/treinador/marca')).toMatchObject({ grupo: 'Configurações', propria: false });
    expect(posicaoNoMenu('/treinador/termos')).toMatchObject({ grupo: 'Configurações', propria: false });
    expect(posicaoNoMenu('/treinador/alunos/novo')).toMatchObject({ grupo: 'Acompanhamento', propria: false });
    expect(posicaoNoMenu('/treinador')).toEqual({ grupo: undefined, indice: 0, propria: true });
  });

  it('caminho fora do menu (nem item, nem tambem, nem subpágina) é null; a raiz não vira pai de tudo', () => {
    expect(posicaoNoMenu('/treinador/xyz')).toBeNull();
    expect(posicaoNoMenu('/aluno')).toBeNull();
  });
});

describe('naConta', () => {
  it('as telas do menu da conta, e as subpáginas delas, acendem o botão da conta', () => {
    expect(naConta('/treinador/marca')).toBe(true);
    expect(naConta('/treinador/configuracoes')).toBe(true);
    expect(naConta('/treinador/ajustes')).toBe(true);
    expect(naConta('/treinador/minha-conta/faturas')).toBe(true);
    expect(naConta('/treinador')).toBe(false);
    expect(naConta('/treinador/perfil')).toBe(false);
    expect(naConta('/treinador/marcador')).toBe(false);
  });
});
