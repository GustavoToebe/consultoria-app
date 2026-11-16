import { expect, test, type Page } from '@playwright/test';

import type { EuResponse } from '../src/api/tipos';
import type { ItemDaVitrineDoAluno } from '../src/api/vitrineTipos';
import { ALUNO, erroApi, json, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { pngDeCor } from './imagens-falsas';

/**
 * Vitrine do aluno (F1.3 de `docs/planos/vitrine-e-loja.md`): a lista com preço especial (o vigente do servidor e o
 * normal riscado), cupom e link (na web todo item mostra tudo; a regra do celular está no teste de tela
 * `aluno/vitrine/CartaoDoItem.test.tsx`), o cartão do Início com até dois itens e "Ver tudo", e os estados (vazio, erro,
 * sem internet, chave desligada). Capturas em 390 e 1280, claro e escuro, vão para `E2E_CAPTURAS`. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;

function item(n: number, extra: Partial<ItemDaVitrineDoAluno> = {}): ItemDaVitrineDoAluno {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Item fictício ${n}`, descricao: null, tipo: 'FISICO',
    precoCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null, ...extra,
  };
}

const CAMISETA = item(1, { nome: 'Camiseta do time', descricao: 'Algodão, tamanhos P a GG.', precoCentavos: 8000, precoVigenteCentavos: 8000, cupom: 'TIME10', linkUrl: 'https://loja.exemplo.invalid/camiseta' });
const GARRAFA = item(2, { nome: 'Garrafa térmica', temFoto: true, fotoAtualizadaEm: '2026-11-10T12:00:00Z' });
const PLANILHA = item(3, {
  nome: 'Planilha de força', descricao: 'Doze semanas de treino.', tipo: 'DIGITAL', precoCentavos: 9900, precoVigenteCentavos: 7900,
  especialAte: '2099-11-30', linkUrl: 'https://loja.exemplo.invalid/planilha',
});
const ITENS = [CAMISETA, GARRAFA, PLANILHA];

async function abrir(page: Page, caminho: string, { vitrine = { corpo: ITENS } as RespostasApi[string], ligada = true, tema = 'CLARO', largura = 390 }: {
  vitrine?: RespostasApi[string]; ligada?: boolean; tema?: 'CLARO' | 'ESCURO'; largura?: number;
} = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema]);
  const sessao = await sessaoDeAluno(page);
  const eu = sessao['GET /eu'] as { corpo: EuResponse };
  const api = await simularApi(page, {
    ...sessao,
    'GET /eu': { corpo: { ...eu.corpo, vitrineHabilitada: ligada } },
    'GET /aluno/dieta': { corpo: { dieta: null } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/vitrine': vitrine,
    'GET /aluno/vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [90, 140, 200]) }),
  });
  await page.goto(caminho);
  return api;
}

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`lista: preço especial, cupom e link (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
        });
      });
      const { naoTratadas, errosDaPagina } = await abrir(page, '/aluno/vitrine', { largura, tema });
      await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
      await expect(page.getByTestId(/^item-da-vitrine-/)).toHaveCount(3);
      // O preço que vale vem do servidor; o normal aparece riscado e o leitor de tela ouve "antes".
      await expect(page.getByLabel(/Preço: R\$\s?79,00, antes R\$\s?99,00\. Preço especial até 30\/11\/2099/)).toBeVisible();
      await expect(page.getByLabel('Preço: não informado')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Foto de Garrafa térmica' })).toBeVisible();
      await expect(page.getByText('Cupom: TIME10')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver produto' })).toHaveCount(2);
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-aluno-lista-${tema.toLowerCase()}-${largura}.png`, fullPage: true });

      await page.getByTestId(`copiar-cupom-${CAMISETA.id}`).click();
      await expect(page.getByText('Copiado.')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe('TIME10');
      // O link abre fora do app (nova aba, sem `opener`); a loja fictícia responde aqui, nada sai da máquina.
      await page.context().route('https://loja.exemplo.invalid/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Loja de teste</p>' }));
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Ver produto' }).first().click()]);
      await popup.waitForURL('https://loja.exemplo.invalid/camiseta');
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`Início: até dois itens, o de preço especial primeiro, e "Ver tudo" (390px, ${tema.toLowerCase()})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, '/aluno', { tema });
    await expect(page.getByRole('heading', { name: 'Vitrine' })).toBeVisible();
    const itens = page.getByTestId(/^inicio-vitrine-/);
    await expect(itens).toHaveCount(2);
    await expect(itens.first()).toHaveAttribute('data-testid', `inicio-vitrine-${PLANILHA.id}`);
    await expect(itens.nth(1)).toHaveAttribute('data-testid', `inicio-vitrine-${CAMISETA.id}`);
    await page.getByRole('heading', { name: 'Vitrine' }).scrollIntoViewIfNeeded();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-aluno-inicio-${tema.toLowerCase()}-390.png` });
    await page.getByRole('button', { name: 'Ver tudo da vitrine' }).click();
    await expect(page).toHaveURL(/\/aluno\/vitrine$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Início sem itens: o cartão não aparece', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, '/aluno', { vitrine: { corpo: [] } });
  await expect.poll(() => pedidos.some((p) => p.caminho === '/aluno/vitrine')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Hoje' }).or(page.getByRole('heading', { level: 1 })).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vitrine' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('chave desligada: nada da vitrine no Início, nenhuma consulta, e a rota volta ao Início', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, '/aluno/vitrine', { ligada: false });
  await expect(page).toHaveURL(/\/aluno$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vitrine' })).toHaveCount(0);
  expect(pedidos.filter((p) => p.caminho.startsWith('/aluno/vitrine'))).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('chave desligada no meio do caminho (503 VITRINE_INDISPONIVEL): o cartão some sem mensagem de erro', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, '/aluno', {
    vitrine: erroApi(503, 'A vitrine não está disponível.', 'VITRINE_INDISPONIVEL'),
  });
  await expect.poll(() => pedidos.some((p) => p.caminho === '/aluno/vitrine')).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vitrine' })).toHaveCount(0);
  await expect(page.getByText('A vitrine não está disponível.')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vazio: explica que não há nada agora', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, '/aluno/vitrine', { vitrine: { corpo: [] } });
  await expect(page.getByText('Nada na vitrine agora')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('erro: mostra a mensagem e "Tentar de novo" busca outra vez', async ({ page }) => {
  let falhar = true;
  const { naoTratadas, errosDaPagina } = await abrir(page, '/aluno/vitrine', {
    vitrine: (_, route) => (falhar ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500) : json(route, ITENS)),
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  falhar = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByTestId(/^item-da-vitrine-/)).toHaveCount(3);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('sem internet: avisa que a vitrine precisa de conexão', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, '/aluno/vitrine');
  await expect(page.getByTestId(/^item-da-vitrine-/)).toHaveCount(3);
  await page.context().setOffline(true);
  await expect(page.getByText('Sem conexão')).toBeVisible();
  await expect(page.getByTestId(/^item-da-vitrine-/)).toHaveCount(0);
  await page.context().setOffline(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
