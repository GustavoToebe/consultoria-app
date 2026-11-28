import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Alimento, Exercicio } from '../src/api/tipos';
import { json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { GIF_FALSO, pngDeCor } from './imagens-falsas';

/**
 * Biblioteca (24/11): "■ Fibra" na legenda dos macros; em Exercícios a cor por modalidade (bolinha + legenda só das que
 * estão na lista), os ícones de vídeo e imagem no lugar do "com vídeo", os filtros Vídeo, Imagem e Modalidade (chips e
 * "Limpar filtros") e os grupos em chips com a contagem ("Mostrar N exercícios"); na folha do exercício, a prévia do vídeo (e o cartão neutro quando a miniatura
 * não carrega), o link inválido sem prévia e a imagem vazia (área tracejada, soltar arquivo) e preenchida. Só dados fictícios.
 */
const ID_DO_VIDEO = 'dQw4w9WgXcQ';
const exercicio = (n: number, nome: string, p: Partial<Exercicio>): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000024`, nome, grupoMuscular: 'Abdômen', equipamento: null, modalidade: 'MAQUINA',
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null, ...p,
});
const CRUNCH = exercicio(1, 'Abdominal na máquina fictício', { videoUrl: `https://www.youtube.com/watch?v=${ID_DO_VIDEO}`, imagemPropriaEm: '2026-11-20T13:00:00Z' });
const REMADA = exercicio(2, 'Remada fictícia', { modalidade: 'LIVRE', grupoMuscular: 'Costas', equipamento: 'Halter', imagens: ['Remada/0.jpg'] });
const PRANCHA = exercicio(3, 'Prancha fictícia', { modalidade: 'PESO_CORPORAL', videoUrl: `https://youtu.be/${ID_DO_VIDEO}` });
const LISTA = [CRUNCH, REMADA, PRANCHA];
const FOTO = pngDeCor(16, [60, 120, 200]);

const ARROZ: Alimento = {
  id: 'al-arroz-24', nome: 'Arroz fictício', baseQuantidade: 100, baseUnidade: 'g', kcal: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2, fibra: 1.6,
  gramasPorUnidade: null, fonte: null, origem: 'PROPRIO', fatorCorrecao: null, fatorCoccao: null, grupo: null,
};

async function abrir(page: Page, largura: number, {
  lista = LISTA, miniatura = 'ok' as 'ok' | 'bloqueada', consultas = [] as string[], salvos = [] as PedidoFalso[], tema = null as 'CLARO' | 'ESCURO' | null,
} = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  await page.route('**/catalogo/exercicios/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }));
  // A mesma lista que a página falsa lê: o envio da imagem troca o item no lugar.
  const atual = [...lista];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(atual, consultas),
    // A lista inteira só sai ao abrir os filtros: a contagem de cada grupo e o "Mostrar N exercícios".
    'GET /exercicios': (_p, r) => json(r, atual),
    'GET /exercicios/{id}/imagem': (_p, r) => r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }),
    'PUT /exercicios/{id}': (p, r) => { salvos.push(p); return json(r, { ...atual[0], ...(p.corpo as object) }); },
    'POST /exercicios': (p, r) => { salvos.push(p); return json(r, { ...atual[0], ...(p.corpo as object), id: 'e-novo' }); },
    'PUT /exercicios/{id}/imagem': (p, r) => {
      const id = p.caminho.split('/')[2];
      const i = atual.findIndex((e) => e.id === id);
      atual[i] = { ...atual[i], imagemPropriaEm: '2026-11-24T15:00:00Z' };
      return json(r, atual[i]);
    },
  });
  // A miniatura do YouTube nunca sai para a rede: ou responde aqui, ou é bloqueada (como a CSP sem o host faria). Depois da
  // API falsa, que aborta tudo fora da origem (a última rota registrada é a primeira a responder).
  await page.route(/i\.ytimg\.com|img\.youtube\.com/, (r) => (miniatura === 'ok' ? r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }) : r.abort('blockedbyclient')));
  await page.goto('/treinador/biblioteca?aba=exercicios');
  await expect(page.getByText(lista[0].nome, { exact: true })).toBeVisible();
  return api;
}

