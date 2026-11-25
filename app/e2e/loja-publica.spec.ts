import { expect, test, type Page } from '@playwright/test';

import type { ItemDaLojaPublica, ItemDaVitrine, LojaPublica, PaginaDaVitrine } from '../src/api/vitrineTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Página pública da loja e o bloco "Página pública" da Vitrine (F2a de `docs/planos/vitrine-e-loja.md`). Página: pronta,
 * vazia, não encontrada (404 e código malformado sem chamar a API), 429, sem conexão com "Tentar de novo", erro e o
 * "Comprar" em outra aba com `noopener`. Vitrine: ligar, copiar o link, novo link com confirmação, 409, o interruptor do
 * item e a chave desligada. Capturas em 390 e 1280, claro e escuro, em `E2E_CAPTURAS` (fora do repositório). Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;
const CODIGO = 'lojaFicticia_0001';
const CODIGO_NOVO = 'lojaFicticia_0002';

const MARCA_DA_LOJA = { nome: 'Equipe Fictícia', corPrimaria: '#1D4ED8', fonteTitulo: 'PADRAO', temaPadrao: 'CLARO', logoUrl: null } as const;

const PLANILHA: ItemDaLojaPublica = {
  id: 'l0000000-0000-4000-8000-000000000001', nome: 'Planilha de força', descricao: 'Doze semanas de treino.',
  precoCentavos: 9900, precoVigenteCentavos: 7900, especialAte: '2099-11-30', cupom: 'FORCA10',
  linkUrl: 'https://loja.exemplo.invalid/planilha', temFoto: true, fotoAtualizadaEm: '2026-11-10T12:00:00Z',
};
const EBOOK: ItemDaLojaPublica = {
  id: 'l0000000-0000-4000-8000-000000000002', nome: 'E-book de receitas', descricao: null,
  precoCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null,
};
const LOJA: LojaPublica = { marca: MARCA_DA_LOJA, itens: [PLANILHA, EBOOK] };

const pedidosDaLoja = (pedidos: { caminho: string }[]) => pedidos.filter((p) => p.caminho.startsWith('/publico/loja'));

async function abrirLoja(page: Page, { largura = 1280, escuro = false, codigo = CODIGO, loja = { corpo: LOJA }, extra = {} }: {
  largura?: number; escuro?: boolean; codigo?: string; loja?: RespostasApi[string]; extra?: RespostasApi;
} = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (escuro) await page.emulateMedia({ colorScheme: 'dark' });
  const api = await simularApi(page, {
    'GET /publico/loja/{codigo}': loja,
    'GET /publico/loja/{codigo}/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(400, [90, 110, 140]) }),
    ...extra,
  });
  await page.goto(`/loja/${codigo}`);
  return api;
}

