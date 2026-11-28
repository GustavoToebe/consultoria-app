import type { TipoPlano } from '../api/tipos';
import { rotaInteiraDoCaminho } from './rotasDasConfiguracoes';

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
/**
 * Tela de um módulo desligado nesta instalação (hoje só o Financeiro, pela chave `TREINOS_PAGAMENTOS_HABILITADO` do
 * servidor): o aviso diz isso em vez de culpar a permissão, e não manda ninguém pedir, porque o administrador da
 * consultoria também não liga o módulo (C4 da auditoria de 03/11). `null` = a tela não depende de módulo desligado.
 */
export function moduloDesligadoDaTela(caminho:string,pagamentosHabilitados:boolean=false,vitrineHabilitada:boolean=false):{titulo:string;texto:string}|null {
  if(caminho==='/treinador/financeiro'&&!pagamentosHabilitados) return {titulo:'Recurso desativado',texto:'Os pagamentos não estão ativos nesta instalação do app.'};
  if(caminho.startsWith('/treinador/vitrine')&&!vitrineHabilitada) return {titulo:'Recurso desativado',texto:'A vitrine não está ativa nesta instalação do app.'};
  return null;
}

/**
 * `pagamentosHabilitados`: módulo de pagamentos ligado para a consultoria (vem de `GET /eu`). Ausente = desligado: o
 * Financeiro some do menu mesmo para quem tem a permissão. `vitrineHabilitada`, idem para a Vitrine (`GET /eu`).
 */
export function podeAcessarTela(caminho:string,tem:(codigo:string)=>boolean,pagamentosHabilitados:boolean=false,administrador:boolean=false,vitrineHabilitada:boolean=false):boolean {
  // Item aberto dentro de Configurações (`/treinador/configuracoes/<id>`): a mesma regra da rota inteira dele; id desconhecido falha fechado.
  if(caminho.startsWith('/treinador/configuracoes/')){const inteira=rotaInteiraDoCaminho(caminho);return inteira!==null&&podeAcessarTela(inteira,tem,pagamentosHabilitados,administrador,vitrineHabilitada);}
  if(['/treinador/perfil','/treinador/meus-dados','/treinador/seguranca','/treinador/ajustes','/treinador/ajuda','/treinador/termos','/treinador/configuracoes'].includes(caminho)) return true;
  if(caminho==='/treinador/comunidade') return tem('TREINO_LER');
  if(caminho==='/treinador/minha-conta') return tem('CONTA_LER');
  if(caminho==='/treinador') return tem('PAINEL_VER');
  // A Agenda junta as atualizações dos próximos dias (mesma permissão das Atualizações) e os compromissos presenciais
  // (AGENDA_LER): abre com qualquer uma das duas, e cada parte aparece só para quem pode vê-la.
  if(caminho==='/treinador/agenda') return (tem('ATUALIZACAO_LER')&&tem('ALUNO_SENSIVEL_LER'))||tem('AGENDA_LER');
  if(caminho.startsWith('/treinador/atualizacoes')) return tem('ATUALIZACAO_LER')&&tem('ALUNO_SENSIVEL_LER');
  // Números é o relatório da consultoria (só contagens): a permissão de quem vê o painel.
  if(caminho==='/treinador/numeros') return tem('PAINEL_VER');
  // Financeiro: planos comerciais, cobranças e painel de recebimentos. Precisa da permissão E do módulo ligado.
  if(caminho==='/treinador/financeiro') return pagamentosHabilitados&&tem('FINANCEIRO_LER');
  // Vitrine: itens que o treinador mostra aos alunos. Precisa da permissão E da chave ligada.
  if(caminho.startsWith('/treinador/vitrine')) return vitrineHabilitada&&tem('VITRINE_LER');
  if(caminho==='/treinador/alunos/novo') return tem('ALUNO_ALTERAR');
  if(caminho==='/treinador/interessados') return tem('INSCRICAO_LER');
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
  // A tela da marca fica no menu da conta e só o perfil Administrador (acesso total) abre.
  if(caminho==='/treinador/marca') return administrador;
  // Documentos (PDF): a mesma regra de quem grava a marca (administrador com MARCA_ALTERAR); o plano sem PDF a tela confere.
  if(caminho==='/treinador/documentos') return administrador&&tem('MARCA_ALTERAR');
  // O editor dos PDFs (fora da busca: só se chega pela galeria) segue a mesma regra; caminho exato, outra subrota falha fechado.
  if(caminho==='/treinador/documentos/personalizar') return administrador&&tem('MARCA_ALTERAR');
  if(caminho==='/treinador/whatsapp') return tem('WHATSAPP_ALTERAR');
  // Contratos (modelos): a chave da plataforma esconde o item no hub; a guarda da rota é a permissão de ler.
  if(caminho==='/treinador/contratos') return tem('CONTRATO_LER');
  // Regras de atenção: ler pede as atualizações e os dados sensíveis (a API também); editar (REGRA_ATENCAO_ALTERAR) a tela confere. A chave esconde o item no hub.
  if(caminho==='/treinador/regras-de-atencao') return tem('ATUALIZACAO_LER')&&tem('ALUNO_SENSIVEL_LER');
  if(caminho==='/treinador/equipe') return tem('EQUIPE_LER');
  if(caminho==='/treinador/auditoria') return tem('AUDITORIA_LER');
  // A planilha completa cria alunos (e o resto por parte, conferido na API): a rota pede ALUNO_ALTERAR.
  if(caminho==='/treinador/importacao/planilha-completa') return tem('ALUNO_ALTERAR');
  // A importação assistida cria alunos e planos: a API exige ALUNO_ALTERAR em toda rota dela.
  if(caminho==='/treinador/importacao/assistida') return tem('ALUNO_ALTERAR');
  if(caminho==='/treinador/importacao/dicionario') return tem('ALUNO_ALTERAR');
  if(caminho==='/treinador/importacao'||caminho==='/treinador/importacao/nova') return tem('ALUNO_ALTERAR')||tem('ALUNO_SENSIVEL_ALTERAR')||tem('BIBLIOTECA_ALTERAR')||tem('ERGOGENICO_ALTERAR');
  return false;
}
