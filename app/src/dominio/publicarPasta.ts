import type { PlanoResumo, PublicarPastaResposta, TipoPlano } from '../api/tipos';
import { dataParaTela } from './formatos';
import { PERMISSOES_DO_PLANO } from './permissoes';

/**
 * Regras puras da Folha da pasta para "Publicar tudo" (C21), "Copiar pasta para outro aluno" (D7) e o peso sugerido
 * ao finalizar (D8). Sem React e sem HTTP; a API continua sendo quem autoriza e valida.
 */

export const TIPOS_DA_PASTA: readonly TipoPlano[] = ['treino', 'dieta', 'mobilidade'];

const NOME: Record<TipoPlano, string> = { treino: 'Treino', dieta: 'Dieta', mobilidade: 'Mobilidade' };
const COM_ARTIGO: Record<TipoPlano, string> = { treino: 'o treino', dieta: 'a dieta', mobilidade: 'a mobilidade' };

/** Planos da pasta por tipo; `null` = a pessoa não lê esse tipo (ou a lista não chegou): não se sabe o que há nele. */
export type PlanosDaPasta = Record<TipoPlano, readonly PlanoResumo[] | null>;

/**
 * Plano que "Publicar tudo" publicaria: nunca publicado, ou com o rascunho alterado depois da última publicação. É o
 * mesmo critério da API (`Alvo.pendente`).
 */
export function planoPendente(p: Pick<PlanoResumo, 'versaoPublicada' | 'rascunhoAlteradoDepoisDePublicar'>): boolean {
  return p.versaoPublicada === 0 || p.rascunhoAlteradoDepoisDePublicar;
}

/**
 * Separa os planos do aluno pela pasta. A mobilidade fica de fora quando a funcionalidade está fora do plano da
 * consultoria (a API a pula ao publicar e ao copiar, então ela não pede permissão nenhuma).
 */
export function planosDaPasta(
  pastaId: string,
  porTipo: Partial<Record<TipoPlano, readonly PlanoResumo[] | null | undefined>>,
  comMobilidade: boolean,
): PlanosDaPasta {
  const daPasta = (lista: readonly PlanoResumo[] | null | undefined) => (lista ? lista.filter((p) => p.pastaId === pastaId) : null);
  return {
    treino: daPasta(porTipo.treino),
    dieta: daPasta(porTipo.dieta),
    mobilidade: comMobilidade ? daPasta(porTipo.mobilidade) : [],
  };
}

/** "o treino", "o treino e a dieta", "o treino, a dieta e a mobilidade". */
function juntar(tipos: readonly TipoPlano[]): string {
  const nomes = tipos.map((t) => COM_ARTIGO[t]);
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Motivo do "Publicar tudo" desabilitado: falta a permissão de publicar de um tipo **que tem alteração** (tipo sem
 * alteração não pede permissão). `null` = liberado. Tipo que a pessoa não lê fica desconhecido e não trava: o servidor
 * decide (403).
 */
export function motivoParaNaoPublicar(planos: PlanosDaPasta, pode: (codigo: string) => boolean): string | null {
  const faltam = TIPOS_DA_PASTA.filter((t) => (planos[t] ?? []).some(planoPendente) && !pode(PERMISSOES_DO_PLANO[t].publicar));
  return faltam.length ? `Falta permissão para publicar ${juntar(faltam)}.` : null;
}

/**
 * Motivo da cópia para outro aluno desabilitada: falta o `*_ALTERAR` de um tipo presente na pasta (a API exige o de
 * cada tipo presente, publicado ou não). `null` = liberado; tipo desconhecido não trava.
 */
export function motivoParaNaoCopiar(planos: PlanosDaPasta, pode: (codigo: string) => boolean): string | null {
  const faltam = TIPOS_DA_PASTA.filter((t) => (planos[t] ?? []).length > 0 && !pode(PERMISSOES_DO_PLANO[t].alterar));
  return faltam.length ? `Falta permissão para alterar ${juntar(faltam)}.` : null;
}

/** Aviso depois do 200: "2 publicados, 1 sem alteração." ou, sem nada publicado, que não havia o que publicar. */
export function resumoDaPublicacao(r: Pick<PublicarPastaResposta, 'publicados' | 'pulados'>): string {
  const n = r.publicados.length;
  const m = r.pulados.length;
  if (n === 0) return 'Nada para publicar: os planos já estão publicados e sem alteração.';
  const publicados = n === 1 ? '1 publicado' : `${n} publicados`;
  return m > 0 ? `${publicados}, ${m} sem alteração.` : `${publicados}.`;
}

export interface ProblemaDoPlano {
  mensagem: string;
}

export interface ProblemasPorPlano {
  /** Chave estável para a lista. */
  chave: string;
  tipo: TipoPlano | null;
  /** Plano do grupo, quando dá para saber qual (a tela oferece abri-lo). */
  planoId: string | null;
  /** "Treino: Plano 17"; sem o plano à mão, "Treino"; prefixo desconhecido, "Outros". */
  titulo: string;
  problemas: ProblemaDoPlano[];
}

const PREFIXO = /^(treino|dieta|mobilidade)(?:\[([^\]]+)\])?(?:\.(.*))?$/s;

