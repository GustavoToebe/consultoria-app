import type { ConteudoDieta, FatoresDoAlimento, ItemDieta, Refeicao, UnidadeAlimento } from '../api/tipos';
import { completarFatores, NOTA_DA_ESTIMATIVA } from './fatoresDoAlimento';
import { secoesDaDieta } from './variacoesDaDieta';

/**
 * Lista de compras da dieta publicada (pedido do Saraiva em 17/10, R13/R14/R32), calculada no aparelho do aluno, também
 * sem internet: a versão publicada já traz os fatores de cada item (copiados da biblioteca pelo servidor ao publicar).
 * O editor do treinador mostra a mesma lista como prévia do que está na tela: como o rascunho não guarda fatores, ele
 * busca os atuais da biblioteca e os põe nos itens com `comFatoresDaBiblioteca`, a mesma regra da publicação.
 *
 * As quantidades da dieta são do alimento **como é comido** (ex.: "Arroz branco cozido" 150 g). Por item, em gramas:
 * cru limpo = quantidade ÷ FCc e a comprar = cru limpo × FC. Fator ausente é estimado pelo nome (`estimarFatoresDoAlimento`).
 * FC e FCc iguais a 1 são peso direto, sem aviso de fator faltando. Os fatores só valem para `g`; `ml` e `un` ficam como estão.
 *
 * Nada aqui opina sobre a dieta: só multiplica o que o treinador escreveu pelo número de dias.
 */

export type PeriodoDaLista = 'semana' | 'duasSemanas' | 'mes';

/** Os períodos na ordem da tela (7, 14 e 30 dias). */
export const PERIODOS_DA_LISTA: readonly PeriodoDaLista[] = ['semana', 'duasSemanas', 'mes'];

/**
 * Dias de cada período: semana = 7, duas semanas = 14, mês = 30 (fixos, para a lista não mudar conforme o mês do
 * calendário).
 */
export const DIAS_DO_PERIODO: Record<PeriodoDaLista, number> = { semana: 7, duasSemanas: 14, mes: 30 };

/**
 * Rótulo do período no seletor e no título do PDF: "7 dias", "14 dias", "30 dias" (A7, 25/11: o número de dias é a
 * conta, e "mês" fazia ler o mês do calendário).
 */
export function textoDoPeriodo(periodo: PeriodoDaLista): string {
  return `${DIAS_DO_PERIODO[periodo]} dias`;
}

/** Título do cartão da lista: "Lista de 7 dias", "Lista de 14 dias", "Lista de 30 dias". */
export function tituloDaLista(periodo: PeriodoDaLista): string {
  return `Lista de ${textoDoPeriodo(periodo)}`;
}

/** Opção escolhida por refeição: `uid` da refeição → `uid` da opção. Sem escolha (ou escolha que sumiu), vale a primeira. */
export type EscolhasDeOpcao = Readonly<Record<string, string>>;

export interface LinhaDaLista {
  /** Chave estável da linha (alimento ou nome, mais a unidade). */
  chave: string;
  nome: string;
  unidade: UnidadeAlimento;
  /** Quantidade a comprar no período, sem arredondar (arredonda só na tela: `quantidadeParaTela`). */
  quantidade: number;
  /** Alguma parte foi convertida para cru pelo fator de cocção. */
  cru: boolean;
  /** Alguma parte foi aumentada pelo fator de correção (peso bruto, com casca, osso...). */
  bruto: boolean;
  /** Nenhum fator foi aplicado: a quantidade é a da dieta, como está. Em gramas a estimativa sempre preenche, então fica falso. */
  semFator: boolean;
  /** Gramas com FC e FCc iguais a 1: o peso da dieta já é o peso de compra. */
  semConversao?: boolean;
  /** Quantidade da dieta no período, antes dos fatores. Some das partes do mesmo alimento. */
  naDieta: number;
  /** Peso cru no período quando todas as partes têm o mesmo FCc; senão `null` (a coluna mostra "—"). */
  quantidadeCru: number | null;
  /** FC comum do grupo; `null` se falta ou se as partes divergem (não se inventa um número). */
  fatorCorrecao: number | null;
  /** FCc comum do grupo; `null` se falta ou se as partes divergem. */
  fatorCoccao: number | null;
  /**
   * Grupo do alimento ("Carnes e derivados"), que a versão publicada traz em cada item (copiado da biblioteca, como os
   * fatores); agrupa a tela e o PDF (`agruparLista`). `null` = sem grupo. Só muda a apresentação, nunca a conta.
   */
  grupo: string | null;
}

