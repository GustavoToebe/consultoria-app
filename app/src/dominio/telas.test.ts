import { pode } from './permissoes';
import { agruparPorSecao, alternarFavorito, buscarTelas, chaveDosFavoritos, favoritosVisiveis, lerFavoritos, nomeDaTela, semAcento, TELAS, telasPermitidas } from './telas';

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
    expect(ids(assistente)).toEqual(['inicio', 'alunos', 'planejamento', 'biblioteca', 'ajuda', 'termos', 'meus-dados', 'ajustes']);
    expect(ids(telasPermitidas(com([])))).toEqual(['ajuda', 'termos', 'meus-dados', 'ajustes']);
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
    expect(ids(buscarTelas('check-in', telasPermitidas(com(['QUESTIONARIO_LER']))))).toContain('questionarios');
    expect(agruparPorSecao(telasPermitidas(com(['QUESTIONARIO_LER']))).flatMap((s) => ids(s.telas))).not.toContain('questionarios');
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

describe('busca de telas', () => {
  const permitidas = telasPermitidas(com(ADMIN));
  it('ignora acento, caixa e usa sinônimos', () => {
    expect(semAcento('Atualizações')).toBe('atualizacoes');
    expect(ids(buscarTelas('ATUALIZAÇÕES', permitidas))[0]).toBe('atualizacoes');
    expect(ids(buscarTelas('exercicios', permitidas))).toEqual(['biblioteca']);
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
  it('não procura alunos pelo nome', () => {
    expect(buscarTelas('Maria', permitidas)).toEqual([]);
  });
});

describe('Todas as telas e favoritos', () => {
  const permitidas = telasPermitidas(com(ADMIN));
  it('agrupa por seção na ordem fixa e deixa as ações de fora', () => {
    const grupos = agruparPorSecao(permitidas);
    expect(grupos.map((g) => g.secao)).toEqual(['Início', 'Alunos', 'Planos', 'Conteúdo', 'Consultoria', 'Ajuda', 'Conta']);
    expect(grupos.flatMap((g) => ids(g.telas))).not.toContain('novo-aluno');
    expect(agruparPorSecao(telasPermitidas(com([]))).map((g) => g.secao)).toEqual(['Ajuda', 'Conta']);
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
