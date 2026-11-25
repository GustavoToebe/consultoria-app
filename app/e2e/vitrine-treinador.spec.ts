import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CategoriaDaVitrine } from '../src/api/vitrineCategorias';
import type { ItemDaVitrine } from '../src/api/vitrineTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Vitrine do treinador (F1.3 de `docs/planos/vitrine-e-loja.md`; grade, foto no cadastro e categorias em
 * `docs/planos/vitrine-categorias.md`): grade de cartões agrupada por categoria ("Sem categoria" por último), "N de 30",
 * Novo item com a foto (cria e envia; a foto falha → "Editar item" com o erro, sem duplicar), formulário em seções, campo
 * Categoria (busca, criar, sugestões por tipo), ordem dentro do grupo pelo ⋯ (o caminho do teclado do arrastar), excluir,
 * teto, só leitura, chave desligada, vazio e erro. Capturas vão para `E2E_CAPTURAS` (fora do repositório). Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;

function item(n: number, extra: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Item fictício ${n}`, descricao: null, tipo: 'DIGITAL',
    precoCentavos: null, precoEspecialCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null,
    ativo: true, naPaginaPublica: false, noMarketplace: false, categoriaId: null, categoriaNome: null, ordem: n - 1, versao: 1, temFoto: false, fotoAtualizadaEm: null, ...extra,
  };
}
const categoria = (n: number, nome: string, quantidade: number): CategoriaDaVitrine => ({ id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, ordem: n - 1, quantidade });

const EBOOKS = categoria(1, 'E-books', 1);
const ROUPAS = categoria(2, 'Roupas', 2);
const CATEGORIAS = [EBOOKS, ROUPAS];
const naCategoria = (c: CategoriaDaVitrine) => ({ categoriaId: c.id, categoriaNome: c.nome });

const PLANILHA = item(1, {
  nome: 'Planilha de força', descricao: 'Doze semanas de treino.', precoCentavos: 9900, precoEspecialCentavos: 7900,
  precoVigenteCentavos: 7900, especialAte: '2099-11-30', cupom: 'FORCA10', linkUrl: 'https://loja.exemplo.invalid/planilha',
  temFoto: true, fotoAtualizadaEm: '2026-11-10T12:00:00Z', ...naCategoria(EBOOKS),
});
const CAMISETA = item(2, { nome: 'Camiseta do time', tipo: 'FISICO', precoCentavos: 8000, precoVigenteCentavos: 8000, ...naCategoria(ROUPAS) });
const BONE = item(3, { nome: 'Boné do time', tipo: 'FISICO', precoCentavos: 5000, precoVigenteCentavos: 5000, ...naCategoria(ROUPAS) });
const GARRAFA = item(4, { nome: 'Garrafa antiga', tipo: 'FISICO', ativo: false });
/** Na ordem da API: categorias na ordem, sem categoria por último. */
const ITENS = [PLANILHA, CAMISETA, BONE, GARRAFA];

const COM_ALTERAR = [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR'];

async function abrir(page: Page, { itens = ITENS, categorias = CATEGORIAS, permissoes = COM_ALTERAR, ligada = true, tema = 'CLARO', largura = 1280, extra = {} }: {
  itens?: ItemDaVitrine[] | RespostasApi[string]; categorias?: CategoriaDaVitrine[] | RespostasApi[string]; permissoes?: string[]; ligada?: boolean;
  tema?: 'CLARO' | 'ESCURO'; largura?: number; extra?: RespostasApi;
} = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, vitrineHabilitada: ligada })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': Array.isArray(itens) ? { corpo: itens } : itens,
    'GET /vitrine/categorias': Array.isArray(categorias) ? { corpo: categorias } : categorias,
    'GET /vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [120, 120, 120]) }),
    ...extra,
  });
  await page.goto('/treinador/vitrine');
  return api;
}

async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-treinador-${nome}.png`, fullPage: true });
}

/** Escolhe uma foto pela galeria da web (o seletor de arquivo do navegador). */
async function escolherFoto(page: Page, alvo: Locator) {
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), alvo.click()]);
  await seletor.setFiles({ name: 'foto-ficticia.png', mimeType: 'image/png', buffer: pngDeCor(400, [200, 120, 60]) });
}

