import { expect, type Page } from '@playwright/test';

/**
 * Colunas empilhadas sem buraco (auditoria de 27/11, Início e Dieta do aluno no computador): mede as peças posicionadas
 * pelas `ColunasMedidas` (testID `<prefixo>-<chave>`), agrupa pela borda esquerda (cada grupo é uma coluna) e devolve o fim
 * de cada coluna, da esquerda para a direita. Peça de altura 0 (bloco sem nada a mostrar) não conta.
 */
export interface Coluna { x: number; fim: number; pecas: string[] }

async function lerColunas(page: Page, prefixo: string): Promise<{ visiveis: boolean; colunas: Coluna[] }> {
  return page.evaluate((p) => {
    const pecas = [...document.querySelectorAll<HTMLElement>(`[data-testid^="${p}-"]`)];
    const visiveis = pecas.length > 0 && pecas.every((el) => getComputedStyle(el.parentElement!).opacity === '1');
    const colunas: { x: number; fim: number; pecas: string[] }[] = [];
    for (const el of pecas) {
      const r = el.getBoundingClientRect();
      if (r.height < 1) continue;
      const nome = el.dataset.testid!.slice(p.length + 1);
      const c = colunas.find((k) => Math.abs(k.x - r.left) < 3);
      if (c) { c.fim = Math.max(c.fim, r.bottom); c.pecas.push(nome); } else colunas.push({ x: r.left, fim: r.bottom, pecas: [nome] });
    }
    return { visiveis, colunas: colunas.sort((a, b) => a.x - b.x) };
  }, prefixo);
}

/** Espera as colunas aparecerem e pararem de mudar (as medidas chegam em mais de um quadro). */
export async function colunasEstaveis(page: Page, prefixo: string): Promise<Coluna[]> {
  let antes = '';
  let atual: Coluna[] = [];
  await expect.poll(async () => {
    const lidas = await lerColunas(page, prefixo);
    atual = lidas.colunas;
    const agora = JSON.stringify(atual.map((c) => [Math.round(c.x), Math.round(c.fim)]));
    const parou = lidas.visiveis && agora === antes;
    antes = agora;
    return parou;
  }, { timeout: 10_000, intervals: [200] }).toBe(true);
  return atual;
}

/** Diferença entre o fim de cada coluna e o da vizinha, da esquerda para a direita. */
export const diferencasVizinhas = (colunas: readonly Coluna[]): number[] => colunas.slice(1).map((c, i) => Math.abs(c.fim - colunas[i].fim));

/**
 * Afirma que nenhuma coluna termina mais de `limite` px antes da vizinha (e que há `colunasEsperadas` colunas). Devolve as
 * colunas para o relatório.
 */
export async function conferirAlturasDeColunas(page: Page, o: { prefixo: string; colunasEsperadas: number; limite?: number }): Promise<Coluna[]> {
  const { prefixo, colunasEsperadas, limite = 80 } = o;
  const colunas = await colunasEstaveis(page, prefixo);
  expect(colunas.map((c) => c.pecas), 'colunas medidas').toHaveLength(colunasEsperadas);
  const diferencas = diferencasVizinhas(colunas);
  expect(Math.max(0, ...diferencas), `fim das colunas: ${colunas.map((c) => `${c.pecas.join('+')}=${Math.round(c.fim)}`).join(' | ')}`).toBeLessThan(limite);
  return colunas;
}

/**
 * Maior vazio embaixo do conteúdo dentro de um cartão (`ui/Cartao`, testID "cartao") da região: borda de baixo do cartão
 * menos o fim do último texto, ícone ou controle dele. O recuo do cartão (~16 a 24) entra na conta; um cartão esticado
 * para acompanhar o vizinho (o "Lanche da tarde" de 27/11, ~110 px) passa muito disso.
 */
export async function maiorVazioDentroDosCartoes(page: Page, prefixo: string): Promise<{ vazio: number; cartao: string }> {
  return page.evaluate((p) => {
    const cartoes = [...document.querySelectorAll<HTMLElement>(`[data-testid^="${p}-"] [data-testid="cartao"]`)];
    let pior = { vazio: 0, cartao: '' };
    for (const cartao of cartoes) {
      const caixa = cartao.getBoundingClientRect();
      if (caixa.height < 1) continue;
      let fim = caixa.top;
      const folhas = [...cartao.querySelectorAll<Element>('*')].filter((el) => el.tagName.toLowerCase() === 'svg' || (el.children.length === 0 && !el.closest('svg')));
      for (const el of folhas) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) fim = Math.max(fim, r.bottom);
      }
      const vazio = caixa.bottom - fim;
      if (vazio > pior.vazio) pior = { vazio, cartao: (cartao.textContent ?? '').slice(0, 40) };
    }
    return pior;
  }, prefixo);
}
