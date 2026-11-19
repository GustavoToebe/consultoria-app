import { tamanhoDoBloco, type BlocoDoPainelId, type PainelDoInicioPreferido } from '../../dominio/painelBlocos';
import { faixaDeLargura, type FaixaDeLargura } from '../../tema/tokens';

/** Espaço entre os blocos (o `gap` da linha no Início). */
const ESPACO = 16;
/** O que o título do bloco reserva antes de dividir a linha com as ações (cresce com o texto ampliado). */
const TITULO = 120;
/** Os três ícones (abrir, atualizar, filtro: 44 px cada, 2 entre eles) e o vão até o título. */
const ACOES = 3 * 44 + 2 * 2 + 8;
/** Recuo da faixa no PC (20 de cada lado) e a borda do cartão. */
const MOLDURA = 2 * 20 + 2;

/** Largura que o título reserva na faixa do bloco: abaixo dela as ações descem juntas para uma segunda linha. */
export function larguraDoTitulo(fatorTexto = 1): number {
  return Math.round(TITULO * fatorTexto);
}

const MAXIMO_DE_COLUNAS: Record<FaixaDeLargura, number> = {
  compacta: 3,
  normal: 4,
  larga: 5,
  ultralarga: 6,
};

/**
 * Quantas colunas cabem na largura medida do painel (que já desconta o menu aberto ou recolhido): de 1 (celular) até
 * 6 na faixa `ultralarga` (3 em `compacta`, 4 em `normal`, 5 em `larga`, 6 em `ultralarga`). A coluna mínima é a de uma
 * faixa com o título e os três ícones na mesma linha (F01 de 12/11): a grade perde coluna antes de espremer o cabeçalho,
 * e com o texto ampliado perde mais cedo.
 */
export function colunasDaGrade(largura: number, fatorTexto = 1, faixa: FaixaDeLargura = faixaDeLargura(largura)): number {
  if (!(largura > 0)) return 1;
  const coluna = larguraDoTitulo(fatorTexto) + ACOES + MOLDURA;
  const teto = MAXIMO_DE_COLUNAS[faixa];
  return Math.max(1, Math.min(teto, Math.floor((largura + ESPACO) / (coluna + ESPACO))));
}

/** Quantas colunas o bloco pede: o tamanho escolhido no "Editar" ou o de fábrica (Agenda e Financeiro 2, as barras 3, o resto 1). */
export function larguraDoBloco(id: BlocoDoPainelId, tamanhos?: PainelDoInicioPreferido['tamanhos']): number {
  return tamanhoDoBloco(id, tamanhos);
}

export interface CelulaDaGrade {
  id: BlocoDoPainelId;
  /** Colunas que o bloco ocupa (nunca mais que a grade). */
  colunas: number;
}

/**
 * Distribui os blocos em linhas, na ordem: o bloco que não cabe no resto da linha começa a próxima. Cada linha é
 * desenhada com `flex: colunas` nos filhos, então a sobra da linha se divide entre os blocos dela (como no protótipo).
 * Cada bloco fica com a própria altura (alinhados no topo): a `LinhaDeBlocos` só iguala as faixas de título.
 */
export function linhasDaGrade(ids: readonly BlocoDoPainelId[], colunas: number, tamanhos?: PainelDoInicioPreferido['tamanhos']): CelulaDaGrade[][] {
  const linhas: CelulaDaGrade[][] = [];
  let atual: CelulaDaGrade[] = [];
  let usadas = 0;
  for (const id of ids) {
    // Em 1 coluna o tamanho não tem efeito (fica gravado para a tela larga).
    const n = Math.min(larguraDoBloco(id, tamanhos), colunas);
    if (usadas + n > colunas && atual.length) {
      linhas.push(atual);
      atual = [];
      usadas = 0;
    }
    atual.push({ id, colunas: n });
    usadas += n;
  }
  if (atual.length) linhas.push(atual);
  // Evita cartão sozinho na última linha (mesma regra da grade de indicadores): puxa o último bloco da linha anterior
  // quando ela tem pelo menos 3 blocos (para não criar outro órfão) e a soma cabe na grade.
  if (colunas > 1 && linhas.length >= 2) {
    const ultima = linhas[linhas.length - 1];
    const penultima = linhas[linhas.length - 2];
    if (ultima.length === 1 && penultima.length >= 3) {
      const candidato = penultima[penultima.length - 1];
      if (candidato.colunas + ultima[0].colunas <= colunas) {
        penultima.pop();
        ultima.unshift(candidato);
      }
    }
  }
  return linhas;
}
