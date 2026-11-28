import type { Alimento, ConteudoDieta, ItemDieta, OpcaoRefeicao, Refeicao, UnidadeAlimento, VariacaoDaDieta } from '../api/tipos';
import { numeroParaTela } from './formatos';
import { moverPara } from './reordenar';
import { novoUid } from './uid';

/**
 * Contas da dieta: o valor do item vem do alimento da biblioteca proporcional à quantidade, calculado ao
 * editar e gravado no item (a versão publicada não recalcula). Sem dado para calcular, o valor fica vazio ("—"):
 * nunca inventar valor nutricional.
 */

export type Macro = 'kcal' | 'proteina' | 'carboidrato' | 'gordura';
export const MACROS: Macro[] = ['kcal', 'proteina', 'carboidrato', 'gordura'];

export type Totais = Record<Macro, number | null>;

/**
 * Totais com a fibra (V089). A fibra não é um `Macro` (não entra na kcal nem nos três macros coloridos); soma só os itens
 * COM fibra. `fibra` é `null` ("—") quando nenhum item tem; `fibraCompleta` só é `true` com total não nulo e nenhum item sem
 * fibra: com `false` e total não nulo a soma é parcial e a tela deve dizer ("a partir de", asterisco ou similar).
 */
export interface TotaisComFibra extends Totais {
  fibra: number | null;
  fibraCompleta: boolean;
}

/** Faixa da fibra aceita pelo servidor (`BibliotecaService.exigirFibraNaFaixa`): 0 a 99999, até 2 casas. */
export const FIBRA_MAXIMA = 99999;
export const MENSAGEM_FIBRA_FORA_DA_FAIXA = 'Use de 0 a 99.999, com até 2 casas.';

/** Vazio (nulo) é permitido; preenchida, fica na faixa e com no máximo 2 casas decimais. */
export function fibraValida(fibra: number | null | undefined): boolean {
  if (fibra == null) return true;
  return Number.isFinite(fibra) && fibra >= 0 && fibra <= FIBRA_MAXIMA && Math.abs(Math.round(fibra * 100) - fibra * 100) < 1e-6;
}

/** Mensagem do campo "Fibras (g)" do formulário do alimento; `null` quando está válida (ou vazia). */
export function erroDaFibra(fibra: number | null | undefined): string | null {
  return fibraValida(fibra) ? null : MENSAGEM_FIBRA_FORA_DA_FAIXA;
}

/** Quantidade do item na unidade-base do alimento; `null` se não há como converter (ex.: "un" sem gramas). */
export function quantidadeNaBase(alimento: Alimento, quantidade: number, unidade: UnidadeAlimento): number | null {
  if (unidade === alimento.baseUnidade) return quantidade;
  const porUnidade = alimento.gramasPorUnidade;
  if (!porUnidade) return null;
  if (unidade === 'un' && alimento.baseUnidade === 'g') return quantidade * porUnidade;
  if (unidade === 'g' && alimento.baseUnidade === 'un') return quantidade / porUnidade;
  return null;
}

/** Item da biblioteca cuja unidade não converte para a base do alimento (o valor fica "—"): o editor avisa o que falta. */
export function semConversao(item: ItemDieta, alimento: Alimento | undefined): boolean {
  return !item.manual && !!alimento && quantidadeNaBase(alimento, 1, item.unidade) === null;
}

const arredondar = (n: number) => Math.round(n * 1000) / 1000;

/** Item recalculado a partir do alimento (não mexe em item manual). */
export function recalcularItem(item: ItemDieta, alimento: Alimento | undefined): ItemDieta {
  if (item.manual || !alimento) return item;
  const base = item.quantidade && item.quantidade > 0 ? quantidadeNaBase(alimento, item.quantidade, item.unidade) : null;
  const fator = base === null || !alimento.baseQuantidade ? null : base / alimento.baseQuantidade;
  const valor = (v: number | null | undefined) =>
    (fator === null || v === null || v === undefined ? null : arredondar(v * fator));
  return {
    ...item,
    kcal: valor(alimento.kcal),
    proteina: valor(alimento.proteina),
    carboidrato: valor(alimento.carboidrato),
    gordura: valor(alimento.gordura),
    fibra: valor(alimento.fibra),
  };
}

