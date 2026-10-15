export interface PerfilEquipe {
  id:string; nome:string; descricao:string|null; acessoTotal:boolean; sistema:boolean; ativo:boolean;
  permissoes:string[]; usuarios:number; versao:number;
}
export interface PerfilEquipeRequest { nome:string; descricao:string|null; permissoes:string[]; ativo:boolean; versao:number|null }
export interface PermissaoEquipe { codigo:string; secao:string; modulo:string; descricao:string; sensivel:boolean }
export interface MembroEquipe {
  id:string; nome:string; email:string; perfilId:string; perfilNome:string; ativo:boolean;
  convitePendente:boolean; conviteExpiraEm:string|null; ultimoAcesso:string|null;
}
export interface ConviteEquipe { codigo:string; link:string; expiraEm:string; emailEnviado:boolean }
export interface ResponsavelEquipe { id:string; nome:string }
export interface EventoAuditoria { id:string; usuarioId:string; nomeUsuario:string; acao:string; entidade:string; entidadeId:string|null; resumo:string; criadoEm:string }
export interface PaginaAuditoria { itens:EventoAuditoria[]; total:number; pagina:number }
