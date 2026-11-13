import {
  chaveDosFiltros, chipsDosFiltros, filtrosVisiveis, lerDoEndereco, MEUS, opcoesDeResponsavel, paraEndereco, pedidoDaApi,
  permissoesDosFiltros, quantosFiltros, SEM_FILTROS, SEM_RESPONSAVEL, semOFiltro, semOQueNaoPode, type FiltrosDeAlunos,
} from './filtrosDeAlunos';

const ID = 'a0000000-0000-4000-8000-000000000001';
const EU = 'u0000000-0000-4000-8000-000000000009';
const todas = new Set(['ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER', 'TREINO_LER', 'REGISTRO_LER']);
const tudo = permissoesDosFiltros((c) => todas.has(c));
const nada = permissoesDosFiltros(() => false);
const f = (extra: Partial<FiltrosDeAlunos>): FiltrosDeAlunos => ({ ...SEM_FILTROS, ...extra });

describe('lerDoEndereco', () => {
  it('sem parâmetros: ativos, todos ou os meus conforme o perfil', () => {
    expect(lerDoEndereco({}, false)).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({}, true)).toEqual(f({ responsaveis: [MEUS] }));
  });

  it('lê cada filtro, com vírgula ou parâmetro repetido, sem diferença de caixa', () => {
    const lido = lerDoEndereco({
      situacao: 'inativo', acesso: 'SEM,aguardando', atualizacao: ['ATRASADA', 'SEM_PASTA'], plano: 'SEM', pasta: 'A_RENOVAR', registro: 'HA_MAIS_DE_14',
      responsavel: `${ID},nenhum`,
    }, true);
    expect(lido).toEqual({
      situacao: 'INATIVO', responsaveis: [ID, SEM_RESPONSAVEL], acesso: ['SEM', 'AGUARDANDO'], atualizacao: ['ATRASADA', 'SEM_PASTA'],
      plano: 'SEM', pastaARenovar: true, registro: 'HA_MAIS_DE_14',
    });
  });

  it('meus=true é só Meus; meus=false é todos, mesmo para quem começa em Meus', () => {
    expect(lerDoEndereco({ meus: 'true' }, false).responsaveis).toEqual([MEUS]);
    expect(lerDoEndereco({ meus: 'false' }, true).responsaveis).toEqual([]);
  });

  it('valor desconhecido é ignorado, nunca vai para a API', () => {
    const lido = lerDoEndereco({ situacao: 'ALGUNS', acesso: 'TALVEZ,SEM', atualizacao: 'X', plano: 'MAIS', pasta: 'X', registro: 'HA_MAIS_DE_3', responsavel: 'id com espaço' }, false);
    expect(lido).toEqual(f({ acesso: ['SEM'] }));
  });
});

describe('paraEndereco', () => {
  it('só o que muda do padrão, e volta igual pelo lerDoEndereco', () => {
    const filtros = f({ situacao: 'TODOS', acesso: ['SEM'], atualizacao: ['ENVIADA', 'SEM_PASTA'], plano: 'COM', pastaARenovar: true, registro: 'NUNCA', responsaveis: [MEUS, SEM_RESPONSAVEL] });
    const q = paraEndereco(filtros, false);
    expect(q).toEqual({ situacao: 'TODOS', responsavel: 'meus,nenhum', acesso: 'SEM', atualizacao: 'ENVIADA,SEM_PASTA', plano: 'COM', pasta: 'A_RENOVAR', registro: 'NUNCA' });
    expect(lerDoEndereco(q, false)).toEqual(filtros);
    expect(paraEndereco(SEM_FILTROS, false)).toEqual({});
  });

  it('responsável conforme o padrão do perfil', () => {
    expect(paraEndereco(f({ responsaveis: [MEUS] }), false)).toEqual({ meus: 'true' });
    expect(paraEndereco(f({ responsaveis: [MEUS] }), true)).toEqual({});
    expect(paraEndereco(SEM_FILTROS, true)).toEqual({ meus: 'false' });
    expect(lerDoEndereco(paraEndereco(SEM_FILTROS, true), true)).toEqual(SEM_FILTROS);
  });
});

