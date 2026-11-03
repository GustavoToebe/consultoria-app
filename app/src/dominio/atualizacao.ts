import type { Atualizacao, AtualizacaoDaLista, FaseAtualizacao, SituacaoAtualizacao } from '../api/tipos';
import { comMaiuscula, dataSemAnoCorrente } from './datasRelativas';
import { dataParaTela, hojeIso, numeroParaTela, somarDias } from './formatos';

export const DIAS_MAXIMOS_DE_ATRASO = 15;
/**
 * Acima disso o atraso não é contado em dias ("atrasada há 644943 dias" não diz nada): o texto passa a "desde dd/mm/aaaa".
 * Igual a `RegrasAtualizacao.DIAS_MAXIMOS_PARA_CONTAR_ATRASO` na API (que só guarda a constante: o texto é do app, e o
 * `diasDeAtraso` da resposta continua inteiro, porque painel e números dependem dele).
 */
export const DIAS_MAXIMOS_PARA_CONTAR_ATRASO = 365;
const diasPorExtenso = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
/** O prazo que venceu, em DD/MM/AAAA: `hoje − diasDeAtraso` (a data do aviso de atraso, se houve, senão a original). */
export const desdeQuandoAtrasou = (diasDeAtraso: number, hoje: string = hojeIso()) => dataParaTela(somarDias(hoje, -diasDeAtraso));
/** "há 5 dias" ou, acima de 365 dias, "desde 02/11/2024". */
export const atrasoEmTexto = (diasDeAtraso: number, hoje: string = hojeIso()) =>
  diasDeAtraso > DIAS_MAXIMOS_PARA_CONTAR_ATRASO ? `desde ${desdeQuandoAtrasou(diasDeAtraso, hoje)}` : `há ${diasPorExtenso(diasDeAtraso)}`;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
export const prazoAtualizacao = (data: string, atrasoAte: string | null) => atrasoAte && atrasoAte > data ? atrasoAte : data;

/**
 * Usa dias de calendário, sem arredondamento por hora ou horário de verão. Igual à API (RegrasAtualizacao):
 * o formulário abre pela data original; o aviso de atraso só adia o "atrasada" até max(data, atrasoAte).
 */
export function faseAtualizacao(hoje: string, data: string | null, atrasoAte: string | null, estado?: FaseAtualizacao) {
  if (!data) return { fase: 'NENHUMA' as FaseAtualizacao, diasParaData: 0, diasDeAtraso: 0 };
  const diasParaData = diasEntre(hoje, data);
  const diasParaPrazo = diasEntre(hoje, prazoAtualizacao(data, atrasoAte));
  const fase: FaseAtualizacao = estado === 'ENVIADA' || estado === 'REVISADA' ? estado
    : diasParaPrazo < 0 ? 'ATRASADA' : diasParaData <= 1 ? 'ABERTA' : diasParaData <= 3 ? 'AVISO' : 'NENHUMA';
  return { fase, diasParaData: diasParaPrazo, diasDeAtraso: Math.max(0, -diasParaPrazo) };
}
export function limitesNovaDataAtraso(hoje: string, data: string) {
  return { minimo: hoje > data ? hoje : data, maximo: somarDias(data, DIAS_MAXIMOS_DE_ATRASO) };
}
export function novaDataAtrasoValida(hoje: string, data: string, nova: string) {
  const { minimo, maximo } = limitesNovaDataAtraso(hoje, data);
  return nova >= minimo && nova <= maximo;
}
/** Atualização antiga aberta pelo histórico (`?id=`) só se lê: enviar ou avisar atraso vale só para a atual. */
export const formularioSomenteLeitura = (idPedido: string | undefined, idAtual: string | null | undefined) =>
  !!idPedido && idPedido !== idAtual;
/** Link do cartão quando ainda não dá para responder (antes da véspera, com ou sem atraso avisado). */
export const linkCartaoAtualizacao = (a: Atualizacao) =>
  a.fase === 'AVISO' || a.fase === 'NENHUMA' ? 'Ver o que vou responder' : a.feedback ? 'Ler' : 'Ver respostas';
/** Com o aviso de atraso dado, o cartão segue na tela inicial até o envio. */
export const mostrarCartaoAtualizacao = (a: Atualizacao) =>
  a.fase === 'REVISADA' ? !!a.feedback?.naoLido : a.fase !== 'NENHUMA' || !!a.atrasoAte;
