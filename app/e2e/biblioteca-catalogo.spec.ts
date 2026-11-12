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
  // O "Filtrando:" mostra o grupo, e o ✕ do chip tira o filtro.
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
 * Folha "Editar alimento": Grupo, FC e FCc são listas de escolha única (`EscolhaSuspensa`) em vez de chips. Cada lista
 * abre por cima da folha (PC) ou numa folha própria (celular), com as opções inteiras dentro da janela; o Esc fecha só a
 * lista e o foco volta ao botão. No claro também confere o teclado da lista sem busca (FC), o "Novo alimento" e a
 * confirmação do "Tirar da biblioteca". Com `CAPTURAS_DIR` roda os quatro temas e três larguras e grava as partes da
 * folha, com as listas abertas.
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

/** Botão fechado da lista: "Rótulo: valor. Escolher." (o leitor de tela ouve o rótulo e o valor escolhido). */
const botaoDa = (onde: Locator | Page, rotulo: string, valor: string) => onde.getByRole('button', { name: `${rotulo}: ${valor}. Escolher.`, exact: true });

/** Todas as opções da lista aberta cabem na largura da janela, e a lista não sai da janela por baixo. */
async function listaNaJanela(page: Page, lista: Locator, quantas: number) {
  const janela = page.viewportSize()!;
  const opcoes = await lista.getByRole('option').all();
  expect(opcoes).toHaveLength(quantas);
  for (const opcao of opcoes) {
    const b = (await opcao.boundingBox())!;
    const nome = await opcao.getAttribute('aria-label');
    expect(b.x, `${nome} começa fora da janela`).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width, `${nome} passa da borda direita`).toBeLessThanOrEqual(janela.width + 0.5);
  }
  const caixa = (await lista.boundingBox())!;
  expect(caixa.y).toBeGreaterThanOrEqual(-0.5);
}

async function abrirAlimento(page: Page, largura: number, alimentos: Alimento[], preferencias: object = TEMAS_DA_FOLHA.claro) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)), [TREINADOR.id, preferencias] as const);
  let tirados = 0;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: alimentos },
    'GET /catalogo/alimentos/grupos': { corpo: GRUPOS_LONGOS },
    'PUT /alimentos/{id}': (p, route) => json(route, { ...alimentos[0], ...(p.corpo as object) }),
    'DELETE /alimentos/{id}': (_p, route) => { tirados += 1; return route.fulfill({ status: 204 }); },
  });
  await page.goto('/treinador/biblioteca?aba=alimentos');
  await page.getByRole('button', { name: `Editar ${alimentos[0].nome}` }).click();
  return { ...api, tirados: () => tirados, folha: page.getByRole('dialog', { name: 'Editar alimento' }) };
}