/**
 * Agrupa os `fieldErrors` do 422 do "Publicar tudo" por plano. O campo é `treino`, `treino.<caminho>` ou, com dois
 * planos do mesmo tipo a publicar, `treino[<planoId>].<caminho>`. O nome vem do plano pelo id; sem id, do único plano
 * pendente daquele tipo (a API só põe o id quando há mais de um); senão, só o tipo. Campo fora desse formato vai para
 * "Outros" (nunca some). Só a mensagem vai para a tela: sem o conteúdo do plano, o caminho cru não diz nada ao treinador.
 * Ordem: a dos planos na resposta (a API valida treino, dieta e mobilidade, nessa ordem).
 */
export function agruparProblemasPorPlano(
  campos: readonly { field: string; message: string }[],
  planos: PlanosDaPasta,
): ProblemasPorPlano[] {
  const grupos = new Map<string, ProblemasPorPlano>();
  for (const c of campos) {
    const m = PREFIXO.exec(c.field);
    const tipo = (m?.[1] as TipoPlano | undefined) ?? null;
    const planoId = m?.[2] ?? null;
    let chave = 'outros';
    let titulo = 'Outros';
    let idDoPlano: string | null = null;
    if (tipo) {
      const daPasta = planos[tipo] ?? [];
      const plano = planoId ? daPasta.find((p) => p.id === planoId) : soUm(daPasta.filter(planoPendente));
      chave = planoId ? `${tipo}[${planoId}]` : tipo;
      titulo = plano ? `${NOME[tipo]}: ${plano.titulo}` : NOME[tipo];
      idDoPlano = plano?.id ?? null;
    }
    const grupo = grupos.get(chave) ?? { chave, tipo, planoId: idDoPlano, titulo, problemas: [] };
    grupo.problemas.push({ mensagem: c.message });
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

function soUm<T>(lista: readonly T[]): T | undefined {
  return lista.length === 1 ? lista[0] : undefined;
}

/** "1 problema", "3 avisos" (para o título de cada grupo e o leitor de tela). */
export function contagemDeProblemas(n: number, avisos: boolean): string {
  if (avisos) return n === 1 ? '1 aviso' : `${n} avisos`;
  return n === 1 ? '1 problema' : `${n} problemas`;
}

/** Erro da API reduzido ao que as regras precisam (o `ErroApi` do cliente serve). */
export interface ErroResumido {
  status: number;
  codigo: string | null;
  mensagem: string;
}

/** Texto do erro do "Publicar tudo" que não é a lista por plano (403, 404 e o resto). */
export function textoDoErroDaPublicacao(e: ErroResumido): string {
  if (e.status === 403) return 'Você não tem permissão para publicar todos os planos com alteração desta pasta. Nada foi publicado.';
  if (e.status === 404) return 'Esta pasta não foi encontrada. Ela pode ter sido excluída; feche e abra a ficha de novo.';
  return e.mensagem;
}

/** Texto do erro da cópia da pasta para outro aluno. */
export function textoDoErroDaCopia(e: ErroResumido): string {
  if (e.status === 409 && e.codigo === 'ALUNO_ANONIMIZADO') return 'Este aluno foi anonimizado e não pode receber a cópia. Escolha outro aluno.';
  if (e.status === 404) return 'Não encontramos a pasta ou o aluno escolhido. Atualize a lista de alunos e tente de novo.';
  if (e.status === 403) return 'Você não tem permissão para copiar todos os planos desta pasta.';
  // 400: a API já explica (mesmo aluno, fim antes do início).
  return e.mensagem;
}

/** Aviso fixo da Folha da cópia (D5): o que vai e o que não vai. */
export const AVISO_DA_COPIA_DA_PASTA =
  'Os planos chegam como rascunho, sem os ergogênicos da dieta e sem o questionário escolhido; nada é publicado para o aluno.';

/** Aviso depois de copiar a pasta. */
export function mensagemPastaCopiada(nomeDoAluno: string | null | undefined): string {
  const nome = nomeDoAluno?.trim();
  return `Pasta copiada para ${nome || 'o aluno'}, com os planos em rascunho.`;
}

/**
 * Peso sugerido ao finalizar (D8): só com as permissões de ler o dado sensível e a atualização (a rota exige as duas)
 * e a de gravar o peso (sem ela o campo nem aparece, e não há por que ler o dado).
 */
export function podeSugerirPeso(pode: (codigo: string) => boolean): boolean {
  return pode('ALUNO_SENSIVEL_LER') && pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_ALTERAR');
}

/** "Peso preenchido com o da atualização de 20/10/2026; confira antes de salvar." */
export function notaDoPesoSugerido(dataIso: string | null): string {
  const data = dataIso ? dataParaTela(dataIso.slice(0, 10)) : '';
  return data
    ? `Peso preenchido com o da atualização de ${data}; confira antes de salvar.`
    : 'Peso preenchido com o da atualização; confira antes de salvar.';
}