/** Opção que entra na lista para a refeição: a escolhida, se ainda existe; senão a primeira. */
function opcaoEscolhida(refeicao: Refeicao, escolhas: EscolhasDeOpcao) {
  const uid = escolhas[refeicao.uid];
  return refeicao.opcoes.find((o) => o.uid === uid) ?? refeicao.opcoes[0];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const positivo = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const diferenteDeUm = (n: number) => Math.abs(n - 1) > 1e-9;

/** FC e FCc do item em gramas: o que veio preenchido fica; o nulo é estimado pelo nome. */
function fatoresEmGramas(item: ItemDieta): { fc: number; fcc: number } | null {
  if (item.unidade !== 'g') return null;
  const fatores = completarFatores(item.fatorCorrecao ?? null, item.fatorCoccao ?? null, item.nome, item.grupo, item.kcal, item.quantidade, item.unidade);
  return { fc: fatores.fatorCorrecao, fcc: fatores.fatorCoccao };
}

/** Quantidade de um item por dia, já com os fatores (só em gramas). */
function porDia(item: ItemDieta & { quantidade: number }): { quantidade: number; cru: boolean; bruto: boolean; fc: number | null; fcc: number | null } {
  const fatores = fatoresEmGramas(item);
  if (!fatores) return { quantidade: item.quantidade, cru: false, bruto: false, fc: null, fcc: null };
  const cru = diferenteDeUm(fatores.fcc);
  const bruto = diferenteDeUm(fatores.fc);
  return { quantidade: (item.quantidade / fatores.fcc) * fatores.fc, cru, bruto, fc: fatores.fc, fcc: fatores.fcc };
}

/** Todas as refeições da dieta, de todas as variações (a raiz, sem variações). Só para quem não depende do dia. */
function todasAsRefeicoes(conteudo: ConteudoDieta): Refeicao[] {
  return secoesDaDieta(conteudo).flatMap((s) => s.refeicoes);
}

/**
 * Refeições de cada seção com os dias que ela vale no período: `dias da seção × período ÷ 7` (multiplica antes de dividir:
 * sem variação são 7 dias e dá exatamente o período, 7, 14 ou 30). Variação de rascunho sem dia marcado fica de fora.
 */
function refeicoesComDias(conteudo: ConteudoDieta, periodo: PeriodoDaLista): { refeicao: Refeicao; dias: number }[] {
  return secoesDaDieta(conteudo).flatMap((s) => {
    const dias = (s.dias.length * DIAS_DO_PERIODO[periodo]) / 7;
    return dias === 0 ? [] : s.refeicoes.map((refeicao) => ({ refeicao, dias }));
  });
}

/**
 * Lista do período: soma, por alimento (mesmo `alimentoId`; item manual pelo nome sem acento) e unidade, a opção
 * escolhida de cada refeição vezes os dias (com variações, cada uma pelos dias dela na semana). Refeição sem opções e
 * item sem quantidade (ou sem nome) não entram: nada vira zero. Ordem alfabética sem acento.
 */
export function listaDeCompras(conteudo: ConteudoDieta, escolhas: EscolhasDeOpcao, periodo: PeriodoDaLista): LinhaDaLista[] {
  const linhas = new Map<string, LinhaDaLista>();
  for (const { refeicao, dias } of refeicoesComDias(conteudo, periodo)) {
    const opcao = opcaoEscolhida(refeicao, escolhas);
    for (const item of opcao?.itens ?? []) {
      const nome = item.nome.trim();
      if (!nome || !positivo(item.quantidade)) continue;
      const chave = `${item.alimentoId ? `a:${item.alimentoId}` : `n:${semAcento(nome)}`}:${item.unidade}`;
      const dia = porDia({ ...item, quantidade: item.quantidade });
      const fc = dia.fc;
      const fcc = dia.fcc;
      const cruQ = fcc !== null && diferenteDeUm(fcc) ? (item.quantidade / fcc) * dias : null;
      const naDieta = item.quantidade * dias;
      const grupo = item.grupo?.trim() || null;
      const atual = linhas.get(chave);
      if (atual) {
        atual.grupo ??= grupo;
        atual.quantidade += dia.quantidade * dias;
        atual.naDieta += naDieta;
        atual.cru ||= dia.cru;
        atual.bruto ||= dia.bruto;
        atual.semFator = atual.unidade === 'g' ? false : !atual.cru && !atual.bruto;
        atual.semConversao = atual.unidade === 'g' && !atual.cru && !atual.bruto;
        atual.fatorCorrecao = mesmoFator(atual.fatorCorrecao, fc);
        atual.fatorCoccao = mesmoFator(atual.fatorCoccao, fcc);
        atual.quantidadeCru = atual.quantidadeCru !== null && cruQ !== null ? atual.quantidadeCru + cruQ : null;
      } else {
        linhas.set(chave, {
          chave, nome, unidade: item.unidade, quantidade: dia.quantidade * dias, cru: dia.cru, bruto: dia.bruto,
          semFator: item.unidade === 'g' ? false : !dia.cru && !dia.bruto,
          semConversao: item.unidade === 'g' && !dia.cru && !dia.bruto,
          naDieta, quantidadeCru: cruQ, fatorCorrecao: fc, fatorCoccao: fcc, grupo,
        });
      }
    }
  }
  return [...linhas.values()].sort((a, b) => semAcento(a.nome).localeCompare(semAcento(b.nome)) || a.unidade.localeCompare(b.unidade));
}

/** Dois fatores só viram um número quando são o mesmo; falta ou divergência fica `null`. */
function mesmoFator(atual: number | null, novo: number | null): number | null {
  return atual !== null && novo !== null && atual === novo ? atual : null;
}

/** "Café da manhã: opção B" para cada refeição com mais de uma opção; com variações, "Carbo alto · Café da manhã: opção B". */
export function textosDasOpcoes(conteudo: ConteudoDieta, escolhas: EscolhasDeOpcao): string[] {
  return secoesDaDieta(conteudo).flatMap((s) => s.refeicoes.filter((r) => r.opcoes.length > 1).map((r) => {
    const uid = escolhas[r.uid];
    const opcao = r.opcoes.find((o) => o.uid === uid) ?? r.opcoes[0];
    return `${s.rotulo ? `${s.rotulo} · ` : ''}${r.nome || 'Refeição'}: opção ${opcao?.rotulo ?? '—'}`;
  }));
}

/** Refeições (de todas as variações) com mais de uma opção: só nelas o aluno escolhe qual entra na lista. */
export function refeicoesComEscolha(conteudo: ConteudoDieta): Refeicao[] {
  return todasAsRefeicoes(conteudo).filter((r) => r.opcoes.length > 1);
}

/** Como {@link refeicoesComEscolha}, com o nome da variação de cada uma (nulo na dieta sem variação), para a tela dizer de qual é. */
export function escolhasDaLista(conteudo: ConteudoDieta): { refeicao: Refeicao; variacao: string | null }[] {
  return secoesDaDieta(conteudo).flatMap((s) => s.refeicoes.filter((r) => r.opcoes.length > 1).map((refeicao) => ({
    refeicao,
    variacao: s.uid === null ? null : s.rotulo?.trim() || 'Variação sem nome',
  })));
}

/** Ids distintos dos alimentos da biblioteca usados na dieta (todas as variações e opções), para buscar os fatores atuais. */
export function alimentosDaDieta(conteudo: ConteudoDieta): string[] {
  const ids = new Set<string>();
  for (const r of todasAsRefeicoes(conteudo)) for (const o of r.opcoes) for (const i of o.itens) if (i.alimentoId) ids.add(i.alimentoId);
  return [...ids];
}

/**
 * Conteúdo com os fatores e o grupo da biblioteca nos itens, como a publicação faz no servidor
 * (`PlanoDietaService.paraPublicar`): item com alimento achado recebe os dois fatores e o grupo atuais; item manual ou
 * alimento não achado fica sem fator e sem grupo (nunca o que estava no item, que no rascunho não vale). Não muda o
 * conteúdo recebido.
 */
export function comFatoresDaBiblioteca(conteudo: ConteudoDieta, fatores: readonly FatoresDoAlimento[]): ConteudoDieta {
  const porId = new Map(fatores.map((f) => [f.alimentoId, f]));
  const comFatores = (refeicoes: Refeicao[]): Refeicao[] => refeicoes.map((r) => ({
    ...r,
    opcoes: r.opcoes.map((o) => ({
      ...o,
      itens: o.itens.map((i) => {
        const f = i.alimentoId ? porId.get(i.alimentoId) : undefined;
        return { ...i, fatorCorrecao: f?.fatorCorrecao ?? null, fatorCoccao: f?.fatorCoccao ?? null, grupo: f?.grupo ?? null };
      }),
    })),
  }));
  return {
    ...conteudo,
    refeicoes: comFatores(conteudo.refeicoes),
    variacoes: conteudo.variacoes.map((v) => ({ ...v, refeicoes: comFatores(v.refeicoes) })),
  };
}

/** Margem para a conta em ponto flutuante não pular um degrau (419,9999 → 420, não 430). */
const MARGEM = 1e-9;
const acima = (n: number, passo: number) => Math.ceil(n / passo - MARGEM) * passo;
const duasCasas = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * Quantidade na tela (e no PDF), arredondada **para cima** para não faltar: g e ml de 10 em 10; a partir de 1.000 vira
 * kg ou L com duas casas ("1,25 kg"); `un` no inteiro de cima.
 */
export function quantidadeParaTela(quantidade: number, unidade: UnidadeAlimento): string {
  if (unidade === 'un') return `${acima(quantidade, 1)} un`;
  const arredondada = acima(quantidade, 10);
  if (arredondada >= 1000) return `${duasCasas(arredondada / 1000)} ${unidade === 'g' ? 'kg' : 'L'}`;
  return `${arredondada} ${unidade}`;
}

/** Nota do rodapé da tela e do PDF. A mesma frase para o aluno, o treinador e os PDFs. */
export const NOTA_DA_LISTA = NOTA_DA_ESTIMATIVA;

/** Rodapé da lista na tela, pelo papel de quem vê. */
export const NOTA_DA_LISTA_ALUNO = NOTA_DA_ESTIMATIVA;
export const NOTA_DA_LISTA_TREINADOR = NOTA_DA_ESTIMATIVA;

/**
 * De onde veio o número a comprar, quando houve limpeza ou cocção.
 * Cocção e limpeza: "Na dieta: 1,05 kg pronto → ~840 g cru limpo".
 * Só cocção: "Na dieta: 1,05 kg cozido". Só limpeza: "Na dieta: 700 g limpo/descascado".
 */
export function detalheDaConversao(l: Pick<LinhaDaLista, 'unidade' | 'cru' | 'bruto' | 'naDieta' | 'quantidadeCru'>): string | null {
  if (l.unidade !== 'g' || (!l.cru && !l.bruto)) return null;
  const naDieta = quantidadeParaTela(l.naDieta, 'g');
  if (l.cru && l.bruto && l.quantidadeCru != null) {
    return `Na dieta: ${naDieta} pronto → ~${quantidadeParaTela(l.quantidadeCru, 'g')} cru limpo`;
  }
  if (l.cru) return `Na dieta: ${naDieta} cozido`;
  if (l.bruto) return `Na dieta: ${naDieta} limpo/descascado`;
  return null;
}

/** Aviso da prévia no editor do treinador (a lista do aluno sai dos fatores copiados na publicação). */
export const NOTA_DA_PREVIA = 'Prévia com os fatores atuais da biblioteca; o aluno vê os fatores que estiverem na biblioteca quando você publicar.';