async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/loja-${nome}.png`, fullPage: true });
}

// ---- Página pública ----

for (const largura of [390, 1280]) {
  for (const escuro of [false, true]) {
    const tema = escuro ? 'escuro' : 'claro';
    test(`página pronta: marca, cartões, preço, cupom e "Comprar" em outra aba (${largura}px, ${tema})`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrirLoja(page, { largura, escuro });
      await expect(page.getByRole('heading', { level: 1, name: 'Loja' })).toBeVisible();
      await expect(page.getByText('Equipe Fictícia').first()).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Planilha de força' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'E-book de receitas' })).toBeVisible();
      await expect(page.getByLabel(/Preço: R\$\s?79,00, antes R\$\s?99,00\. Preço especial até 30\/11\/2099/)).toBeVisible();
      await expect(page.getByText('Cupom: FORCA10')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Foto de Planilha de força' })).toBeVisible();

      const comprar = page.getByRole('link', { name: /^Comprar Planilha de força/ });
      await expect(comprar).toHaveAttribute('href', 'https://loja.exemplo.invalid/planilha');
      await expect(comprar).toHaveAttribute('target', '_blank');
      await expect(comprar).toHaveAttribute('rel', /noopener/);
      // Sem link, sem botão; sem preço, nem "—".
      await expect(page.getByRole('link', { name: /^Comprar/ })).toHaveCount(1);
      await expect(page.getByTestId(`item-da-loja-${EBOOK.id}`).getByText('—')).toHaveCount(0);
      await expect.poll(() => page.title()).toBe('Loja · Equipe Fictícia');
      await capturar(page, `pronta-${tema}-${largura}`);
      expect(pedidosDaLoja(pedidos).filter((p) => !p.caminho.endsWith('/foto')).map((p) => p.caminho)).toEqual([`/publico/loja/${CODIGO}`]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('página vazia: a marca e o aviso de que ainda não há itens', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirLoja(page, { largura: 390, loja: { corpo: { ...LOJA, itens: [] } } });
  await expect(page.getByRole('heading', { level: 1, name: 'Loja' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Nenhum item por aqui' })).toBeVisible();
  await expect(page.getByText('Esta página ainda não tem itens.')).toBeVisible();
  await capturar(page, 'vazia-390');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('não encontrada (404): o mesmo texto de página desligada, sem "Tentar de novo"', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirLoja(page, { loja: erroApi(404, 'Página não encontrada.', 'NAO_ENCONTRADO') });
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada.' })).toBeVisible();
  await expect(page.getByText('O endereço pode estar errado ou a página não está disponível.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
  await capturar(page, 'nao-encontrada-1280');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('código malformado: "Página não encontrada." sem chamar a API', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirLoja(page, { codigo: 'abc' });
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada.' })).toBeVisible();
  await expect.poll(() => page.title()).toBe('Loja · Overtraining');
  expect(pedidosDaLoja(pedidos)).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('muitas tentativas (429): "Tente de novo em instantes." e o botão busca outra vez', async ({ page }) => {
  let limitada = true;
  const { pedidos, naoTratadas, errosDaPagina } = await abrirLoja(page, {
    largura: 390,
    loja: (_, route) => (limitada ? json(route, erroApi(429, 'Muitas tentativas.', 'LIMITE').corpo, 429) : json(route, LOJA)),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Muitas tentativas' })).toBeVisible();
  await expect(page.getByText('Tente de novo em instantes.')).toBeVisible();
  await capturar(page, 'muitas-tentativas-390');
  limitada = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Loja' })).toBeVisible();
  expect(pedidosDaLoja(pedidos).filter((p) => !p.caminho.endsWith('/foto')).length).toBeGreaterThan(1);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('sem conexão: "Sem conexão" e "Tentar de novo" carrega a página', async ({ page }) => {
  let semRede = true;
  const { naoTratadas, errosDaPagina } = await abrirLoja(page, {
    loja: (_, route) => (semRede ? route.abort('internetdisconnected') : json(route, LOJA)),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible();
  await expect(page.getByText('Confira a internet e tente de novo.')).toBeVisible();
  await capturar(page, 'sem-conexao-1280');
  semRede = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Planilha de força' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('erro do servidor: título próprio, sem a mensagem da API', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirLoja(page, { loja: erroApi(500, 'Falha interna fictícia.') });
  await expect(page.getByRole('heading', { level: 1, name: 'Não foi possível abrir a página' })).toBeVisible();
  await expect(page.getByText('Falha interna fictícia.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('visitante logado vê a mesma página, com a marca da loja (não a dele)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirLoja(page, {
    extra: await sessao(page, TREINADOR, { lojaHabilitada: true, vitrineHabilitada: true }),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Loja' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Comprar Planilha de força/ })).toBeVisible();
  await expect.poll(() => page.title()).toBe('Loja · Equipe Fictícia');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// ---- Vitrine do treinador ----

function itemDaVitrine(n: number, extra: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Item fictício ${n}`, descricao: null, tipo: 'DIGITAL',
    precoCentavos: null, precoEspecialCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null,
    ativo: true, naPaginaPublica: false, noMarketplace: false, categoriaId: null, categoriaNome: null, ordem: n - 1, versao: 1, temFoto: false, fotoAtualizadaEm: null, ...extra,
  };
}
const MARCADO = itemDaVitrine(1, { nome: 'Planilha de força', precoCentavos: 9900, precoVigenteCentavos: 9900, naPaginaPublica: true });
const FISICO = itemDaVitrine(2, { nome: 'Camiseta do time', tipo: 'FISICO' });
const INATIVO_MARCADO = itemDaVitrine(3, { nome: 'Guia antigo', ativo: false, naPaginaPublica: true });
const ITENS = [MARCADO, FISICO, INATIVO_MARCADO];