/**
 * "Trocar alimento" (C56): o item passa a ser do `alimento`, no mesmo lugar, com a mesma quantidade e unidade, e os
 * valores são recalculados por ele. A unidade que não converte para a base do novo alimento deixa o valor "—" (decisão 5
 * do plano `dieta-pronta-para-comecar`). Os fatores eram do alimento anterior: o servidor regrava os do novo ao publicar.
 */
export function trocarAlimento(item: ItemDieta, alimento: Alimento): ItemDieta {
  return recalcularItem({ ...item, alimentoId: alimento.id, nome: alimento.nome, manual: false, fatorCorrecao: null, fatorCoccao: null }, alimento);
}

/** Troca o alimento do item `uid` onde ele estiver (refeição e opção), sem mexer na ordem nem nos outros itens. */
export function trocarAlimentoNasRefeicoes(refeicoes: Refeicao[], uid: string, alimento: Alimento): Refeicao[] {
  return refeicoes.map((r) => ({
    ...r,
    opcoes: r.opcoes.map((o) => (o.itens.some((i) => i.uid === uid) ? { ...o, itens: o.itens.map((i) => (i.uid === uid ? trocarAlimento(i, alimento) : i)) } : o)),
  }));
}

/** Soma os valores sem arredondar (arredonda só na tela). Algum item sem valor → aquele total fica `null`. */
export function somar(itens: ItemDieta[]): TotaisComFibra {
  const totais: Totais = { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0 };
  let fibra: number | null = null;
  let semFibra = false;
  for (const item of itens) {
    for (const m of MACROS) {
      const atual = totais[m];
      const valor = item[m];
      totais[m] = atual === null || valor === null || valor === undefined ? null : atual + valor;
    }
    // Fibra é o oposto dos macros: item sem fibra não anula o total, só o marca como parcial.
    if (item.fibra === null || item.fibra === undefined) semFibra = true;
    else fibra = (fibra ?? 0) + item.fibra;
  }
  return { ...totais, fibra, fibraCompleta: fibra !== null && !semFibra };
}

/**
 * Total do dia = primeira opção de cada refeição (nunca somar alternativas como se todas fossem consumidas), por variação:
 * recebe as refeições do dia (`refeicoesDoDia`). shortcut: ainda aceita o conteúdo (soma só a raiz, que com variações é
 * vazia) para não quebrar os chamadores de tela/PDF/modelos que outros passos migram; trocar para só `Refeicao[]` no passo 5.
 */
export function totalDoDia(fonte: Refeicao[] | ConteudoDieta): TotaisComFibra {
  const refeicoes = Array.isArray(fonte) ? fonte : fonte.refeicoes;
  return somar(refeicoes.flatMap((r) => r.opcoes[0]?.itens ?? []));
}

/**
 * Algum item da dieta inteira (raiz e todas as variações, todas as opções) tem fibra (0 conta; nula ou ausente, não). Sem
 * nenhum, a dieta do aluno não fala de fibra (nem "Fibra —", nem na legenda; Gustavo, 28/11); com algum, "Fibra —" nos que
 * não têm. Olha a dieta inteira para trocar de variação não fazer a fibra aparecer e sumir.
 */
export function algumItemComFibra(c: Pick<ConteudoDieta, 'refeicoes' | 'variacoes'>): boolean {
  return [c.refeicoes, ...c.variacoes.map((v) => v.refeicoes)]
    .some((rs) => rs.some((r) => r.opcoes.some((o) => o.itens.some((i) => i.fibra !== null && i.fibra !== undefined))));
}

