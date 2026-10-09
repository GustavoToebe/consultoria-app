/** Preferências de apresentação; a API autoriza cada operação pelo banco. */
export function pode(permissoes:readonly string[]|undefined,codigo:string):boolean {
  return permissoes?.includes(codigo)??false;
}
export function podeAcessarTela(caminho:string,tem:(codigo:string)=>boolean):boolean {
  if(caminho==='/treinador/perfil') return true;
  if(caminho==='/treinador') return tem('PAINEL_VER');
  if(caminho.startsWith('/treinador/atualizacoes')) return tem('ATUALIZACAO_LER')&&tem('ALUNO_SENSIVEL_LER');
  if(caminho==='/treinador/alunos/novo') return tem('ALUNO_ALTERAR');
  if(caminho.startsWith('/treinador/alunos')) return tem('ALUNO_LER');
  if(caminho.startsWith('/treinador/treinos')) return tem('TREINO_LER')&&tem('TREINO_ALTERAR');
  if(caminho.startsWith('/treinador/dietas')) return tem('DIETA_LER')&&tem('DIETA_ALTERAR');
  if(caminho==='/treinador/biblioteca') return tem('BIBLIOTECA_LER');
  if(caminho.startsWith('/treinador/planejamento/modelo')) return tem('MODELO_LER')&&tem('MODELO_ALTERAR');
  if(caminho.startsWith('/treinador/planejamento')||caminho==='/treinador/receitas') return tem('MODELO_LER');
  if(caminho==='/treinador/marca') return tem('MARCA_ALTERAR');
  if(caminho==='/treinador/equipe') return tem('EQUIPE_LER');
  if(caminho==='/treinador/auditoria') return tem('AUDITORIA_LER');
  return false;
}
