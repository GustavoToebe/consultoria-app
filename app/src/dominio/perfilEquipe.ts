import type { PerfilEquipe } from '../api/equipeTipos';
/** Espelha as dependências do catálogo da API; o servidor valida novamente. */
const dependencias:Record<string,string[]> = {
  ALUNO_ALTERAR:['ALUNO_LER'],ALUNO_CONVITE:['ALUNO_LER'],ALUNO_SENSIVEL_LER:['ALUNO_LER'],
  ALUNO_SENSIVEL_ALTERAR:['ALUNO_SENSIVEL_LER'],PASTA_ALTERAR:['ALUNO_LER'],
  ALUNO_EXPORTAR:['ALUNO_LER','ALUNO_SENSIVEL_LER'],ALUNO_ANONIMIZAR:['ALUNO_ALTERAR','ALUNO_SENSIVEL_ALTERAR'],
  TREINO_ALTERAR:['TREINO_LER'],TREINO_PUBLICAR:['TREINO_LER','TREINO_ALTERAR'],
  DIETA_ALTERAR:['DIETA_LER'],DIETA_PUBLICAR:['DIETA_LER','DIETA_ALTERAR'],
  ATUALIZACAO_LER:['ALUNO_SENSIVEL_LER'],ATUALIZACAO_RESPONDER:['ATUALIZACAO_LER'],
  BIBLIOTECA_ALTERAR:['BIBLIOTECA_LER'],MODELO_ALTERAR:['MODELO_LER'],MODELO_APLICAR:['MODELO_LER'],QUESTIONARIO_ALTERAR:['QUESTIONARIO_LER'],
  USUARIO_ALTERAR:['EQUIPE_LER'],PERFIL_ALTERAR:['EQUIPE_LER'],
};
export function completarPermissoes(codigos:readonly string[]):string[] {
  const conjunto=new Set(codigos);
  for(const codigo of conjunto) for(const exigida of dependencias[codigo]??[]) conjunto.add(exigida);
  return [...conjunto];
}
export function desmarcarPermissoes(atuais:readonly string[],remover:readonly string[]):string[] {
  const conjunto=new Set(atuais);remover.forEach(c=>conjunto.delete(c));
  let mudou=true;
  while(mudou){mudou=false;for(const codigo of conjunto) if((dependencias[codigo]??[]).some(c=>!conjunto.has(c))){conjunto.delete(codigo);mudou=true;}}
  return [...conjunto];
}

/**
 * Teto de permissões, só para apresentação (espelha `EquipeService` da API, que decide de verdade):
 * Administrador só administrador atribui; ninguém dá permissão que não tem; quem não é administrador não mexe em
 * administrador, no próprio perfil nem no perfil que usa.
 */
export interface AtorEquipe { administrador:boolean; perfilId:string|null; usuarioId:string|null; tem:(codigo:string)=>boolean }
const cabeNoTeto=(ator:AtorEquipe,permissoes:readonly string[])=>ator.administrador||permissoes.every(ator.tem);
export const permissaoMarcavel=(ator:AtorEquipe,codigo:string)=>ator.administrador||ator.tem(codigo);
const podeAtribuir=(ator:AtorEquipe,p:PerfilEquipe)=>ator.administrador||(!p.acessoTotal&&cabeNoTeto(ator,p.permissoes));
/** Opções de perfil ao convidar (sem membro) ou editar um membro: o perfil atual do membro continua na lista. */
export function perfisAtribuiveis(ator:AtorEquipe,perfis:readonly PerfilEquipe[],membro?:{id:string;perfilId:string}) {
  if(membro&&!ator.administrador&&membro.id===ator.usuarioId) return perfis.filter(p=>p.id===membro.perfilId);
  return perfis.filter(p=>p.id===membro?.perfilId||(p.ativo&&podeAtribuir(ator,p)));
}
export function podeEditarMembro(ator:AtorEquipe,membro:{id:string;perfilId:string},perfis:readonly PerfilEquipe[]) {
  return ator.administrador||!perfis.find(p=>p.id===membro.perfilId)?.acessoTotal;
}
export const podeEditarPerfil=(ator:AtorEquipe,p:PerfilEquipe)=>!p.sistema&&(ator.administrador||(p.id!==ator.perfilId&&cabeNoTeto(ator,p.permissoes)));
/** Convite pendente só é cancelado por quem poderia convidar para aquele perfil (a API decide de verdade). */
export const podeCancelarConvite=(ator:AtorEquipe,convite:{convitePendente:boolean;perfilId:string},perfis:readonly PerfilEquipe[])=>{
  const perfil=perfis.find(p=>p.id===convite.perfilId);
  return convite.convitePendente&&!!perfil&&podeAtribuir(ator,perfil);
};
export const podeDuplicarPerfil=(ator:AtorEquipe,p:PerfilEquipe)=>podeAtribuir(ator,p);
