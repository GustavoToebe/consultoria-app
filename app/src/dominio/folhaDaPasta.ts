import type { PastaResumo, PlanoResumo, TipoPlano } from '../api/tipos';
import { dataSemAnoCorrente, periodoCurto } from './datasRelativas';
import { hojeIso } from './formatos';
import { PERMISSOES_DO_PLANO } from './permissoes';
import { planoPendente, TIPOS_DA_PASTA, type PlanosDaPasta, type ProblemasPorPlano } from './publicarPasta';
import { prazoDaPasta } from './resumoDoAluno';

/**
 * Regras puras da Folha da pasta (pedido de 27/11): o título é a pasta (o período), nunca o nome técnico de um plano; uma
 * linha de situação com um selo só; o rodapé de publicação com a contagem do que vai sair. Sem React e sem HTTP.
 */

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

/** "Pasta de 01/11 a 11/11"; sem nenhuma data, "Pasta sem período" (o título gravado pode ser o técnico da importação). */
export function tituloDaFolhaDaPasta(pasta: Pick<PastaResumo, 'inicio' | 'fim'>, hoje: string = hojeIso()): string {
  if (!pasta.inicio && !pasta.fim) return 'Pasta sem período';
  return `Pasta de ${periodoCurto(pasta.inicio, pasta.fim, hoje)}`;
}

/** "01/11 a 11/11 · 11 dias"; só uma das datas, sem a contagem; nenhuma, "Período não definido". */
export function periodoDaFolhaDaPasta(pasta: Pick<PastaResumo, 'inicio' | 'fim'>, hoje: string = hojeIso()): string {
  if (!pasta.inicio && !pasta.fim) return 'Período não definido';
  const texto = periodoCurto(pasta.inicio, pasta.fim, hoje);
  if (!pasta.inicio || !pasta.fim || pasta.fim < pasta.inicio) return texto;
  const dias = diasEntre(pasta.inicio, pasta.fim) + 1;
  return `${texto} · ${dias === 1 ? '1 dia' : `${dias} dias`}`;
}

export interface SeloDaPasta {
  texto: string;
  tipo: 'sucesso' | 'perigo' | 'neutro';
}

type PastaDaSituacao = Pick<PastaResumo, 'id' | 'titulo' | 'inicio' | 'fim' | 'concluidaEm'>;

/**
 * O único selo da linha de situação, nesta ordem: finalizada ("Concluída em 12/11", neutro); vencida pela regra da lista
 * (`prazoDaPasta`, D12 e D13: a vigente que acabou, ou a que acabou e ainda pede renovação), "Vencida há 16 dias"
 * (vermelho); outra que acabou e não foi finalizada (já renovada), "Período encerrado em 11/11" (neutro); a vigente da API
 * (`ehVigente`, nunca por data), "Vigente" (verde). Nunca dois juntos. Fora disso (futura, no período sem ser a vigente,
 * sem datas e não vigente), sem selo.
 */
export function situacaoDaPasta(pasta: PastaDaSituacao, todas: readonly PastaDaSituacao[], ehVigente: boolean, hoje: string = hojeIso()): SeloDaPasta | null {
  if (pasta.concluidaEm) return { texto: `Concluída em ${dataSemAnoCorrente(hojeIso(new Date(pasta.concluidaEm)), hoje)}`, tipo: 'neutro' };
  const prazo = prazoDaPasta(pasta, todas, hoje, ehVigente);
  if (prazo?.tipo === 'perigo') return { texto: prazo.texto, tipo: 'perigo' };
  if (pasta.fim && pasta.fim < hoje) return { texto: `Período encerrado em ${dataSemAnoCorrente(pasta.fim, hoje)}`, tipo: 'neutro' };
  return ehVigente ? { texto: 'Vigente', tipo: 'sucesso' } : null;
}

const NOVO: Record<TipoPlano, string> = { treino: 'Novo treino', dieta: 'Nova dieta', mobilidade: 'Nova mobilidade' };
const NENHUM: Record<TipoPlano, string> = { treino: 'Nenhum treino nesta pasta', dieta: 'Nenhuma dieta nesta pasta', mobilidade: 'Nenhuma mobilidade nesta pasta' };