const SEM_LINK: PaginaDaVitrine = { paginaLigada: false, codigo: null, noMarketplace: false, versao: null };
const LIGADA: PaginaDaVitrine = { paginaLigada: true, codigo: CODIGO, noMarketplace: false, versao: 1 };
const COM_ALTERAR = [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR'];

async function abrirVitrine(page: Page, { pagina = { corpo: LIGADA }, permissoes = COM_ALTERAR, loja = true, tema = 'CLARO', largura = 1280, extra = {} }: {
  pagina?: RespostasApi[string]; permissoes?: string[]; loja?: boolean; tema?: 'CLARO' | 'ESCURO'; largura?: number; extra?: RespostasApi;
} = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  // A área de transferência de verdade pede permissão no navegador de teste: guarda o texto copiado na página.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
    });
  });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, vitrineHabilitada: true, lojaHabilitada: loja })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': { corpo: ITENS },
    'GET /vitrine/configuracao': pagina,
    ...extra,
  });
  await page.goto('/treinador/vitrine');
  return api;
}

const copiado = (page: Page) => page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado);
const bloco = (page: Page) => page.getByRole('heading', { level: 2, name: 'Página pública' });

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`vitrine: ligar a página mostra o link, que se copia inteiro (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, {
        largura, tema, pagina: { corpo: SEM_LINK }, extra: { 'PUT /vitrine/configuracao': { corpo: LIGADA } },
      });
      await expect(bloco(page)).toBeVisible();
      await expect(page.getByText('Sem link ainda', { exact: true })).toBeVisible();
      await expect(page.getByText('O link aparece quando você ligar a página.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copiar link' })).toHaveCount(0);
      // O sinal na lista: só o item ativo, digital e marcado.
      await expect(page.getByText('Na página pública', { exact: true })).toHaveCount(1);
      await capturar(page, `vitrine-sem-link-${tema.toLowerCase()}-${largura}`);

      await page.getByRole('switch', { name: 'Página ligada' }).click();
      await expect(page.getByText('Página ligada.')).toBeVisible();
      await expect(page.getByText('Ligada', { exact: true })).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/vitrine/configuracao')?.corpo).toEqual({ paginaLigada: true, noMarketplace: false, versao: null });
      const link = `${new URL(page.url()).origin}/loja/${CODIGO}`;
      await expect(page.getByTestId('link-da-pagina-publica')).toHaveText(link);
      await capturar(page, `vitrine-ligada-${tema.toLowerCase()}-${largura}`);

      await page.getByRole('button', { name: 'Copiar link' }).click();
      await expect(page.getByText('Link copiado.')).toBeVisible();
      expect(await copiado(page)).toBe(link);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('vitrine: gerar novo link pede confirmação e manda a versão', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, {
    largura: 390,
    extra: { 'POST /vitrine/configuracao/novo-link': { corpo: { paginaLigada: true, codigo: CODIGO_NOVO, versao: 2 } } },
  });
  await page.getByRole('button', { name: 'Gerar novo link' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Gerar novo link?' });
  await expect(painel.getByText('O link atual deixa de funcionar. Quem o tiver vai ver "Página não encontrada.".')).toBeVisible();
  await capturar(page, 'vitrine-novo-link-390');
  expect(pedidos.some((p) => p.caminho.endsWith('/novo-link'))).toBe(false);
  await painel.getByRole('button', { name: 'Gerar novo link' }).click();
  await expect(page.getByText('Novo link gerado. O anterior parou de funcionar.')).toBeVisible();
  await expect(page.getByTestId('link-da-pagina-publica')).toHaveText(new RegExp(`/loja/${CODIGO_NOVO}$`));
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/vitrine/configuracao/novo-link')?.corpo).toEqual({ versao: 1 });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vitrine: 409 avisa e busca a configuração de novo', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, {
    extra: { 'PUT /vitrine/configuracao': erroApi(409, 'Alterado em outro lugar.', 'CONFLITO_EDICAO') },
  });
  await page.getByRole('switch', { name: 'Página ligada' }).click();
  await expect(page.getByText('A página foi alterada em outro lugar. Recarregamos para você conferir.')).toBeVisible();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/vitrine/configuracao').length).toBe(2);
  expect(pedidos.find((p) => p.metodo === 'PUT')?.corpo).toEqual({ paginaLigada: false, noMarketplace: false, versao: 1 });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vitrine: o interruptor do item vale só para digital; trocar para físico o desliga', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirVitrine(page);
  await page.getByRole('button', { name: 'Editar Camiseta do time' }).click();
  let folha = page.getByRole('dialog', { name: 'Editar item' });
  await expect(folha.getByRole('switch', { name: 'Aparece na página pública' })).toBeDisabled();
  await expect(folha.getByText('Só item digital pode aparecer na página pública.')).toBeVisible();
  await folha.getByText('Só item digital pode aparecer na página pública.').scrollIntoViewIfNeeded();
  await capturar(page, 'vitrine-item-fisico-1280');
  await page.keyboard.press('Escape');
  await expect(folha).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar Planilha de força' }).click();
  folha = page.getByRole('dialog', { name: 'Editar item' });
  const interruptor = folha.getByRole('switch', { name: 'Aparece na página pública' });
  await expect(interruptor).toBeEnabled();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await folha.getByRole('radio', { name: 'Físico' }).click();
  await expect(interruptor).toBeDisabled();
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vitrine: editar o preço de um item marcado mantém naPaginaPublica no PUT', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, {
    extra: { 'PUT /vitrine/itens/{id}': { corpo: { ...MARCADO, precoCentavos: 8900, precoVigenteCentavos: 8900, versao: 2 } } },
  });
  await page.getByRole('button', { name: 'Editar Planilha de força' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar item' });
  await folha.getByLabel('Preço (opcional)', { exact: true }).fill('89,00');
  await folha.getByRole('button', { name: 'Salvar item' }).click();
  await expect(page.getByText('Item salvo.')).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/vitrine/itens/${MARCADO.id}`)?.corpo)
    .toMatchObject({ precoCentavos: 8900, naPaginaPublica: true, tipo: 'DIGITAL', versao: 1 });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vitrine só leitura: vê a situação e copia o link, sem ligar nem gerar link', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, { permissoes: [...PERMISSOES_TREINADOR, 'VITRINE_LER'] });
  await expect(page.getByText('Ligada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar link' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Página ligada' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gerar novo link' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver Planilha de força' }).click();
  await expect(page.getByRole('dialog', { name: 'Item da vitrine' }).getByText('Aparece', { exact: true })).toBeVisible();
  expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho.startsWith('/vitrine'))).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vitrine sem lojaHabilitada: sem bloco, sem selo, sem interruptor e sem buscar a configuração', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrirVitrine(page, { loja: false });
  await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar Planilha de força' })).toBeVisible();
  await expect(bloco(page)).toHaveCount(0);
  await expect(page.getByText('Na página pública', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar Planilha de força' }).click();
  await expect(page.getByRole('dialog', { name: 'Editar item' }).getByRole('switch', { name: 'Aparece na página pública' })).toHaveCount(0);
  expect(pedidos.filter((p) => p.caminho === '/vitrine/configuracao')).toEqual([]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
