import { PERMISSOES_DO_PLANO, pode, podeAcessarTela } from './permissoes';

const ADMIN_SEM_CONTA = ['PAINEL_VER','ALUNO_LER','EQUIPE_LER','MARCA_ALTERAR','AUDITORIA_LER'];
describe('navegação de membros da equipe', () => {
  const assistente = ['PAINEL_VER','ALUNO_LER','ALUNO_ALTERAR','TREINO_LER','DIETA_LER','BIBLIOTECA_LER','MODELO_LER'];
  const acesso = (codigos: string[]) => (codigo: string) => pode(codigos, codigo);
  it('permite a ficha e a biblioteca, mas impede editores e telas administrativas do Assistente', () => {
    const tem = acesso(assistente);
    expect(podeAcessarTela('/treinador/alunos/um-id', tem)).toBe(true);
    expect(podeAcessarTela('/treinador/biblioteca', tem)).toBe(true);
    for (const caminho of ['/treinador/treinos/um-id','/treinador/dietas/um-id','/treinador/mobilidades/um-id','/treinador/marca','/treinador/equipe','/treinador/auditoria','/treinador/atualizacoes/um-id']) {
      expect(podeAcessarTela(caminho, tem)).toBe(false);
    }
  });
  it('habilita apenas o editor de dieta ao passar de Assistente a Nutricionista', () => {
    const tem = acesso([...assistente,'DIETA_ALTERAR']);
    expect(podeAcessarTela('/treinador/dietas/um-id', tem)).toBe(true);
    expect(podeAcessarTela('/treinador/treinos/um-id', tem)).toBe(false);
  });
  it('exige leitura sensível para as respostas e falha fechado sem perfil ou em rota desconhecida', () => {
    expect(podeAcessarTela('/treinador/atualizacoes', acesso(['ATUALIZACAO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/atualizacoes', acesso(['ATUALIZACAO_LER','ALUNO_SENSIVEL_LER']))).toBe(true);
    expect(pode(undefined,'ALUNO_LER')).toBe(false);
    expect(podeAcessarTela('/treinador/desconhecido', () => true)).toBe(false);
    expect(podeAcessarTela('/treinador/perfil', acesso([]))).toBe(true);
    expect(podeAcessarTela('/treinador/ajuda', acesso([]))).toBe(true);
  });
  it('a Agenda pede o mesmo que as Atualizações (ATUALIZACAO_LER e ALUNO_SENSIVEL_LER)', () => {
    expect(podeAcessarTela('/treinador/agenda', acesso(['ATUALIZACAO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/agenda', acesso(['ALUNO_SENSIVEL_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/agenda', acesso(['PAINEL_VER','ALUNO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/agenda', acesso(['ATUALIZACAO_LER','ALUNO_SENSIVEL_LER']))).toBe(true);
  });
  it('Números pede só PAINEL_VER (a permissão de quem vê o painel)', () => {
    expect(podeAcessarTela('/treinador/numeros', acesso(['PAINEL_VER']))).toBe(true);
    expect(podeAcessarTela('/treinador/numeros', acesso(['ATUALIZACAO_LER','ALUNO_SENSIVEL_LER','ALUNO_LER','CONTA_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/numeros', acesso([]))).toBe(false);
  });
  it('Meus dados e Ajustes são de todos; Minha conta exige CONTA_LER', () => {
    expect(podeAcessarTela('/treinador/meus-dados', acesso([]))).toBe(true);
    expect(podeAcessarTela('/treinador/ajustes', acesso([]))).toBe(true);
    expect(podeAcessarTela('/treinador/minha-conta', acesso(ADMIN_SEM_CONTA))).toBe(false);
    expect(podeAcessarTela('/treinador/minha-conta', acesso(['CONTA_LER']))).toBe(true);
  });
  it('Planejamento abre com modelos ou questionários; o editor de questionário só com QUESTIONARIO_LER; o de modelo segue igual', () => {
    expect(podeAcessarTela('/treinador/planejamento', acesso(['QUESTIONARIO_LER']))).toBe(true);
    expect(podeAcessarTela('/treinador/planejamento', acesso(['MODELO_LER']))).toBe(true);
    expect(podeAcessarTela('/treinador/planejamento', acesso(['ALUNO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/planejamento/questionario/um-id', acesso(['QUESTIONARIO_LER']))).toBe(true);
    expect(podeAcessarTela('/treinador/planejamento/questionario/um-id', acesso(['MODELO_LER','MODELO_ALTERAR']))).toBe(false);
    expect(podeAcessarTela('/treinador/planejamento/modelo/um-id', acesso(['QUESTIONARIO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/planejamento/modelo/um-id', acesso(['MODELO_LER','MODELO_ALTERAR']))).toBe(true);
    // Subrota que não é nenhuma das conhecidas não se abre só com questionário.
    expect(podeAcessarTela('/treinador/planejamento/outra', acesso(['QUESTIONARIO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/planejamento/outra', acesso(['MODELO_LER']))).toBe(true);
    expect(podeAcessarTela('/treinador/receitas', acesso(['QUESTIONARIO_LER']))).toBe(true);
  });
  it('mobilidade usa as permissões do treino, não as da dieta', () => {
    expect(podeAcessarTela('/treinador/mobilidades/um-id', acesso(['TREINO_LER','TREINO_ALTERAR']))).toBe(true);
    expect(podeAcessarTela('/treinador/mobilidades/um-id', acesso(['TREINO_LER']))).toBe(false);
    expect(podeAcessarTela('/treinador/mobilidades/um-id', acesso(['DIETA_LER','DIETA_ALTERAR']))).toBe(false);
    expect(PERMISSOES_DO_PLANO.mobilidade).toEqual(PERMISSOES_DO_PLANO.treino);
    expect(PERMISSOES_DO_PLANO.dieta).toEqual({ ler: 'DIETA_LER', alterar: 'DIETA_ALTERAR', publicar: 'DIETA_PUBLICAR' });
  });
});
