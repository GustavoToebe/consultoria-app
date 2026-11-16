import { expect, test, type Page } from '@playwright/test';

import type { ItemDaVitrine } from '../src/api/vitrineTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Vitrine do treinador (F1.3 de `docs/planos/vitrine-e-loja.md`): lista com ativos e inativos na ordem, "N de 30",
 * criar, editar (422 no campo), excluir, Subir/Descer, teto, só leitura sem `VITRINE_ALTERAR`, chave desligada, vazio e
 * erro. Capturas em 390 e 1280, claro e escuro, vão para `E2E_CAPTURAS` (pasta fora do repositório). Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;

function item(n: number, extra: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Item fictício ${n}`, descricao: null, tipo: 'DIGITAL',
    precoCentavos: null, precoEspecialCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null,
    ativo: true, naPaginaPublica: false, noMarketplace: false, ordem: n - 1, versao: 1, temFoto: false, fotoAtualizadaEm: null, ...extra,
  };
}

const PLANILHA = item(1, {
  nome: 'Planilha de força', descricao: 'Doze semanas de treino.', precoCentavos: 9900, precoEspecialCentavos: 7900,
  precoVigenteCentavos: 7900, especialAte: '2099-11-30', cupom: 'FORCA10', linkUrl: 'https://loja.exemplo.invalid/planilha',
  temFoto: true, fotoAtualizadaEm: '2026-11-10T12:00:00Z',
});
const CAMISETA = item(2, { nome: 'Camiseta do time', tipo: 'FISICO', precoCentavos: 8000, precoVigenteCentavos: 8000 });
const GARRAFA = item(3, { nome: 'Garrafa antiga', tipo: 'FISICO', ativo: false });
const ITENS = [PLANILHA, CAMISETA, GARRAFA];

const COM_ALTERAR = [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR'];

async function abrir(page: Page, { itens = ITENS, permissoes = COM_ALTERAR, ligada = true, tema = 'CLARO', largura = 1280, extra = {} }: {
  itens?: ItemDaVitrine[] | RespostasApi[string]; permissoes?: string[]; ligada?: boolean; tema?: 'CLARO' | 'ESCURO'; largura?: number; extra?: RespostasApi;
} = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, vitrineHabilitada: ligada })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': Array.isArray(itens) ? { corpo: itens } : itens,
    'GET /vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [120, 120, 120]) }),
    ...extra,
  });
  await page.goto('/treinador/vitrine');
  return api;
}

async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-treinador-${nome}.png`, fullPage: true });
}

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`lista: ativos e inativos na ordem, contagem e folha (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, { largura, tema });
      await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
      await expect(page.getByText('3 de 30 itens. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
      await expect(page.getByText('Inativo', { exact: true })).toHaveCount(1);
      // O preço que vale é o do servidor, com a validade; o item sem preço mostra "—".
      await expect(page.getByText(/Digital · R\$\s?79,00 · Preço especial até 30\/11\/2099/)).toBeVisible();
      await expect(page.getByText('Físico · —', { exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Foto de Planilha de força' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Subir Planilha de força' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Descer Garrafa antiga' })).toBeDisabled();
      await capturar(page, `lista-${tema.toLowerCase()}-${largura}`);

      await page.getByRole('button', { name: 'Editar Planilha de força' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      await expect(folha.getByRole('button', { name: 'Trocar foto' })).toBeVisible();
      await expect(folha.getByLabel('Nome', { exact: true })).toHaveValue('Planilha de força');
      await expect(folha.getByRole('img', { name: 'Foto de Planilha de força' })).toBeVisible();
      await capturar(page, `folha-${tema.toLowerCase()}-${largura}`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('criar: confere antes de enviar, cria e reabre no item para a foto', async ({ page }) => {
  const criado = item(4, { nome: 'Garrafa térmica', tipo: 'FISICO', precoCentavos: 15000, precoVigenteCentavos: 15000, linkUrl: 'https://loja.exemplo.invalid/garrafa' });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: { 'POST /vitrine/itens': { status: 201, corpo: criado } },
  });
  await page.getByRole('button', { name: 'Novo item' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo item' });
  await expect(folha.getByText('A foto entra depois de criar o item.')).toBeVisible();
  await folha.getByRole('button', { name: 'Criar item' }).click();
  await expect(folha.getByText('Informe o nome do item.')).toBeVisible();
  expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === '/vitrine/itens')).toBe(false);

  await folha.getByLabel('Nome', { exact: true }).fill('Garrafa térmica');
  await folha.getByRole('radio', { name: 'Físico' }).click();
  await expect(folha.getByText('Item físico mostra tudo, na web e no celular.')).toBeVisible();
  await folha.getByLabel('Preço (opcional)', { exact: true }).fill('150,00');
  await folha.getByLabel('Link (opcional)', { exact: true }).fill('https://loja.exemplo.invalid/garrafa');
  await folha.getByRole('button', { name: 'Criar item' }).click();

  await expect(page.getByRole('dialog', { name: 'Editar item' }).getByRole('button', { name: 'Escolher foto' })).toBeVisible();
  const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/vitrine/itens');
  expect(post?.corpo).toEqual({
    nome: 'Garrafa térmica', descricao: null, tipo: 'FISICO', precoCentavos: 15000, precoEspecialCentavos: null, especialAte: null,
    cupom: null, linkUrl: 'https://loja.exemplo.invalid/garrafa', ativo: true, naPaginaPublica: false, noMarketplace: false,
  });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('editar: o 422 da API aparece no campo, a folha fica aberta e some ao corrigir', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'PUT /vitrine/itens/{id}': erroApi(422, 'Confira os dados do item.', 'VITRINE_ITEM_INVALIDO', [{ field: 'linkUrl', message: 'Este endereço não pode ser usado.' }]),
    },
  });
  await page.getByRole('button', { name: 'Editar Camiseta do time' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar item' });
  await folha.getByLabel('Link (opcional)', { exact: true }).fill('https://loja.exemplo.invalid/camiseta');
  await folha.getByRole('button', { name: 'Salvar item' }).click();
  await expect(folha.getByText('Este endereço não pode ser usado.')).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT');
  expect(put?.corpo).toMatchObject({ nome: 'Camiseta do time', versao: 1, linkUrl: 'https://loja.exemplo.invalid/camiseta' });
  await folha.getByLabel('Link (opcional)', { exact: true }).fill('https://loja.exemplo.invalid/outra');
  await expect(folha.getByText('Este endereço não pode ser usado.')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('excluir: pede confirmação no painel e manda a versão', async ({ page }) => {
  let lista = ITENS;
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'GET /vitrine/itens': (_, route) => json(route, lista),
      'DELETE /vitrine/itens/{id}': (pedido, route) => { lista = lista.filter((i) => !pedido.caminho.endsWith(i.id)); return route.fulfill({ status: 204 }); },
    },
  });
  await page.getByRole('button', { name: 'Editar Garrafa antiga' }).click();
  await page.getByRole('dialog', { name: 'Editar item' }).getByRole('button', { name: 'Excluir' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Excluir este item?' });
  await painel.getByRole('button', { name: 'Excluir item' }).click();
  await expect(page.getByText('Item excluído.')).toBeVisible();
  await expect(page.getByText('2 de 30 itens. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  const apagar = pedidos.find((p) => p.metodo === 'DELETE');
  expect(apagar?.caminho).toBe(`/vitrine/itens/${GARRAFA.id}`);
  expect(apagar?.busca.get('versao')).toBe('1');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('reordenar: Descer troca com o vizinho e manda a lista inteira', async ({ page }) => {
  let lista = ITENS;
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'GET /vitrine/itens': (_, route) => json(route, lista),
      'PUT /vitrine/itens/ordem': (pedido, route) => {
        const { ids } = pedido.corpo as { ids: string[] };
        lista = ids.map((id) => lista.find((i) => i.id === id)!);
        return route.fulfill({ status: 204 });
      },
    },
  });
  await page.getByRole('button', { name: 'Descer Planilha de força' }).click();
  await expect(page.getByRole('button', { name: 'Subir Camiseta do time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Subir Planilha de força' })).toBeEnabled();
  const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/vitrine/itens/ordem');
  expect(put?.corpo).toEqual({ ids: [CAMISETA.id, PLANILHA.id, GARRAFA.id] });
  // A lista que voltou do servidor continua na ordem nova.
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/vitrine/itens').length).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: 'Subir Camiseta do time' })).toBeDisabled();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`teto: com 30 itens "Novo item" fica desabilitado com o motivo (${largura}px)`, async ({ page }) => {
    const trinta = Array.from({ length: 30 }, (_, k) => item(k + 1));
    const { naoTratadas, errosDaPagina } = await abrir(page, { itens: trinta, largura });
    await expect(page.getByText('30 de 30 itens. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo item' })).toBeDisabled();
    await expect(page.getByText(/A vitrine tem no máximo 30 itens/)).toBeVisible();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-treinador-teto-${largura}.png` });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('só leitura sem VITRINE_ALTERAR: sem criar, sem setas, folha sem ações', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { permissoes: [...PERMISSOES_TREINADOR, 'VITRINE_LER'] });
  await expect(page.getByText('3 de 30 itens. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo item' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Subir|Descer) / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver Planilha de força' }).click();
  const folha = page.getByRole('dialog', { name: 'Item da vitrine' });
  await expect(folha.getByText('FORCA10')).toBeVisible();
  await expect(folha.getByText('30/11/2099')).toBeVisible();
  await expect(folha.getByRole('textbox')).toHaveCount(0);
  await expect(folha.getByRole('button', { name: /Salvar|Excluir|Trocar foto/ })).toHaveCount(0);
  expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho.startsWith('/vitrine'))).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('chave desligada: sem item no menu, tela de recurso desativado e nenhuma consulta', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { ligada: false });
  await expect(page.getByText('A vitrine não está ativa nesta instalação do app.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vitrine' })).toHaveCount(0);
  expect(pedidos.filter((p) => p.caminho.startsWith('/vitrine'))).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('menu: com a chave e a permissão, a Vitrine aparece no menu lateral', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page);
  await expect(page.getByRole('link', { name: 'Vitrine' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vazio: explica e oferece o Novo item', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { itens: [], largura: 390 });
  await expect(page.getByText('Nenhum item na vitrine')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo item' })).toBeEnabled();
  await capturar(page, 'vazio-390');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('erro: mostra a mensagem e "Tentar de novo" busca outra vez', async ({ page }) => {
  let falhar = true;
  const { naoTratadas, errosDaPagina } = await abrir(page, {
    itens: (_, route) => (falhar ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500) : json(route, ITENS)),
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  falhar = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('3 de 30 itens. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
