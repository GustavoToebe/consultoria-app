import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, RegistroPeso } from '../src/api/tipos';
import { CLARO, ESCURO } from '../src/tema/tokens';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Foco de teclado nas `Abas` (aba "Gráfico" do cartão Peso, na ficha do aluno): o anel é o único do `global.css`
 * (`:focus-visible`: 2 px, folga de 2 px, cor `anelFoco`), aparece inteiro (a rolagem horizontal das abas cortava as
 * bordas de cima e de baixo e deixava só as laterais), não aparece no clique do mouse e a folga que o protege não
 * muda a altura da faixa. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PESOS: RegistroPeso[] = [
  { id: 'p3', data: '2026-10-26', pesoKg: 80.5, variacao: -0.7, observacao: null },
  { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: null },
  { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
];

/** Largura do anel (2 px) mais a folga (2 px) do `:focus-visible` do `global.css`. */
const ALCANCE_DO_ANEL = 4;

type Tema = 'claro' | 'escuro';

async function abrirFicha(page: Page, largura: number, tema: Tema) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (tema === 'escuro') {
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  }
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: PESOS },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const abaGrafico = page.getByRole('tab', { name: 'Gráfico' });
  await abaGrafico.scrollIntoViewIfNeeded();
  await expect(abaGrafico).toBeVisible();
  return { ...api, abaGrafico };
}

/**
 * Foco pelo teclado, como a pessoa faz: as abas têm uma parada só no Tab (a ativa, "Lista") e a seta para a direita leva
 * ao "Gráfico". Chega um foco de teclado de verdade (`:focus-visible`).
 */
