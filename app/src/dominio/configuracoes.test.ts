import { abaDoPlanejamento, tipoDoPlanejamento } from '../treinador/planejamento/modelos';
import {
  buscarCartoes,
  CARTOES_DE_CONFIGURACAO,
  cartoesVisiveis,
  type CartaoDeConfiguracao,
  type ContextoDeConfiguracoes,
  GRUPOS_DE_CONFIGURACAO,
  gruposDeCartoes,
} from './configuracoes';
import { pode, podeAcessarTela } from './permissoes';

const TUDO: ContextoDeConfiguracoes = { pode: () => true, administrador: true, pagamentosHabilitados: true, chaves: { recebimentoOnlineHabilitado: true } };
const com = (codigos: string[], resto: Partial<ContextoDeConfiguracoes> = {}): ContextoDeConfiguracoes => ({
  pode: (c) => pode(codigos, c), administrador: false, pagamentosHabilitados: false, chaves: {}, ...resto,
});
const ids = (cartoes: readonly { id: string }[]) => cartoes.map((c) => c.id);
const PESSOAIS = ['meus-dados', 'seguranca', 'ajustes', 'ajuda', 'termos'];

describe('catálogo das configurações', () => {
  it('não repete id, usa só grupos conhecidos e todo cartão tem texto', () => {
    expect(new Set(ids(CARTOES_DE_CONFIGURACAO)).size).toBe(CARTOES_DE_CONFIGURACAO.length);
    for (const c of CARTOES_DE_CONFIGURACAO) {
      expect(GRUPOS_DE_CONFIGURACAO).toContain(c.grupo);
      expect(c.titulo.trim()).not.toBe('');
      expect(c.descricao.trim()).not.toBe('');
    }
  });

  it('todo href é aceito por podeAcessarTela com acesso total e todas as chaves (nenhum cartão nasce inalcançável)', () => {
    for (const c of CARTOES_DE_CONFIGURACAO) {
      const caminho = c.href.split('?')[0];
      expect([c.id, podeAcessarTela(caminho, TUDO.pode, true, true)]).toEqual([c.id, true]);
    }
  });

  it('o ?aba= e o ?tipo= dos cartões do Planejamento são os que a tela já lê', () => {
    const abas = { questionarios: 'Atualização', anamneses: 'Anamnese', 'perguntas-inscricao': 'Inscrição' };
    for (const [id, rotulo] of Object.entries(abas)) {
      const href = CARTOES_DE_CONFIGURACAO.find((c) => c.id === id)!.href;
      expect(abaDoPlanejamento(new URLSearchParams(href.split('?')[1]).get('aba') ?? undefined, true, true)).toBe(rotulo);
    }
    const metodologias = CARTOES_DE_CONFIGURACAO.find((c) => c.id === 'metodologias')!.href;
    expect(tipoDoPlanejamento(new URLSearchParams(metodologias.split('?')[1]).get('tipo') ?? undefined)).toBe('METODOLOGIA');
  });
});

