import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Alimento, CatalogoExercicio, Exercicio } from '../src/api/tipos';
import { json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Biblioteca › Importar do catálogo e Exercícios: filtro de vários grupos (`grupo` repetido na consulta), foto que
 * preenche a miniatura e abre grande ao tocar (sem marcar o item). Só dados fictícios.
 */
const AZUL = pngDeCor(16, [30, 90, 200]);

function exercicio(n: number, nome: string, grupo: string): CatalogoExercicio {
  return { id: `c000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', instrucoes: null, fonte: null, imagens: [`Foto_${n}/0.jpg`, `Foto_${n}/1.jpg`] };
}
const CATALOGO = [exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Remada baixa', 'Costas'), exercicio(3, 'Agachamento', 'Quadríceps'), exercicio(4, 'Tríceps testa', 'Tríceps')];
const GRUPOS = ['Costas', 'Peito', 'Quadríceps', 'Tríceps'];

/** As fotos do catálogo são do site (`/catalogo/exercicios/...`), não da API (`/api/catalogo/...`). */
async function servirFotos(page: Page) {
  await page.route((url) => url.pathname.startsWith('/catalogo/exercicios/'), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: AZUL }));
}

test('catálogo: marcar vários grupos filtra por "ou", Marcar todos age só no que o filtro deixa e Esc fecha', async ({ page }) => {
  await servirFotos(page);
  const consultas: string[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /catalogo/exercicios/grupos': { corpo: GRUPOS },
    'GET /catalogo/exercicios': (pedido, route) => {
      consultas.push(pedido.busca.getAll('grupo').join('|'));
      const grupos = pedido.busca.getAll('grupo');
      const itens = CATALOGO.filter((e) => grupos.length === 0 || grupos.includes(e.grupoMuscular ?? ''));
      return json(route, { itens, total: itens.length });
    },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
  await expect(page.getByText('Tríceps testa', { exact: true })).toBeVisible();

  // O grupo fica no painel "Filtros avançados" da barra de filtros (o botão "Filtros" abre).
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  const campo = page.getByRole('button', { name: 'Grupo: Todos. Escolher.' });
  await campo.click();
  const painel = page.getByRole('dialog', { name: 'Grupo' });
  await expect(painel).toBeVisible();
  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await painel.getByRole('checkbox', { name: 'Costas' }).click();
  // Marcar não fecha a lista; a consulta leva os dois grupos, repetidos (um `grupo` por valor).
  await expect(painel).toBeVisible();
  await expect.poll(() => consultas.at(-1)).toBe('Costas|Peito');
  await expect(page.getByText('Agachamento', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
  await expect(page.getByText('Remada baixa', { exact: true })).toBeVisible();

  // "Marcar todos" com filtro digitado marca só os visíveis (sem acento: "triceps" acha "Tríceps").
  await painel.getByRole('textbox', { name: 'Filtro' }).fill('triceps');
  await expect(painel.getByRole('checkbox', { name: 'Peito' })).toHaveCount(0);
  await painel.getByRole('checkbox', { name: 'Marcar todos os visíveis' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('Costas|Peito|Tríceps');
  await painel.getByRole('textbox', { name: 'Filtro' }).fill('');
  await painel.getByRole('button', { name: 'Limpar Grupo' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('');

  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grupo: Peito. Escolher.' })).toBeVisible();
  // O "Filtrado por" mostra o grupo, e o ✕ do chip tira o filtro.
  await page.getByRole('button', { name: 'Tirar filtro: Grupo: Peito' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('');

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('catálogo: a foto preenche a miniatura e, ao tocar, abre grande sem marcar o item', async ({ page }) => {
  await servirFotos(page);
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /catalogo/exercicios/grupos': { corpo: GRUPOS },
    'GET /catalogo/exercicios': { corpo: { itens: [CATALOGO[0]], total: 1 } },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  const foto = page.getByRole('button', { name: /Demonstração: Supino reto\. Tocar para ampliar/ });
  await expect(foto).toBeVisible();
  await expect(foto.locator('img').first()).toHaveCSS('object-fit', 'cover');

  await foto.click();
  const grande = page.getByRole('dialog', { name: 'Demonstração: Supino reto' });
  await expect(grande).toBeVisible();
  await expect(grande.locator('img').first()).toHaveCSS('object-fit', 'contain');
  // Tocar na foto só amplia: o item não foi marcado.
  await page.keyboard.press('Escape');
  await expect(grande).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importar selecionados (0)' })).toBeVisible();

  // Tocar no nome marca.
  await page.getByText('Supino reto', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importar selecionados (1)' })).toBeVisible();

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('catálogo de alimentos mostra o fator, a importação copia e a biblioteca exibe', async ({ page }) => {
  const abacaxi = {
    id: 'a0000001-0000-4000-8000-000000000000', nome: 'Abacaxi com casca', baseQuantidade: 100, baseUnidade: 'g',
    kcal: 48, proteina: 0.9, carboidrato: 12.3, gordura: 0.1, fonte: 'TACO (nutrientes de Abacaxi, cru)', grupo: 'Frutas',
    codigoFonte: null, tracos: [], fatorCorrecao: 1.75, fatorCoccao: null,
  };
  let naBiblioteca: object[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /alimentos': (_pedido, route) => json(route, naBiblioteca),
    'GET /catalogo/exercicios/grupos': { corpo: [] },
    'GET /catalogo/exercicios': { corpo: { itens: [], total: 0 } },
    'GET /catalogo/alimentos/grupos': { corpo: ['Frutas'] },
    'GET /catalogo/alimentos': { corpo: { itens: [abacaxi], total: 1 } },
    'POST /alimentos/importar-catalogo': (_pedido, route) => {
      naBiblioteca = [{
        id: 'b0000001-0000-4000-8000-000000000000', nome: abacaxi.nome, baseQuantidade: 100, baseUnidade: 'g',
        kcal: 48, proteina: 0.9, carboidrato: 12.3, gordura: 0.1, gramasPorUnidade: null, fonte: abacaxi.fonte,
        origem: 'CATALOGO', fatorCorrecao: 1.75, fatorCoccao: null,
      }];
      return json(route, { importados: 1, ignorados: 0 });
    },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  await page.getByRole('radiogroup', { name: 'Catálogo' }).getByRole('radio', { name: 'Alimentos' }).click();
  await expect(page.getByText('Abacaxi com casca', { exact: true })).toBeVisible();
  await expect(page.getByText('FC 1,75')).toBeVisible();
  await page.getByText('Abacaxi com casca', { exact: true }).click();
  await page.getByRole('button', { name: 'Importar selecionados (1)' }).click();
  await expect(page.getByText('1 importado(s).')).toBeVisible();

  await page.goto('/treinador/biblioteca?aba=alimentos');
  await expect(page.getByText('Abacaxi com casca', { exact: true })).toBeVisible();
  await expect(page.getByText('FC 1,75')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/**
 * Folha "Editar alimento": as sugestões de grupo e os perfis de FC e FCc quebram linha dentro da folha (antes a fileira
 * passava da borda e os chips apareciam cortados, "Cere…", "Feijã…"). Confere a caixa de cada opção contra a da folha.
 * No claro também confere o "Novo alimento" e a confirmação do "Tirar da biblioteca". Com `CAPTURAS_DIR` roda os
 * quatro temas e grava as partes da folha em cada tema e largura.
 */
const ARROZ: Alimento = {
  id: 'f0000001-0000-4000-8000-000000000000', nome: 'Arroz branco cozido', baseQuantidade: 100, baseUnidade: 'g',
  kcal: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2, gramasPorUnidade: null, fonte: 'Plano do treinador (exemplo)',
  origem: 'MANUAL', fatorCorrecao: 1, fatorCoccao: 2.6, grupo: null,
};
const GRUPOS_LONGOS = ['Bebidas (alcoólicas e não alcoólicas)', 'Carnes', 'Carnes e derivados', 'Cereais e derivados',
  'Frutas e derivados', 'Leguminosas e derivados', 'Leite e derivados', 'Gorduras e óleos', 'Pescados e frutos do mar'];
const TEMAS_DA_FOLHA = {
  claro: { tema: 'CLARO' }, escuro: { tema: 'ESCURO' }, areia: { tema: 'AREIA' }, 'contraste-alto': { tema: 'CLARO', contraste: 'ALTO' },
} as const;

/** Todas as opções de escolha da folha cabem na largura dela. */
async function opcoesDentroDa(folha: Locator, minimo: number) {
  const caixa = (await folha.boundingBox())!;
  const opcoes = await folha.getByRole('radio').all();
  expect(opcoes.length).toBeGreaterThan(minimo);
  for (const opcao of opcoes) {
    const b = (await opcao.boundingBox())!;
    const nome = await opcao.getAttribute('aria-label');
    expect(b.x, `${nome} começa antes da folha`).toBeGreaterThanOrEqual(caixa.x - 0.5);
    expect(b.x + b.width, `${nome} passa da borda direita da folha`).toBeLessThanOrEqual(caixa.x + caixa.width + 0.5);
  }
}

// Os outros temas só mudam as capturas: sem CAPTURAS_DIR roda só o claro, para não gastar minutos da CI.
const temasDaFolha = process.env.CAPTURAS_DIR ? Object.entries(TEMAS_DA_FOLHA) : [['claro', TEMAS_DA_FOLHA.claro] as const];

for (const largura of [390, 1280]) {
  for (const [nomeDoTema, preferencias] of temasDaFolha) {
    test(`folha do alimento em ${largura}px, tema ${nomeDoTema}: nenhum chip passa da borda da folha`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
      await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)), [TREINADOR.id, preferencias] as const);
      let tirados = 0;
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /alimentos': { corpo: [ARROZ] },
        'GET /catalogo/alimentos/grupos': { corpo: GRUPOS_LONGOS },
        'DELETE /alimentos/{id}': (_p, route) => { tirados += 1; return route.fulfill({ status: 204 }); },
      });
      await page.goto('/treinador/biblioteca?aba=alimentos');
      await page.getByRole('button', { name: `Editar ${ARROZ.nome}` }).click();
      const folha = page.getByRole('dialog', { name: 'Editar alimento' });
      await expect(folha.getByRole('radiogroup', { name: 'Sugestões de grupo' })).toBeVisible();
      await expect(folha.getByRole('radio', { name: 'Feijão/leguminosa cozida (1,85)' })).toBeAttached();
      await opcoesDentroDa(folha, 20);

      if (process.env.CAPTURAS_DIR) {
        await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/alimento-${largura}-${nomeDoTema}-topo.png`, animations: 'disabled' });
        await folha.getByRole('heading', { name: 'Porção e macronutrientes' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/alimento-${largura}-${nomeDoTema}-porcao.png`, animations: 'disabled' });
        await folha.getByRole('heading', { name: 'Lista de compras' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/alimento-${largura}-${nomeDoTema}-meio.png`, animations: 'disabled' });
        await folha.getByRole('button', { name: 'Tirar da biblioteca' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/alimento-${largura}-${nomeDoTema}-fim.png`, animations: 'disabled' });
      }

      if (nomeDoTema === 'claro') {
        // Novo alimento: as mesmas sugestões de grupo aparecem e também cabem na folha.
        await folha.getByRole('button', { name: 'Cancelar' }).click();
        await page.getByRole('button', { name: 'Novo alimento' }).click();
        const novo = page.getByRole('dialog', { name: 'Novo alimento' });
        await expect(novo.getByRole('radiogroup', { name: 'Sugestões de grupo' }).getByRole('radio', { name: 'Cereais e derivados' })).toBeVisible();
        await expect(novo.getByRole('button', { name: 'Tirar da biblioteca' })).toHaveCount(0);
        await opcoesDentroDa(novo, 20);
        if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/alimento-${largura}-novo.png`, animations: 'disabled' });
        await novo.getByRole('button', { name: 'Cancelar' }).click();

        // Tirar da biblioteca: a área separada no fim da folha continua abrindo a confirmação.
        await page.getByRole('button', { name: `Editar ${ARROZ.nome}` }).click();
        await page.getByRole('dialog', { name: 'Editar alimento' }).getByRole('button', { name: 'Tirar da biblioteca' }).click();
        await expect(page.getByText(`Tirar “${ARROZ.nome}” da biblioteca?`)).toBeVisible();
        expect(tirados).toBe(0);
        await page.getByRole('button', { name: 'Tirar da biblioteca' }).click();
        await expect(page.getByText(`“${ARROZ.nome}” saiu da biblioteca.`)).toBeVisible();
        expect(tirados).toBe(1);
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('exercícios da biblioteca: filtro de vários grupos no servidor', async ({ page }) => {
  await servirFotos(page);
  const doTreinador = (n: number, nome: string, grupo: string): Exercicio => ({
    id: `e000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
    observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
  });
  const consultas: string[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa([doTreinador(1, 'Supino', 'Peito'), doTreinador(2, 'Remada', 'Costas'), doTreinador(3, 'Agacho', 'Pernas')], consultas),
  });
  await page.goto('/treinador/biblioteca');
  await expect(page.getByText('Agacho', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  await page.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
  const painel = page.getByRole('dialog', { name: 'Grupo muscular' });
  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await painel.getByRole('checkbox', { name: 'Costas' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Supino', { exact: true })).toBeVisible();
  await expect(page.getByText('Remada', { exact: true })).toBeVisible();
  await expect(page.getByText('Agacho', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Filtros, 1 ligado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Costas, Peito' })).toBeVisible();
  // O filtro vai ao servidor, com o grupo repetido na consulta.
  expect(consultas.at(-1)).toContain('grupo=Costas&grupo=Peito');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