/** Uma linha do "Por refeição" do Total do dia: a kcal da opção A e a fração do dia (0 a 1); `null` = sem valor ou sem base. */
export interface KcalDaRefeicao { uid: string; kcal: number | null; fracao: number | null }

/**
 * Kcal de cada refeição na ordem do dia, só a opção A (como o total). A fração é sobre o total do dia; sem total (algum
 * item sem kcal, que o deixa "—") ou com total 0, nenhuma refeição tem fração: a barra fica vazia, nunca inventada.
 */
export function kcalPorRefeicao(refeicoes: Refeicao[]): KcalDaRefeicao[] {
  const linhas = refeicoes.map((r) => ({ uid: r.uid, kcal: somar(r.opcoes[0]?.itens ?? []).kcal }));
  const total = totalDoDia(refeicoes).kcal;
  return linhas.map((l) => ({ ...l, fracao: total && l.kcal !== null ? l.kcal / total : null }));
}

const LETRAS = 'ABCDEF';

export function novaOpcao(existentes: OpcaoRefeicao[]): OpcaoRefeicao {
  const usadas = new Set(existentes.map((o) => o.rotulo));
  const rotulo = [...LETRAS].find((l) => !usadas.has(l)) ?? String(existentes.length + 1);
  return { uid: novoUid(), rotulo, itens: [] };
}

/** A letra de cada posição: a primeira é sempre a "Opção A" (a que conta no total do dia); depois de F, o número. */
export const letraDaPosicao = (i: number) => LETRAS[i] ?? String(i + 1);

/**
 * Rótulo padrão = o que `novaOpcao` e `letraDaPosicao` geram (uma letra A-F ou um número; vazio também, que volta a ser
 * padrão). Qualquer outro texto ("Opção Principal", que a importação assistida grava) é personalizado e nunca é reescrito.
 */
export const ehRotuloPadrao = (rotulo: string) => /^(?:[A-F]|\d+)?$/.test(rotulo.trim());

/** "Opção B" para o rótulo padrão; o personalizado fica como foi escrito ("Opção Principal"). */
export const nomeDaOpcao = (rotulo: string) => (ehRotuloPadrao(rotulo) ? `Opção ${rotulo.trim()}` : rotulo.trim());

/** O personalizado sem o "Opção " do começo ("Principal"), para frases como "Principal agora conta no total do dia.". */
const nomeCurtoDaOpcao = (rotulo: string) => rotulo.trim().replace(/^Opção\s+(?=\S)/i, '');

/** "opção A" ou "opção Principal", para o meio de uma frase ("Total da opção A", "Mais ações da opção A"). */
export const opcaoNaFrase = (rotulo: string) => `opção ${ehRotuloPadrao(rotulo) ? rotulo.trim() : nomeCurtoDaOpcao(rotulo)}`;

/** "Total da opção A" para o rótulo padrão; "Total · Opção Principal" para o personalizado (aluno, PDF e lista de compras). */
export const totalDaOpcao = (rotulo: string) => (ehRotuloPadrao(rotulo) ? `Total da opção ${rotulo.trim()}`.trim() : `Total · ${rotulo.trim()}`);

/**
 * Como as frases do total do dia chamam a primeira opção de cada refeição (a que entra na soma), que pode ter rótulo
 * diferente por refeição. Todas padrão (ou vazias, ou nenhuma refeição) = `padrao` com "opção A" ("Soma da opção A de cada
 * refeição"); todas com o mesmo rótulo personalizado = o rótulo como escrito ("Soma · Principal de cada refeição"); mistura
 * (personalizados diferentes, ou personalizado com padrão) = "primeira opção". Refeição sem opção não conta.
 */
export function opcaoDoTotalDoDia(refeicoes: Refeicao[]): { padrao: boolean; nome: string } {
  const rotulos = refeicoes.filter((r) => r.opcoes.length > 0).map((r) => r.opcoes[0].rotulo.trim());
  if (rotulos.every(ehRotuloPadrao)) return { padrao: true, nome: 'opção A' };
  const todasIguais = rotulos.every((r) => r === rotulos[0]);
  return { padrao: false, nome: todasIguais ? rotulos[0] : 'primeira opção' };
}

