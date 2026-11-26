import { abaDoPlanejamento, tipoDoPlanejamento } from '../treinador/planejamento/modelos';
import { artigoDaTela } from './ajudaDaTela';
import {
  abreDentro,
  buscarCartoes,
  CARTOES_DE_CONFIGURACAO,
  cartoesVisiveis,
  destinoNaColuna,
  primeiroItemDentro,
  type CartaoDeConfiguracao,
  type ContextoDeConfiguracoes,
  GRUPOS_DE_CONFIGURACAO,
  gruposDeCartoes,
} from './configuracoes';
import { pode, podeAcessarTela } from './permissoes';
import { ehItemEmbutido, itemDoCaminho, ROTA_INTEIRA_DO_ITEM, rotaInteiraDoCaminho } from './rotasDasConfiguracoes';
import { nomeDaTela } from './telas';

const TUDO: ContextoDeConfiguracoes = { pode: () => true, administrador: true, pagamentosHabilitados: true, chaves: { recebimentoOnlineHabilitado: true, whatsappHabilitado: true, contratosHabilitados: true } };
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

  it('Tags dos alunos: abre com ALUNO_LER (a guarda da lista de alunos) e a busca acha por etiqueta', () => {
    expect(ids(cartoesVisiveis(com(['ALUNO_LER'])))).toContain('tags-dos-alunos');
    expect(ids(cartoesVisiveis(com(['ALUNO_ALTERAR'])))).not.toContain('tags-dos-alunos');
    expect(ids(buscarCartoes('etiquetas', CARTOES_DE_CONFIGURACAO))).toEqual(['tags-dos-alunos']);
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

  it('Financeiro: precisa do módulo ligado e de FINANCEIRO_LER; o Recebimento vale sem a chave da InfinitePay', () => {
    const financeiro = ['financeiro-planos', 'financeiro-lembretes', 'financeiro-recebimento'];
    expect(ids(cartoesVisiveis(com(['FINANCEIRO_LER'])))).not.toEqual(expect.arrayContaining(financeiro));
    expect(ids(cartoesVisiveis(com([], { pagamentosHabilitados: true })))).not.toContain('financeiro-planos');
    const ligado = com(['FINANCEIRO_LER'], { pagamentosHabilitados: true });
    // Pix, link próprio e Manual não dependem da InfinitePay: a aba aparece com a chave ausente ou desligada.
    expect(ids(cartoesVisiveis(ligado))).toEqual(expect.arrayContaining(financeiro));
    expect(ids(cartoesVisiveis({ ...ligado, chaves: { recebimentoOnlineHabilitado: false } }))).toContain('financeiro-recebimento');
    expect(ids(cartoesVisiveis({ ...ligado, chaves: { recebimentoOnlineHabilitado: true } }))).toContain('financeiro-recebimento');
    expect(ids(cartoesVisiveis(com(['FINANCEIRO_LER'], { pagamentosHabilitados: false })))).not.toContain('financeiro-recebimento');
  });

  it('o cartão do recebimento fala das formas, não só da InfinitePay, e a busca acha Pix e link próprio', () => {
    const cartao = CARTOES_DE_CONFIGURACAO.find((c) => c.id === 'financeiro-recebimento')!;
    expect(cartao.chave).toBeUndefined();
    expect(cartao.descricao).toMatch(/Pix/);
    expect(ids(buscarCartoes('chave pix', CARTOES_DE_CONFIGURACAO))).toContain('financeiro-recebimento');
    expect(ids(buscarCartoes('link proprio', CARTOES_DE_CONFIGURACAO))).toContain('financeiro-recebimento');
  });

  it('cartão com chave: chave desligada ou ausente o esconde mesmo com acesso total', () => {
    const teste: CartaoDeConfiguracao[] = [
      { id: 'c', grupo: 'Financeiro', titulo: 'C', descricao: 'c', href: '/treinador/ajuda', palavras: [], chave: 'recebimentoOnlineHabilitado' },
    ];
    expect(ids(cartoesVisiveis({ ...TUDO, chaves: {} }, teste))).toEqual([]);
    expect(ids(cartoesVisiveis({ ...TUDO, chaves: { recebimentoOnlineHabilitado: false } }, teste))).toEqual([]);
    expect(ids(cartoesVisiveis({ ...TUDO, chaves: { recebimentoOnlineHabilitado: true } }, teste))).toEqual(['c']);
  });

  it('Contratos (27/11): precisa de CONTRATO_LER e da chave contratosHabilitados, sem depender do financeiro', () => {
    const chave = { contratosHabilitados: true };
    expect(ids(cartoesVisiveis(com(['CONTRATO_LER'], { chaves: chave })))).toContain('contratos');
    expect(ids(cartoesVisiveis(com(['CONTRATO_LER'], { chaves: { contratosHabilitados: false } })))).not.toContain('contratos');
    expect(ids(cartoesVisiveis(com(['CONTRATO_LER'])))).not.toContain('contratos');
    expect(ids(cartoesVisiveis(com(['CONTRATO_ALTERAR'], { chaves: chave })))).not.toContain('contratos');
    expect(ids(buscarCartoes('assinatura', CARTOES_DE_CONFIGURACAO))).toContain('contratos');
    expect(ids(buscarCartoes('prestacao de servico', CARTOES_DE_CONFIGURACAO))).toEqual(['contratos']);
    const c = CARTOES_DE_CONFIGURACAO.find((x) => x.id === 'contratos')!;
    expect([c.grupo, c.titulo, c.href]).toEqual(['Alunos e atendimento', 'Contratos', '/treinador/contratos']);
    expect(ROTA_INTEIRA_DO_ITEM.contratos).toBe('/treinador/contratos');
    expect(podeAcessarTela('/treinador/configuracoes/contratos', (p) => p === 'CONTRATO_LER')).toBe(true);
    expect(podeAcessarTela('/treinador/contratos', () => false)).toBe(false);
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

describe('itens que abrem dentro de Configurações (coluna da direita)', () => {
  it('cada item embutido é um cartão do catálogo e a rota inteira dele é o href do cartão (as duas rotas mostram a mesma tela)', () => {
    for (const [id, rota] of Object.entries(ROTA_INTEIRA_DO_ITEM)) {
      expect([id, CARTOES_DE_CONFIGURACAO.find((c) => c.id === id)?.href]).toEqual([id, rota]);
    }
  });

  it('abrem dentro só as telas de configuração; as do menu principal abrem a tela inteira', () => {
    expect(ids(CARTOES_DE_CONFIGURACAO.filter(abreDentro))).toEqual([
      'meus-dados', 'seguranca', 'ajustes', 'minha-conta', 'marca', 'contato', 'whatsapp-oficial', 'documentos-pdf', 'tags-dos-alunos', 'contratos', 'termos',
    ]);
    const marca = CARTOES_DE_CONFIGURACAO.find((c) => c.id === 'marca')!;
    const auditoria = CARTOES_DE_CONFIGURACAO.find((c) => c.id === 'auditoria')!;
    expect(destinoNaColuna(marca)).toBe('/treinador/configuracoes/marca');
    expect(destinoNaColuna(auditoria)).toBe('/treinador/auditoria');
  });

  it('sem item, abre o primeiro que abre dentro (Meus dados); sem nenhum, nada', () => {
    expect(primeiroItemDentro(cartoesVisiveis(com([])))?.id).toBe('meus-dados');
    expect(primeiroItemDentro(CARTOES_DE_CONFIGURACAO.filter((c) => !abreDentro(c)))).toBeNull();
  });

  it('o caminho embutido vira a rota inteira; o resto não', () => {
    expect(itemDoCaminho('/treinador/configuracoes/marca')).toBe('marca');
    expect(itemDoCaminho('/treinador/configuracoes/auditoria')).toBe('auditoria');
    expect(itemDoCaminho('/treinador/configuracoes')).toBeNull();
    expect(itemDoCaminho('/treinador/configuracoes/marca/x')).toBeNull();
    expect(rotaInteiraDoCaminho('/treinador/configuracoes/contato')).toBe('/treinador/marca');
    expect(rotaInteiraDoCaminho('/treinador/configuracoes/auditoria')).toBeNull();
    expect(rotaInteiraDoCaminho('/treinador/marca')).toBeNull();
    expect(ehItemEmbutido('toString')).toBe(false);
  });

  it('a guarda do item embutido é a da rota inteira, e id desconhecido falha fechado', () => {
    expect(podeAcessarTela('/treinador/configuracoes/meus-dados', () => false)).toBe(true);
    expect(podeAcessarTela('/treinador/configuracoes/marca', () => true, false, false)).toBe(false);
    expect(podeAcessarTela('/treinador/configuracoes/marca', () => true, false, true)).toBe(true);
    expect(podeAcessarTela('/treinador/configuracoes/minha-conta', (c) => c === 'CONTA_LER')).toBe(true);
    expect(podeAcessarTela('/treinador/configuracoes/minha-conta', () => false)).toBe(false);
    expect(podeAcessarTela('/treinador/configuracoes/tags-dos-alunos', (c) => c === 'ALUNO_LER')).toBe(true);
    expect(podeAcessarTela('/treinador/configuracoes/auditoria', () => true, true, true)).toBe(false);
    expect(podeAcessarTela('/treinador/configuracoes/xyz', () => true, true, true)).toBe(false);
  });

  it('o "Saiba mais" e o título da aba são os da tela inteira', () => {
    expect(artigoDaTela('/treinador/configuracoes/seguranca')).toBeNull();
    expect(artigoDaTela('/treinador/configuracoes/meus-dados')).toBeNull();
    expect(artigoDaTela('/treinador/configuracoes/termos')).toBe('/treinador/ajuda?secao=privacidade');
    expect(artigoDaTela('/treinador/configuracoes/marca')).toBe(artigoDaTela('/treinador/marca'));
    expect(artigoDaTela('/treinador/configuracoes')).toBe('/treinador/ajuda?secao=consultoria');
    expect(nomeDaTela('/treinador/configuracoes/seguranca')).toBe('Segurança');
    expect(nomeDaTela('/treinador/configuracoes/minha-conta')).toBe('Assinatura e faturas');
    expect(nomeDaTela('/treinador/configuracoes')).toBe('Configurações');
  });

  it('o item "Aniversários dos alunos" saiu (a opção mora no bloco do Início)', () => {
    expect(ids(CARTOES_DE_CONFIGURACAO)).not.toContain('aniversarios');
    expect(buscarCartoes('aniversario', CARTOES_DE_CONFIGURACAO)).toEqual([]);
  });
});
