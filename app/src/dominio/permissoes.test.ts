import { pode, podeAcessarTela } from './permissoes';

describe('navegação de membros da equipe', () => {
  const assistente = ['PAINEL_VER','ALUNO_LER','ALUNO_ALTERAR','TREINO_LER','DIETA_LER','BIBLIOTECA_LER','MODELO_LER'];
  const acesso = (codigos: string[]) => (codigo: string) => pode(codigos, codigo);
  it('permite a ficha e a biblioteca, mas impede editores e telas administrativas do Assistente', () => {
    const tem = acesso(assistente);
    expect(podeAcessarTela('/treinador/alunos/um-id', tem)).toBe(true);
    expect(podeAcessarTela('/treinador/biblioteca', tem)).toBe(true);
    for (const caminho of ['/treinador/treinos/um-id','/treinador/dietas/um-id','/treinador/marca','/treinador/equipe','/treinador/auditoria','/treinador/atualizacoes/um-id']) {
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
  });
});