/** A descrição do "Total do dia" no editor, com as mesmas regras do aluno e do PDF ("Soma só a opção A…", "Soma só · Principal…"). */
export function descricaoDoTotalDoDia(refeicoes: Refeicao[]): string {
  const { padrao, nome } = opcaoDoTotalDoDia(refeicoes);
  return `${padrao ? `Soma só a ${nome}` : `Soma só · ${nome}`} de cada refeição: as outras opções substituem a refeição e não entram no total.`;
}

/**
 * A letra segue a posição (26/11) só nas opções de rótulo padrão: o `rotulo` é gravado no plano e o aluno, o PDF e o
 * "Escolha uma das opções" o leem, então reordenar grava as letras novas. O personalizado se mantém (e a posição 1 segue
 * sendo a do total do dia). Quem já está com a letra certa continua a mesma instância.
 */
export function reletrarOpcoes(opcoes: OpcaoRefeicao[]): OpcaoRefeicao[] {
  return opcoes.map((o, i) => (!ehRotuloPadrao(o.rotulo) || o.rotulo === letraDaPosicao(i) ? o : { ...o, rotulo: letraDaPosicao(i) }));
}

export interface OpcaoMovida {
  /** As opções na ordem nova, já com as letras pela posição (as de rótulo personalizado ficam como estavam). */
  opcoes: OpcaoRefeicao[];
  uid: string;
  /** O rótulo que a opção movida tinha e o que ficou (iguais quando é personalizado). */
  letraAntes: string;
  letraDepois: string;
  /** Posição nova, de 0. */
  para: number;
  /** A primeira mudou (outra opção passou a contar no total do dia): o rótulo que a nova primeira tinha antes. */
  novaPrimeira: string | null;
}

/**
 * Leva a opção `de` para `para` (arrastar a aba ou a linha da comparação, "Mover para a esquerda/direita" e "Tornar Opção
 * A" no ⋯) e reletra pela posição. Nulo quando nada muda. `novaPrimeira` vale também quando a A sai do primeiro lugar.
 */
export function moverOpcao(opcoes: OpcaoRefeicao[], de: number, para: number): OpcaoMovida | null {
  const novas = moverPara(opcoes, de, para);
  if (novas === opcoes) return null;
  const opcoesNovas = reletrarOpcoes(novas);
  const primeira = opcoes.find((o) => o.uid === novas[0].uid);
  return {
    opcoes: opcoesNovas,
    uid: opcoes[de].uid,
    letraAntes: opcoes[de].rotulo,
    letraDepois: opcoesNovas[para].rotulo,
    para,
    novaPrimeira: novas[0].uid === opcoes[0].uid ? null : primeira?.rotulo ?? null,
  };
}

/** O aviso (com Desfazer) quando outra opção passa a ser a primeira. */
export const avisoDaNovaOpcaoA = (rotuloAntes: string) => (ehRotuloPadrao(rotuloAntes)
  ? `Opção ${rotuloAntes.trim()} agora é a Opção A e conta no total do dia.`
  : `${nomeCurtoDaOpcao(rotuloAntes)} agora conta no total do dia.`);

/** O que o leitor de tela ouve depois de mover pelo ⋯ (a região viva): a posição nova e, no padrão, a letra que ela dá. */
export function anuncioDaOpcaoMovida(m: Pick<OpcaoMovida, 'letraAntes' | 'letraDepois' | 'para'>): string {
  const posicao = `movida para a posição ${m.para + 1}`;
  if (!ehRotuloPadrao(m.letraAntes)) return `${nomeCurtoDaOpcao(m.letraAntes)} ${posicao}.`;
  return `Opção ${m.letraAntes.trim()} ${posicao}${m.letraAntes === m.letraDepois ? '' : `: agora é a Opção ${m.letraDepois}`}.`;
}

