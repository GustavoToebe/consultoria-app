import { FUNCIONALIDADES } from './funcionalidadesDoPlano';
import { pode } from './permissoes';
import { agruparPorSecao, alternarFavorito, atalhosPadrao, buscarTelas, chaveDosFavoritos, favoritosVisiveis, lerFavoritos, nomeDaTela, semAcento, TELAS, telasDaOrigem, telasPermitidas, tituloDaPagina, voltarAutomatico } from './telas';

const com = (codigos: string[]) => (codigo: string) => pode(codigos, codigo);
const ADMIN = ['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'MODELO_ALTERAR', 'MARCA_ALTERAR', 'EQUIPE_LER', 'USUARIO_ALTERAR', 'AUDITORIA_LER'];
const ids = (telas: { id: string }[]) => telas.map((t) => t.id);

describe('catálogo de telas', () => {
  it('não repete id e todo caminho começa em /treinador', () => {
    expect(new Set(TELAS.map((t) => t.id)).size).toBe(TELAS.length);
    expect(TELAS.every((t) => t.href.startsWith('/treinador'))).toBe(true);
  });

  it('mostra só o que o perfil pode abrir, com a mesma regra do menu', () => {
    const tudo = telasPermitidas(com(ADMIN));
    expect(ids(tudo)).toEqual(expect.arrayContaining(['inicio', 'novo-aluno', 'novo-modelo', 'convidar-membro', 'atualizacoes-revisar', 'auditoria']));
    const assistente = telasPermitidas(com(['PAINEL_VER', 'ALUNO_LER', 'BIBLIOTECA_LER', 'MODELO_LER']));
    expect(ids(assistente)).toEqual(['inicio', 'alunos', 'numeros', 'biblioteca', 'planejamento', 'ajuda', 'termos', 'meus-dados', 'seguranca', 'ajustes']);
    expect(ids(telasPermitidas(com([])))).toEqual(['ajuda', 'termos', 'meus-dados', 'seguranca', 'ajustes']);
  });

  it('Medicação e ergogênicos só aparece e só é achado com ERGOGENICO_LER', () => {
    const sem = telasPermitidas(com(ADMIN));
    expect(ids(sem)).not.toContain('ergogenicos');
    expect(ids(buscarTelas('ergogenicos', sem))).toEqual([]);
    expect(ids(buscarTelas('medicacao', sem))).toEqual([]);
    const com1 = telasPermitidas(com([...ADMIN, 'ERGOGENICO_LER']));
    expect(ids(buscarTelas('medicacao', com1))).toEqual(['ergogenicos']);
    // É atalho para a aba da Biblioteca, não uma tela: fica fora de "Todas as telas".
    expect(agruparPorSecao(com1).flatMap((s) => ids(s.telas))).not.toContain('ergogenicos');
  });

  it('questionários: atalho só com QUESTIONARIO_LER, "Novo questionário" só com ALTERAR; quem só lê questionário vê o Planejamento', () => {
    const leitor = ids(telasPermitidas(com(['QUESTIONARIO_LER'])));
    expect(leitor).toEqual(expect.arrayContaining(['planejamento', 'questionarios']));
    expect(leitor).not.toContain('novo-questionario');
    expect(ids(telasPermitidas(com(['MODELO_LER'])))).not.toContain('questionarios');
    expect(ids(telasPermitidas(com(['QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR'])))).toContain('novo-questionario');
    expect(ids(telasPermitidas(com(['QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR'])))).toContain('nova-anamnese');
    expect(leitor).not.toContain('nova-anamnese');
    expect(ids(buscarTelas('check-in', telasPermitidas(com(['QUESTIONARIO_LER']))))).toContain('questionarios');
    expect(agruparPorSecao(telasPermitidas(com(['QUESTIONARIO_LER']))).flatMap((s) => ids(s.telas))).not.toContain('questionarios');
  });

  it('Interessados só com INSCRICAO_LER, e a busca acha por "inscrição" e "link"', () => {
    expect(ids(telasPermitidas(com(ADMIN)))).not.toContain('interessados');
    const atendente = telasPermitidas(com(['INSCRICAO_LER']));
    expect(ids(atendente)).toContain('interessados');
    expect(ids(buscarTelas('inscricao', atendente))).toEqual(['interessados']);
    expect(ids(buscarTelas('link de inscrição', atendente))).toEqual(['interessados']);
    expect(nomeDaTela('/treinador/interessados')).toBe('Interessados');
  });

  it('Agenda pede as mesmas permissões das Atualizações e a busca a acha por "semana"', () => {
    expect(ids(telasPermitidas(com(['ATUALIZACAO_LER'])))).not.toContain('agenda');
    expect(ids(telasPermitidas(com(['ALUNO_SENSIVEL_LER'])))).not.toContain('agenda');
    const completa = telasPermitidas(com(['ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER']));
    expect(ids(completa)).toContain('agenda');
    expect(ids(buscarTelas('semana', completa))).toEqual(['agenda']);
    expect(nomeDaTela('/treinador/agenda')).toBe('Agenda');
  });

  it('Números pede só PAINEL_VER (como o Início) e a busca acha por "relatório" e "alunos ativos"', () => {
    expect(ids(telasPermitidas(com(['ALUNO_LER'])))).not.toContain('numeros');
    expect(ids(telasPermitidas(com(['ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER'])))).not.toContain('numeros');
    const painel = telasPermitidas(com(['PAINEL_VER']));
    expect(ids(painel)).toContain('numeros');
    expect(ids(buscarTelas('relatório', painel))).toEqual(['numeros']);
    expect(ids(buscarTelas('alunos ativos', painel))).toEqual(['numeros']);
    expect(nomeDaTela('/treinador/numeros')).toBe('Números');
    expect(tituloDaPagina('/treinador/numeros', 'Saraiva Team')).toBe('Números · Saraiva Team');
  });

  it('Financeiro pede FINANCEIRO_LER e o módulo ligado; some do catálogo e da busca sem um dos dois', () => {
    const pagador = ['ALUNO_LER', 'FINANCEIRO_LER'];
    expect(ids(telasPermitidas(com(pagador)))).not.toContain('financeiro');
    expect(ids(telasPermitidas(com(['ALUNO_LER']), undefined, undefined, true))).not.toContain('financeiro');
    const tudo = telasPermitidas(com(pagador), undefined, undefined, true);
    expect(ids(tudo)).toContain('financeiro');
    expect(ids(buscarTelas('mensalidade', tudo))).toEqual(['financeiro']);
    expect(ids(buscarTelas('inadimplência', tudo))).toEqual(['financeiro']);
    expect(ids(buscarTelas('faturas', tudo))).toEqual([]);
    expect(TELAS.find((t) => t.id === 'financeiro')?.secao).toBe('Consultoria');
    expect(nomeDaTela('/treinador/financeiro')).toBe('Financeiro');
    expect(tituloDaPagina('/treinador/financeiro', 'Saraiva Team')).toBe('Financeiro · Saraiva Team');
  });

  it('"faturas" e "assinatura" acham a Minha conta, não o Financeiro', () => {
    const conta = telasPermitidas(com(['CONTA_LER']));
    expect(ids(buscarTelas('faturas', conta))).toEqual(['minha-conta']);
    expect(ids(buscarTelas('assinatura', conta))).toEqual(['minha-conta']);
  });

  it('ação com permissão extra exige a permissão além da tela', () => {
    // Pode ver o planejamento e a equipe, mas não criar modelo nem convidar.
    const leitor = ids(telasPermitidas(com(['MODELO_LER', 'EQUIPE_LER'])));
    expect(leitor).toEqual(expect.arrayContaining(['planejamento', 'equipe']));
    expect(leitor).not.toContain('novo-modelo');
    expect(leitor).not.toContain('convidar-membro');
    // Atualizações pedem também o dado sensível, como na guarda da tela.
    expect(ids(telasPermitidas(com(['ATUALIZACAO_LER'])))).not.toContain('atualizacoes');
  });
});

describe('funcionalidades do plano no catálogo', () => {
  it('sem a lista (pacote antigo ou offline), tudo segue como antes', () => {
    expect(ids(telasPermitidas(com(ADMIN), TELAS, undefined))).toContain('convidar-membro');
  });

  it('EQUIPE desligada: "Convidar membro" some da lista e da busca, e a tela Equipe continua', () => {
    const liberadas = ['MOBILIDADE', 'PDF'];
    const permitidas = telasPermitidas(com(ADMIN), TELAS, liberadas);
    expect(ids(permitidas)).not.toContain('convidar-membro');
    expect(ids(permitidas)).toContain('equipe');
    expect(buscarTelas('convidar', permitidas)).toEqual([]);
    expect(ids(buscarTelas('equipe', permitidas))).toContain('equipe');
  });

  it('EQUIPE ligada mantém "Convidar membro"; desligar outra funcionalidade não mexe nele', () => {
    expect(ids(telasPermitidas(com(ADMIN), TELAS, ['EQUIPE']))).toContain('convidar-membro');
    expect(ids(telasPermitidas(com(ADMIN), TELAS, ['EQUIPE']))).toContain('novo-modelo');
  });

  it('todo item do catálogo que declara funcionalidade usa um código conhecido', () => {
    for (const t of TELAS) {
      if (t.funcionalidade !== undefined) expect(FUNCIONALIDADES as readonly string[]).toContain(t.funcionalidade);
    }
  });
});

describe('busca de telas', () => {
  const permitidas = telasPermitidas(com(ADMIN));
  it('ignora acento, caixa e usa sinônimos', () => {
    expect(semAcento('Atualizações')).toBe('atualizacoes');
    expect(ids(buscarTelas('ATUALIZAÇÕES', permitidas))[0]).toBe('atualizacoes');
    expect(ids(buscarTelas('exercicios', permitidas))).toEqual(['biblioteca', 'importacao']);
    expect(ids(buscarTelas('check-in', permitidas))).toEqual(expect.arrayContaining(['atualizacoes', 'atualizacoes-revisar']));
    expect(ids(buscarTelas('criar modelo', permitidas))[0]).toBe('novo-modelo');
  });
  it('exige todas as palavras e começa por quem inicia com o texto', () => {
    expect(ids(buscarTelas('novo', permitidas)).slice(0, 2)).toEqual(['novo-aluno', 'novo-modelo']);
    expect(buscarTelas('novo xyz', permitidas)).toEqual([]);
    expect(ids(buscarTelas('atualizacoes para', permitidas))).toEqual(['atualizacoes-revisar']);
  });
  it('texto vazio não devolve nada e o que o perfil não pode abrir nunca aparece', () => {
    expect(buscarTelas('   ', permitidas)).toEqual([]);
    const semEquipe = telasPermitidas(com(['PAINEL_VER']));
    expect(buscarTelas('convidar', semEquipe)).toEqual([]);
    expect(buscarTelas('equipe', semEquipe)).toEqual([]);
  });
  it('"senha" acha Meus dados e Segurança; "sair" não abre tela', () => {
    expect(ids(buscarTelas('senha', permitidas))).toEqual(expect.arrayContaining(['meus-dados', 'seguranca']));
    expect(buscarTelas('sair', permitidas)).toEqual([]);
  });
  it('não procura alunos pelo nome', () => {
    expect(buscarTelas('Maria', permitidas)).toEqual([]);
  });
});

describe('Todas as telas e favoritos', () => {
  const permitidas = telasPermitidas(com(ADMIN), TELAS, undefined, false, true);
  it('agrupa na ordem do menu e deixa as ações de fora', () => {
    const grupos = agruparPorSecao(permitidas);
    expect(grupos.map((g) => g.secao)).toEqual(['Dia a dia', 'Planos', 'Consultoria', 'Ajuda', 'Sua conta']);
    expect(grupos.flatMap((g) => ids(g.telas))).toEqual(['inicio', 'alunos', 'atualizacoes', 'agenda', 'numeros', 'biblioteca', 'planejamento', 'equipe', 'auditoria', 'importacao', 'ajuda', 'termos', 'meus-dados', 'seguranca', 'marca', 'ajustes']);
    expect(agruparPorSecao(telasPermitidas(com([]))).map((g) => g.secao)).toEqual(['Ajuda', 'Sua conta']);
  });
  it('busca vazia sem favoritos sugere atalhos que o perfil pode abrir', () => {
    expect(ids(atalhosPadrao(permitidas))).toEqual(['atualizacoes-revisar', 'alunos', 'novo-aluno', 'planejamento', 'ajuda']);
    expect(ids(atalhosPadrao(telasPermitidas(com([]))))).toEqual(['ajuda']);
  });
  it('favoritos mantêm a ordem em que foram marcados', () => {
    let lista: string[] = [];
    lista = alternarFavorito(lista, 'equipe');
    lista = alternarFavorito(lista, 'alunos');
    lista = alternarFavorito(lista, 'biblioteca');
    expect(ids(favoritosVisiveis(lista, permitidas))).toEqual(['equipe', 'alunos', 'biblioteca']);
    lista = alternarFavorito(lista, 'alunos');
    expect(lista).toEqual(['equipe', 'biblioteca']);
    lista = alternarFavorito(lista, 'alunos');
    expect(lista).toEqual(['equipe', 'biblioteca', 'alunos']);
  });
  it('favorito sem permissão, repetido, de ação ou desconhecido não aparece', () => {
    const poucas = telasPermitidas(com(['PAINEL_VER', 'ALUNO_LER']));
    expect(ids(favoritosVisiveis(['equipe', 'alunos', 'alunos', 'novo-aluno', 'xyz', 'inicio'], poucas))).toEqual(['alunos', 'inicio']);
  });
  it('guarda por usuário, na chave treinos:<usuarioId>:favoritos', () => {
    expect(chaveDosFavoritos('u1')).toBe('treinos:u1:favoritos');
  });
  it('lê o JSON salvo sem quebrar com lixo', () => {
    expect(lerFavoritos('["a","b"]')).toEqual(['a', 'b']);
    expect(lerFavoritos('["a",3,null]')).toEqual(['a']);
    expect(lerFavoritos('{"a":1}')).toEqual([]);
    expect(lerFavoritos('não é json')).toEqual([]);
    expect(lerFavoritos(null)).toEqual([]);
  });
});

describe('nome da tela atual', () => {
  it('acha a tela do catálogo, também nas subpáginas, e as telas de edição', () => {
    expect(nomeDaTela('/treinador')).toBe('Início');
    expect(nomeDaTela('/treinador/alunos')).toBe('Alunos');
    expect(nomeDaTela('/treinador/alunos/um-id')).toBe('Alunos');
    expect(nomeDaTela('/treinador/atualizacoes/um-id')).toBe('Atualizações');
    expect(nomeDaTela('/treinador/treinos/um-id')).toBe('Plano de treino');
    expect(nomeDaTela('/treinador/planejamento/modelo/um-id')).toBe('Modelo');
    expect(nomeDaTela('/treinador/planejamento/questionario/um-id')).toBe('Questionário');
    expect(nomeDaTela('/treinador/planejamento')).toBe('Planejamento');
    expect(nomeDaTela('/treinador/perfil')).toBe('Perfil');
    expect(nomeDaTela('/treinador/meus-dados')).toBe('Meus dados');
    expect(nomeDaTela('/treinador/ajustes')).toBe('Ajustes');
    expect(nomeDaTela('/treinador/minha-conta')).toBe('Minha conta');
    expect(nomeDaTela('/treinador/desconhecido')).toBeNull();
  });
});

describe('voltar e item aceso fora da barra inferior', () => {
  it('com a barra inferior, a tela aberta pelo Perfil, pelo Início ou pela Conta volta para lá', () => {
    expect(voltarAutomatico('/treinador/equipe', true)).toBe('/treinador/perfil');
    expect(voltarAutomatico('/treinador/termos', true)).toBe('/treinador/perfil');
    expect(voltarAutomatico('/treinador/atualizacoes', true)).toBe('/treinador');
    expect(voltarAutomatico('/aluno/ajuda', true)).toBe('/aluno/conta');
  });
  it('no PC não há seta; telas da barra e detalhes não ganham seta automática', () => {
    expect(voltarAutomatico('/treinador/equipe', false)).toBeUndefined();
    expect(voltarAutomatico('/treinador/alunos', true)).toBeUndefined();
    expect(voltarAutomatico('/treinador/atualizacoes/um-id', true)).toBeUndefined();
  });
  it('lista as telas que acendem cada origem', () => {
    expect(telasDaOrigem('/aluno/conta')).toEqual(['/aluno/ajuda', '/aluno/termos']);
    expect(telasDaOrigem('/treinador')).toEqual(['/treinador/atualizacoes', '/treinador/agenda', '/treinador/numeros']);
    expect(voltarAutomatico('/treinador/numeros', true)).toBe('/treinador');
    expect(voltarAutomatico('/treinador/agenda', true)).toBe('/treinador');
    expect(voltarAutomatico('/treinador/agenda', false)).toBeUndefined();
    expect(telasDaOrigem('/treinador/perfil')).toContain('/treinador/interessados');
    expect(telasDaOrigem('/treinador/perfil')).toContain('/treinador/financeiro');
    expect(voltarAutomatico('/treinador/financeiro', true)).toBe('/treinador/perfil');
  });
});

describe('título da aba do navegador', () => {
  it('"Tela · Consultoria" logado e "Tela · Treinos" sem consultoria', () => {
    expect(tituloDaPagina('/treinador/alunos/um-id', 'Saraiva Team')).toBe('Alunos · Saraiva Team');
    expect(tituloDaPagina('/aluno', 'Saraiva Team')).toBe('Início · Saraiva Team');
    expect(tituloDaPagina('/aluno/sessao/x/y', 'Saraiva Team')).toBe('Treino do dia · Saraiva Team');
    expect(tituloDaPagina('/entrar', null)).toBe('Entrar · Treinos');
    expect(tituloDaPagina('/convite-equipe', null)).toBe('Convite da equipe · Treinos');
    expect(tituloDaPagina('/inscricao/abc', 'Saraiva Team')).toBe('Inscrição · Saraiva Team');
  });
  it('tela desconhecida fica só com o nome', () => {
    expect(tituloDaPagina('/qualquer', '  ')).toBe('Treinos');
    expect(tituloDaPagina('/treinador/xyz', 'Saraiva Team')).toBe('Saraiva Team');
  });
});
