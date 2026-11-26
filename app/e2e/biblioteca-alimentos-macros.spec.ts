import { expect, test } from '@playwright/test';

import type { Alimento } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Biblioteca › Alimentos em 390 px: a linha dos macros não passa por baixo do botão de editar e cada macro ("P 14,0 g")
 * fica inteiro numa linha só (desce junto, nunca se parte). Dados fictícios, tema escuro e claro, texto padrão e extra.
 */
function alimento(id: string, nome: string, kcal: number, p: number, c: number, g: number): Alimento {
  return {
    id, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g, gramasPorUnidade: null,
    fonte: null, origem: 'PROPRIO', fatorCorrecao: null, fatorCoccao: null, grupo: null,
  };
}

const ALIMENTOS = [
  alimento('a1', 'Aveia fictícia', 393, 14, 66.7, 8.5),
  alimento('a2', 'Azeite fictício', 884, 0, 0, 100),
  alimento('a3', 'Castanha fictícia', 643, 14.5, 15.1, 63.5),
  alimento('a4', 'Queijo fictício', 264, 17.4, 3.2, 20.2),
];

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const extra of [false, true]) {
    test(`390px (${tema.toLowerCase()}${extra ? ', texto extra' : ''}): macros não passam por baixo do editar e não se partem`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(([id, t, e]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, ...(e ? { tamanhoTexto: 'EXTRA' } : {}) })), [TREINADOR.id, tema, extra] as const);
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /alimentos': { corpo: ALIMENTOS },
      });
      await page.goto('/treinador/biblioteca?aba=alimentos');
      for (const a of ALIMENTOS) {
        const editar = page.getByRole('button', { name: `Editar ${a.nome}` });
        await expect(editar).toBeVisible();
        const sobras = await editar.evaluate((botao) => {
          const b = botao.getBoundingClientRect();
          // A linha é o ancestral que traz os macros; cada macro é um texto "P 14,0 g" (25/11: o número vai num <span> mono dentro
          // do <div>, então "folha" quer dizer sem <div> dentro, não sem filhos).
          const ehMacro = (d: Element) => /^[PCG] \d/.test(d.textContent ?? '') && ![...d.children].some((c) => c.tagName === 'DIV');
          let linha: HTMLElement | null = botao.parentElement;
          while (linha && ![...linha.querySelectorAll('div')].some(ehMacro)) linha = linha.parentElement;
          const textos = [...linha!.querySelectorAll('div')].filter(ehMacro);
          return textos.map((d) => {
            const r = d.getBoundingClientRect();
            const alturaDaLinha = parseFloat(getComputedStyle(d).lineHeight) || r.height;
            const invade = r.bottom > b.top && r.top < b.bottom ? r.right - b.left : -1;
            return { texto: d.textContent, invade, linhas: Math.round(r.height / alturaDaLinha) };
          });
        });
        expect(sobras.length).toBe(3);
        for (const s of sobras) {
          expect(s.invade, `${a.nome}: "${s.texto}" passa por baixo do botão de editar`).toBeLessThanOrEqual(0.5);
          expect(s.linhas, `${a.nome}: "${s.texto}" quebrou no meio`).toBe(1);
        }
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}
