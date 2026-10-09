import type { PerfilEquipe } from '../api/equipeTipos';
import { completarPermissoes,desmarcarPermissoes,perfisAtribuiveis,permissaoMarcavel,podeDuplicarPerfil,podeEditarMembro,podeEditarPerfil,type AtorEquipe } from './perfilEquipe';
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

describe('teto de permissões na tela (espelha a API)',()=>{
  const perfil=(id:string,permissoes:string[],extra:Partial<PerfilEquipe>={}):PerfilEquipe=>({id,nome:id,descricao:null,acessoTotal:false,sistema:false,ativo:true,permissoes,usuarios:0,versao:0,...extra});
  const admin=perfil('admin',['EQUIPE_LER','USUARIO_ALTERAR','PERFIL_ALTERAR','ALUNO_LER','ALUNO_SENSIVEL_LER'],{acessoTotal:true,sistema:true});
  const gestor=perfil('gestor',['EQUIPE_LER','USUARIO_ALTERAR','PERFIL_ALTERAR']);
  const leitura=perfil('leitura',['EQUIPE_LER']);
  const nutri=perfil('nutri',['ALUNO_LER','ALUNO_SENSIVEL_LER']);
  const inativo=perfil('inativo',['EQUIPE_LER'],{ativo:false});
  const ator=(codigos:string[],extra:Partial<AtorEquipe>={}):AtorEquipe=>({administrador:false,perfilId:'gestor',usuarioId:'eu',tem:c=>codigos.includes(c),...extra});
  const membroGestor=ator(gestor.permissoes);
  const administrador=ator([],{administrador:true,perfilId:'admin'});
  it('quem não é administrador não vê o Administrador nem perfis maiores que o seu',()=>{
    expect(perfisAtribuiveis(membroGestor,[admin,gestor,leitura,nutri,inativo]).map(p=>p.id)).toEqual(['gestor','leitura']);
    expect(perfisAtribuiveis(administrador,[admin,gestor,leitura,nutri,inativo]).map(p=>p.id)).toEqual(['admin','gestor','leitura','nutri']);
  });
  it('não mexe em administrador; no próprio cadastro o perfil não muda',()=>{
    expect(podeEditarMembro(membroGestor,{id:'outro',perfilId:'admin'},[admin,gestor])).toBe(false);
    expect(podeEditarMembro(membroGestor,{id:'outro',perfilId:'leitura'},[admin,leitura])).toBe(true);
    expect(podeEditarMembro(administrador,{id:'outro',perfilId:'admin'},[admin])).toBe(true);
    expect(perfisAtribuiveis(membroGestor,[admin,gestor,leitura],{id:'eu',perfilId:'gestor'}).map(p=>p.id)).toEqual(['gestor']);
    // membro com perfil maior que o do ator: mantém o perfil atual entre as opções (só nome/situação mudam)
    expect(perfisAtribuiveis(membroGestor,[gestor,nutri],{id:'outro',perfilId:'nutri'}).map(p=>p.id)).toEqual(['gestor','nutri']);
  });
  it('editar e duplicar perfil só dentro do teto, nunca o perfil que usa',()=>{
    expect(podeEditarPerfil(membroGestor,gestor)).toBe(false);
    expect(podeEditarPerfil(membroGestor,leitura)).toBe(true);
    expect(podeEditarPerfil(membroGestor,nutri)).toBe(false);
    expect(podeEditarPerfil(administrador,admin)).toBe(false);
    expect(podeDuplicarPerfil(membroGestor,admin)).toBe(false);
    expect(podeDuplicarPerfil(membroGestor,gestor)).toBe(true);
    expect(podeDuplicarPerfil(administrador,admin)).toBe(true);
    expect(permissaoMarcavel(membroGestor,'ALUNO_SENSIVEL_LER')).toBe(false);
    expect(permissaoMarcavel(membroGestor,'EQUIPE_LER')).toBe(true);
    expect(permissaoMarcavel(administrador,'ALUNO_SENSIVEL_LER')).toBe(true);
  });
});
