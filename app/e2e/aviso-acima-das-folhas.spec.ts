import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CategoriaDaVitrine } from '../src/api/vitrineCategorias';
import type { ItemDaVitrine } from '../src/api/vitrineTipos';
import { erroApi, json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import type { EuResponse } from '../src/api/tipos';
import { pngDeCor } from './imagens-falsas';

/**
 * O aviso do rodapé (`ui/Aviso`) fica sempre por cima das Folhas: com uma aberta ele vai para o portal dela, acima do
 * véu e do painel. `toBeVisible` não vê o que está coberto, então cada caso confere o ponto do meio do aviso com
 * `document.elementFromPoint`. Casos: aviso com a folha aberta, "Desfazer" clicável (e alcançável pelo Tab) com a folha
 * aberta, avisar e fechar a folha no mesmo toque e aviso sem folha. Na Vitrine, com dados fictícios. Capturas só com
 * `CAPTURAS` (pasta fora do repositório).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.CAPTURAS;

function item(n: number, nome: string, categoria: CategoriaDaVitrine): ItemDaVitrine {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, descricao: null, tipo: 'FISICO',
    precoCentavos: 5000, precoEspecialCentavos: null, precoVigenteCentavos: 5000, especialAte: null, cupom: null, linkUrl: null,
    ativo: true, naPaginaPublica: false, noMarketplace: false, categoriaId: categoria.id, categoriaNome: categoria.nome, ordem: n - 1,
    versao: 1, temFoto: false, fotoAtualizadaEm: null,
  };
}
const categoria = (n: number, nome: string, quantidade: number): CategoriaDaVitrine => ({ id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, ordem: n - 1, quantidade });
const EBOOKS = categoria(1, 'E-books', 0);
const ROUPAS = categoria(2, 'Roupas', 2);
const CAMISETA = item(1, 'Camiseta fictícia', ROUPAS);
const BONE = item(2, 'Boné fictício', ROUPAS);

async function abrir(page: Page, largura: number, tema: 'CLARO' | 'ESCURO', opcoes: { sessao?: Partial<EuResponse>; permissoes?: string[]; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  let categorias = [EBOOKS, ROUPAS];
  let itens = [CAMISETA, BONE];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR', ...(opcoes.permissoes ?? [])], vitrineHabilitada: true, ...opcoes.sessao })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': (_, route) => json(route, itens),
    'GET /vitrine/categorias': (_, route) => json(route, categorias),
    'GET /vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [120, 120, 120]) }),
    'PUT /vitrine/itens/{id}/foto': (_, route) => json(route, { ...CAMISETA, temFoto: true, fotoAtualizadaEm: '2026-11-24T12:00:00Z' }),
    'PUT /vitrine/itens/{id}': (_, route) => json(route, { ...CAMISETA, versao: 2 }),
    'PUT /vitrine/itens/ordem': (pedido, route) => {
      const { ids } = pedido.corpo as { ids: string[] };
      itens = ids.map((id) => itens.find((i) => i.id === id)!);
      return route.fulfill({ status: 204 });
    },
    'PUT /vitrine/categorias/ordem': (pedido, route) => {
      const { ids } = pedido.corpo as { ids: string[] };
      categorias = ids.map((id) => categorias.find((c) => c.id === id)!);
      return route.fulfill({ status: 204 });
    },
    ...opcoes.extra,
  });
  await page.goto('/treinador/vitrine');
  await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
  return api;
}

/** O elemento pintado no meio do `alvo` é ele ou um descendente dele (nada por cima: véu, painel, outra camada). */
async function noTopo(alvo: Locator) {
  await expect(alvo).toBeVisible();
  // Em poucos décimos de segundo: o aviso confere 5 vezes por segundo se uma folha ou um menu abriu por cima.
  await expect.poll(() => alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const ponto = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!ponto && el.contains(ponto);
  }), { timeout: 2000 }).toBe(true);
}

