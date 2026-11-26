// permissões em matriz (23/11)
import { CATALOGO_DE_EXEMPLO } from './catalogoDePermissoes.exemplo';
import {
  arranjoDaMatriz, LARGURA_MINIMA_DA_MATRIZ, alternarCaixa, alternarSecao, estadoDaCaixa, estadoDaSecao, filtrarMatriz, montarMatriz, MOTIVO_DO_TETO, perfilAlterado,
  resumoDasPermissoes, rotulosDaMatriz, type CaixaDaMatriz, type SecaoDaMatriz,
} from './matrizDePermissoes';
import { completarPermissoes } from './perfilEquipe';

const matriz = montarMatriz(CATALOGO_DE_EXEMPLO);
const caixas = (secoes: readonly SecaoDaMatriz[]) =>
  secoes.flatMap((s) => s.linhas.flatMap((l) => [...Object.values(l.celulas), ...l.outras].filter((c): c is CaixaDaMatriz => !!c)));
const caixa = (codigo: string) => caixas(matriz).find((c) => c.codigo === codigo)!;
const linha = (recurso: string) => matriz.flatMap((s) => s.linhas).find((l) => l.recurso === recurso)!;
const rotulos = rotulosDaMatriz(matriz);
const todos = () => true;

describe('montar a matriz a partir do catálogo da API', () => {
  it('cada código do catálogo cai em exatamente uma caixa, na seção dele', () => {
    const codigos = caixas(matriz).map((c) => c.codigo);
    expect(codigos.sort()).toEqual(CATALOGO_DE_EXEMPLO.map((p) => p.codigo).sort());
    expect(matriz.map((s) => s.secao)).toEqual(['Início', 'Alunos', 'Planos', 'Atualizações', 'Conteúdo', 'Consultoria']);
    for (const s of matriz) expect(s.codigos.sort()).toEqual(CATALOGO_DE_EXEMPLO.filter((p) => p.secao === s.secao).map((p) => p.codigo).sort());
  });

  it('linhas por recurso e colunas pelo sufixo: Ver, Criar e editar, Publicar; o resto em Outras com o nome à vista', () => {
    expect(linha('Treino').celulas).toMatchObject({ ver: { codigo: 'TREINO_LER' }, editar: { codigo: 'TREINO_ALTERAR' }, publicar: { codigo: 'TREINO_PUBLICAR' } });
    expect(linha('Cadastro').outras.map((c) => c.nome)).toEqual(['Gerar convite']);
    expect(linha('Privacidade').outras.map((c) => c.nome)).toEqual(['Exportar', 'Anonimizar']);
    expect(linha('Registros').outras.map((c) => c.nome)).toEqual(['Marcar como visto']);
    expect(linha('Modelos').outras.map((c) => c.nome)).toEqual(['Aplicar ao aluno']);
    expect(linha('Painel').celulas.ver?.codigo).toBe('PAINEL_VER');
    // Ação que não existe para o recurso: célula vazia.
    expect(linha('Privacidade').celulas).toEqual({ ver: null, editar: null, publicar: null });
    expect(linha('Pastas').celulas.ver).toBeNull();
  });

  it('nome acessível "recurso: ação" e o texto longo como dica, não como rótulo', () => {
    expect(caixa('TREINO_ALTERAR').rotuloAcessivel).toBe('Treino: criar e editar');
    expect(caixa('ALUNO_CONVITE').rotuloAcessivel).toBe('Cadastro: gerar convite');
    const interessados = caixa('INSCRICAO_ALTERAR');
    expect(interessados.nome).toBe('Criar e editar');
    expect(interessados.dica).toBe('Atender, aceitar e recusar: interessados; configurar o link de inscrição.');
    expect(interessados.dicaAcrescenta).toBe(true);
    // A dica que só repete recurso e coluna fica para o leitor de tela.
    expect(caixa('ALUNO_LER').dicaAcrescenta).toBe(false);
    expect(caixa('TREINO_PUBLICAR').dicaAcrescenta).toBe(false);
    expect(caixa('ALUNO_CONVITE').dicaAcrescenta).toBe(false);
    expect(caixa('PAINEL_VER').dicaAcrescenta).toBe(false);
  });

  it('nenhuma célula fixa com duas permissões: ergogênicos em linha própria e as duas da equipe com nomes diferentes', () => {
    expect(linha('Biblioteca').celulas).toMatchObject({ ver: { codigo: 'BIBLIOTECA_LER' }, editar: { codigo: 'BIBLIOTECA_ALTERAR' } });
    expect(linha('Medicação e ergogênicos').celulas).toMatchObject({ ver: { codigo: 'ERGOGENICO_LER' }, editar: { codigo: 'ERGOGENICO_ALTERAR' } });
    // O defeito "Equipe · Criar e editar: equipe" duas vezes: dois códigos com a mesma descrição na API.
    const equipe = linha('Equipe');
    expect(equipe.celulas.ver?.codigo).toBe('EQUIPE_LER');
    expect(equipe.outras.map((c) => [c.codigo, c.rotuloAcessivel])).toEqual([
      ['USUARIO_ALTERAR', 'Equipe: convidar e editar membros'],
      ['PERFIL_ALTERAR', 'Equipe: criar e editar perfis'],
    ]);
    const nomes = caixas(matriz).map((c) => c.rotuloAcessivel);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('código novo da API nunca some: sem lugar livre na linha, vai para Outras com o verbo da descrição', () => {
    const m = montarMatriz([
      ...CATALOGO_DE_EXEMPLO.filter((p) => p.modulo === 'Treino'),
      { codigo: 'TREINO_REVISAR_ALTERAR', secao: 'Planos', modulo: 'Treino', descricao: 'Revisar: treino.', sensivel: false },
      { codigo: 'NOVO_RECURSO', secao: 'Novidades', modulo: 'Algo', descricao: 'Fazer algo: novo.', sensivel: true },
    ]);
    expect(m.flatMap((s) => s.linhas.flatMap((l) => l.outras.map((c) => c.nome)))).toEqual(['Revisar', 'Fazer algo']);
    expect(m.find((s) => s.secao === 'Novidades')?.linhas[0].sensivel).toBe(true);
  });

  it('dado sensível: o selo é do recurso se alguma permissão dele for; cada caixa guarda o seu', () => {
    expect(linha('Dados sensíveis').sensivel).toBe(true);
    expect(linha('Check-in').sensivel).toBe(true);
    expect(caixa('ATUALIZACAO_LER').sensivel).toBe(true);
    expect(caixa('ATUALIZACAO_RESPONDER').sensivel).toBe(false);
    expect(linha('Biblioteca').sensivel).toBe(false);
    expect(linha('Medicação e ergogênicos').sensivel).toBe(true);
  });

  it('selo: só onde o nome ainda não diz que é sensível ("Dados sensíveis" fica sem)', () => {
    expect(linha('Dados sensíveis')).toMatchObject({ sensivel: true, selo: false });
    expect(['Privacidade', 'Check-in', 'Anamnese', 'Medicação e ergogênicos', 'Financeiro', 'WhatsApp'].map((r) => linha(r).selo)).toEqual([true, true, true, true, true, true]);
    expect(linha('Cadastro').selo).toBe(false);
  });

  it('as duas da equipe ficam com a dica que a API manda', () => {
    expect(caixa('USUARIO_ALTERAR').dica).toBe('Criar e editar: membros da equipe.');
    expect(caixa('PERFIL_ALTERAR').dica).toBe('Criar e editar: perfis de acesso.');
  });

  it('arranjo pela largura medida, igual para todos os recursos: matriz ou blocos, selo ao lado ou abaixo em todos', () => {
    expect(arranjoDaMatriz(868)).toEqual({ forma: 'matriz', seloAbaixo: false }); // folha de 900 em 1280
    expect(arranjoDaMatriz(LARGURA_MINIMA_DA_MATRIZ - 1).forma).toBe('blocos');
    expect(arranjoDaMatriz(704)).toEqual({ forma: 'blocos', seloAbaixo: false }); // janela de 768
    expect(arranjoDaMatriz(851).forma).toBe('matriz'); // 1280 com a barra de rolagem da web
    expect(arranjoDaMatriz(866)).toEqual({ forma: 'matriz', seloAbaixo: false }); // medido em 1280 (borda da folha)
    expect(arranjoDaMatriz(356)).toEqual({ forma: 'blocos', seloAbaixo: true }); // celular de 390: o nome mais longo não cabe com o selo
    expect(arranjoDaMatriz(378)).toEqual({ forma: 'blocos', seloAbaixo: false }); // a partir de 378 cabe ao lado
  });
});

describe('caixas travadas: dependência e teto', () => {
  it('marcada por outra fica travada com "Necessária para …"; desmarcar a que depende libera', () => {
    let marcadas = completarPermissoes(['TREINO_PUBLICAR']);
    const ler = () => estadoDaCaixa('TREINO_LER', new Set(marcadas), true, rotulos);
    expect(ler()).toEqual({ marcada: true, travada: true, motivo: 'Necessária para Treino: criar e editar e Treino: publicar.' });
    expect(estadoDaCaixa('TREINO_ALTERAR', new Set(marcadas), true, rotulos).motivo).toBe('Necessária para Treino: publicar.');
    marcadas = alternarCaixa(marcadas, 'TREINO_PUBLICAR', false);
    expect(estadoDaCaixa('TREINO_ALTERAR', new Set(marcadas), true, rotulos)).toEqual({ marcada: true, travada: false, motivo: null });
    marcadas = alternarCaixa(marcadas, 'TREINO_ALTERAR', false);
    expect(ler()).toEqual({ marcada: true, travada: false, motivo: null });
  });

  it('três dependentes: lista com vírgula e "e"', () => {
    const marcadas = new Set(completarPermissoes(['ALUNO_ALTERAR', 'ALUNO_CONVITE', 'PASTA_ALTERAR']));
    expect(estadoDaCaixa('ALUNO_LER', marcadas, true, rotulos).motivo).toBe('Necessária para Cadastro: criar e editar, Cadastro: gerar convite e Pastas: criar e editar.');
  });

  it('acima do teto de quem edita: travada com o motivo, marcada ou não', () => {
    expect(estadoDaCaixa('FINANCEIRO_LER', new Set(), false, rotulos)).toEqual({ marcada: false, travada: true, motivo: MOTIVO_DO_TETO });
  });

  it('marcar uma caixa leva junto o que ela exige (ergogênicos pedem a biblioteca, como na API)', () => {
    expect(alternarCaixa([], 'ERGOGENICO_ALTERAR', true).sort()).toEqual(['BIBLIOTECA_LER', 'ERGOGENICO_ALTERAR', 'ERGOGENICO_LER']);
  });
});

describe('"Marcar toda a seção" com estado parcial e contagem', () => {
  const planos = matriz.find((s) => s.secao === 'Planos')!.codigos;
  it('vazia, parcial e cheia; a contagem é do que quem edita pode atribuir', () => {
    expect(estadoDaSecao(planos, new Set(), todos)).toEqual({ marcadas: 0, total: 7, valor: false });
    expect(estadoDaSecao(planos, new Set(['TREINO_LER', 'DIETA_LER']), todos)).toEqual({ marcadas: 2, total: 7, valor: 'misto' });
    expect(estadoDaSecao(planos, new Set(planos), todos).valor).toBe(true);
    expect(estadoDaSecao(planos, new Set(['TREINO_LER']), (c) => c.startsWith('TREINO'))).toEqual({ marcadas: 1, total: 3, valor: 'misto' });
  });

  it('parcial marca tudo (e o que a seção exige de fora); cheia desmarca', () => {
    const cheia = alternarSecao(['TREINO_LER'], planos, todos, 'misto');
    expect(cheia).toEqual(expect.arrayContaining([...planos, 'ALUNO_LER']));
    expect(alternarSecao(cheia, planos, todos, true)).toEqual(['ALUNO_LER']);
  });

  it('desmarcar a seção mantém, travado, o que outra seção ainda exige', () => {
    const alunos = matriz.find((s) => s.secao === 'Alunos')!.codigos;
    const atuais = completarPermissoes([...alunos, 'ATUALIZACAO_LER']);
    const depois = alternarSecao(atuais, alunos, todos, true);
    expect(depois.sort()).toEqual(['ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER']);
    expect(estadoDaSecao(alunos, new Set(depois), todos).valor).toBe('misto');
    expect(estadoDaCaixa('ALUNO_SENSIVEL_LER', new Set(depois), true, rotulos).motivo).toBe('Necessária para Check-in: ver.');
  });

  it('só mexe no que quem edita pode atribuir', () => {
    const conteudo = matriz.find((s) => s.secao === 'Conteúdo')!.codigos;
    const semErgogenico = (c: string) => !c.startsWith('ERGOGENICO');
    expect(alternarSecao([], conteudo, semErgogenico, false)).not.toContain('ERGOGENICO_LER');
  });
});

describe('resumo vivo, filtro e alteração', () => {
  it('"14 permissões · 3 com dado sensível", singular e códigos fora do catálogo ignorados', () => {
    const marcadas = new Set(completarPermissoes(['TREINO_PUBLICAR', 'ATUALIZACAO_RESPONDER', 'DESCONHECIDO']));
    expect(resumoDasPermissoes(marcadas, CATALOGO_DE_EXEMPLO)).toMatchObject({ total: 7, sensiveis: 2, texto: '7 permissões · 2 com dado sensível' });
    expect(resumoDasPermissoes(new Set(['PAINEL_VER']), CATALOGO_DE_EXEMPLO).texto).toBe('1 permissão · 0 com dado sensível');
  });

  it('filtra sem acento por recurso, ação ou dica; a seção que casa pelo nome fica inteira; a contagem continua da seção', () => {
    const recursos = (t: string) => filtrarMatriz(matriz, t).flatMap((s) => s.linhas.map((l) => l.recurso));
    expect(recursos('medicacao')).toEqual(['Medicação e ergogênicos']);
    expect(recursos('link de inscri')).toEqual(['Interessados']);
    expect(recursos('anonimizar')).toEqual(['Privacidade']);
    expect(recursos('dado sensivel')).toEqual(['Dados sensíveis', 'Privacidade', 'Check-in', 'Anamnese', 'Medicação e ergogênicos', 'Financeiro', 'WhatsApp', 'Contratos']);
    expect(recursos('planos')).toEqual(expect.arrayContaining(['Pastas', 'Treino', 'Dieta', 'Financeiro']));
    expect(filtrarMatriz(matriz, 'medicacao')[0].codigos).toHaveLength(10);
    expect(filtrarMatriz(matriz, 'nada disso')).toEqual([]);
    expect(filtrarMatriz(matriz, '  ')).toHaveLength(matriz.length);
  });

  it('alterado: nome, descrição, situação ou o conjunto de permissões (a ordem não conta)', () => {
    const inicial = { nome: 'Estagiário', descricao: '', ativo: true, permissoes: ['ALUNO_LER', 'TREINO_LER'] };
    expect(perfilAlterado(inicial, { ...inicial, permissoes: ['TREINO_LER', 'ALUNO_LER'] })).toBe(false);
    expect(perfilAlterado(inicial, { ...inicial, permissoes: ['ALUNO_LER'] })).toBe(true);
    expect(perfilAlterado(inicial, { ...inicial, ativo: false })).toBe(true);
    expect(perfilAlterado(inicial, { ...inicial, nome: 'Estagiária' })).toBe(true);
  });
});
