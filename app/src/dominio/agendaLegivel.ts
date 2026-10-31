import type { Compromisso } from '../api/agendaTipos';
import { contraste } from '../tema/tokens';
import { resumoDosParticipantes } from './agendaPresencial';

/**
 * Legibilidade dos itens da agenda (reunião de 30/10 com o Saraiva: "a cor ocupa pouco do evento"). A cor da agenda
 * aparece numa faixa de 8 px à esquerda e num fundo levemente tingido; o texto do item é sempre a cor `texto` do tema,
 * nunca a cor da agenda, e o status vai escrito (selo) ou, no bloco que não cabe, em ícone com o nome acessível.
 */

/** Largura da faixa da cor da agenda, à esquerda do item (antes eram 4 px). */
export const LARGURA_DA_FAIXA = 8;
/** Quanto da cor da agenda entra no fundo do item (0 = só o fundo do tema). Baixa se o contraste pedir. */
export const PROPORCAO_DO_TINGIDO = 0.16;
/** Texto ≥ 4,5:1 (WCAG 1.4.3); faixa e ícones ≥ 3:1 (WCAG 1.4.11). */
export const CONTRASTE_DO_TEXTO = 4.5;
export const CONTRASTE_DO_GRAFICO = 3;

const HEX = /^#[0-9a-f]{6}$/i;

/** Mistura `base` com `cor` na proporção `t` (0 = base, 1 = cor), canal a canal, em #RRGGBB. */
export function misturarCores(base: string, cor: string, t: number): string {
  const a = parseInt(base.slice(1), 16);
  const b = parseInt(cor.slice(1), 16);
  const canal = (desl: number) => Math.round(((a >> desl) & 255) * (1 - t) + ((b >> desl) & 255) * t);
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

export interface PedidoDeFundo {
  /** A cor da agenda no tema em uso (a do treinador ou a fixa de compromissos e atualizações). */
  cor: string;
  /** O fundo do item sem tinta (`superficie2` em repouso, `superficie3` no hover). */
  base: string;
  /** Cores de texto desenhadas direto sobre o fundo (título e horário): todas ficam ≥ 4,5:1. */
  textos: readonly string[];
  /** Outros gráficos desenhados direto sobre o fundo (ícone de status): ficam ≥ 3:1, como a faixa. */
  graficos?: readonly string[];
  proporcao?: number;
}

/**
 * Fundo do item da agenda: `base` tingido com a cor da agenda, na maior proporção (até {@link PROPORCAO_DO_TINGIDO}) em
 * que todo texto continua ≥ 4,5:1 e a faixa (e os ícones) ≥ 3:1 sobre ele. A cor vem da agenda que o treinador escolheu,
 * então a proporção é calculada, não presumida; se nenhuma passar, o fundo fica o do tema. Cor inválida = `base`.
 */
export function fundoDoItemDaAgenda({ cor, base, textos, graficos = [], proporcao = PROPORCAO_DO_TINGIDO }: PedidoDeFundo): string {
  if (!HEX.test(cor) || !HEX.test(base)) return base;
  // A faixa só é exigida quando já passava sobre o fundo sem tinta (tingir nunca melhora o contraste dela).
  const faixaExigida = contraste(cor, base) >= CONTRASTE_DO_GRAFICO;
  const passa = (fundo: string) => textos.every((t) => contraste(t, fundo) >= CONTRASTE_DO_TEXTO)
    && graficos.every((g) => contraste(g, fundo) >= CONTRASTE_DO_GRAFICO)
    && (!faixaExigida || contraste(cor, fundo) >= CONTRASTE_DO_GRAFICO);
  for (let passo = Math.round(Math.max(0, Math.min(1, proporcao)) * 100); passo > 0; passo -= 1) {
    const fundo = misturarCores(base, cor, passo / 100);
    if (passa(fundo)) return fundo;
  }
  return base;
}

/**
 * O status do compromisso no fim do nome acessível (", cancelado", ", realizado", ", 2 de 3 realizados · 1 faltou"). Vazio
 * quando todos ainda estão agendados: o nome continua o de antes ("Abrir compromisso de Ana, 09:00").
 */
export function statusNoRotuloDoCompromisso(c: Pick<Compromisso, 'cancelado' | 'participantes'>): string {
  if (!c.cancelado && c.participantes.every((p) => p.situacao === 'AGENDADO')) return '';
  const resumo = resumoDosParticipantes(c);
  return `, ${resumo.charAt(0).toLowerCase()}${resumo.slice(1)}`;
}

/** Como o bloco da grade se arranja na altura e na largura que tem. */
export interface ArranjoDoBloco {
  /** Horário numa linha própria embaixo do título; senão, uma linha só "09:00 Título". */
  horarioSeparado: boolean;
  linhasDoTitulo: 1 | 2;
  /** `selo` escrito, `icone` (o status vai no nome acessível e na folha) ou nada (evento sem status). */
  status: 'selo' | 'icone' | null;
}

/**
 * Largura mínima do bloco (com a faixa de 8 px) para o selo curto ("Cancelado", "Realizado") caber numa linha com o ícone,
 * sem cortar; cresce junto com o tamanho do texto.
 */
export const LARGURA_PARA_SELO = 124;
/** Na faixa de dia inteiro o selo fica ao lado do título ("Atrasada há 12 dias"): só a partir desta largura. */
export const LARGURA_PARA_SELO_AO_LADO = 260;
/** Bordas (1 + 1), respiro do lugar (1 + 1) e do bloco (2 + 2): o que sobra para o texto é a altura menos isso. */
const MOLDURA_DO_BLOCO = 8;
const ESPACO = 2;

/**
 * Arranjo do bloco pela altura e largura medidas e pela altura de linha do texto (16 px, vezes o tamanho do texto que a
 * pessoa escolheu): só entra o que cabe inteiro, para nada ser cortado pela borda sem reticências. O selo tem a altura
 * da linha mais 6 px (respiro e borda). Largura 0 (antes de medir) = ícone.
 */
export function arranjoDoBloco(altura: number, largura: number, temStatus: boolean, linha = 16): ArranjoDoBloco {
  const util = altura - MOLDURA_DO_BLOCO;
  const selo = linha + 6;
  const horarioSeparado = util >= 2 * linha + ESPACO;
  if (!horarioSeparado) return { horarioSeparado, linhasDoTitulo: 1, status: temStatus ? 'icone' : null };
  const cabeSelo = temStatus && largura >= (LARGURA_PARA_SELO * linha) / 16 && util >= 2 * linha + selo + 2 * ESPACO;
  const resto = util - (cabeSelo ? selo + ESPACO : 0);
  const linhasDoTitulo = resto >= 3 * linha + 2 * ESPACO ? 2 : 1;
  return { horarioSeparado, linhasDoTitulo, status: temStatus ? (cabeSelo ? 'selo' : 'icone') : null };
}

/**
 * Item de dia inteiro (uma linha de 44 px): o selo vai ao lado do título quando a largura medida deixa (o Dia, no PC); na
 * Semana, a coluna é estreita e o status fica no ícone antes do título (e escrito no nome acessível e na ficha).
 */
export function statusNoDiaInteiro(largura: number, temStatus: boolean, linha = 16): 'selo' | 'icone' | null {
  if (!temStatus) return null;
  return largura >= (LARGURA_PARA_SELO_AO_LADO * linha) / 16 ? 'selo' : 'icone';
}