/** Rótulo do "+ Novo …" na linha das abas, que muda com a aba. */
export const rotuloDoNovoPlano = (tipo: TipoPlano): string => NOVO[tipo];

/** Título do vazio da aba. */
export const vazioDoTipo = (tipo: TipoPlano): string => NENHUM[tipo];

/** Plano que vai sair no "Publicar alterações", com o tipo. */
export interface PendenteDaPasta {
  tipo: TipoPlano;
  plano: PlanoResumo;
}

/**
 * Pendentes das listas conhecidas (lista `null` = desconhecida, fica de fora), na ordem treino, dieta, mobilidade. É o que
 * o rodapé conta e o que a lista "N alterações para publicar" mostra; o "(N)" do botão continua só com tudo conhecido.
 */
export function pendentesDaPasta(planos: PlanosDaPasta | null): PendenteDaPasta[] {
  if (!planos) return [];
  return TIPOS_DA_PASTA.flatMap((tipo) => (planos[tipo] ?? []).filter(planoPendente).map((plano) => ({ tipo, plano })));
}

/**
 * "1 alteração para publicar", "2 alterações para publicar"; com algum tipo desconhecido (`parcial`: a contagem do botão é
 * `null` e ele fica sem o "(N)"), "Pelo menos 2 alterações para publicar".
 */
export const textoDasAlteracoes = (n: number, parcial = false): string =>
  `${parcial ? 'Pelo menos ' : ''}${n === 1 ? '1 alteração' : `${n} alterações`} para publicar`;

const NO_TIPO: Record<TipoPlano, string> = { treino: 'no treino', dieta: 'na dieta', mobilidade: 'na mobilidade' };
const O_TIPO: Record<TipoPlano, string> = { treino: 'o treino', dieta: 'a dieta', mobilidade: 'a mobilidade' };
const NELE: Record<TipoPlano, string> = { treino: 'nele', dieta: 'nela', mobilidade: 'nela' };
const juntar = (itens: readonly string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);

/**
 * Tipo que a pessoa não lê (lista `null` que não falhou) e não pode publicar: se ele tiver alteração, a API recusa tudo
 * com 403. Não dá para saber se tem, então o botão não trava; a frase avisa antes do clique. `null` = nada a avisar.
 */
export function avisoDosTiposSemAcesso(
  planos: PlanosDaPasta | null,
  falhou: Partial<Record<TipoPlano, boolean>>,
  pode: (codigo: string) => boolean,
): string | null {
  if (!planos) return null;
  const tipos = TIPOS_DA_PASTA.filter((t) => planos[t] === null && !falhou[t] && !pode(PERMISSOES_DO_PLANO[t].publicar));
  if (!tipos.length) return null;
  const nele = tipos.length === 1 ? NELE[tipos[0]] : tipos.includes('treino') ? 'neles' : 'nelas';
  return `Você não vê ${juntar(tipos.map((t) => O_TIPO[t]))} desta pasta: se houver alteração ${nele}, nada é publicado.`;
}

/**
 * Motivo do "Publicar alterações" desabilitado depois de um 422 (nada foi publicado): "Corrija 1 problema no treino",
 * "Corrija 3 problemas no treino e na dieta"; problema fora de um tipo conhecido, "Corrija 2 problemas antes de publicar".
 * `null` sem problema.
 */
export function motivoDosProblemas(grupos: readonly Pick<ProblemasPorPlano, 'tipo' | 'problemas'>[]): string | null {
  const total = grupos.reduce((n, g) => n + g.problemas.length, 0);
  if (!total) return null;
  const contagem = total === 1 ? '1 problema' : `${total} problemas`;
  const tipos = TIPOS_DA_PASTA.filter((t) => grupos.some((g) => g.tipo === t && g.problemas.length));
  if (!tipos.length || grupos.some((g) => !g.tipo && g.problemas.length)) return `Corrija ${contagem} antes de publicar`;
  return `Corrija ${contagem} ${juntar(tipos.map((t) => NO_TIPO[t]))}`;
}

/** O ⓘ da contagem do rodapé: a regra do tudo ou nada, que saiu do texto solto do meio da folha. */
export const AJUDA_DA_PUBLICACAO = 'Publica de uma vez os planos com alteração desta pasta. Se algum plano tiver erro, nada é publicado.';