async function focarPorTeclado(page: Page, aba: Locator, tema: Tema) {
  await page.getByRole('tab', { name: 'Lista' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(aba).toBeFocused();
  await expect(aba).toHaveAttribute('aria-selected', 'true');
  // O gatilho tem `transition-colors`: o anel nasce transparente e chega à cor do tema em instantes.
  await expect(aba).toHaveCSS('outline-color', corCss(tema));
}

function anelDoTema(tema: Tema): string {
  return (tema === 'claro' ? CLARO : ESCURO).anelFoco;
}

function corCss(tema: Tema): string {
  const [r, g, b] = rgb(anelDoTema(tema));
  return `rgb(${r}, ${g}, ${b})`;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

for (const tema of ['claro', 'escuro'] as const) {
  for (const largura of [390, 1280]) {
    test.describe(`tema ${tema} em ${largura}px`, () => {
      test('foco por teclado na aba Gráfico: anel de 2 px com folga de 2 px na cor anelFoco', async ({ page }) => {
        const { abaGrafico, errosDaPagina } = await abrirFicha(page, largura, tema);
        await focarPorTeclado(page, abaGrafico, tema);
        const anel = await abaGrafico.evaluate((e) => {
          const c = getComputedStyle(e);
          return { estilo: c.outlineStyle, largura: c.outlineWidth, folga: c.outlineOffset, cor: c.outlineColor, sombra: c.boxShadow, borda: c.borderTopColor };
        });
        expect(anel).toMatchObject({ estilo: 'solid', largura: '2px', folga: '2px', cor: corCss(tema) });
        // O gatilho não desenha anel próprio por cima do global (box-shadow do RNR): é um anel só.
        expect(anel.sombra).toBe('none');
        expect(errosDaPagina).toEqual([]);
      });

      test('o anel aparece inteiro: cabe em todos os ancestrais que cortam e as quatro bordas têm a cor do anel', async ({ page }) => {
        const { abaGrafico } = await abrirFicha(page, largura, tema);
        await focarPorTeclado(page, abaGrafico, tema);

        // Geometria: o retângulo da aba mais o alcance do anel cabe dentro de cada ancestral com overflow diferente de visible
        // (a ScrollView horizontal das abas é um deles).
        const sobras = await abaGrafico.evaluate((e, alcance) => {
          const a = e.getBoundingClientRect();
          const anel = { esquerda: a.left - alcance, direita: a.right + alcance, topo: a.top - alcance, base: a.bottom + alcance };
          const cortes: { ancestral: string; esquerda: number; direita: number; topo: number; base: number }[] = [];
          for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
            const c = getComputedStyle(p);
            if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
            const r = p.getBoundingClientRect();
            // Sobra positiva = o anel ultrapassa a caixa que corta.
            cortes.push({
              ancestral: `${p.tagName.toLowerCase()}[overflow ${c.overflowX}/${c.overflowY}]`,
              esquerda: r.left - anel.esquerda, direita: anel.direita - r.right,
              topo: r.top - anel.topo, base: anel.base - r.bottom,
            });
          }
          return cortes;
        }, ALCANCE_DO_ANEL);
        // A rolagem horizontal das abas existe (senão o teste não estaria vendo o ancestral que cortava).
        expect(sobras.some((s) => s.ancestral.includes('auto') || s.ancestral.includes('scroll'))).toBe(true);
        for (const s of sobras) {
          const { ancestral, ...lados } = s;
          // Meio pixel de tolerância para o arredondamento do layout.
          for (const [lado, sobra] of Object.entries(lados)) expect(sobra, `${ancestral}: o anel passa da borda ${lado}`).toBeLessThanOrEqual(0.5);
        }

        // Pixels: em cada lado, no meio da aba, há uma faixa de 1 a 5 px fora da caixa com a cor do anel.
        const caixa = (await abaGrafico.boundingBox())!;
        const margem = 8;
        const recorte = { x: Math.floor(caixa.x) - margem, y: Math.floor(caixa.y) - margem, width: Math.ceil(caixa.width) + 2 * margem, height: Math.ceil(caixa.height) + 2 * margem };
        const png = (await page.screenshot({ clip: recorte, animations: 'disabled' })).toString('base64');
        const lados = await page.evaluate(async ({ png, caixa, recorte, cor }) => {
          const img = new Image();
          img.src = `data:image/png;base64,${png}`;
          await img.decode();
          const tela = document.createElement('canvas');
          tela.width = img.width;
          tela.height = img.height;
          const ctx = tela.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const escala = img.width / recorte.width;
          const perto = (x: number, y: number) => {
            const [r, g, b] = ctx.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data;
            return Math.abs(r - cor[0]) + Math.abs(g - cor[1]) + Math.abs(b - cor[2]) <= 24;
          };
          const meioX = caixa.x + caixa.width / 2 - recorte.x;
          const meioY = caixa.y + caixa.height / 2 - recorte.y;
          const esq = caixa.x - recorte.x;
          const dir = esq + caixa.width;
          const topo = caixa.y - recorte.y;
          const base = topo + caixa.height;
          const faixa = [1, 2, 3, 4, 5];
          return {
            acima: faixa.some((d) => perto(meioX, topo - d)),
            abaixo: faixa.some((d) => perto(meioX, base + d - 1)),
            esquerda: faixa.some((d) => perto(esq - d, meioY)),
            direita: faixa.some((d) => perto(dir + d - 1, meioY)),
          };
        }, { png, caixa, recorte, cor: rgb(anelDoTema(tema)) });
        expect(lados).toEqual({ acima: true, abaixo: true, esquerda: true, direita: true });
      });

      test('o clique do mouse na aba Gráfico não mostra o anel', async ({ page }) => {
        const { abaGrafico, errosDaPagina } = await abrirFicha(page, largura, tema);
        await abaGrafico.click();
        await expect(abaGrafico).toHaveAttribute('aria-selected', 'true');
        await expect(abaGrafico).toBeFocused();
        const anel = await abaGrafico.evaluate((e) => {
          const c = getComputedStyle(e);
          return { estilo: c.outlineStyle, largura: c.outlineWidth, sombra: c.boxShadow };
        });
        expect(anel.estilo === 'none' || anel.largura === '0px').toBe(true);
        expect(anel.sombra).toBe('none');
        expect(errosDaPagina).toEqual([]);
      });

      test('a folga do anel não muda a altura da faixa: a aba mantém 44 px ou mais e a faixa não cresce', async ({ page }) => {
        const { abaGrafico } = await abrirFicha(page, largura, tema);
        const medidas = await abaGrafico.evaluate((e) => {
          const aba = e.getBoundingClientRect();
          // O contêiner `Tabs` é o ancestral com a linha de 1 px embaixo.
          let tabs: HTMLElement | null = e.parentElement;
          while (tabs && getComputedStyle(tabs).borderBottomWidth !== '1px') tabs = tabs.parentElement;
          const faixa = tabs!.getBoundingClientRect();
          return { aba: aba.height, faixa: faixa.height, abaTopo: aba.top - faixa.top };
        });
        expect(medidas.aba).toBeGreaterThanOrEqual(44);
        // A faixa é a aba (que já traz o sublinhado) mais, no máximo, a linha de 1 px: a folga de 4 px de cada lado, que
        // protege o anel da rolagem, é devolvida por margem negativa e não soma altura nem desloca a aba.
        expect(Math.abs(medidas.faixa - medidas.aba)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(medidas.abaTopo)).toBeLessThanOrEqual(0.5);
      });
    });
  }
}

/**
 * C5 (auditoria de UI/UX de 03/11): a aba ativa vem inteira para a vista, fora do esmaecido (28 px) das bordas, ao abrir
 * por link uma aba do fim (`?aba=`) e ao tocar numa aba meio escondida. No celular as sete abas do Planejamento não cabem.
 */
const ESMAECIDO = 28;

/** Caixa da aba e da rolagem horizontal que a contém, e quanto a rolagem andou. */
function posicaoNaFaixa(aba: Locator) {
  return aba.evaluate((e) => {
    let rolagem: HTMLElement | null = e.parentElement;
    while (rolagem && !['auto', 'scroll'].includes(getComputedStyle(rolagem).overflowX)) rolagem = rolagem.parentElement;
    const a = e.getBoundingClientRect();
    const r = rolagem!.getBoundingClientRect();
    return { esquerda: a.left - r.left, direita: r.right - a.right, rolou: rolagem!.scrollLeft, sobra: rolagem!.scrollWidth - rolagem!.clientWidth };
  });
}

test('390px: a aba aberta por ?aba= e a tocada vêm inteiras para a vista, fora do esmaecido', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /receitas': { corpo: [] },
    'GET /pastas-modelos': { corpo: [] },
    'GET /questionarios': { corpo: [] },
  });
  await page.goto('/treinador/planejamento?aba=anamnese');
  const anamnese = page.getByRole('tab', { name: 'Anamnese', exact: true });
  await expect(anamnese).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await posicaoNaFaixa(anamnese)).rolou).toBeGreaterThan(0);
  const aberta = await posicaoNaFaixa(anamnese);
  expect(aberta.sobra).toBeGreaterThan(0);
  expect(aberta.esquerda).toBeGreaterThanOrEqual(ESMAECIDO - 1);
  expect(aberta.direita).toBeGreaterThanOrEqual(ESMAECIDO - 1);

  // A primeira aba, agora escondida à esquerda: o toque a traz de volta, sem nada cortado.
  await page.getByRole('tab', { name: 'Treino', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Treino', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await posicaoNaFaixa(page.getByRole('tab', { name: 'Treino', exact: true }))).esquerda).toBeGreaterThanOrEqual(-0.5);
});
