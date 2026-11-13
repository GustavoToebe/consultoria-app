import { expect, type Locator } from '@playwright/test';

interface Medida {
  texto: string;
  linhas: number;
  dentro: boolean;
  topo: number;
  base: number;
}

/**
 * Valor grande (R$ 10.000,00, R$ 100.000,00) inteiro na peça (Gustavo, 13/11): cada texto pedido aparece numa linha só
 * (contando as caixas de linha do próprio nó de texto, que é o que denuncia o "R$" separado do número), sem passar da borda
 * da peça, e todos na mesma linha (o "R$" pequeno e o número do mini-cartão do Início). Espaço comum e o não separável
 * contam como iguais.
 */
export async function esperarValorInteiro(peca: Locator, textos: string[]): Promise<void> {
  // Logo depois de trocar a largura a grade ainda se reorganiza (onLayout): mede de novo até assentar.
  await expect(() => medirEConferir(peca, textos)).toPass({ timeout: 5_000 });
}

async function medirEConferir(peca: Locator, textos: string[]): Promise<void> {
  const medidas = await peca.evaluate((el, procurados) => {
    const normal = (t: string) => t.replace(/ /g, ' ').trim();
    const caixa = el.getBoundingClientRect();
    const resultado: Medida[] = [];
    const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let no = andar.nextNode(); no; no = andar.nextNode()) {
      const texto = normal(no.textContent ?? '');
      if (!procurados.map(normal).includes(texto)) continue;
      const faixa = document.createRange();
      faixa.selectNodeContents(no);
      const partes = Array.from(faixa.getClientRects()).filter((r) => r.width > 0);
      const topos = new Set(partes.map((r) => Math.round(r.top)));
      const unida = faixa.getBoundingClientRect();
      resultado.push({
        texto,
        linhas: topos.size,
        dentro: unida.left >= caixa.left - 0.5 && unida.right <= caixa.right + 0.5,
        topo: unida.top,
        base: unida.bottom,
      });
    }
    return resultado;
  }, textos);

  expect(medidas.map((m) => m.texto).sort(), `textos achados na peça`).toEqual(textos.map((t) => t.replace(/ /g, ' ').trim()).sort());
  for (const m of medidas) {
    expect(m.linhas, `"${m.texto}" numa linha só`).toBe(1);
    expect(m.dentro, `"${m.texto}" dentro da peça`).toBe(true);
  }
  // Mesma linha: as caixas se sobrepõem na vertical.
  for (const m of medidas.slice(1)) {
    expect(m.topo < medidas[0].base && medidas[0].topo < m.base, `"${m.texto}" na linha de "${medidas[0].texto}"`).toBe(true);
  }
}