describe('pedidoDaApi', () => {
  it('só Meus vai como meus=true; com outras pessoas, o id do usuário vai em responsavel', () => {
    expect(pedidoDaApi(f({ responsaveis: [MEUS] }), EU)).toEqual([['situacao', 'ATIVO'], ['meus', 'true']]);
    expect(pedidoDaApi(f({ responsaveis: [MEUS, SEM_RESPONSAVEL, ID] }), EU)).toEqual([
      ['situacao', 'ATIVO'], ['meus', 'false'], ['responsavel', EU], ['responsavel', SEM_RESPONSAVEL], ['responsavel', ID],
    ]);
  });

  it('cada opção vira um parâmetro repetido', () => {
    expect(pedidoDaApi(f({ acesso: ['SEM', 'AGUARDANDO'], atualizacao: ['ATRASADA'], plano: 'SEM', pastaARenovar: true, registro: 'HA_MAIS_DE_7' }), EU)).toEqual([
      ['situacao', 'ATIVO'], ['meus', 'false'], ['acesso', 'SEM'], ['acesso', 'AGUARDANDO'], ['atualizacao', 'ATRASADA'],
      ['plano', 'SEM'], ['pasta', 'A_RENOVAR'], ['registro', 'HA_MAIS_DE_7'],
    ]);
  });
});

describe('chips e contagem', () => {
  it('um chip por filtro ligado, na ordem do painel, com os rótulos da tela', () => {
    const filtros = f({ situacao: 'INATIVO', responsaveis: [SEM_RESPONSAVEL, ID, MEUS], acesso: ['AGUARDANDO', 'SEM'], atualizacao: ['SEM_PASTA', 'ENVIADA'], plano: 'SEM', pastaARenovar: true, registro: 'NUNCA' });
    expect(chipsDosFiltros(filtros, (id) => (id === ID ? 'Bia Fictícia' : null)).map((c) => c.texto)).toEqual([
      'Situação: Inativos',
      'Responsável: Meus alunos, Bia Fictícia, Sem responsável',
      'Acesso: Sem acesso, Aguardando o primeiro acesso',
      'Atualização: Para revisar, Sem pasta com período',
      'Plano: Sem plano em uso',
      'Pasta a renovar',
      'Último registro: Nunca registrou',
    ]);
    expect(quantosFiltros(filtros)).toBe(7);
    expect(quantosFiltros(SEM_FILTROS)).toBe(0);
    expect(chipsDosFiltros(f({ responsaveis: [ID] }))[0].texto).toBe('Responsável: Outro membro');
  });

  it('o ✕ tira só aquele filtro', () => {
    const filtros = f({ situacao: 'TODOS', acesso: ['SEM'], registro: 'NUNCA' });
    expect(semOFiltro(filtros, 'acesso')).toEqual(f({ situacao: 'TODOS', registro: 'NUNCA' }));
    expect(semOFiltro(filtros, 'situacao').situacao).toBe('ATIVO');
    expect(semOFiltro(f({ responsaveis: [MEUS] }), 'responsavel').responsaveis).toEqual([]);
    expect(semOFiltro(f({ pastaARenovar: true }), 'pasta').pastaARenovar).toBe(false);
  });

  it('a chave muda quando o filtro muda, não pela ordem das opções', () => {
    expect(chaveDosFiltros(f({ acesso: ['SEM', 'COM'] }))).toBe(chaveDosFiltros(f({ acesso: ['COM', 'SEM'] })));
    expect(chaveDosFiltros(f({ acesso: ['SEM'] }))).not.toBe(chaveDosFiltros(f({ acesso: ['COM'] })));
  });
});

describe('permissões', () => {
  it('cada filtro aparece só com a permissão de quem já vê o dado', () => {
    expect(filtrosVisiveis(tudo)).toEqual(['situacao', 'responsavel', 'acesso', 'atualizacao', 'plano', 'pasta', 'registro']);
    expect(filtrosVisiveis(nada)).toEqual(['situacao', 'responsavel', 'acesso']);
    // Atualização pede as duas.
    expect(permissoesDosFiltros((c) => c === 'ATUALIZACAO_LER').atualizacao).toBe(false);
  });

  it('o que vem do endereço sem permissão é tirado antes de ir à API', () => {
    const doEndereco = f({ acesso: ['SEM'], atualizacao: ['ATRASADA'], plano: 'COM', pastaARenovar: true, registro: 'NUNCA' });
    const limpo = semOQueNaoPode(doEndereco, nada);
    expect(limpo).toEqual(f({ acesso: ['SEM'] }));
    expect(pedidoDaApi(limpo, EU).map(([k]) => k)).toEqual(['situacao', 'meus', 'acesso']);
    expect(semOQueNaoPode(doEndereco, tudo)).toEqual(doEndereco);
  });
});

describe('opcoesDeResponsavel', () => {
  it('Meus primeiro, as outras pessoas por nome (sem o usuário) e Sem responsável por último', () => {
    const opcoes = opcoesDeResponsavel([{ id: EU, nome: 'Eu Mesmo' }, { id: 'b', nome: 'Zeca' }, { id: 'c', nome: 'Ana' }], EU);
    expect(opcoes.map((o) => o.rotulo)).toEqual(['Meus alunos', 'Ana', 'Zeca', 'Sem responsável']);
  });
});
