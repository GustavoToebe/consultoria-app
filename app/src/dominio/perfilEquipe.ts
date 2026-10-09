/** Espelha as dependências do catálogo da API; o servidor valida novamente. */
const dependencias:Record<string,string[]> = {
  ALUNO_ALTERAR:['ALUNO_LER'],ALUNO_CONVITE:['ALUNO_LER'],ALUNO_SENSIVEL_LER:['ALUNO_LER'],
  ALUNO_SENSIVEL_ALTERAR:['ALUNO_SENSIVEL_LER'],PASTA_ALTERAR:['ALUNO_LER'],
  TREINO_ALTERAR:['TREINO_LER'],TREINO_PUBLICAR:['TREINO_LER','TREINO_ALTERAR'],
  DIETA_ALTERAR:['DIETA_LER'],DIETA_PUBLICAR:['DIETA_LER','DIETA_ALTERAR'],
  ATUALIZACAO_LER:['ALUNO_SENSIVEL_LER'],ATUALIZACAO_RESPONDER:['ATUALIZACAO_LER'],
  BIBLIOTECA_ALTERAR:['BIBLIOTECA_LER'],MODELO_ALTERAR:['MODELO_LER'],MODELO_APLICAR:['MODELO_LER'],
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