/** Enviada, vista pelo aluno: quem espera é ele, então neutro (D2); o texto diz o que falta. */
export const SELO_ENVIADA_DO_ALUNO = { texto: 'Enviada · aguardando revisão', tipo: 'neutro' } as const;
export function statusAtualizacao(a: Atualizacao, hoje: string = hojeIso()) {
  const data = dataParaTela(a.atrasoAte ?? a.dataAtualizacao);
  if (a.fase === 'REVISADA') return { texto: a.feedback?.naoLido ? 'Seu treinador respondeu sua atualização' : 'Revisada', tipo: 'sucesso' as const };
  if (a.fase === 'ENVIADA') return SELO_ENVIADA_DO_ALUNO;
  if (a.fase === 'ATRASADA') return { texto: `Atualização atrasada ${atrasoEmTexto(a.diasDeAtraso, hoje)}`, tipo: 'perigo' as const };
  if (a.atrasoAte) return { texto: `Você avisou: nova data ${data}`, tipo: 'atencao' as const };
  if (a.fase === 'ABERTA') return { texto: `Responda sua atualização até ${data}`, tipo: 'atencao' as const };
  return { texto: `Sua atualização é em ${a.diasParaData} dias (${data})`, tipo: 'neutro' as const };
}
export const temAcaoAtualizacao = (a: Atualizacao) => a.fase === 'ABERTA' || a.fase === 'ATRASADA' || !!a.feedback?.naoLido;
/** Atualização de uma pasta: a vigente (pode ainda não ter linha gravada) ou a do histórico; null se nunca houve. */
export function atualizacaoDaPasta(pastaId: string, atual: Atualizacao | null | undefined, historico: readonly Atualizacao[]) {
  if (atual?.pastaId === pastaId) return atual;
  return historico.find(a => a.pastaId === pastaId) ?? null;
}
/**
 * Lista de onde o treinador veio: a revisão em fila segue o mesmo filtro (`?situacao=&meus=`, e os responsáveis, o
 * período e a busca da barra de filtros, `?responsavel=<id>,nenhum&de=&ate=&busca=`).
 */
export interface FilaDeAtualizacoes { situacao: SituacaoAtualizacao; meus: boolean; responsavel?: string; de?: string; ate?: string; busca?: string }
const SITUACOES_DA_FILA: readonly SituacaoAtualizacao[] = ['PARA_REVISAR', 'ATRASADAS', 'AVISARAM_ATRASO', 'PROXIMAS'];
const ID_DA_FILA = /^([0-9a-z-]{8,64}|nenhum)$/i;
const DATA_DA_FILA = /^\d{4}-\d{2}-\d{2}$/;
export function filaDosParametros(situacao: string | undefined, meus: string | undefined,
  extra: { responsavel?: string; de?: string; ate?: string; busca?: string } = {}): FilaDeAtualizacoes | null {
  const achada = SITUACOES_DA_FILA.find((s) => s === situacao);
  if (!achada) return null;
  const fila: FilaDeAtualizacoes = { situacao: achada, meus: meus === 'true' };
  const responsaveis = (extra.responsavel ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!fila.meus && responsaveis.length && responsaveis.every((r) => ID_DA_FILA.test(r))) fila.responsavel = responsaveis.join(',');
  if (extra.de && extra.ate && DATA_DA_FILA.test(extra.de) && DATA_DA_FILA.test(extra.ate)) { fila.de = extra.de; fila.ate = extra.ate; }
  const busca = extra.busca?.trim().slice(0, 100);
  if (busca) fila.busca = busca;
  return fila;
}
/** O resto do endereço da fila: `&responsavel=`, `&de=&ate=` e `&busca=` quando há. */
const restoDaFila = (fila: FilaDeAtualizacoes) =>
  `${fila.responsavel ? `&responsavel=${encodeURIComponent(fila.responsavel)}` : ''}${fila.de && fila.ate ? `&de=${fila.de}&ate=${fila.ate}` : ''}${fila.busca ? `&busca=${encodeURIComponent(fila.busca)}` : ''}`;
