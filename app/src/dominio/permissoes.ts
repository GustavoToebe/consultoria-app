import type { TipoPlano } from '../api/tipos';

/** Permissão de cada ação por tipo de plano. Mobilidade usa as do treino (decisão do produto). Mapa exaustivo: tipo novo não compila sem entrada. */
export const PERMISSOES_DO_PLANO: Record<TipoPlano, { ler: string; alterar: string; publicar: string }> = {
  treino: { ler: 'TREINO_LER', alterar: 'TREINO_ALTERAR', publicar: 'TREINO_PUBLICAR' },
  dieta: { ler: 'DIETA_LER', alterar: 'DIETA_ALTERAR', publicar: 'DIETA_PUBLICAR' },
  mobilidade: { ler: 'TREINO_LER', alterar: 'TREINO_ALTERAR', publicar: 'TREINO_PUBLICAR' },
};

/** Preferências de apresentação; a API autoriza cada operação pelo banco. */
export function pode(permissoes:readonly string[]|undefined,codigo:string):boolean {
  return permissoes?.includes(codigo)??false;
}
export function podeAcessarTela(caminho:string,tem:(codigo:string)=>boolean):boolean {
  if(['/treinador/perfil','/treinador/meus-dados','/treinador/ajustes','/treinador/ajuda'].includes(caminho)) return true;
  if(caminho==='/treinador/minha-conta') return tem('CONTA_LER');
  if(caminho==='/treinador') return tem('PAINEL_VER');
  if(caminho.startsWith('/treinador/atualizacoes')) return tem('ATUALIZACAO_LER')&&tem('ALUNO_SENSIVEL_LER');
  if(caminho==='/treinador/alunos/novo') return tem('ALUNO_ALTERAR');
  if(caminho.startsWith('/treinador/alunos')) return tem('ALUNO_LER');
  if(caminho.startsWith('/treinador/treinos')) return tem('TREINO_LER')&&tem('TREINO_ALTERAR');
  if(caminho.startsWith('/treinador/dietas')) return tem('DIETA_LER')&&tem('DIETA_ALTERAR');
  if(caminho.startsWith('/treinador/mobilidades')) return tem('TREINO_LER')&&tem('TREINO_ALTERAR');
  if(caminho==='/treinador/biblioteca') return tem('BIBLIOTECA_LER');
  if(caminho.startsWith('/treinador/planejamento/modelo')) return tem('MODELO_LER')&&tem('MODELO_ALTERAR');
  if(caminho.startsWith('/treinador/planejamento/questionario')) return tem('QUESTIONARIO_LER');
  // O Planejamento abre para quem lê modelos ou questionários; a tela esconde a aba que a pessoa não pode ver.
  // Qualquer outra subrota segue falhando fechado, com a permissão de modelos.
  if(caminho==='/treinador/planejamento'||caminho==='/treinador/receitas') return tem('MODELO_LER')||tem('QUESTIONARIO_LER');
  if(caminho.startsWith('/treinador/planejamento')) return tem('MODELO_LER');
  if(caminho==='/treinador/marca') return tem('MARCA_ALTERAR');
  if(caminho==='/treinador/equipe') return tem('EQUIPE_LER');
  if(caminho==='/treinador/auditoria') return tem('AUDITORIA_LER');
  return false;
}
