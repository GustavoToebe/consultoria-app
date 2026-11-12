import type { BlocoDoPainelId } from '../../dominio/painelBlocos';

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

/**
 * Quantas colunas cabem na largura medida do painel (que já desconta o menu aberto ou recolhido): de 1 (celular) a 4
 * (PC largo). A coluna mínima é a de uma faixa com o título e os três ícones na mesma linha (F01 de 12/11): a grade perde
 * coluna antes de espremer o cabeçalho, e com o texto ampliado perde mais cedo. Em 1280 e 1440 px com o menu aberto, 3; em
 * 1920, 4; no celular, 1.
 */
export function colunasDaGrade(largura: number, fatorTexto = 1): number {
  if (!(largura > 0)) return 1;
  const coluna = larguraDoTitulo(fatorTexto) + ACOES + MOLDURA;
  return Math.max(1, Math.min(4, Math.floor((largura + ESPACO) / (coluna + ESPACO))));
}

/** Quantas colunas o bloco pede: Agenda e Financeiro 2, as barras 3, o resto 1 (D9). */
export function larguraDoBloco(id: BlocoDoPainelId): number {
  return id === 'recebido' ? 3 : id === 'agenda' || id === 'financeiro' ? 2 : 1;
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
export function linhasDaGrade(ids: readonly BlocoDoPainelId[], colunas: number): CelulaDaGrade[][] {
  const linhas: CelulaDaGrade[][] = [];
  let atual: CelulaDaGrade[] = [];
  let usadas = 0;
  for (const id of ids) {
    const n = Math.min(larguraDoBloco(id), colunas);
    if (usadas + n > colunas && atual.length) {
      linhas.push(atual);
      atual = [];
      usadas = 0;
    }
    atual.push({ id, colunas: n });
    usadas += n;
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}