// Os outros temas e o 768 só mudam as capturas: sem CAPTURAS_DIR roda só o claro em 390 e 1280, para não gastar minutos.
const temasDaFolha = process.env.CAPTURAS_DIR ? Object.entries(TEMAS_DA_FOLHA) : [['claro', TEMAS_DA_FOLHA.claro] as const];
const largurasDaFolha = process.env.CAPTURAS_DIR ? [390, 768, 1280] : [390, 1280];
const capturar = (page: Page, nome: string) =>
  process.env.CAPTURAS_DIR ? page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nome}.png`, animations: 'disabled' }) : Promise.resolve();

for (const largura of largurasDaFolha) {
  for (const [nomeDoTema, preferencias] of temasDaFolha) {
    test(`folha do alimento em ${largura}px, tema ${nomeDoTema}: Grupo, FC e FCc em listas de escolha única que cabem na janela`, async ({ page }) => {
      const { folha, naoTratadas, errosDaPagina, tirados } = await abrirAlimento(page, largura, [ARROZ], preferencias);
      const grupo = botaoDa(folha, 'Grupo (opcional)', 'Sem grupo');
      await expect(grupo).toBeVisible();
      await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Sem perda (1,00)')).toBeVisible();
      await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Arroz/grão cozido (2,60)')).toBeVisible();
      // Perfil escolhido: o número fica escondido (o fator está no nome).
      await expect(folha.getByLabel('Fator de correção (FC)')).toHaveCount(0);
      await expect(folha.getByLabel('Fator de cocção (FCc)')).toHaveCount(0);
      // Nada de chips de grupo nem de perfil; só os da unidade (g, ml, un) continuam.
      await expect(folha.getByRole('radiogroup', { name: 'Sugestões de grupo' })).toHaveCount(0);
      await expect(folha.getByRole('radio', { name: 'g', exact: true })).toBeVisible();
      const prefixo = `alimento-${largura}-${nomeDoTema}`;
      await capturar(page, `${prefixo}-topo`);

      // Grupo: com busca, "Sem grupo" no topo e os grupos da consultoria e do catálogo.
      await grupo.click();
      const listaDoGrupo = page.getByRole('listbox', { name: 'Grupo do alimento' });
      await listaNaJanela(page, listaDoGrupo, GRUPOS_LONGOS.length + 1);
      await expect(page.getByLabel('Buscar ou digitar um grupo')).toBeVisible();
      await capturar(page, `${prefixo}-grupo-aberto`);
      await page.keyboard.press('Escape');
      await expect(listaDoGrupo).toHaveCount(0);
      await expect(folha).toBeVisible();
      if (largura >= 768) await expect(grupo).toBeFocused();

      // FCc: com busca; busca sem resultado diz que não achou.
      await folha.getByRole('heading', { name: 'Lista de compras' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await capturar(page, `${prefixo}-meio`);
      const fcc = botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Arroz/grão cozido (2,60)');
      await fcc.click();
      const listaDoFcc = page.getByRole('listbox', { name: 'Estado na dieta e cocção (FCc)' });
      await listaNaJanela(page, listaDoFcc, 10);
      await expect(listaDoFcc.getByRole('option', { name: 'Arroz/grão cozido (2,60)', exact: true })).toHaveAttribute('aria-selected', 'true');
      await capturar(page, `${prefixo}-fcc-aberto`);
      await page.getByLabel('Buscar perfil').fill('xyz');
      await expect(page.getByText('Nenhum perfil encontrado.')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(listaDoFcc).toHaveCount(0);
      await expect(folha).toBeVisible();

      // FC: sem busca (cinco opções); o foco vai à escolhida e as setas e o Enter escolhem.
      const fc = botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Sem perda (1,00)');
      await fc.click();
      const listaDoFc = page.getByRole('listbox', { name: 'Descarte e limpeza (FC)' });
      await listaNaJanela(page, listaDoFc, 5);
      await expect(page.getByLabel('Buscar campo')).toHaveCount(0);
      await capturar(page, `${prefixo}-fc-aberto`);
      if (nomeDoTema === 'claro') {
        await expect(listaDoFc.getByRole('option', { name: 'Sem perda (1,00)', exact: true })).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(listaDoFc.getByRole('option', { name: 'Limpeza leve (1,12)', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(listaDoFc).toHaveCount(0);
        await expect(folha).toBeVisible();
        await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Limpeza leve (1,12)')).toBeVisible();
      } else {
        await page.keyboard.press('Escape');
        await expect(listaDoFc).toHaveCount(0);
      }

      if (nomeDoTema === 'claro') {
        // Novo alimento: o grupo começa vazio e a lista traz os mesmos grupos.
        await folha.getByRole('button', { name: 'Cancelar' }).click();
        await page.getByRole('button', { name: 'Novo alimento' }).click();
        const novo = page.getByRole('dialog', { name: 'Novo alimento' });
        await expect(botaoDa(novo, 'Grupo (opcional)', 'Sem grupo')).toBeVisible();
        await expect(novo.getByRole('button', { name: 'Tirar da biblioteca' })).toHaveCount(0);
        await capturar(page, `alimento-${largura}-novo`);
        await novo.getByRole('button', { name: 'Cancelar' }).click();

        // Tirar da biblioteca: a área separada no fim da folha continua abrindo a confirmação.
        await page.getByRole('button', { name: `Editar ${ARROZ.nome}` }).click();
        await page.getByRole('dialog', { name: 'Editar alimento' }).getByRole('button', { name: 'Tirar da biblioteca' }).click();
        await expect(page.getByText(`Tirar “${ARROZ.nome}” da biblioteca?`)).toBeVisible();
        expect(tirados()).toBe(0);
        await page.getByRole('button', { name: 'Tirar da biblioteca' }).click();
        await expect(page.getByText(`“${ARROZ.nome}” saiu da biblioteca.`)).toBeVisible();
        expect(tirados()).toBe(1);
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`alimento salvo em ${largura}px: grupo próprio e FC personalizado aparecem; trocar, grupo novo, Personalizado com validação e salvar`, async ({ page }) => {
    const salvo: Alimento = { ...ARROZ, id: 'f0000002-0000-4000-8000-000000000000', nome: 'Frango grelhado', grupo: 'Marmitas da semana', fatorCorrecao: 1.3, fatorCoccao: 0.78 };
    const { folha, pedidos, naoTratadas, errosDaPagina } = await abrirAlimento(page, largura, [salvo]);
    // O que foi salvo aparece como está, sem abrir as listas.
    await expect(botaoDa(folha, 'Grupo (opcional)', 'Marmitas da semana')).toBeVisible();
    await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Personalizado (1,3)')).toBeVisible();
    await expect(folha.getByLabel('Fator de correção (FC)')).toHaveValue('1,3');
    await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Carne/peixe grelhado ou assado (0,78)')).toBeVisible();
    await expect(folha.getByLabel('Fator de cocção (FCc)')).toHaveCount(0);

    // Grupo: um pedaço do nome + Enter escolhe o que já existe (o "Usar" vai no fim).
    await botaoDa(folha, 'Grupo (opcional)', 'Marmitas da semana').click();
    const busca = page.getByLabel('Buscar ou digitar um grupo');
    await busca.fill('cere');
    const lista = page.getByRole('listbox', { name: 'Grupo do alimento' });
    await expect(lista.getByRole('option')).toHaveText([/Cereais e derivados/, /Usar “cere”/]);
    await busca.press('Enter');
    await expect(botaoDa(folha, 'Grupo (opcional)', 'Cereais e derivados')).toBeVisible();
    // Grupo próprio: "Usar “…”" com o nome digitado.
    await botaoDa(folha, 'Grupo (opcional)', 'Cereais e derivados').click();
    await page.getByLabel('Buscar ou digitar um grupo').fill('Lanches   da tarde');
    await page.getByRole('option', { name: 'Usar “Lanches da tarde”, Grupo novo' }).click();
    await expect(botaoDa(folha, 'Grupo (opcional)', 'Lanches da tarde')).toBeVisible();

    // FC: um perfil esconde o número.
    await botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Personalizado (1,3)').click();
    await page.getByRole('option', { name: 'Limpeza leve (1,12)', exact: true }).click();
    await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Limpeza leve (1,12)')).toBeVisible();
    await expect(folha.getByLabel('Fator de correção (FC)')).toHaveCount(0);

    // FCc: "Personalizado" abre o número com o valor de agora; as validações de sempre valem.
    await botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Carne/peixe grelhado ou assado (0,78)').click();
    await page.getByRole('option', { name: 'Personalizado, Digite o fator' }).click();
    const numero = folha.getByLabel('Fator de cocção (FCc)');
    await expect(numero).toHaveValue('0,78');
    await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Personalizado (0,78)')).toBeVisible();
    await numero.fill('20');
    await expect(folha.getByText('Use um valor de 0,1 a 10.')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await numero.fill('0,8');
    await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Personalizado (0,8)')).toBeVisible();
    await capturar(page, `alimento-${largura}-personalizado`);

    await folha.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alimento salvo.')).toBeVisible();
    const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith(`/alimentos/${salvo.id}`))?.corpo;
    expect(corpo).toMatchObject({ nome: 'Frango grelhado', grupo: 'Lanches da tarde', fatorCorrecao: 1.12, fatorCoccao: 0.8 });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`alimento salvo em ${largura}px: Sugerir pelo nome atualiza as duas listas, "Sem grupo" limpa e salvar manda os sugeridos`, async ({ page }) => {
    const salvo: Alimento = { ...ARROZ, grupo: 'Cereais e derivados', fatorCorrecao: 1.3, fatorCoccao: 1.9 };
    const { folha, pedidos, naoTratadas, errosDaPagina } = await abrirAlimento(page, largura, [salvo]);
    await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Personalizado (1,3)')).toBeVisible();
    await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Personalizado (1,9)')).toBeVisible();
    await folha.getByRole('button', { name: 'Sugerir pelo nome' }).click();
    await expect(botaoDa(folha, 'Descarte e limpeza antes do preparo (FC)', 'Sem perda (1,00)')).toBeVisible();
    await expect(botaoDa(folha, 'Estado na dieta e cocção (FCc)', 'Arroz/grão cozido (2,60)')).toBeVisible();
    await expect(folha.getByLabel('Fator de correção (FC)')).toHaveCount(0);
    await expect(folha.getByLabel('Fator de cocção (FCc)')).toHaveCount(0);

    await botaoDa(folha, 'Grupo (opcional)', 'Cereais e derivados').click();
    await page.getByRole('option', { name: 'Sem grupo, Fica em “Outros itens” na lista de compras' }).click();
    await expect(botaoDa(folha, 'Grupo (opcional)', 'Sem grupo')).toBeVisible();

    await folha.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alimento salvo.')).toBeVisible();
    const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith(`/alimentos/${salvo.id}`))?.corpo;
    expect(corpo).toMatchObject({ grupo: null, fatorCorrecao: 1, fatorCoccao: 2.6 });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * Instruções do catálogo: um controle só ("Ver instruções" ↔ "Recolher instruções", com `aria-expanded`) abre a região
 * "Instruções de execução" com os passos na ordem da fonte, numerados pela apresentação (o texto do passo não leva o
 * número). Abrir e recolher não marca o item. Com `CAPTURAS_DIR`, também o tema escuro.
 */
const PASSOS = ['Deite no banco com os pés apoiados no chão.', 'Desça a barra até a linha do peito, controlando o movimento.', 'Empurre a barra para cima até estender os braços.'];
const temasDasInstrucoes = process.env.CAPTURAS_DIR ? (['claro', 'escuro'] as const) : (['claro'] as const);
for (const largura of [390, 1280]) {
  for (const nomeDoTema of temasDasInstrucoes) {
    test(`catálogo em ${largura}px, tema ${nomeDoTema}: instruções abrem numa região com os passos em ordem e recolhem`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
      await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)), [TREINADOR.id, TEMAS_DA_FOLHA[nomeDoTema]] as const);
      await servirFotos(page);
      const comPassos = { ...CATALOGO[0], instrucoes: PASSOS.join('\n') };
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /exercicios': { corpo: [] },
        'GET /catalogo/exercicios/grupos': { corpo: GRUPOS },
        'GET /catalogo/exercicios': { corpo: { itens: [comPassos, CATALOGO[1]], total: 2 } },
      });
      await page.goto('/treinador/biblioteca?aba=catalogo');
      const ver = page.getByRole('button', { name: 'Ver instruções de Supino reto', exact: true });
      await expect(ver).toBeVisible();
      await expect(ver).toHaveAttribute('aria-expanded', 'false');
      // Sem instruções na fonte, sem controle.
      await expect(page.getByRole('button', { name: 'Ver instruções de Remada baixa' })).toHaveCount(0);
      await capturar(page, `catalogo-instrucoes-${largura}-${nomeDoTema}-fechado`);

      await ver.click();
      const regiao = page.getByRole('region', { name: 'Instruções de execução de Supino reto' });
      await expect(regiao).toBeVisible();
      await expect(regiao.getByText('Instruções de execução', { exact: true })).toBeVisible();
      const passos = regiao.getByRole('listitem');
      await expect(passos).toHaveCount(PASSOS.length);
      for (const [i, passo] of PASSOS.entries()) {
        // Número na coluna própria e o texto da fonte intacto: nada de "1. 1." nem número dentro do passo.
        await expect(passos.nth(i).getByText(passo, { exact: true })).toBeVisible();
        await expect(passos.nth(i).getByText(`${i + 1}.`, { exact: true })).toBeVisible();
        await expect(passos.nth(i)).not.toContainText(`${i + 1}. ${i + 1}.`);
      }
      const recolher = page.getByRole('button', { name: 'Recolher instruções de Supino reto', exact: true });
      await expect(recolher).toHaveAttribute('aria-expanded', 'true');
      await expect(recolher).toBeFocused();
      if (largura >= 768) {
        // No PC o bloco começa onde começa o nome do exercício e o texto não passa de ~640 px.
        const nome = (await page.getByText('Supino reto', { exact: true }).boundingBox())!;
        const bloco = (await regiao.boundingBox())!;
        expect(Math.abs(bloco.x - nome.x)).toBeLessThanOrEqual(1);
        expect((await regiao.getByRole('list').boundingBox())!.width).toBeLessThanOrEqual(640.5);
      } else {
        const janela = page.viewportSize()!;
        const bloco = (await regiao.boundingBox())!;
        expect(bloco.x + bloco.width).toBeLessThanOrEqual(janela.width + 0.5);
      }
      await regiao.scrollIntoViewIfNeeded();
      await capturar(page, `catalogo-instrucoes-${largura}-${nomeDoTema}-aberto`);

      // Pelo teclado: Enter recolhe e o foco fica no mesmo controle.
      await page.keyboard.press('Enter');
      await expect(regiao).toHaveCount(0);
      await expect(ver).toBeFocused();
      await expect(ver).toHaveAttribute('aria-expanded', 'false');
      // Abrir e recolher não marcou o item.
      await expect(page.getByRole('button', { name: 'Importar selecionados (0)' })).toBeVisible();
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