/** O filtro da API da fila (os responsáveis da vírgula viram parâmetros repetidos). */
export const filtroDaFila = (fila: FilaDeAtualizacoes) => ({
  ...(fila.responsavel ? { responsavel: fila.responsavel.split(',') } : {}),
  ...(fila.de && fila.ate ? { de: fila.de, ate: fila.ate } : {}),
  ...(fila.busca ? { busca: fila.busca } : {}),
});
export const caminhoAtualizacaoTreinador = (a: Pick<Atualizacao,'id'|'alunoId'>, fila?: FilaDeAtualizacoes | null) => {
  const base = a.id ? `/treinador/atualizacoes/${a.id}` : `/treinador/atualizacoes/previa?alunoId=${a.alunoId}`;
  if (!fila) return base;
  return `${base}${a.id ? '?' : '&'}situacao=${fila.situacao}${fila.meus ? '&meus=true' : ''}${restoDaFila(fila)}`;
};
/** "Próxima ›": a primeira da lista que não é a atual (ao responder, a atual sai de "Para revisar"). */
export const proximaDaFila = <T extends { pastaId: string | null }>(itens: readonly T[], pastaAtual: string | null): T | null =>
  itens.find((i) => i.pastaId !== pastaAtual) ?? null;
/** Lista aberta a partir de um contador do Início: leva junto o escopo "Meus alunos", para o total bater com a lista. */
export const caminhoListaAtualizacoes = (situacao: string, meus: boolean, fila?: Omit<FilaDeAtualizacoes, 'situacao' | 'meus'>) =>
  `/treinador/atualizacoes?situacao=${situacao}${meus ? '&meus=true' : ''}${fila ? restoDaFila({ situacao: 'PARA_REVISAR', meus, ...fila }) : ''}`;
/**
 * Selo da atualização para o treinador. `texto` diz de quê ("Atualização em 15 dias") e serve fora das telas de
 * atualização (lista de alunos, pastas, resumo da ficha); `curto` ("Em 15 dias") serve onde o assunto já é a
 * atualização (lista e detalhe de atualizações). Selo curto: a frase longa vai no corpo do cartão.
 */
export function statusAtualizacaoTreinador(a:Pick<AtualizacaoDaLista,'fase'|'diasDeAtraso'|'diasParaData'|'atrasoAte'>, hoje:string=hojeIso()) {
  const selo=(curto:string,tipo:'atencao'|'sucesso'|'perigo'|'neutro',texto=`Atualização ${curto[0].toLowerCase()}${curto.slice(1)}`)=>({texto,curto,tipo});
  if(a.fase==='ENVIADA')return selo('Para revisar','atencao');
  if(a.fase==='REVISADA')return selo('Revisada','sucesso');
  if(a.fase==='ATRASADA')return selo(`Atrasada ${atrasoEmTexto(a.diasDeAtraso,hoje)}`,'perigo');
  if(a.atrasoAte)return selo(`Adiada para ${paraQuando(a.atrasoAte,hoje)}`,'neutro');
  return selo(comMaiuscula(emDias(a.diasParaData)),'neutro');
}
/**
 * Depois de "Adiada para": "hoje" ou "amanhã" (decididos pela diferença em dias) ou a data ("24/10", "02/01/2027" em outro ano).
 * "em 5 dias" ficaria "Adiada para em 5 dias".
 */
function paraQuando(iso:string,hoje:string):string {
  const dias=diasEntre(hoje,iso);
  if(dias===0)return 'hoje';
  if(dias===1)return 'amanhã';
  return dataSemAnoCorrente(iso,hoje);
}
/** Distância em dias a partir de hoje: "hoje", "amanhã", "em 3 dias"; no passado, "há 2 dias". */
export function emDias(dias:number):string {
  if(dias===0)return 'hoje';
  if(dias===1)return 'amanhã';
  if(dias===-1)return 'ontem';
  return dias>0?`em ${dias} dias`:`há ${-dias} dias`;
}
export const podeResponderAtualizacao = (a: Atualizacao, hoje: string) =>
  !!a.dataAtualizacao && a.fase !== 'ENVIADA' && a.fase !== 'REVISADA' && hoje >= somarDias(a.dataAtualizacao, -1);

/**
 * N17: "1 treino registrado no período (≈0,2 por semana)". Conta os dias com treino registrado no app, que é o que a
 * API sabe; sem o dado do período, "—" (nunca zero inventado). A média só aparece quando a API a manda.
 */
export function fraseDeTreinosNoPeriodo(diasComTreino: number | null | undefined, mediaPorSemana: number | null | undefined): string {
  if (diasComTreino == null) return 'Treinos registrados no período: —';
  const quantos = diasComTreino === 1 ? '1 treino registrado' : diasComTreino === 0 ? 'Nenhum treino registrado' : `${diasComTreino} treinos registrados`;
  return `${quantos} no período${mediaPorSemana == null ? '' : ` (≈${numeroParaTela(mediaPorSemana, 1)} por semana)`}`;
}