const caixa = async (l: Locator) => (await l.boundingBox())!;

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`grade: agrupada por categoria, preço especial, Inativo e o editar (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, { largura, tema });
      await expect(page.getByRole('heading', { level: 1, name: 'Vitrine' })).toBeVisible();
      await expect(page.getByText('4 itens · até 30. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['E-books', 'Roupas', 'Sem categoria']);
      await expect(page.getByRole('list', { name: 'Roupas' }).getByRole('listitem')).toHaveCount(2);
      await expect(page.getByText('Inativo', { exact: true })).toHaveCount(1);
      await expect(page.getByText('E-books · Digital', { exact: true })).toBeVisible();
      await expect(page.getByText('Sem categoria · Físico', { exact: true })).toBeVisible();
      // O preço que vale é o do servidor, com o normal riscado (o leitor de tela ouve "antes").
      await expect(page.getByLabel(/Preço: R\$\s?79,00, antes R\$\s?99,00\. Preço especial até 30\/11\/2099/)).toBeVisible();
      await expect(page.getByRole('img', { name: 'Foto de Planilha de força' })).toBeVisible();
      const camiseta = page.getByTestId(`cartao-do-item-${CAMISETA.id}`);
      const bone = page.getByTestId(`cartao-do-item-${BONE.id}`);
      const [c, b] = [await caixa(camiseta), await caixa(bone)];
      if (largura === 1280) {
        // Dois cartões da mesma categoria lado a lado, com a mesma altura.
        expect(Math.abs(c.y - b.y)).toBeLessThan(2);
        expect(Math.abs(c.height - b.height)).toBeLessThan(2);
      } else {
        // Celular: uma coluna de cartões compactos.
        expect(b.y).toBeGreaterThan(c.y + c.height - 1);
      }
      await capturar(page, `lista-${tema.toLowerCase()}-${largura}`);

      await page.getByRole('button', { name: 'Editar Planilha de força' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      await expect(folha.getByRole('button', { name: 'Trocar foto do item' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Remover foto do item' })).toBeVisible();
      await expect(folha.getByLabel('Nome', { exact: true })).toHaveValue('Planilha de força');
      await expect(folha.getByRole('button', { name: 'Categoria: E-books. Escolher.' })).toBeVisible();
      await expect(folha.getByRole('heading', { level: 3 })).toHaveText(['Item', 'Preço', 'Onde comprar', 'Visibilidade']);
      await capturar(page, `folha-${tema.toLowerCase()}-${largura}`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('grade: mais colunas em tela mais larga (1280 × 1920)', async ({ page }) => {
  const muitos = Array.from({ length: 8 }, (_, k) => item(k + 1));
  await abrir(page, { itens: muitos, categorias: [] });
  const naPrimeiraLinha = async () => {
    const ys = await Promise.all(muitos.map(async (i) => Math.round((await caixa(page.getByTestId(`cartao-do-item-${i.id}`))).y)));
    return ys.filter((y) => y === ys[0]).length;
  };
  await expect(page.getByTestId(`cartao-do-item-${muitos[0].id}`)).toBeVisible();
  const em1280 = await naPrimeiraLinha();
  await page.setViewportSize({ width: 1920, height: 900 });
  await expect.poll(naPrimeiraLinha).toBeGreaterThan(em1280);
  // As colunas ocupam a largura toda (piso de 240 px por cartão): a primeira linha termina na borda direita da grade.
  const grade = await caixa(page.getByRole('list', { name: 'Itens da vitrine' }));
  const n = await naPrimeiraLinha();
  const ultimo = await caixa(page.getByTestId(`cartao-do-item-${muitos[n - 1].id}`));
  expect(ultimo.width).toBeGreaterThanOrEqual(240);
  expect(Math.abs(ultimo.x + ultimo.width - (grade.x + grade.width))).toBeLessThan(3);
  // Sem categoria nenhuma, a lista fica sem subtítulos.
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
});

test('Novo item com foto: cria e em seguida envia a foto, no mesmo "Criar item"', async ({ page }) => {
  let lista = ITENS;
  const criado = item(5, { nome: 'Garrafa térmica', tipo: 'FISICO' });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'GET /vitrine/itens': (_, route) => json(route, lista),
      'POST /vitrine/itens': (_, route) => { lista = [...lista, criado]; return json(route, criado, 201); },
      'PUT /vitrine/itens/{id}/foto': (_, route) => json(route, { ...criado, temFoto: true, fotoAtualizadaEm: '2026-11-24T12:00:00Z' }),
    },
  });
  await page.getByRole('button', { name: 'Novo item' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo item' });
  await expect(folha.getByText('A foto entra depois de criar o item.')).toHaveCount(0);
  const area = folha.getByRole('button', { name: 'Foto do item: escolher foto. JPEG, até 300 KB' });
  await expect(area).toBeVisible();
  await folha.getByRole('button', { name: 'Criar item' }).click();
  await expect(folha.getByText('Informe o nome do item.')).toBeVisible();
  expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))).toBe(false);

  await escolherFoto(page, area);
  await expect(folha.getByRole('img', { name: 'Foto escolhida para o item' })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Trocar foto do item' })).toBeVisible();
  // Escolher no "Novo item" não envia nada: a foto vai depois de criar.
  expect(pedidos.some((p) => p.caminho.endsWith('/foto') && p.metodo === 'PUT')).toBe(false);
  await folha.getByLabel('Nome', { exact: true }).fill('Garrafa térmica');
  await folha.getByRole('radio', { name: 'Físico' }).click();
  await folha.getByRole('button', { name: 'Criar item' }).click();
  await expect(page.getByText('Item criado com a foto.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /item/ })).toHaveCount(0);
  const ordem = pedidos.filter((p) => p.metodo !== 'GET' && p.caminho.startsWith('/vitrine')).map((p) => `${p.metodo} ${p.caminho}`);
  expect(ordem).toEqual(['POST /vitrine/itens', `PUT /vitrine/itens/${criado.id}/foto`]);
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))?.corpo).toEqual({
    nome: 'Garrafa térmica', descricao: null, tipo: 'FISICO', precoCentavos: null, precoEspecialCentavos: null, especialAte: null,
    cupom: null, linkUrl: null, categoriaId: null, ativo: true, naPaginaPublica: false, noMarketplace: false,
  });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Solta um arquivo sobre o alvo, como arrastar do computador (web). */
async function soltarArquivo(page: Page, alvo: Locator, cor: [number, number, number]) {
  const base64 = pngDeCor(300, cor).toString('base64');
  const dados = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'solta.png', { type: 'image/png' }));
    return dt;
  }, base64);
  await alvo.dispatchEvent('dragover', { dataTransfer: dados });
  await alvo.dispatchEvent('drop', { dataTransfer: dados });
}

test('Novo item: soltar um arquivo na área usa a foto, e soltar outro sobre a prévia troca sem sair da tela', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page);
  await page.getByRole('button', { name: 'Novo item' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo item' });
  await soltarArquivo(page, folha.getByRole('button', { name: /^Foto do item: escolher foto/ }), [30, 160, 90]);
  const previa = folha.getByRole('img', { name: 'Foto escolhida para o item' });
  await expect(previa).toBeVisible();
  // O `Image` da web desenha a foto por dentro do nó: o HTML muda quando a foto muda.
  const html = () => previa.evaluate((el) => el.outerHTML);
  const antes = await html();
  await soltarArquivo(page, previa, [160, 30, 90]);
  await expect.poll(html).not.toBe(antes);
  await expect(page).toHaveURL(/\/treinador\/vitrine$/);
  expect(pedidos.some((p) => p.caminho.endsWith('/foto') && p.metodo === 'PUT')).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Novo item: a foto falha, a folha vira "Editar item" com o erro e tentar de novo não duplica o item', async ({ page }) => {
  let falhar = true;
  const criado = item(5, { nome: 'Garrafa térmica' });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'POST /vitrine/itens': { status: 201, corpo: criado },
      'PUT /vitrine/itens/{id}/foto': (_, route) => (falhar ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500)
        : json(route, { ...criado, temFoto: true, fotoAtualizadaEm: '2026-11-24T12:00:00Z' })),
    },
  });
  await page.getByRole('button', { name: 'Novo item' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo item' });
  await escolherFoto(page, novo.getByRole('button', { name: /^Foto do item: escolher foto/ }));
  await novo.getByLabel('Nome', { exact: true }).fill('Garrafa térmica');
  await novo.getByRole('button', { name: 'Criar item' }).click();

  const editar = page.getByRole('dialog', { name: 'Editar item' });
  await expect(editar.getByText('Item criado, mas a foto não subiu. Tente de novo.')).toBeVisible();
  await expect(editar.getByRole('img', { name: 'Foto escolhida para o item' })).toBeVisible();
  await expect(editar.getByRole('button', { name: 'Salvar item' })).toBeVisible();
  await capturar(page, 'novo-item-foto-falhou-1280');
  falhar = false;
  await editar.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('Foto do item salva.')).toBeVisible();
  await expect(editar.getByText('Item criado, mas a foto não subiu. Tente de novo.')).toHaveCount(0);
  expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/vitrine/itens')).toHaveLength(1);
  expect(pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/vitrine/itens/${criado.id}/foto`)).toHaveLength(2);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`formulário em seções: Preço, Preço especial e Até; especial só com preço; erro no campo (${largura}px)`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { largura });
    await page.getByRole('button', { name: 'Novo item' }).click();
    const folha = page.getByRole('dialog', { name: 'Novo item' });
    await expect(folha.getByRole('heading', { level: 3 })).toHaveText(['Item', 'Preço', 'Onde comprar', 'Visibilidade']);
    const preco = folha.getByLabel('Preço (opcional)', { exact: true });
    const especial = folha.getByLabel('Preço especial', { exact: true });
    const ate = folha.getByLabel('Até: prazo do preço especial');
    await expect(especial).not.toBeEditable();
    await expect(ate).not.toBeEditable();
    await expect(folha.getByText('Informe o preço para usar o preço especial.')).toBeVisible();
    if (largura === 1280) {
      const [p, e, a] = [await caixa(preco), await caixa(especial), await caixa(ate)];
      expect(Math.abs(p.y - e.y)).toBeLessThan(2);
      expect(Math.abs(p.y - a.y)).toBeLessThan(2);
      // Cupom e Link lado a lado.
      const [c, l] = [await caixa(folha.getByLabel('Cupom (opcional)')), await caixa(folha.getByLabel('Link (opcional)'))];
      expect(Math.abs(c.y - l.y)).toBeLessThan(2);
    }
    // A nota das lojas só com "Digital".
    const nota = folha.getByText('No celular, item digital mostra só foto, nome e descrição. Preço, cupom e link aparecem na web.');
    await expect(nota).toBeVisible();
    await expect(folha.getByText('0/300')).toBeVisible();
    await capturar(page, `novo-item-${largura}`);
    await folha.getByRole('radio', { name: 'Físico' }).click();
    await expect(nota).toHaveCount(0);

    await folha.getByLabel('Nome', { exact: true }).fill('Camiseta nova');
    await preco.fill('100,00');
    await expect(especial).toBeEditable();
    await especial.fill('120,00');
    await folha.getByRole('button', { name: 'Criar item' }).click();
    await expect(folha.getByText('O preço especial precisa ser menor que o preço normal.')).toBeVisible();
    expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))).toBe(false);
    // Apagar o preço apaga o especial (os campos voltam a ficar desabilitados, sem erro escondido).
    await preco.fill('');
    await expect(especial).toHaveValue('');
    await expect(folha.getByText('O preço especial precisa ser menor que o preço normal.')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('campo Categoria: sugestões pelo tipo só sem categorias, e tocar numa sugestão cria e escolhe', async ({ page }) => {
  const criada = categoria(9, 'Roupas', 0);
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    categorias: [],
    extra: { 'POST /vitrine/categorias': { status: 201, corpo: criada } },
  });
  await page.getByRole('button', { name: 'Novo item' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo item' });
  await expect(folha.getByRole('button', { name: 'Criar categoria E-books' })).toBeVisible();
  await folha.getByRole('radio', { name: 'Físico' }).click();
  await expect(folha.getByRole('button', { name: 'Criar categoria E-books' })).toHaveCount(0);
  // Nada é criado sozinho: só ao tocar.
  expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))).toBe(false);
  await folha.getByRole('button', { name: 'Criar categoria Roupas' }).click();
  await expect(folha.getByRole('button', { name: 'Categoria: Roupas. Escolher.' })).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/vitrine/categorias')?.corpo).toEqual({ nome: 'Roupas' });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('campo Categoria: a busca escolhe a que existe, cria a nova ali mesmo e mostra o 409 no campo', async ({ page }) => {
  const livros = categoria(3, 'Livros', 0);
  let duplicada = false;
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'POST /vitrine/categorias': (_, route) => (duplicada
        ? json(route, erroApi(409, 'Confira a categoria.', 'VITRINE_CATEGORIA_DUPLICADA', [{ field: 'nome', message: 'Já existe uma categoria com esse nome.' }]).corpo, 409)
        : json(route, livros, 201)),
    },
  });
  await page.getByRole('button', { name: 'Editar Camiseta do time' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar item' });
  const campo = folha.getByRole('button', { name: /^Categoria: / });
  await expect(campo).toHaveAccessibleName('Categoria: Roupas. Escolher.');
  await campo.click();
  await page.getByLabel('Buscar ou criar categoria').fill('e-boo');
  await page.getByRole('option', { name: /^E-books/ }).click();
  await expect(campo).toHaveAccessibleName('Categoria: E-books. Escolher.');
  await campo.click();
  await page.getByLabel('Buscar ou criar categoria').fill('Livros');
  await page.getByRole('option', { name: /Criar categoria “Livros”/ }).click();
  await expect(campo).toHaveAccessibleName('Categoria: Livros. Escolher.');
  duplicada = true;
  await campo.click();
  await page.getByLabel('Buscar ou criar categoria').fill('Acessórios');
  await page.getByRole('option', { name: /Criar categoria “Acessórios”/ }).click();
  await expect(folha.getByText('Já existe uma categoria com esse nome.')).toBeVisible();
  await expect(campo).toHaveAccessibleName('Categoria: Livros. Escolher.');
  expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine')).map((p) => p.corpo)).toEqual([{ nome: 'Livros' }, { nome: 'Acessórios' }]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('reordenar dentro da categoria pelo teclado (⋯ → Mover para baixo) manda a lista completa', async ({ page }) => {
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
  // Item sozinho na categoria não tem ⋯ (não há para onde mover).
  await expect(page.getByRole('button', { name: 'Ações do item Planilha de força' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ações do item Camiseta do time' }).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Ações de “Camiseta do time”' });
  await expect(menu.getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
  await menu.getByRole('button', { name: /^Mover para baixo/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Ordem alterada.')).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/vitrine/itens/ordem');
  expect(put?.corpo).toEqual({ ids: [PLANILHA.id, BONE.id, CAMISETA.id, GARRAFA.id] });
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/vitrine/itens').length).toBeGreaterThan(1);
  const roupas = page.getByRole('list', { name: 'Roupas' }).getByRole('listitem');
  await expect(roupas.first()).toContainText('Boné do time');
  // O foco volta ao ⋯ do item que se moveu.
  await expect(page.getByRole('button', { name: 'Ações do item Camiseta do time' })).toBeFocused();
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
  expect(put?.corpo).toMatchObject({ nome: 'Camiseta do time', versao: 1, linkUrl: 'https://loja.exemplo.invalid/camiseta', categoriaId: ROUPAS.id });
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
  await expect(page.getByText('3 itens · até 30. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  const apagar = pedidos.find((p) => p.metodo === 'DELETE');
  expect(apagar?.caminho).toBe(`/vitrine/itens/${GARRAFA.id}`);
  expect(apagar?.busca.get('versao')).toBe('1');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`teto: com 30 itens "Novo item" fica desabilitado com o motivo (${largura}px)`, async ({ page }) => {
    const trinta = Array.from({ length: 30 }, (_, k) => item(k + 1));
    const { naoTratadas, errosDaPagina } = await abrir(page, { itens: trinta, largura });
    await expect(page.getByText('30 itens · até 30. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo item' })).toBeDisabled();
    await expect(page.getByText(/A vitrine tem no máximo 30 itens/)).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('só leitura sem VITRINE_ALTERAR: sem criar, sem ordenar, folha sem ações', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { permissoes: [...PERMISSOES_TREINADOR, 'VITRINE_LER'] });
  await expect(page.getByText('4 itens · até 30. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo item' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Organizar categorias' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ações do item / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver Planilha de força' }).click();
  const folha = page.getByRole('dialog', { name: 'Item da vitrine' });
  await expect(folha.getByText('FORCA10')).toBeVisible();
  await expect(folha.getByText('30/11/2099')).toBeVisible();
  await expect(folha.getByText('E-books', { exact: true })).toBeVisible();
  await expect(folha.getByRole('textbox')).toHaveCount(0);
  await expect(folha.getByRole('button', { name: /Salvar|Excluir|Trocar/ })).toHaveCount(0);
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
  await expect(page.getByText('4 itens · até 30. Os alunos veem só os ativos, nesta ordem.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
