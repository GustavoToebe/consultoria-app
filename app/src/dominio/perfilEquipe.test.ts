import { completarPermissoes,desmarcarPermissoes } from './perfilEquipe';
describe('seleção de permissões de perfil',()=>{
  it('feedback marca a cadeia de leitura sensível e cadastro',()=>{
    expect(completarPermissoes(['ATUALIZACAO_RESPONDER'])).toEqual(expect.arrayContaining(['ATUALIZACAO_RESPONDER','ATUALIZACAO_LER','ALUNO_SENSIVEL_LER','ALUNO_LER']));
  });
  it('retirar leitura sensível também retira feedback sem retirar dieta',()=>{
    const atuais=completarPermissoes(['ATUALIZACAO_RESPONDER','DIETA_PUBLICAR']);
    const resultado=desmarcarPermissoes(atuais,['ALUNO_SENSIVEL_LER']);
    expect(resultado).not.toEqual(expect.arrayContaining(['ATUALIZACAO_RESPONDER']));
    expect(resultado).not.toContain('ATUALIZACAO_LER');
    expect(resultado).toEqual(expect.arrayContaining(['DIETA_LER','DIETA_ALTERAR','DIETA_PUBLICAR']));
  });
  it('uma seção inteira pode ser removida sem permissões dependentes órfãs',()=>{
    const atuais=completarPermissoes(['TREINO_PUBLICAR','ALUNO_CONVITE']);
    expect(desmarcarPermissoes(atuais,['TREINO_LER','TREINO_ALTERAR'])).toEqual(expect.arrayContaining(['ALUNO_LER','ALUNO_CONVITE']));
    expect(desmarcarPermissoes(atuais,['TREINO_LER','TREINO_ALTERAR'])).not.toContain('TREINO_PUBLICAR');
  });
});
