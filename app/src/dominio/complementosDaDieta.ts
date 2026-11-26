import type { ConteudoDieta, ItemErgogenico, Suplemento } from '../api/tipos';
import { linkExternoSeguro } from './links';
import { MAX_CUPOM } from './suplementos';

/**
 * Regras puras do cartão "Complementos" do editor de dieta (abas Orientações, Observações, Suplementação e Outros): os
 * limites que a API já impõe (`ConteudoDieta` e `ValidadorDieta`) e o problema de cada aba. Nada é sugerido nem calculado
 * sobre a dose: "Falta a dose" só avisa que o campo está vazio.
 */
export const LIMITES_DOS_COMPLEMENTOS = {
  tituloDaOrientacao: 80,
  textoDaOrientacao: 2000,
  observacoes: 8000,
  /** Nome, dose e horário do suplemento e do item de "Outros". */
  campoCurto: 120,
  observacao: 500,
  principioAtivo: 160,
  concentracao: 40,
  prescricao: 200,
} as const;

export type GravidadeDoProblema = 'perigo' | 'atencao';
export type AbaDosComplementos = 'orientacoes' | 'observacoes' | 'suplementacao' | 'outros';
export type ProblemasDosComplementos = Partial<Record<AbaDosComplementos, GravidadeDoProblema>>;

type Orientacao = ConteudoDieta['orientacoes'][number];

const vazio = (t: string | null | undefined) => (t ?? '').trim() === '';
const passa = (t: string | null | undefined, max: number) => (t ?? '').length > max;
/** O mais grave vence: perigo (a API recusa) sobre atenção (aviso que não trava). */
const pior = (a: GravidadeDoProblema | undefined, b: GravidadeDoProblema | undefined) => (a === 'perigo' || b === 'perigo' ? 'perigo' : a ?? b);

/** Orientação: texto acima do limite é recusado pela API; sem título, o aluno lê um texto sem nome (só aviso). */
export function problemaDaOrientacao(o: Orientacao): GravidadeDoProblema | undefined {
  const L = LIMITES_DOS_COMPLEMENTOS;
  if (passa(o.titulo, L.tituloDaOrientacao) || passa(o.texto, L.textoDaOrientacao)) return 'perigo';
  return vazio(o.titulo) ? 'atencao' : undefined;
}

/** Link fora da regra https e cupom acima de 40 travam a publicação; sem nome ou sem dose, só aviso. */
export function problemaDoSuplemento(s: Suplemento): GravidadeDoProblema | undefined {
  const L = LIMITES_DOS_COMPLEMENTOS;
  const link = s.link?.trim();
  if (link && !linkExternoSeguro(link)) return 'perigo';
  if ((s.cupom ?? '').trim().length > MAX_CUPOM) return 'perigo';
  if ([s.nome, s.dose, s.horario].some((t) => passa(t, L.campoCurto)) || passa(s.observacao, L.observacao)) return 'perigo';
  return vazio(s.nome) || vazio(s.dose) ? 'atencao' : undefined;
}

/** O que falta no suplemento, para o aviso da linha ("Falta o nome", "Falta a dose"); nulo quando nada. */
export function faltaNoSuplemento(s: Suplemento): string | null {
  if (vazio(s.nome)) return 'Falta o nome';
  return vazio(s.dose) ? 'Falta a dose' : null;
}

/** Item de "Outros": a linha toda em branco é ignorada pela API; com algo escrito, sem nome é recusado. */
export function problemaDoErgogenico(e: ItemErgogenico): GravidadeDoProblema | undefined {
  const L = LIMITES_DOS_COMPLEMENTOS;
  const campos = [e.nome, e.principioAtivo, e.concentracao, e.dose, e.horario, e.observacao, e.prescricao];
  if (campos.every(vazio)) return undefined;
  const longo = [e.nome, e.dose, e.horario].some((t) => passa(t, L.campoCurto)) || passa(e.principioAtivo, L.principioAtivo)
    || passa(e.concentracao, L.concentracao) || passa(e.prescricao, L.prescricao) || passa(e.observacao, L.observacao);
  return longo || vazio(e.nome) ? 'perigo' : undefined;
}

/** O problema mais grave de cada aba (o selo na própria aba); aba sem problema não aparece no resultado. */
export function problemasDosComplementos(c: Pick<ConteudoDieta, 'orientacoes' | 'observacoes' | 'suplementacao' | 'ergogenicos'>): ProblemasDosComplementos {
  const r: ProblemasDosComplementos = {};
  const juntar = (aba: AbaDosComplementos, g: GravidadeDoProblema | undefined) => {
    const v = pior(r[aba], g);
    if (v) r[aba] = v;
  };
  c.orientacoes.forEach((o) => juntar('orientacoes', problemaDaOrientacao(o)));
  if (passa(c.observacoes, LIMITES_DOS_COMPLEMENTOS.observacoes)) juntar('observacoes', 'perigo');
  c.suplementacao.forEach((s) => juntar('suplementacao', problemaDoSuplemento(s)));
  (c.ergogenicos ?? []).forEach((e) => juntar('outros', problemaDoErgogenico(e)));
  return r;
}

/**
 * Onde fica o item aberto depois de mover outro de `de` para `para` (as orientações não têm uid: a aberta segue o item,
 * não a posição). `null` continua `null`.
 */
export function abertaDepoisDeMover(aberta: number | null, de: number, para: number): number | null {
  if (aberta === null || de === para) return aberta;
  if (aberta === de) return para;
  if (de < aberta && para >= aberta) return aberta - 1;
  if (de > aberta && para <= aberta) return aberta + 1;
  return aberta;
}

/** Onde fica o item aberto depois de remover o de `removido`: o próprio removido fecha. */
export function abertaDepoisDeRemover(aberta: number | null, removido: number): number | null {
  if (aberta === null || aberta === removido) return null;
  return aberta > removido ? aberta - 1 : aberta;
}

/** Contagem da aba: sem item, a aba fica sem número (o padrão do `Abas`). */
export const contagemDaAba = (n: number): number | undefined => (n > 0 ? n : undefined);

/**
 * Linhas do campo do nome do suplemento: duas por padrão e mais quando o nome não cabe, para nunca ficar cortado (o
 * campo do app não cresce sozinho). Conta por caracteres numa largura média folgada da fonte de 16 px (9 px por
 * caractere, vezes o "Tamanho do texto"), descontado o recuo interno do campo; sem medida ainda, duas.
 */
export function linhasDoNome(nome: string, larguraDoCampo: number, fatorDoTexto = 1): number {
  const util = larguraDoCampo - 28;
  if (util <= 0) return 2;
  const porLinha = Math.max(1, Math.floor(util / (9 * fatorDoTexto)));
  return Math.max(2, Math.ceil(nome.length / porLinha));
}

/** Nome do suplemento numa linha só: o campo quebra em duas linhas, mas Enter não pode gravar uma quebra no nome. */
export const nomeSemQuebra = (t: string) => t.replace(/[\r\n]+/g, ' ');
