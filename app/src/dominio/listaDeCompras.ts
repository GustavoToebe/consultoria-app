import type { ConteudoDieta, FatoresDoAlimento, ItemDieta, UnidadeAlimento } from '../api/tipos';

/**
 * Lista de compras da dieta publicada (pedido do Saraiva em 17/10, R13/R14/R32), calculada no aparelho do aluno, também
 * sem internet: a versão publicada já traz os fatores de cada item (copiados da biblioteca pelo servidor ao publicar).
 * O editor do treinador mostra a mesma lista como prévia do que está na tela: como o rascunho não guarda fatores, ele
 * busca os atuais da biblioteca e os põe nos itens com `comFatoresDaBiblioteca`, a mesma regra da publicação.
 *
 * As quantidades da dieta são do alimento **como é comido** (ex.: "Arroz branco cozido" 150 g). Por item, em gramas:
 * cru = quantidade ÷ FCc (se o treinador informou o fator de cocção); a comprar = cru × FC (se informou o fator de
 * correção). Sem fator, vale a quantidade da dieta: nenhum fator é inventado nem vira 1. Os fatores só valem para `g`
 * (cozinhar ou limpar líquido em ml não tem sentido aqui) e `un` é contado como está.
 *
 * Nada aqui opina sobre a dieta: só multiplica o que o treinador escreveu pelo número de dias.
 */

export type PeriodoDaLista = 'semana' | 'mes';

/** Dias de cada período: semana = 7, mês = 30 (fixo, para a lista não mudar conforme o mês do calendário). */
export const DIAS_DO_PERIODO: Record<PeriodoDaLista, number> = { semana: 7, mes: 30 };

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
  /** Nenhum fator foi aplicado: a quantidade é a da dieta, como está. */
  semFator: boolean;
}

/** Opção que entra na lista para a refeição: a escolhida, se ainda existe; senão a primeira. */
function opcaoEscolhida(refeicao: ConteudoDieta['refeicoes'][number], escolhas: EscolhasDeOpcao) {
  const uid = escolhas[refeicao.uid];
  return refeicao.opcoes.find((o) => o.uid === uid) ?? refeicao.opcoes[0];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const positivo = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Quantidade de um item por dia, já com os fatores que existirem (só em gramas). */
function porDia(item: ItemDieta & { quantidade: number }): { quantidade: number; cru: boolean; bruto: boolean } {
  if (item.unidade !== 'g') return { quantidade: item.quantidade, cru: false, bruto: false };
  const cru = positivo(item.fatorCoccao);
  const bruto = positivo(item.fatorCorrecao);
  const semCoccao = cru ? item.quantidade / (item.fatorCoccao as number) : item.quantidade;
  return { quantidade: bruto ? semCoccao * (item.fatorCorrecao as number) : semCoccao, cru, bruto };
}

/**
 * Lista do período: soma, por alimento (mesmo `alimentoId`; item manual pelo nome sem acento) e unidade, a opção
 * escolhida de cada refeição vezes os dias. Refeição sem opções e item sem quantidade (ou sem nome) não entram: nada
 * vira zero. Ordem alfabética sem acento.
 */
export function listaDeCompras(conteudo: ConteudoDieta, escolhas: EscolhasDeOpcao, periodo: PeriodoDaLista): LinhaDaLista[] {
  const dias = DIAS_DO_PERIODO[periodo];
  const linhas = new Map<string, LinhaDaLista>();
  for (const refeicao of conteudo.refeicoes) {
    const opcao = opcaoEscolhida(refeicao, escolhas);
    for (const item of opcao?.itens ?? []) {
      const nome = item.nome.trim();
      if (!nome || !positivo(item.quantidade)) continue;
      const chave = `${item.alimentoId ? `a:${item.alimentoId}` : `n:${semAcento(nome)}`}:${item.unidade}`;
      const dia = porDia({ ...item, quantidade: item.quantidade });
      const atual = linhas.get(chave);
      if (atual) {
        atual.quantidade += dia.quantidade * dias;
        atual.cru ||= dia.cru;
        atual.bruto ||= dia.bruto;
        atual.semFator = !atual.cru && !atual.bruto;
      } else {
        linhas.set(chave, { chave, nome, unidade: item.unidade, quantidade: dia.quantidade * dias, cru: dia.cru, bruto: dia.bruto, semFator: !dia.cru && !dia.bruto });
      }
    }
  }
  return [...linhas.values()].sort((a, b) => semAcento(a.nome).localeCompare(semAcento(b.nome)) || a.unidade.localeCompare(b.unidade));
}

/** Refeições com mais de uma opção: só nelas o aluno escolhe qual entra na lista. */
export function refeicoesComEscolha(conteudo: ConteudoDieta): ConteudoDieta['refeicoes'] {
  return conteudo.refeicoes.filter((r) => r.opcoes.length > 1);
}

/** Ids distintos dos alimentos da biblioteca usados na dieta (todas as opções), para buscar os fatores atuais. */
export function alimentosDaDieta(conteudo: ConteudoDieta): string[] {
  const ids = new Set<string>();
  for (const r of conteudo.refeicoes) for (const o of r.opcoes) for (const i of o.itens) if (i.alimentoId) ids.add(i.alimentoId);
  return [...ids];
}

/**
 * Conteúdo com os fatores da biblioteca nos itens, como a publicação faz no servidor (`PlanoDietaService.paraPublicar`):
 * item com alimento achado recebe os dois fatores atuais; item manual ou alimento não achado fica sem fator (nunca o
 * que estava no item, que no rascunho não vale). Não muda o conteúdo recebido.
 */
export function comFatoresDaBiblioteca(conteudo: ConteudoDieta, fatores: readonly FatoresDoAlimento[]): ConteudoDieta {
  const porId = new Map(fatores.map((f) => [f.alimentoId, f]));
  return {
    ...conteudo,
    refeicoes: conteudo.refeicoes.map((r) => ({
      ...r,
      opcoes: r.opcoes.map((o) => ({
        ...o,
        itens: o.itens.map((i) => {
          const f = i.alimentoId ? porId.get(i.alimentoId) : undefined;
          return { ...i, fatorCorrecao: f?.fatorCorrecao ?? null, fatorCoccao: f?.fatorCoccao ?? null };
        }),
      })),
    })),
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

/** Nota do rodapé da tela e do PDF. */
export const NOTA_DA_LISTA = 'Quantidades calculadas com os fatores que o treinador cadastrou; sem fator, vale a quantidade da dieta.';

/** Aviso da prévia no editor do treinador (a lista do aluno sai dos fatores copiados na publicação). */
export const NOTA_DA_PREVIA = 'Prévia com os fatores atuais da biblioteca; o aluno vê os fatores que estiverem na biblioteca quando você publicar.';

/** "Semana (7 dias)" / "Mês (30 dias)" para o título do PDF. */
export function textoDoPeriodo(periodo: PeriodoDaLista): string {
  return periodo === 'semana' ? `Semana (${DIAS_DO_PERIODO.semana} dias)` : `Mês (${DIAS_DO_PERIODO.mes} dias)`;
}
