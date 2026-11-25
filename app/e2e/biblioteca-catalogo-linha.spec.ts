import { expect, test, type Page } from '@playwright/test';

import type { Alimento, CatalogoAlimento, CatalogoExercicio } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Biblioteca › Importar do catálogo no padrão das abas Exercícios e Alimentos (24/11): a linha de detalhe com a bolinha
 * da modalidade e a legenda; a linha de valores dos alimentos com "Tr" e a legenda dele só quando aparece; o selo "Já na
 * biblioteca" com a caixa desabilitada; os filtros na API (Modalidade, Imagem, "Na biblioteca"); e o "Marque ao menos um"
 * só depois de tocar em Importar sem nada marcado. Só dados fictícios, API simulada.
 */
const FOTO = pngDeCor(16, [60, 90, 140]);
const ex = (n: number, nome: string, modalidade: CatalogoExercicio['modalidade'], grupo: string, equipamento: string | null, imagens: boolean, naBiblioteca = false): CatalogoExercicio => ({
  id: `c000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento, modalidade, instrucoes: null, fonte: null,
  imagens: imagens ? [`Foto_${n}/0.jpg`] : [], naBiblioteca,
});
const ABDOMINAL = ex(1, 'Abdominal na polia (fictício)', 'MAQUINA', 'Abdômen', 'Polia', true, true);
const PRANCHA = ex(2, 'Prancha (fictício)', 'PESO_CORPORAL', 'Abdômen', 'Peso corporal', false);
const REMADA = ex(3, 'Remada curvada (fictício)', 'LIVRE', 'Costas', 'Barra', true);
const EXERCICIOS = [ABDOMINAL, PRANCHA, REMADA];

const al = (n: number, nome: string, base: number, unidade: string, p: number, c: number, g: number, fibra: number | null, grupo: string, fc: number | null, fcc: number | null, tracos: string[] = []): CatalogoAlimento => ({
  id: `a000000${n}-0000-4000-8000-000000000000`, nome, baseQuantidade: base, baseUnidade: unidade, kcal: 96, proteina: p, carboidrato: c, gordura: g, fibra,
  fonte: 'Tabela fictícia', grupo, codigoFonte: null, tracos, fatorCorrecao: fc, fatorCoccao: fcc,
});
const ABACATE = al(1, 'Abacate (fictício)', 100, 'g', 1.2, 6, 8.4, 6.3, 'Frutas e derivados', 1.45, 1);
const LEITE = al(2, 'Leite (fictício)', 200, 'ml', 6.4, 9.4, 6.6, null, 'Leite e derivados', 1, 1);
const ACUCAR = al(3, 'Açúcar (fictício)', 100, 'g', 0, 99.5, 0, 0, 'Produtos açucarados', null, null, ['proteina', 'gordura', 'fibra']);

async function abrir(page: Page, largura: number, alimentos: CatalogoAlimento[] = [ABACATE, LEITE], biblioteca: Alimento[] = []) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await page.route((url) => url.pathname.startsWith('/catalogo/exercicios/'), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: FOTO }));
  const consultas: string[] = [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /catalogo/exercicios/grupos': { corpo: ['Abdômen', 'Costas'] },
    'GET /catalogo/exercicios': (p: PedidoFalso, route) => {
      consultas.push(p.busca.toString());
      const mod = p.busca.getAll('modalidade');
      const imagem = p.busca.get('imagem');
      const na = p.busca.get('naBiblioteca');
      const itens = EXERCICIOS.filter((e) => (!mod.length || mod.includes(e.modalidade)) && (imagem === null || (e.imagens.length > 0) === (imagem === 'true'))
        && (na === null || !!e.naBiblioteca === (na === 'true')));
      return json(route, { itens, total: itens.length });
    },
    'GET /alimentos': { corpo: biblioteca },
    'GET /catalogo/alimentos/grupos': { corpo: ['Frutas e derivados', 'Leite e derivados'] },
    'GET /catalogo/alimentos': (p: PedidoFalso, route) => {
      consultas.push(p.busca.toString());
      return json(route, { itens: alimentos, total: alimentos.length });
    },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  await expect(page.getByText(ABDOMINAL.nome, { exact: true })).toBeVisible();
  return { ...api, consultas };
}

const paraAlimentos = (page: Page) => page.getByRole('radiogroup', { name: 'Catálogo' }).getByRole('radio', { name: 'Alimentos' }).click();

for (const largura of [390, 1280]) {
  test(`catálogo de exercícios em ${largura}px: linha com a modalidade, legenda, ícone de imagem e "Já na biblioteca" com a caixa desabilitada`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura);
    // A mesma legenda da aba Exercícios, só com as modalidades da lista.
    await expect(page.getByRole('list', { name: 'Cores das modalidades' }).getByRole('listitem')).toHaveText(['Peso livre', 'Máquina', 'Peso corporal']);
    await expect(page.getByText('Máquina · Abdômen · Polia', { exact: true })).toBeVisible();
    // Equipamento que só repete a modalidade sai ("Peso corporal · Abdômen", não "… · Peso corporal").
    await expect(page.getByText('Peso corporal · Abdômen', { exact: true })).toBeVisible();
    // Ícone neutro de imagem nos que têm foto; vídeo, nunca (o catálogo não tem).
    await expect(page.getByRole('img', { name: 'Tem imagem' })).toHaveCount(2);
    await expect(page.getByRole('img', { name: 'Tem vídeo' })).toHaveCount(0);

    // Já na biblioteca: selo neutro, caixa desabilitada com o motivo no nome e na dica; tocar no nome não marca.
    await expect(page.getByText('Já na biblioteca', { exact: true })).toHaveCount(1);
    const caixa = page.getByRole('checkbox', { name: `${ABDOMINAL.nome}, já na biblioteca` });
    await expect(caixa).toBeDisabled();
    await expect(caixa.locator('..')).toHaveAttribute('title', /Já está na sua biblioteca/);
    await page.getByText(ABDOMINAL.nome, { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Importar selecionados (0)' })).toBeVisible();
    // Os outros marcam como antes.
    await page.getByRole('checkbox', { name: REMADA.nome, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Importar selecionados (1)' })).toBeVisible();
    // O selo vem da API do catálogo: a tela não busca mais a biblioteca inteira para comparar nomes.
    expect(pedidos.filter((p) => p.caminho.endsWith('/exercicios') && !p.caminho.includes('catalogo')).map((p) => p.caminho)).toEqual([]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`catálogo de exercícios em ${largura}px: Modalidade, Imagem e "Na biblioteca" vão à API, com chips e "Limpar filtros"`, async ({ page }) => {
    const { consultas, naoTratadas, errosDaPagina } = await abrir(page, largura);
    await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
    const painel = page.getByRole('dialog', { name: 'Filtros do catálogo' });
    // Os filtros da aba Exercícios, sem o Vídeo (o catálogo não tem vídeo), e o "Na biblioteca".
    await expect(painel.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' })).toBeVisible();
    await expect(painel.getByRole('radiogroup', { name: 'Vídeo' })).toHaveCount(0);
    await painel.getByRole('checkbox', { name: 'Máquina' }).click();
    await painel.getByRole('checkbox', { name: 'Peso corporal' }).click();
    await painel.getByRole('radiogroup', { name: 'Imagem' }).getByRole('radio', { name: 'Com imagem' }).click();
    await expect(painel.getByRole('radiogroup', { name: 'Na biblioteca' }).getByRole('radio')).toHaveText(['Todos', 'Ainda não', 'Já tenho']);
    await painel.getByRole('radiogroup', { name: 'Na biblioteca' }).getByRole('radio', { name: 'Ainda não' }).click();
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect.poll(() => consultas.at(-1)).toBe('modalidade=MAQUINA&modalidade=PESO_CORPORAL&imagem=true&naBiblioteca=false');
    await expect(page.getByRole('button', { name: 'Filtros, 3 ligados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Na biblioteca: Ainda não' })).toBeVisible();
    await expect(page.getByText(ABDOMINAL.nome, { exact: true })).toHaveCount(0);
    await expect(page.getByText(PRANCHA.nome, { exact: true })).toHaveCount(0);
    await expect(page.getByText(REMADA.nome, { exact: true })).toHaveCount(0);
    // Nada sobrou: o vazio oferece "Limpar filtros", que volta tudo.
    await expect(page.getByText('Nenhum resultado no catálogo')).toBeVisible();
    await page.getByRole('button', { name: 'Tirar filtro: Imagem: Com imagem' }).click();
    await expect.poll(() => consultas.at(-1)).toBe('modalidade=MAQUINA&modalidade=PESO_CORPORAL&naBiblioteca=false');
    await expect(page.getByText(PRANCHA.nome, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await expect.poll(() => consultas.at(-1)).toBe('');
    await expect(page.getByText(ABDOMINAL.nome, { exact: true })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`catálogo de alimentos em ${largura}px: a linha da aba Alimentos, legenda com Fibra e "Tr" só quando aparece`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    await paraAlimentos(page);
    await expect(page.getByText(ABACATE.nome, { exact: true })).toBeVisible();
    // Linha 2 (números): "Por 100 g", kcal, P, C, G e Fibra com uma casa; ausente é "—" sem unidade; ml diz "Por 200 ml".
    await expect(page.getByText('Por 100 g', { exact: true })).toBeVisible();
    await expect(page.getByText('Fibra 6,3 g', { exact: true })).toBeVisible();
    await expect(page.getByText('Por 200 ml', { exact: true })).toBeVisible();
    await expect(page.getByText('Fibra —', { exact: true })).toBeVisible();
    // Linha 3 (texto): grupo e fatores, na ordem da aba Alimentos.
    await expect(page.getByText(/^Frutas e derivados · FC 1,45 · FCc 1 \(100 g na dieta/)).toBeVisible();
    await expect(page.getByText('Leite e derivados · Peso direto (sem perda na limpeza/cocção)', { exact: true })).toBeVisible();
    await expect(page.getByText('Fibra', { exact: true })).toBeVisible();
    // Sem traço na página, sem a legenda dele.
    await expect(page.getByText('Tr = traço (quantidade mínima)')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('catálogo de alimentos: com traço na página, "Tr" no lugar do número (nunca 0) e a legenda explica', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, [ABACATE, ACUCAR]);
  await paraAlimentos(page);
  await expect(page.getByText(ACUCAR.nome, { exact: true })).toBeVisible();
  await expect(page.getByText('Tr = traço (quantidade mínima)', { exact: true })).toBeVisible();
  await expect(page.getByText('P Tr', { exact: true })).toBeVisible();
  await expect(page.getByText('G Tr', { exact: true })).toBeVisible();
  await expect(page.getByText('Fibra Tr', { exact: true })).toBeVisible();
  await expect(page.getByText('C 99,5 g', { exact: true })).toBeVisible();
  await expect(page.getByText('P 0,0 g', { exact: true })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('catálogo de alimentos: a mesma linha que a aba Alimentos mostra para o mesmo alimento', async ({ page }) => {
  const daBiblioteca: Alimento = {
    id: 'b0000001-0000-4000-8000-000000000000', nome: ABACATE.nome, baseQuantidade: 100, baseUnidade: 'g', kcal: 96, proteina: 1.2, carboidrato: 6, gordura: 8.4,
    fibra: 6.3, gramasPorUnidade: null, fonte: null, origem: 'CATALOGO', fatorCorrecao: 1.45, fatorCoccao: 1, grupo: 'Frutas e derivados',
  };
  await abrir(page, 1280, [ABACATE], [daBiblioteca]);
  await paraAlimentos(page);
  const linhaDoCatalogo = await page.getByText(ABACATE.nome, { exact: true }).locator('..').innerText();
  await page.goto('/treinador/biblioteca?aba=alimentos');
  await expect(page.getByText(ABACATE.nome, { exact: true })).toBeVisible();
  const linhaDaAba = await page.getByText(ABACATE.nome, { exact: true }).locator('..').innerText();
  expect(linhaDoCatalogo).toBe(linhaDaAba);
});

test('Importar sem nada marcado: o aviso só aparece depois do toque e some ao marcar', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, 1280);
  const aviso = page.getByText('Marque ao menos um item para importar.');
  const importar = page.getByRole('button', { name: 'Importar selecionados (0)' });
  await expect(importar).toBeEnabled();
  await expect(aviso).toHaveCount(0);
  await importar.click();
  await expect(aviso).toBeVisible();
  expect(pedidos.filter((p) => p.caminho.includes('importar-catalogo')).map((p) => p.caminho)).toEqual([]);
  await page.getByRole('checkbox', { name: REMADA.nome, exact: true }).click();
  await expect(aviso).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importar selecionados (1)' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('catálogo de alimentos: Unidade e "Na biblioteca" vão à API, com chips', async ({ page }) => {
  const { consultas, naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await paraAlimentos(page);
  await expect(page.getByText(ABACATE.nome, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  const painel = page.getByRole('dialog', { name: 'Filtros do catálogo' });
  await painel.getByRole('button', { name: 'Unidade: Todas as unidades. Escolher.' }).click();
  const lista = page.getByRole('dialog', { name: 'Unidade' });
  await lista.getByRole('checkbox', { name: 'Mililitros (ml)', exact: true }).click();
  await page.keyboard.press('Escape');
  await painel.getByRole('radiogroup', { name: 'Na biblioteca' }).getByRole('radio', { name: 'Já tenho' }).click();
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('unidade=ml&naBiblioteca=true');
  await expect(page.getByRole('button', { name: 'Tirar filtro: Unidade: Mililitros (ml)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar filtro: Na biblioteca: Já tenho' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Mesmas colunas por largura que a aba Exercícios: o começo (x) distinto dos títulos das linhas, nas duas abas. */
for (const largura of [1280, 1920]) {
  test(`catálogo e aba Exercícios em ${largura}px: o mesmo número de colunas`, async ({ page }) => {
    const muitos = Array.from({ length: 8 }, (_, i) => ex(10 + i, `Exercício do catálogo ${i + 1}`, 'LIVRE', 'Costas', 'Barra', true));
    EXERCICIOS.push(...muitos);
    try {
      await abrir(page, largura);
      const colunas = async (nomes: string[]) => {
        const xs = await Promise.all(nomes.map(async (n) => Math.round((await page.getByText(n, { exact: true }).boundingBox())!.x)));
        return new Set(xs).size;
      };
      await expect(page.getByText(muitos[7].nome, { exact: true })).toBeVisible();
      const doCatalogo = await colunas(muitos.map((e) => e.nome));
      await page.route('**/api/exercicios/pagina**', (route) => json(route, {
        itens: muitos.map((e, i) => ({ id: `e000000${i}-0000-4000-8000-000000000000`, nome: `Da biblioteca ${i + 1}`, grupoMuscular: 'Costas', equipamento: 'Barra',
          modalidade: 'LIVRE', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null })),
        total: muitos.length, grupos: ['Costas'], modalidades: ['LIVRE'],
      }));
      await page.goto('/treinador/biblioteca?aba=exercicios');
      await expect(page.getByText('Da biblioteca 8', { exact: true })).toBeVisible();
      const daAba = await colunas(muitos.map((_, i) => `Da biblioteca ${i + 1}`));
      expect(doCatalogo).toBe(daAba);
      expect(doCatalogo).toBe(largura >= 1920 ? 2 : 1);
    } finally {
      EXERCICIOS.splice(3);
    }
  });
}