/**
 * O Desfazer da ordem: volta as opções de agora à ordem e às letras de antes, pelo uid, sem tocar nos itens (o que foi
 * digitado depois de mover fica). A opção criada depois vai para o fim; a excluída depois não volta.
 */
export function restaurarOrdemDasOpcoes(atuais: OpcaoRefeicao[], antes: readonly Pick<OpcaoRefeicao, 'uid' | 'rotulo'>[]): OpcaoRefeicao[] {
  const porUid = new Map(atuais.map((o) => [o.uid, o]));
  const voltam = antes.flatMap(({ uid, rotulo }) => {
    const o = porUid.get(uid);
    return o ? [o.rotulo === rotulo ? o : { ...o, rotulo }] : [];
  });
  const novas = atuais.filter((o) => !antes.some((a) => a.uid === o.uid));
  return [...voltam, ...novas];
}

export function novaRefeicao(nome = ''): Refeicao {
  return { uid: novoUid(), nome, horario: null, observacao: null, opcoes: [novaOpcao([])], modoDePreparo: null };
}

/**
 * Nome de refeição vazio (ou só espaços) vira "Refeição N", com N = posição + 1 (o mesmo texto de `tituloDaRefeicao`), para
 * a publicação não recusar "Refeição sem nome". Devolve o próprio conteúdo quando todos os nomes já existem.
 */
export function comNomesPadrao(conteudo: ConteudoDieta): ConteudoDieta {
  const comNomes = (refeicoes: Refeicao[]) => (refeicoes.every((r) => r.nome.trim() !== '')
    ? refeicoes
    : refeicoes.map((r, i) => (r.nome.trim() !== '' ? r : { ...r, nome: `Refeição ${i + 1}` })));
  const refeicoes = comNomes(conteudo.refeicoes);
  const variacoes = conteudo.variacoes.map((v) => {
    const r = comNomes(v.refeicoes);
    return r === v.refeicoes ? v : { ...v, refeicoes: r };
  });
  if (refeicoes === conteudo.refeicoes && variacoes.every((v, i) => v === conteudo.variacoes[i])) return conteudo;
  return { ...conteudo, refeicoes, variacoes };
}

export function novoItem(alimento?: Alimento): ItemDieta {
  if (!alimento) {
    return {
      uid: novoUid(),
      alimentoId: null,
      nome: '',
      quantidade: null,
      unidade: 'g',
      kcal: null,
      proteina: null,
      carboidrato: null,
      gordura: null,
      fibra: null,
      manual: true,
    };
  }
  return recalcularItem(
    {
      uid: novoUid(),
      alimentoId: alimento.id,
      nome: alimento.nome,
      quantidade: alimento.baseQuantidade,
      unidade: alimento.baseUnidade ?? 'g',
      kcal: null,
      proteina: null,
      carboidrato: null,
      gordura: null,
      fibra: null,
      manual: false,
    },
    alimento,
  );
}

/** Lista de objetos do JSON de fora: ausente, nulo ou não-lista vira `[]`; elemento que não é objeto some (offline não quebra). */
function objetosDe<T>(v: unknown): T[] {
  return Array.isArray(v) ? v.filter((x): x is T => !!x && typeof x === 'object') : [];
}

function normalizarRefeicoes(refeicoes: unknown): Refeicao[] {
  return objetosDe<Partial<Refeicao>>(refeicoes).map((r) => ({
    uid: r.uid ?? novoUid(),
    nome: r.nome ?? '',
    horario: r.horario ?? null,
    observacao: r.observacao ?? null,
    modoDePreparo: r.modoDePreparo ?? null,
    opcoes: (r.opcoes ?? []).map((o) => ({
      uid: o.uid ?? novoUid(),
      rotulo: o.rotulo ?? '',
      itens: (o.itens ?? []).map((i) => ({
        uid: i.uid ?? novoUid(),
        alimentoId: i.alimentoId ?? null,
        nome: i.nome ?? '',
        quantidade: i.quantidade ?? null,
        unidade: i.unidade ?? 'g',
        kcal: i.kcal ?? null,
        proteina: i.proteina ?? null,
        carboidrato: i.carboidrato ?? null,
        gordura: i.gordura ?? null,
        fibra: i.fibra ?? null,
        manual: i.manual ?? i.alimentoId == null,
        fatorCorrecao: i.fatorCorrecao ?? null,
        fatorCoccao: i.fatorCoccao ?? null,
        grupo: i.grupo ?? null,
      })),
    })),
  }));
}