test('alimentos: a legenda dos macros traz "■ Fibra" depois do "G = gordura"', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [ARROZ] },
    'GET /catalogo/alimentos/grupos': { corpo: [] },
  });
  await page.goto('/treinador/biblioteca?aba=alimentos');
  const gordura = page.getByText('G = gordura', { exact: true });
  await expect(gordura).toBeVisible();
  const fibra = gordura.locator('xpath=../..').getByText('Fibra', { exact: true });
  await expect(fibra).toBeVisible();
  // Na mesma linha e depois da gordura.
  const [g, f] = [(await gordura.boundingBox())!, (await fibra.boundingBox())!];
  expect(Math.abs(f.y - g.y)).toBeLessThanOrEqual(2);
  expect(f.x).toBeGreaterThan(g.x);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`exercícios: cor por modalidade, legenda só das existentes e ícones no lugar do "com vídeo" (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    const legenda = page.getByRole('list', { name: 'Cores das modalidades' });
    await expect(legenda.getByRole('listitem')).toHaveText(['Peso livre', 'Máquina', 'Peso corporal']);
    // O "com vídeo" saiu da linha (a descrição do cartão continua dizendo "com vídeo quando houver").
    await expect(page.getByText(/· com vídeo/)).toHaveCount(0);
    await expect(page.getByText('Máquina · Abdômen', { exact: true })).toBeVisible();
    await expect(page.getByText('Peso livre · Costas · Halter', { exact: true })).toBeVisible();
    // Vídeo e imagem viram ícones neutros com nome acessível e dica (title na web).
    await expect(page.getByRole('img', { name: 'Tem vídeo' })).toHaveCount(2);
    await expect(page.getByRole('img', { name: 'Tem imagem' })).toHaveCount(2);
    await expect(page.getByRole('img', { name: 'Tem vídeo' }).first()).toHaveAttribute('title', 'Tem vídeo');
    // A bolinha tem a cor da modalidade e é redonda; a do Peso livre é outra cor que a da Máquina.
    const cores = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('div')]
      .filter((d) => d.getBoundingClientRect().width === 8 && getComputedStyle(d).borderRadius === '4px')
      .map((d) => getComputedStyle(d).backgroundColor));
    expect(new Set(cores).size).toBe(3);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`exercícios: filtros Vídeo, Imagem e Modalidade, grupos com contagem, chips e "Limpar filtros" (${largura} px)`, async ({ page }) => {
    const consultas: string[] = [];
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { consultas });
    await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
    const painel = page.getByRole('dialog', { name: 'Filtros de exercícios' });
    // Grupo muscular em lista com a contagem (27/11); com poucos grupos (até 12) sem a busca; o botão principal conta o resultado.
    await expect(painel.getByRole('checkbox', { name: 'Abdômen, 2 exercícios' })).toBeVisible();
    await expect(painel.getByRole('checkbox', { name: 'Costas, 1 exercício' })).toBeVisible();
    await expect(painel.getByRole('textbox', { name: 'Buscar grupo' })).toHaveCount(0);
    await expect(painel.getByRole('button', { name: 'Mostrar 3 exercícios' })).toBeVisible();
    // Só as modalidades que a biblioteca tem (a resposta traz `modalidades`): ninguém tem Cardio.
    await expect(painel.getByRole('checkbox', { name: 'Cardio' })).toHaveCount(0);
    await painel.getByRole('checkbox', { name: 'Máquina' }).click();
    await painel.getByRole('checkbox', { name: 'Peso corporal' }).click();
    await painel.getByRole('radiogroup', { name: 'Vídeo' }).getByRole('radio', { name: 'Com', exact: true }).click();
    await painel.getByRole('button', { name: /^Mostrar / }).click();
    await expect(page.getByRole('button', { name: 'Filtros, 2 ligados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Modalidade: Máquina, Peso corporal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Vídeo: Com vídeo' })).toBeVisible();
    await expect(page.getByText(REMADA.nome, { exact: true })).toHaveCount(0);
    await expect(page.getByText(CRUNCH.nome, { exact: true })).toBeVisible();
    await expect(page.getByText(PRANCHA.nome, { exact: true })).toBeVisible();
    // O filtro é do servidor: o pedido leva modalidade (repetida, na ordem da tela) e video, na página 1, e não há aviso de "só desta página".
    expect(consultas.at(-1)).toBe('pagina=0&tamanho=30&modalidade=MAQUINA&modalidade=PESO_CORPORAL&video=true');
    await expect(page.getByText(/desta página/)).toHaveCount(0);

    // Imagem: "Sem imagem" junto com o resto deixa só a prancha; o ✕ do chip tira só aquele filtro.
    await page.getByRole('button', { name: 'Filtros, 2 ligados' }).click();
    await painel.getByRole('radiogroup', { name: 'Imagem' }).getByRole('radio', { name: 'Sem', exact: true }).click();
    await painel.getByRole('button', { name: /^Mostrar / }).click();
    await expect(page.getByText(CRUNCH.nome, { exact: true })).toHaveCount(0);
    await expect(page.getByText(PRANCHA.nome, { exact: true })).toBeVisible();
    expect(consultas.at(-1)).toBe('pagina=0&tamanho=30&modalidade=MAQUINA&modalidade=PESO_CORPORAL&video=true&imagem=false');
    await page.getByRole('button', { name: 'Tirar filtro: Imagem: Sem imagem' }).click();
    await expect(page.getByText(CRUNCH.nome, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Vídeo: Com vídeo' })).toBeVisible();

    // Nada sobra: vazio com "Limpar filtros"; o da página tira todos.
    await page.getByRole('button', { name: 'Filtros, 2 ligados' }).click();
    await painel.getByRole('checkbox', { name: 'Peso corporal' }).click();
    await painel.getByRole('checkbox', { name: 'Máquina' }).click();
    await painel.getByRole('checkbox', { name: 'Peso livre' }).click();
    await painel.getByRole('button', { name: /^Mostrar / }).click();
    await expect(page.getByText('Nenhum exercício encontrado')).toBeVisible();
    expect(consultas.at(-1)).toBe('pagina=0&tamanho=30&modalidade=LIVRE&video=true');
    await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
    await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    await expect(page.getByText(REMADA.nome, { exact: true })).toBeVisible();
    expect(consultas.at(-1)).toBe('pagina=0&tamanho=30');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('exercícios: mudar um filtro refaz o pedido na página 1', async ({ page }) => {
  // 35 exercícios: 30 na primeira página e 5 na segunda; só o último tem vídeo.
  const muitos = Array.from({ length: 35 }, (_, i) => exercicio(i + 10, `Exercício fictício ${String(i + 1).padStart(2, '0')}`,
    i === 34 ? { videoUrl: `https://youtu.be/${ID_DO_VIDEO}` } : {}));
  const consultas: string[] = [];
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { lista: muitos, consultas });
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Página 2 de 2 · 35 exercícios')).toBeVisible();
  expect(consultas.at(-1)).toBe('pagina=1&tamanho=30');
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  const painel = page.getByRole('dialog', { name: 'Filtros de exercícios' });
  await painel.getByRole('radiogroup', { name: 'Vídeo' }).getByRole('radio', { name: 'Com', exact: true }).click();
  await painel.getByRole('button', { name: /^Mostrar / }).click();
  // O filtro vale sobre os 35, não sobre a página aberta: um único resultado, na página 1.
  await expect(page.getByText(muitos[34].nome, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próxima' })).toHaveCount(0);
  expect(consultas.at(-1)).toBe('pagina=0&tamanho=30&video=true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// 27/11: a Identificação com os três seletores iguais (46 px, rótulo dentro), Grupo muscular e Equipamento com busca,
// contagem e "+ Usar", e Vídeo e Imagem com a área da mesma altura e os botões na mesma linha. Capturas só com
// `E2E_CAPTURAS` (fora do git): `<pasta>/exercicio-<caso>-1280-<tema>.png`.
const PASTA_DAS_CAPTURAS = process.env.E2E_CAPTURAS;
const PANTURRILHA = exercicio(4, 'Panturrilha em pé fictícia', { grupoMuscular: 'Panturrilha', equipamento: 'Smith' });
const DICA_DO_VIDEO = 'Cole o link do vídeo (youtube.com ou youtu.be)';

const caixaDe = async (l: Locator) => (await l.boundingBox())!;
/** A caixa da área tracejada mais próxima acima do elemento (a do vídeo ou a da imagem); o estilo vem por classe, não inline. */
const areaTracejada = (l: Locator) => l.evaluate((el) => {
  let no: Element | null = el;
  while (no && getComputedStyle(no).borderTopStyle !== 'dashed') no = no.parentElement;
  const r = (no ?? el).getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, achou: !!no };
});
const seletor = (folha: Locator, rotulo: string) => folha.getByRole('button', { name: new RegExp(`^${rotulo}: `) });

for (const largura of [390, 1280]) {
  test(`editar exercício: Modalidade, Grupo muscular e Equipamento no mesmo estilo e altura (46), alinhados (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    await page.getByRole('button', { name: `Editar ${REMADA.nome}` }).click();
    const folha = page.getByRole('dialog', { name: 'Editar exercício' });
    await expect(folha.getByRole('button', { name: 'Grupo muscular · opcional: Costas. Escolher.' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Equipamento · opcional: Halter. Escolher.' })).toBeVisible();
    // Os dois deixaram de ser campos de digitar.
    await expect(folha.getByRole('textbox', { name: /Grupo muscular|Equipamento/ })).toHaveCount(0);
    const [m, g, e] = await Promise.all(['Modalidade', 'Grupo muscular · opcional', 'Equipamento · opcional'].map((r) => caixaDe(seletor(folha, r))));
    for (const c of [m, g, e]) expect(Math.abs(c.height - 46)).toBeLessThanOrEqual(1);
    if (largura === 1280) {
      expect(Math.abs(m.y - g.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.y - e.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.width - g.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(g.width - e.width)).toBeLessThanOrEqual(2);
      expect(g.x).toBeGreaterThan(m.x + m.width);
      expect(e.x).toBeGreaterThan(g.x + g.width);
    } else {
      expect(g.y).toBeGreaterThan(m.y + m.height);
      expect(e.y).toBeGreaterThan(g.y + g.height);
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('grupo muscular: lista os existentes com a contagem, "pantu" mostra a Panturrilha antes do "+ Usar" e um nome novo é gravado como digitado', async ({ page }) => {
  const salvos: PedidoFalso[] = [];
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { lista: [...LISTA, PANTURRILHA], salvos });
  await page.getByRole('button', { name: `Editar ${CRUNCH.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  await seletor(folha, 'Grupo muscular · opcional').click();
  const lista = page.getByRole('listbox', { name: 'Grupo muscular' });
  await expect(lista.getByRole('option')).toHaveText([/^Não informado/, /^Abdômen.*2 exercícios/, /^Costas.*1 exercício/, /^Panturrilha.*1 exercício/]);
  await expect(lista.getByRole('option', { name: 'Abdômen, 2 exercícios' })).toHaveAttribute('aria-selected', 'true');

  // Um pedaço do nome: o existente primeiro, o "+ Usar" no fim.
  const busca = page.getByRole('textbox', { name: 'Buscar ou criar grupo' });
  await busca.fill('pantu');
  await expect(lista.getByRole('option')).toHaveText([/^Panturrilha/, /^\+ Usar “pantu”/]);
  // O plural do existente não oferece criar a variação: só a Panturrilha.
  await busca.fill('Panturrilhas');
  await expect(lista.getByRole('option')).toHaveText([/^Panturrilha.*1 exercício/]);

  // Nome novo: "+ Usar “…”" no fim, com o detalhe; a grafia escolhida vai ao corpo.
  await busca.fill('Glúteo médio');
  const usar = lista.getByRole('option', { name: '+ Usar “Glúteo médio”, Grupo muscular novo' });
  await expect(usar).toBeVisible();
  await usar.click();
  await expect(folha.getByRole('button', { name: 'Grupo muscular · opcional: Glúteo médio. Escolher.' })).toBeVisible();
  await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Exercício salvo.')).toBeVisible();
  expect(salvos.at(-1)?.corpo).toMatchObject({ grupoMuscular: 'Glúteo médio', equipamento: null });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('equipamento: os padrão primeiro, os da consultoria com a contagem, "Não informado" limpa e um novo é criado pela busca', async ({ page }) => {
  const salvos: PedidoFalso[] = [];
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { lista: [...LISTA, PANTURRILHA], salvos });
  await page.getByRole('button', { name: `Editar ${REMADA.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  await seletor(folha, 'Equipamento · opcional').click();
  const lista = page.getByRole('listbox', { name: 'Equipamento' });
  const nomes = await lista.getByRole('option').allTextContents();
  expect(nomes.slice(0, 3).map((n) => n.split(/\d/)[0].trim())).toEqual(['Não informado', 'Barra', 'Halter']);
  await expect(lista.getByRole('option', { name: 'Halter, 1 exercício' })).toBeVisible();
  await expect(lista.getByRole('option', { name: 'Smith, 1 exercício' })).toBeVisible();
  await lista.getByRole('option', { name: 'Não informado' }).click();
  await expect(folha.getByRole('button', { name: 'Equipamento · opcional: Não informado. Escolher.' })).toBeVisible();

  await seletor(folha, 'Equipamento · opcional').click();
  await page.getByRole('textbox', { name: 'Buscar ou criar equipamento' }).fill('Corda naval');
  await page.getByRole('option', { name: '+ Usar “Corda naval”, Equipamento novo' }).click();
  await expect(folha.getByRole('button', { name: 'Equipamento · opcional: Corda naval. Escolher.' })).toBeVisible();
  await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Exercício salvo.')).toBeVisible();
  expect(salvos.at(-1)?.corpo).toMatchObject({ grupoMuscular: 'Costas', equipamento: 'Corda naval' });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vídeo: vazio (área tracejada com o campo e a dica), link inválido com o erro no campo, válido vira a prévia e "Remover vídeo" volta ao vazio', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: `Editar ${REMADA.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  const campo = folha.getByRole('textbox', { name: 'Link do YouTube' });
  await expect(campo).toHaveValue('');
  await expect(folha.getByText(DICA_DO_VIDEO, { exact: true })).toBeVisible();
  // O campo e a dica ficam dentro da área tracejada, que tem a altura da prévia das fotos do catálogo ao lado.
  const area = await areaTracejada(campo);
  expect(area.achou).toBe(true);
  expect(await areaTracejada(folha.getByText(DICA_DO_VIDEO, { exact: true }))).toEqual(area);
  const previaDaImagem = folha.getByRole('img', { name: `Demonstração: ${REMADA.nome}` });
  await expect(previaDaImagem).toBeVisible();
  expect(Math.abs(area.height - (await caixaDe(previaDaImagem)).height)).toBeLessThanOrEqual(2);

  // Inválido: o erro no campo (no lugar da dica), sem prévia nem ações; o Salvar trava com o motivo.
  await campo.fill('https://vimeo.com/123');
  await expect(folha.getByText('Use um link https do YouTube.')).toBeVisible();
  await expect(folha.getByRole('button', { name: /Assistir aqui/ })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: /Abrir no YouTube/ })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: 'Remover vídeo' })).toHaveCount(0);

  // Válido: enquanto o campo tem o foco ele fica (dá para seguir digitando "?t=30"); ao sair dele, a prévia 16:9 entra no
  // lugar da área, com as ações embaixo, e o foco vai ao "Abrir no YouTube".
  await campo.fill(`https://youtu.be/${ID_DO_VIDEO}`);
  await expect(campo).toBeFocused();
  await campo.pressSequentially('?t=30');
  await expect(campo).toHaveValue(`https://youtu.be/${ID_DO_VIDEO}?t=30`);
  await campo.press('Tab');
  await expect(folha.getByRole('button', { name: `Abrir no YouTube: ${REMADA.nome}` })).toBeFocused();
  const assistir = folha.getByRole('button', { name: `Assistir aqui: ${REMADA.nome}` });
  await expect(assistir).toBeVisible();
  await expect(folha.getByRole('textbox', { name: 'Link do YouTube' })).toHaveCount(0);
  const quadro = await caixaDe(assistir);
  expect(Math.abs(quadro.width / quadro.height - 16 / 9)).toBeLessThan(0.05);
  await expect(folha.getByRole('button', { name: `Abrir no YouTube: ${REMADA.nome}` })).toBeVisible();

  // Remover: volta a área vazia, com o campo limpo.
  await folha.getByRole('button', { name: 'Remover vídeo' }).click();
  await expect(folha.getByRole('textbox', { name: 'Link do YouTube' })).toHaveValue('');
  await expect(folha.getByRole('button', { name: /Assistir aqui/ })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// Vídeo e imagem preenchidos: as duas prévias com a mesma altura e os botões das duas colunas na mesma linha (PC); no
// celular, empilhados. Os botões de perigo são tonais (fundo, não só texto) com a altura do secundário.
for (const largura of [390, 1280]) {
  test(`editar exercício: vídeo e imagem preenchidos, mesma altura, botões alinhados e de perigo tonais (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    await page.getByRole('button', { name: `Editar ${CRUNCH.nome}` }).click();
    const folha = page.getByRole('dialog', { name: 'Editar exercício' });
    const video = folha.getByRole('button', { name: `Assistir aqui: ${CRUNCH.nome}` });
    const imagem = folha.getByRole('img', { name: `Demonstração: ${CRUNCH.nome}` });
    await expect(video).toBeVisible();
    await expect(imagem).toBeVisible();
    const [v, i] = [await caixaDe(video), await caixaDe(imagem)];
    const removerVideo = folha.getByRole('button', { name: 'Remover vídeo', exact: true });
    const removerImagem = folha.getByRole('button', { name: 'Remover imagem', exact: true });
    const abrirNoYoutube = folha.getByRole('button', { name: `Abrir no YouTube: ${CRUNCH.nome}` });
    const trocar = folha.getByRole('button', { name: 'Trocar imagem ou GIF' });
    if (largura === 1280) {
      expect((await caixaDe(folha)).width).toBeGreaterThan(760);
      expect(i.x).toBeGreaterThan(v.x + v.width);
      expect(Math.abs(i.width - v.width)).toBeLessThanOrEqual(4);
      expect(Math.abs(i.y - v.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(i.height - v.height)).toBeLessThanOrEqual(2);
      // Os botões das duas colunas começam na mesma linha (a primeira de cada coluna: numa coluna de ~340 px o par do vídeo
      // pode quebrar, e aí o "Remover vídeo" desce).
      const [yAbrir, yTrocar, yRemoverImagem] = await Promise.all([abrirNoYoutube, trocar, removerImagem].map(async (b) => (await caixaDe(b)).y));
      expect(Math.abs(yAbrir - yTrocar)).toBeLessThanOrEqual(1);
      expect(Math.abs(yTrocar - yRemoverImagem)).toBeLessThanOrEqual(1);
      // A data do envio vem depois dos botões.
      expect((await caixaDe(folha.getByText(/^Imagem própria, enviada em/))).y).toBeGreaterThan(yTrocar);
    } else {
      expect(i.y).toBeGreaterThan(v.y + v.height);
    }
    for (const botao of [removerVideo, removerImagem, folha.getByRole('button', { name: 'Tirar da biblioteca', exact: true })]) {
      await botao.scrollIntoViewIfNeeded();
      expect(await botao.evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      expect(Math.abs((await caixaDe(botao)).height - (await caixaDe(abrirNoYoutube)).height)).toBeLessThanOrEqual(1);
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('novo exercício: a área do vídeo e a da imagem ("depois de salvar") com a mesma altura', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: 'Novo exercício' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo exercício' });
  const v = await areaTracejada(folha.getByRole('textbox', { name: 'Link do YouTube' }));
  const i = await areaTracejada(folha.getByText('Depois de salvar, você pode enviar uma imagem ou GIF deste exercício.'));
  expect(v.achou && i.achou).toBe(true);
  expect(Math.abs(v.height - i.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(v.y - i.y)).toBeLessThanOrEqual(1);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('instruções: "Observações" começa com 3 linhas, cresce com o texto, sem a alça, e conta os caracteres', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: 'Novo exercício' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo exercício' });
  const campo = folha.getByRole('textbox', { name: 'Observações (opcional)' });
  expect(await campo.evaluate((e) => getComputedStyle(e).resize)).toBe('none');
  const antes = (await caixaDe(campo)).height;
  const texto = Array.from({ length: 8 }, (_, i) => `Linha fictícia ${i + 1}`).join('\n');
  await campo.fill(texto);
  await expect.poll(async () => (await caixaDe(campo)).height).toBeGreaterThan(antes + 40);
  await expect(folha.getByText(`${texto.length}/4000`, { exact: true })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`capturas da folha do exercício (1280 px, ${tema.toLowerCase()})`, async ({ page }) => {
    test.skip(!PASTA_DAS_CAPTURAS, 'só com E2E_CAPTURAS');
    const nome = (caso: string) => `${PASTA_DAS_CAPTURAS}/exercicio-${caso}-1280-${tema.toLowerCase()}.png`;
    const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { lista: [...LISTA, PANTURRILHA], tema });
    // Vazio: o exercício novo.
    await page.getByRole('button', { name: 'Novo exercício' }).click();
    let folha = page.getByRole('dialog', { name: 'Novo exercício' });
    await expect(folha.getByRole('textbox', { name: 'Link do YouTube' })).toBeVisible();
    await page.screenshot({ path: nome('vazio') });
    // Link inválido.
    await folha.getByRole('textbox', { name: 'Link do YouTube' }).fill('https://vimeo.com/123');
    await expect(folha.getByText('Use um link https do YouTube.')).toBeVisible();
    await folha.getByRole('textbox', { name: 'Link do YouTube' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: nome('link-invalido') });
    // O seletor de grupo aberto, com "pantu".
    await seletor(folha, 'Grupo muscular · opcional').click();
    await page.getByRole('textbox', { name: 'Buscar ou criar grupo' }).fill('pantu');
    await expect(page.getByRole('option', { name: /^\+ Usar “pantu”/ })).toBeVisible();
    await page.screenshot({ path: nome('grupo-pantu') });
    await page.keyboard.press('Escape');
    await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
    // Vídeo e imagem preenchidos.
    await page.getByRole('button', { name: `Editar ${CRUNCH.nome}` }).click();
    folha = page.getByRole('dialog', { name: 'Editar exercício' });
    await expect(folha.getByRole('img', { name: `Demonstração: ${CRUNCH.nome}` })).toBeVisible();
    await folha.getByRole('button', { name: 'Remover vídeo' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: nome('preenchido') });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('editar exercício: miniatura bloqueada vira o cartão neutro 16:9 com o play', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { miniatura: 'bloqueada' });
  await page.getByRole('button', { name: `Editar ${PRANCHA.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  await expect(folha.getByRole('button', { name: `Assistir aqui: ${PRANCHA.nome}` })).toBeVisible();
  await expect(folha.getByRole('img', { name: /Miniatura do vídeo/ })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: `Abrir no YouTube: ${PRANCHA.nome}` })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  // O bloqueio da miniatura só aparece no console como falha de rede, não como erro da página.
  expect(errosDaPagina).toEqual([]);
});

test('editar exercício: imagem vazia (área tracejada, soltar arquivo) e preenchida (contain, ações na mesma linha)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: `Editar ${PRANCHA.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  // Rótulos no estilo da folha: "Vídeo" e "Imagem ou GIF" na cor do texto, como os outros.
  const [rotuloImagem, rotuloNome] = await Promise.all([
    folha.getByText('Imagem ou GIF', { exact: true }).evaluate((e) => getComputedStyle(e).color),
    folha.getByText('Vídeo', { exact: true }).evaluate((e) => getComputedStyle(e).color),
  ]);
  expect(rotuloImagem).toBe(rotuloNome);
  // Vazia: um botão de ação dentro da área tracejada, com a dica.
  const escolher = folha.getByRole('button', { name: 'Escolher imagem ou GIF' });
  await expect(escolher).toHaveCount(1);
  await expect(folha.getByText('JPEG, PNG ou GIF animado, até 1 MB e 800 px. Ou arraste o arquivo para cá.', { exact: true })).toBeVisible();
  const borda = await escolher.evaluate((b) => {
    let no: Element | null = b;
    while (no && getComputedStyle(no).borderTopStyle !== 'dashed') no = no.parentElement;
    return no ? getComputedStyle(no).borderTopStyle : null;
  });
  expect(borda).toBe('dashed');
  // A área vazia da imagem tem a altura da prévia do vídeo ao lado.
  const prevDoVideo = await caixaDe(folha.getByRole('button', { name: `Assistir aqui: ${PRANCHA.nome}` }));
  expect(Math.abs((await areaTracejada(escolher)).height - prevDoVideo.height)).toBeLessThanOrEqual(2);

  // Soltar um GIF na área envia pela mesma rota (nome fixo, o original não sai).
  const envio = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes(`/exercicios/${PRANCHA.id}/imagem`));
  const dados = await page.evaluateHandle((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'prancha-original.gif', { type: 'image/gif' }));
    return dt;
  }, GIF_FALSO.toString('base64'));
  await escolher.dispatchEvent('dragenter', { dataTransfer: dados });
  await escolher.dispatchEvent('dragover', { dataTransfer: dados });
  await escolher.dispatchEvent('drop', { dataTransfer: dados });
  const pedido = await envio;
  expect(pedido.postDataBuffer()?.toString('latin1')).toContain('filename="imagem.gif"');
  expect(pedido.postDataBuffer()?.toString('latin1')).not.toContain('prancha-original');
  await expect(page.getByText('Imagem salva.')).toBeVisible();

  // Preenchida: a prévia na largura e na altura da do vídeo, inteira (contain), Trocar e Remover na mesma linha e a data.
  const previa = folha.getByRole('img', { name: `Demonstração: ${PRANCHA.nome}` });
  await expect(previa).toBeVisible();
  await expect(folha.getByText(/^Imagem própria, enviada em 24\/11\/2026/)).toBeVisible();
  const ajuste = await previa.evaluate((el) => {
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    return img ? getComputedStyle(img).objectFit : null;
  });
  expect(ajuste).toBe('contain');
  const caixaDaPrevia = await caixaDe(previa);
  expect(Math.abs(caixaDaPrevia.width - prevDoVideo.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(caixaDaPrevia.height - prevDoVideo.height)).toBeLessThanOrEqual(2);
  const trocar = await caixaDe(folha.getByRole('button', { name: 'Trocar imagem ou GIF' }));
  const remover = await caixaDe(folha.getByRole('button', { name: 'Remover imagem' }));
  expect(Math.abs(trocar.y - remover.y)).toBeLessThanOrEqual(2);
  await expect(folha.getByRole('button', { name: 'Escolher imagem ou GIF' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('editar exercício: com as fotos do catálogo, soltar um PNG na prévia envia um JPEG reduzido (sem o nome original)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: `Editar ${REMADA.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  await expect(folha.getByText('Fotos do catálogo: o aluno vê estas enquanto não houver imagem própria.')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Escolher imagem ou GIF' })).toHaveCount(1);
  await expect(folha.getByRole('button', { name: 'Remover imagem' })).toHaveCount(0);
  const previa = folha.getByRole('img', { name: `Demonstração: ${REMADA.nome}` });
  await expect(previa).toBeVisible();
  const envio = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes(`/exercicios/${REMADA.id}/imagem`));
  const dados = await page.evaluateHandle((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'remada-original.png', { type: 'image/png' }));
    return dt;
  }, pngDeCor(32, [200, 80, 40]).toString('base64'));
  await previa.dispatchEvent('dragenter', { dataTransfer: dados });
  await previa.dispatchEvent('dragover', { dataTransfer: dados });
  await previa.dispatchEvent('drop', { dataTransfer: dados });
  const corpo = (await envio).postDataBuffer()?.toString('latin1') ?? '';
  expect(corpo).toContain('filename="imagem.jpg"');
  expect(corpo).toContain('Content-Type: image/jpeg');
  expect(corpo).not.toContain('remada-original');
  await expect(page.getByText('Imagem salva.')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
