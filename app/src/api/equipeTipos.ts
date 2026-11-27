export interface PerfilEquipe {
  id:string; nome:string; descricao:string|null; acessoTotal:boolean; sistema:boolean; ativo:boolean;
  permissoes:string[]; usuarios:number; versao:number;
}
export interface PerfilEquipeRequest { nome:string; descricao:string|null; permissoes:string[]; ativo:boolean; versao:number|null }
export interface PermissaoEquipe { codigo:string; secao:string; modulo:string; descricao:string; sensivel:boolean }
export interface MembroEquipe {
  id:string; nome:string; email:string; perfilId:string; perfilNome:string; ativo:boolean;
  convitePendente:boolean; conviteExpiraEm:string|null; ultimoAcesso:string|null;
  /** Nulo = sem limite (supervisão da equipe, D2); grava só o Administrador, na rota própria. */
  limiteDeAlunos:number|null;
}
export interface ConviteEquipe { codigo:string; link:string; expiraEm:string; emailEnviado:boolean }
export interface ResponsavelEquipe { id:string; nome:string }
/**
 * `resumo` é o texto fixo da ação (repete o nome dela): a tela não o mostra. `objetoNome` é o nome do objeto afetado, já
 * sem o tipo (nulo sem objeto, objeto apagado ou tipo não resolvido) e `origem` é "Web", "App Android", "App iOS" ou nulo.
 * `usuarioPerfil` é o nome do perfil de acesso de quem fez (o atual; nulo para o Sistema, autor sem perfil, como o aluno, ou não encontrado).
 * Os três são opcionais no tipo só para os eventos montados à mão nos testes antigos; a API sempre os manda.
 */
export interface EventoAuditoria {
  id:string; usuarioId:string|null; nomeUsuario:string; acao:string; entidade:string; entidadeId:string|null; resumo:string; criadoEm:string;
  objetoNome?:string|null; origem?:string|null; usuarioPerfil?:string|null;
}
export interface PaginaAuditoria { itens:EventoAuditoria[]; total:number; pagina:number }