/** Dias da variação: só inteiros de 1 a 7, sem repetir, em ordem (dia fora da faixa some; o publicar do servidor cobra a cobertura). */
function normalizarDias(dias: unknown): number[] {
  if (!Array.isArray(dias)) return [];
  return [...new Set(dias.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
}

function normalizarVariacoes(variacoes: unknown): VariacaoDaDieta[] {
  return objetosDe<Partial<VariacaoDaDieta>>(variacoes).map((v) => ({
    uid: v.uid ?? novoUid(),
    rotulo: v.rotulo ?? '',
    dias: normalizarDias(v.dias),
    refeicoes: normalizarRefeicoes(v.refeicoes),
  }));
}

export function normalizarDieta(conteudo: unknown): ConteudoDieta {
  const c = (conteudo ?? {}) as Partial<ConteudoDieta>;
  return {
    objetivo: c.objetivo ?? null,
    dataInicio: c.dataInicio ?? null,
    profissional: c.profissional ?? null,
    refeicoes: normalizarRefeicoes(c.refeicoes),
    variacoes: normalizarVariacoes(c.variacoes),
    orientacoes: (c.orientacoes ?? []).map((o) => ({ titulo: o.titulo ?? '', texto: o.texto ?? '' })),
    observacoes: c.observacoes ?? null,
    aguaLitros: c.aguaLitros ?? null,
    suplementacao: (c.suplementacao ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      nome: s.nome ?? '',
      dose: s.dose ?? '',
      horario: s.horario ?? '',
      observacao: s.observacao ?? '',
      link: s.link ?? null,
      cupom: s.cupom ?? null,
    })),
    // Nulo é "sem acesso" (a API não manda): continua nulo, para o editor não criar uma lista que apagaria a real.
    ergogenicos: c.ergogenicos
      ? c.ergogenicos.map((e) => ({
          uid: e.uid ?? novoUid(),
          nome: e.nome ?? '',
          principioAtivo: e.principioAtivo ?? '',
          concentracao: e.concentracao ?? '',
          dose: e.dose ?? '',
          horario: e.horario ?? '',
          observacao: e.observacao ?? '',
          prescricao: e.prescricao ?? '',
        }))
      : null,
  };
}

/** Cópia das refeições com uid novo em cada refeição, opção e item (copiar nunca repete identificador). */
export function comUidsNovos(refeicoes: Refeicao[]): Refeicao[] {
  return refeicoes.map((r) => ({
    ...r,
    uid: novoUid(),
    opcoes: r.opcoes.map((o) => ({ ...o, uid: novoUid(), itens: o.itens.map((i) => ({ ...i, uid: novoUid() })) })),
  }));
}

/**
 * Receita de dieta: troca as refeições **e** as variações pelas da receita (uids novos); o resto do plano fica. Trocar só
 * a raiz deixaria raiz e variações juntas, estado que o servidor recusa.
 */
export function aplicarReceitaDeDieta(atual: ConteudoDieta, receita: unknown): ConteudoDieta {
  const daReceita = normalizarDieta(receita);
  return {
    ...atual,
    refeicoes: comUidsNovos(daReceita.refeicoes),
    variacoes: daReceita.variacoes.map((v) => ({ ...v, uid: novoUid(), refeicoes: comUidsNovos(v.refeicoes) })),
  };
}