describe('cartoesVisiveis', () => {
  it('perfil com tudo vê tudo, e a lista segue a ordem do catálogo', () => {
    expect(ids(cartoesVisiveis(TUDO))).toEqual(ids(CARTOES_DE_CONFIGURACAO));
  });

  it('sem nenhuma permissão ficam só os cartões pessoais, e os grupos vazios somem', () => {
    const vistos = cartoesVisiveis(com([]));
    expect(ids(vistos)).toEqual(PESSOAIS);
    expect(gruposDeCartoes(vistos).map((g) => g.grupo)).toEqual(['Sua conta', 'Ajuda']);
  });

  it('sem a permissão do destino ou a extra, o cartão some', () => {
    expect(ids(cartoesVisiveis(com(['CONTA_LER'])))).toContain('minha-conta');
    expect(ids(cartoesVisiveis(com([])))).not.toContain('minha-conta');
    expect(ids(cartoesVisiveis(com(['EQUIPE_LER'])))).toEqual(expect.arrayContaining(['equipe-membros', 'equipe-perfis']));
    expect(ids(cartoesVisiveis(com(['EQUIPE_LER'])))).not.toContain('auditoria');
    expect(ids(cartoesVisiveis(com(['AUDITORIA_LER'])))).toContain('auditoria');
    // O Planejamento abre com QUESTIONARIO_LER, mas Metodologias pede MODELO_LER.
    const soQuestionarios = ids(cartoesVisiveis(com(['QUESTIONARIO_LER'])));
    expect(soQuestionarios).toEqual(expect.arrayContaining(['questionarios', 'anamneses', 'perguntas-inscricao']));
    expect(soQuestionarios).not.toContain('metodologias');
    const soModelos = ids(cartoesVisiveis(com(['MODELO_LER'])));
    expect(soModelos).toContain('metodologias');
    expect(soModelos).not.toContain('questionarios');
    expect(ids(cartoesVisiveis(com(['INSCRICAO_LER'])))).toContain('interessados');
  });

  it('importação: a planilha completa pede ALUNO_ALTERAR, a importação aceita qualquer das quatro de escrita', () => {
    expect(ids(cartoesVisiveis(com(['BIBLIOTECA_ALTERAR'])))).toEqual(expect.arrayContaining(['importacao']));
    expect(ids(cartoesVisiveis(com(['BIBLIOTECA_ALTERAR'])))).not.toContain('planilha-completa');
    expect(ids(cartoesVisiveis(com(['ALUNO_ALTERAR'])))).toEqual(expect.arrayContaining(['importacao', 'planilha-completa']));
  });

  it('Marca e Contato são só do administrador: precisam da guarda da tela e de MARCA_ALTERAR', () => {
    for (const id of ['marca', 'contato']) {
      expect(ids(cartoesVisiveis(com(['MARCA_ALTERAR'])))).not.toContain(id);
      expect(ids(cartoesVisiveis(com([], { administrador: true })))).not.toContain(id);
      expect(ids(cartoesVisiveis(com(['MARCA_ALTERAR'], { administrador: true })))).toContain(id);
    }
    expect(CARTOES_DE_CONFIGURACAO.find((c) => c.id === 'contato')).toMatchObject({ grupo: 'Consultoria', href: '/treinador/marca' });
  });

  it('Documentos (PDF): administrador com MARCA_ALTERAR e o PDF no plano; a busca acha por pdf e tema', () => {
    const admin = com(['MARCA_ALTERAR'], { administrador: true });
    expect(ids(cartoesVisiveis(admin))).toContain('documentos-pdf');
    expect(ids(cartoesVisiveis({ ...admin, liberadas: ['PDF'] }))).toContain('documentos-pdf');
    expect(ids(cartoesVisiveis({ ...admin, liberadas: ['MOBILIDADE', 'EQUIPE'] }))).not.toContain('documentos-pdf');
    expect(ids(cartoesVisiveis(com(['MARCA_ALTERAR'])))).not.toContain('documentos-pdf');
    expect(ids(cartoesVisiveis(com([], { administrador: true })))).not.toContain('documentos-pdf');
    expect(ids(buscarCartoes('pdf', cartoesVisiveis(admin)))).toEqual(['documentos-pdf']);
    expect(ids(buscarCartoes('tema do pdf', cartoesVisiveis(admin)))).toEqual(['documentos-pdf']);
  });

  it('Financeiro: precisa do módulo ligado e de FINANCEIRO_LER; o Recebimento online ainda pede a chave', () => {
    const financeiro = ['financeiro-planos', 'financeiro-lembretes'];
    expect(ids(cartoesVisiveis(com(['FINANCEIRO_LER'])))).not.toEqual(expect.arrayContaining(financeiro));
    expect(ids(cartoesVisiveis(com([], { pagamentosHabilitados: true })))).not.toContain('financeiro-planos');
    const ligado = com(['FINANCEIRO_LER'], { pagamentosHabilitados: true });
    expect(ids(cartoesVisiveis(ligado))).toEqual(expect.arrayContaining(financeiro));
    expect(ids(cartoesVisiveis(ligado))).not.toContain('financeiro-recebimento');
    expect(ids(cartoesVisiveis({ ...ligado, chaves: { recebimentoOnlineHabilitado: false } }))).not.toContain('financeiro-recebimento');
    expect(ids(cartoesVisiveis({ ...ligado, chaves: { recebimentoOnlineHabilitado: true } }))).toContain('financeiro-recebimento');
  });

  it('chave desligada ou ausente esconde o cartão mesmo com acesso total', () => {
    expect(ids(cartoesVisiveis({ ...TUDO, chaves: {} }))).not.toContain('financeiro-recebimento');
    expect(ids(cartoesVisiveis({ ...TUDO, chaves: { recebimentoOnlineHabilitado: false } }))).not.toContain('financeiro-recebimento');
  });

  it('funcionalidade fora do plano esconde o cartão; sem a lista (pacote antigo, offline), vale tudo', () => {
    const teste: CartaoDeConfiguracao[] = [
      { id: 'a', grupo: 'Equipe', titulo: 'A', descricao: 'a', href: '/treinador/ajuda', palavras: [], funcionalidade: 'EQUIPE' },
      { id: 'b', grupo: 'Equipe', titulo: 'B', descricao: 'b', href: '/treinador/ajuda', palavras: [] },
    ];
    expect(ids(cartoesVisiveis({ ...TUDO, liberadas: ['PDF'] }, teste))).toEqual(['b']);
    expect(ids(cartoesVisiveis({ ...TUDO, liberadas: ['EQUIPE'] }, teste))).toEqual(['a', 'b']);
    expect(ids(cartoesVisiveis({ ...TUDO, liberadas: undefined }, teste))).toEqual(['a', 'b']);
    expect(ids(cartoesVisiveis({ ...TUDO, liberadas: [] }, teste))).toEqual(['b']);
  });
});