/** Segura a alça e leva o ponteiro, em passos, até 4 px abaixo do topo do `alvo` (o mesmo de `arrastar.spec.ts`). */
async function arrastar(page: Page, alca: Locator, alvo: Locator) {
  await alca.scrollIntoViewIfNeeded();
  const de = (await alca.boundingBox())!;
  const y = (await alvo.boundingBox())!.y + 4;
  const x = de.x + de.width / 2;
  const y0 = de.y + de.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(x, y0 + ((y - y0) * k) / 10);
  await page.mouse.up();
}

const ordensPedidas = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/vitrine/categorias/ordem').map((p) => (p.corpo as { ids: string[] }).ids);

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    const sufixo = `${largura}px, ${tema.toLowerCase()}`;

    test(`com a folha aberta, "Foto do item salva." fica por cima do véu e do painel (${sufixo})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, tema);
      await page.getByRole('button', { name: 'Editar Camiseta fictícia' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      const [seletor] = await Promise.all([page.waitForEvent('filechooser'), folha.getByRole('button', { name: /^Foto do item: escolher foto/ }).click()]);
      await seletor.setFiles({ name: 'foto-ficticia.png', mimeType: 'image/png', buffer: pngDeCor(400, [200, 120, 60]) });
      const aviso = page.getByRole('alert').filter({ hasText: 'Foto do item salva.' });
      await noTopo(aviso);
      await expect(folha).toBeVisible();
      // Acima do rodapé da folha: as ações dele continuam à vista e clicáveis.
      await noTopo(folha.getByRole('button', { name: 'Salvar item' }));
      await noTopo(folha.getByRole('button', { name: 'Excluir', exact: true }));
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/toast-sobre-folha-com-rodape-${tema === 'ESCURO' ? 'escuro' : 'claro'}-${largura}.png` });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(`"Desfazer" do aviso com a folha aberta: no topo, pelo Tab e pelo clique, sem fechar a folha (${sufixo})`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, tema);
      await page.getByRole('button', { name: 'Organizar categorias' }).click();
      const folha = page.getByRole('dialog', { name: 'Organizar categorias' });
      await expect(folha.getByText('Roupas', { exact: true })).toBeVisible();
      await arrastar(page, folha.getByTestId('alca-de-arraste').nth(1), folha.getByText('E-books', { exact: true }));
      const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
      const desfazer = aviso.getByRole('button', { name: 'Desfazer' });
      await noTopo(aviso);
      await noTopo(desfazer);
      expect(ordensPedidas(pedidos)).toEqual([[ROUPAS.id, EBOOKS.id]]);
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/toast-sobre-folha-${tema === 'ESCURO' ? 'escuro' : 'claro'}${largura === 390 ? '-390' : ''}.png` });
      // Pelo teclado: o aviso está dentro da trava de foco da folha, depois do conteúdo dela.
      await folha.getByRole('button', { name: 'Fechar', exact: true }).focus();
      let alcancou = false;
      for (let i = 0; i < 40 && !alcancou; i += 1) {
        await page.keyboard.press('Tab');
        alcancou = await desfazer.evaluate((el) => el === document.activeElement);
      }
      expect(alcancou).toBe(true);
      // O clique chega ao botão (o véu não o engole) e não fecha a folha.
      await desfazer.click();
      await expect(aviso).toHaveCount(0);
      await expect(folha).toBeVisible();
      await expect.poll(() => ordensPedidas(pedidos)).toEqual([[ROUPAS.id, EBOOKS.id], [EBOOKS.id, ROUPAS.id]]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`com a confirmação aberta dentro da folha, o aviso continua por cima (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 'CLARO');
    await page.getByRole('button', { name: 'Organizar categorias' }).click();
    const folha = page.getByRole('dialog', { name: 'Organizar categorias' });
    await expect(folha.getByText('Roupas', { exact: true })).toBeVisible();
    await arrastar(page, folha.getByTestId('alca-de-arraste').nth(1), folha.getByText('E-books', { exact: true }));
    const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
    await expect(aviso).toBeVisible();
    await folha.getByRole('button', { name: 'Excluir categoria E-books' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await noTopo(aviso);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`com a confirmação aberta na raiz (fora de folha), o aviso fica por cima e fechá-lo não fecha a confirmação (${largura}px)`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    });
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 'CLARO', {
      sessao: { lojaHabilitada: true },
      extra: { 'GET /vitrine/configuracao': { corpo: { paginaLigada: true, codigo: 'lojaFicticia_0001', noMarketplace: false, versao: 1 } } },
    });
    await page.getByRole('button', { name: 'Copiar link' }).click();
    const aviso = page.getByRole('alert').filter({ hasText: 'Link copiado.' });
    await expect(aviso).toBeVisible();
    await page.getByRole('button', { name: 'Gerar novo link' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Gerar novo link?' });
    await expect(painel).toBeVisible();
    await noTopo(aviso);
    await aviso.getByRole('button', { name: 'Fechar aviso' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(painel).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`com uma seleção suspensa aberta sobre o painel de filtros, o aviso fica por cima e fechá-lo não fecha a seleção (${largura}px)`, async ({ page }) => {
    test.skip(largura !== 1280, 'chega à Biblioteca pelo menu lateral, que só fica à vista no PC');
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 'CLARO', {
      permissoes: ['BIBLIOTECA_LER'],
      extra: {
        'PUT /vitrine/itens/ordem': erroApi(500, 'Falha fictícia no servidor.'),
        'GET /exercicios/pagina': paginaDeExerciciosFalsa(['Peito', 'Costas'].map((grupo, i) => ({
          id: `e000000${i + 1}-0000-4000-8000-000000000000`, nome: `Exercício fictício ${i + 1}`, grupoMuscular: grupo, equipamento: null,
          modalidade: 'LIVRE', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
        }))),
      },
    });
    // Erro fica até ser fechado: continua na tela depois de trocar de tela.
    await page.getByRole('button', { name: 'Ações do item Camiseta fictícia' }).click();
    await page.getByRole('dialog', { name: 'Ações de “Camiseta fictícia”' }).getByRole('button', { name: /^Mover para baixo/ }).click();
    const aviso = page.getByRole('alert');
    await expect(aviso).toBeVisible();
    // Navegação dentro do app (recarregar a página apagaria o aviso).
    await page.getByRole('menubar').getByText('Biblioteca', { exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/biblioteca/);
    await expect(aviso).toBeVisible();
    // A seleção abre por cima do painel de filtros (uma folha): o aviso tem de passar por cima dos dois.
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
    await noTopo(aviso);
    await page.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
    const selecao = page.getByRole('dialog', { name: 'Grupo muscular' });
    await expect(selecao).toBeVisible();
    await noTopo(aviso);
    await aviso.getByRole('button', { name: 'Fechar aviso' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(selecao).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`avisar e fechar a folha no mesmo toque: "Item salvo." fica na tela e no topo (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 'CLARO');
    await page.getByRole('button', { name: 'Editar Camiseta fictícia' }).click();
    const folha = page.getByRole('dialog', { name: 'Editar item' });
    await folha.getByRole('button', { name: 'Salvar item' }).click();
    await expect(folha).toHaveCount(0);
    await noTopo(page.getByRole('alert').filter({ hasText: 'Item salvo.' }));
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`sem folha o aviso continua no rodapé e no topo (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 'CLARO');
    await page.getByRole('button', { name: 'Ações do item Camiseta fictícia' }).click();
    await page.getByRole('dialog', { name: 'Ações de “Camiseta fictícia”' }).getByRole('button', { name: /^Mover para baixo/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
    await noTopo(aviso);
    // Mesmo lugar de antes: centrado, no rodapé da janela.
    const caixa = (await aviso.boundingBox())!;
    expect(caixa.y + caixa.height).toBeGreaterThan(900 - 160);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