/** Limite do modo de preparo da refeição (o mesmo de `ConteudoDieta.MODO_DE_PREPARO_MAXIMO` no servidor). */
export const MODO_DE_PREPARO_MAXIMO = 2000;

/** Vazio é válido (não aparece); preenchido, até {@link MODO_DE_PREPARO_MAXIMO} caracteres, como o `ValidadorDieta`. */
export function modoDePreparoValido(texto: string | null | undefined): boolean {
  return (texto ?? '').length <= MODO_DE_PREPARO_MAXIMO;
}

/** Texto do modo de preparo para mostrar, ou `null` quando só há espaços (nada aparece). Quebras de linha ficam. */
export function modoDePreparoParaMostrar(texto: string | null | undefined): string | null {
  return texto && texto.trim() ? texto : null;
}

/** Faixa da água por dia aceita pelo servidor (`ValidadorDieta`): de 0,1 a 20 L, no máximo uma casa decimal. */
export const AGUA_MINIMA = 0.1;
export const AGUA_MAXIMA = 20;

/** Água vazia é válida (não aparece); preenchida, fica na faixa e com uma casa decimal no máximo. */
export function aguaValida(litros: number | null): boolean {
  if (litros == null) return true;
  return litros >= AGUA_MINIMA && litros <= AGUA_MAXIMA && Math.abs(Math.round(litros * 10) - litros * 10) < 1e-9;
}

/** "3,5 L por dia" (o número que o treinador escreveu); sem água, `null` e nada aparece. */
export function textoDaAgua(litros: number | null | undefined): string | null {
  if (litros == null) return null;
  return `${numeroParaTela(litros, 1)} L por dia`;
}

/** Item da opção A que deixa o total do dia incompleto (algum valor vazio): onde ele está, para o editor levar até lá. */
export interface ItemSemValor {
  refeicaoUid: string;
  itemUid: string;
  nome: string;
}

/**
 * Itens que fazem o "Total do dia" ficar "—": só a opção A de cada refeição entra no total (`totalDoDia`), então só ela
 * é conferida. O editor diz quantos são e leva ao primeiro, em vez de mostrar "— g de proteína" sem explicar.
 */
export function itensSemValorNoTotal(fonte: Refeicao[] | ConteudoDieta): ItemSemValor[] {
  const refeicoes = Array.isArray(fonte) ? fonte : fonte.refeicoes;
  return refeicoes.flatMap((r) => (r.opcoes[0]?.itens ?? [])
    .filter((i) => MACROS.some((m) => i[m] === null || i[m] === undefined))
    .map((i) => ({ refeicaoUid: r.uid, itemUid: i.uid, nome: i.nome })));
}

/** "Proteína 180,2 g"; sem valor, só "Proteína —" (valor ausente não leva unidade). */
export function textoDoMacro(rotulo: string, valor: number | null, unidade: string, casas = 1): string {
  return valor === null ? `${rotulo} —` : `${rotulo} ${numeroParaTela(valor, casas)} ${unidade}`;
}

/** "1 item sem valor nutricional completo" / "3 itens …". */
export function textoItensSemValor(n: number): string {
  return `${n} ${n === 1 ? 'item' : 'itens'} da opção A sem kcal, proteína, carboidrato ou gordura`;
}

/**
 * "Escolha uma das opções: A ou B." / "…: A, B ou C." para o aluno ver que são alternativas, não itens somados.
 * Uma opção só não pede escolha (`null`). Nunca fala em "equivalente": o sistema não compara as opções.
 */
export function textoEscolhaDasOpcoes(rotulos: string[]): string | null {
  const nomes = rotulos.map((r, i) => (ehRotuloPadrao(r) ? r.trim() || String(i + 1) : nomeCurtoDaOpcao(r)));
  if (nomes.length < 2) return null;
  const lista = `${nomes.slice(0, -1).join(', ')} ou ${nomes[nomes.length - 1]}`;
  return `Escolha uma das opções: ${lista}.`;
}