describe('gruposDeCartoes', () => {
  it('agrupa na ordem dos grupos, mantém a ordem dos cartões e descarta grupo vazio', () => {
    const grupos = gruposDeCartoes(cartoesVisiveis(TUDO));
    expect(grupos.map((g) => g.grupo)).toEqual([...GRUPOS_DE_CONFIGURACAO]);
    expect(ids(grupos.flatMap((g) => g.cartoes))).toEqual(ids(CARTOES_DE_CONFIGURACAO));
    expect(gruposDeCartoes([])).toEqual([]);
    const soAjuda = CARTOES_DE_CONFIGURACAO.filter((c) => c.grupo === 'Ajuda' || c.grupo === 'Equipe');
    expect(gruposDeCartoes(soAjuda).map((g) => g.grupo)).toEqual(['Equipe', 'Ajuda']);
  });
});

describe('buscarCartoes', () => {
  const todos = [...CARTOES_DE_CONFIGURACAO];

  it('texto vazio ou só espaços devolve todos, na mesma ordem', () => {
    expect(ids(buscarCartoes('', todos))).toEqual(ids(todos));
    expect(ids(buscarCartoes('   ', todos))).toEqual(ids(todos));
  });

  it('ignora acento e maiúscula no título', () => {
    expect(ids(buscarCartoes('SEGURANCA', todos))).toContain('seguranca');
    expect(ids(buscarCartoes('aparência', todos))).toContain('ajustes');
  });

  it('acha pela descrição', () => {
    expect(ids(buscarCartoes('verificacao em duas', todos))).toContain('seguranca');
    expect(ids(buscarCartoes('Quero ser aluno', todos))).toContain('perguntas-inscricao');
  });

  it('acha por sinônimo, sem acento', () => {
    expect(ids(buscarCartoes('2fa', todos))).toEqual(['seguranca']);
    expect(ids(buscarCartoes('Questionário padrão', todos))).toContain('questionarios');
    expect(ids(buscarCartoes('pix', todos))).toContain('financeiro-recebimento');
    expect(ids(buscarCartoes('remetente', todos))).toEqual(['contato']);
    expect(ids(buscarCartoes('Responder para', todos))).toEqual(['contato']);
    expect(ids(buscarCartoes('WhatsApp', todos))).toContain('contato');
  });

  it('cada palavra precisa aparecer (E), em qualquer ordem', () => {
    expect(ids(buscarCartoes('equipe permissoes', todos))).toEqual(['equipe-perfis']);
    expect(ids(buscarCartoes('permissoes equipe', todos))).toEqual(['equipe-perfis']);
    expect(buscarCartoes('equipe batata', todos)).toEqual([]);
  });

  it('sem resultado devolve lista vazia', () => {
    expect(buscarCartoes('zzzzzz', todos)).toEqual([]);
  });

  it('não reordena: o resultado é um recorte do catálogo na ordem original', () => {
    const achados = ids(buscarCartoes('equipe', todos));
    expect(achados).toEqual(ids(todos).filter((id) => achados.includes(id)));
  });

  it('só procura entre os cartões recebidos (os que o perfil não vê não são achados)', () => {
    expect(buscarCartoes('marca', cartoesVisiveis(com([])))).toEqual([]);
    expect(ids(buscarCartoes('marca', cartoesVisiveis(TUDO)))).toContain('marca');
  });
});
