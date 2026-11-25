import { expect, test, type Page } from '@playwright/test';

import type { Alimento, Exercicio } from '../src/api/tipos';
import { json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { GIF_FALSO, pngDeCor } from './imagens-falsas';

/**
 * Biblioteca (24/11): "■ Fibra" na legenda dos macros; em Exercícios a cor por modalidade (bolinha + legenda só das que
 * estão na lista), os ícones de vídeo e imagem no lugar do "com vídeo", os filtros Vídeo, Imagem e Modalidade (chips e
 * "Limpar filtros") e o "Buscar grupo"; na folha do exercício, a prévia do vídeo (e o cartão neutro quando a miniatura
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

async function abrir(page: Page, largura: number, { lista = LISTA, miniatura = 'ok' as 'ok' | 'bloqueada', consultas = [] as string[] } = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.route('**/catalogo/exercicios/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }));
  // A mesma lista que a página falsa lê: o envio da imagem troca o item no lugar.
  const atual = [...lista];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(atual, consultas),
    'GET /exercicios/{id}/imagem': (_p, r) => r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }),
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

  test(`exercícios: filtros Vídeo, Imagem e Modalidade, "Buscar grupo", chips e "Limpar filtros" (${largura} px)`, async ({ page }) => {
    const consultas: string[] = [];
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { consultas });
    await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
    const painel = page.getByRole('dialog', { name: 'Filtros de exercícios' });
    // O campo de busca dentro do Grupo muscular chama-se "Buscar grupo".
    await painel.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
    await expect(page.getByRole('dialog', { name: 'Grupo muscular' }).getByRole('textbox', { name: 'Buscar grupo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Grupo muscular' })).toHaveCount(0);
    // Só as modalidades que a biblioteca tem (a resposta traz `modalidades`): ninguém tem Cardio.
    await expect(painel.getByRole('checkbox', { name: 'Cardio' })).toHaveCount(0);
    await painel.getByRole('checkbox', { name: 'Máquina' }).click();
    await painel.getByRole('checkbox', { name: 'Peso corporal' }).click();
    await painel.getByRole('radiogroup', { name: 'Vídeo' }).getByRole('radio', { name: 'Com vídeo' }).click();
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
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
    await painel.getByRole('radiogroup', { name: 'Imagem' }).getByRole('radio', { name: 'Sem imagem' }).click();
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
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
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
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
  await painel.getByRole('radiogroup', { name: 'Vídeo' }).getByRole('radio', { name: 'Com vídeo' }).click();
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  // O filtro vale sobre os 35, não sobre a página aberta: um único resultado, na página 1.
  await expect(page.getByText(muitos[34].nome, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próxima' })).toHaveCount(0);
  expect(consultas.at(-1)).toBe('pagina=0&tamanho=30&video=true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('editar exercício: prévia do vídeo válido, ações, link inválido sem prévia e remover o vídeo', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: `Editar ${CRUNCH.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar exercício' });
  const campo = folha.getByRole('textbox', { name: 'Vídeo', exact: true });
  await expect(campo).toHaveValue(CRUNCH.videoUrl!);
  await expect(folha.getByRole('img', { name: `Miniatura do vídeo: ${CRUNCH.nome}` })).toBeVisible();
  await expect(folha.getByRole('button', { name: `Assistir aqui: ${CRUNCH.nome}` })).toBeVisible();
  await expect(folha.getByRole('button', { name: `Abrir no YouTube: ${CRUNCH.nome}` })).toBeVisible();
  await expect(folha.getByText('O vídeo continua sendo um link', { exact: false })).toHaveCount(0);
  // A prévia é 16:9.
  const quadro = (await folha.getByRole('button', { name: `Assistir aqui: ${CRUNCH.nome}` }).boundingBox())!;
  expect(Math.abs(quadro.width / quadro.height - 16 / 9)).toBeLessThan(0.05);

  // Link inválido: o erro no campo, sem prévia nem ações.
  await campo.fill('https://vimeo.com/123');
  await expect(folha.getByText('Use um link https do YouTube.')).toBeVisible();
  await expect(folha.getByRole('button', { name: /Assistir aqui/ })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: /Abrir no YouTube/ })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: 'Remover vídeo' })).toHaveCount(0);

  // Válido de novo e "Remover vídeo": o campo fica vazio e a prévia some.
  await campo.fill(`https://youtu.be/${ID_DO_VIDEO}`);
  await folha.getByRole('button', { name: 'Remover vídeo' }).click();
  await expect(campo).toHaveValue('');
  await expect(folha.getByRole('button', { name: /Assistir aqui/ })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

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

  // Preenchida: a prévia na largura do campo, inteira (contain), a data do envio e Trocar e Remover na mesma linha.
  const previa = folha.getByRole('img', { name: `Demonstração: ${PRANCHA.nome}` });
  await expect(previa).toBeVisible();
  await expect(folha.getByText(/^Imagem própria, enviada em 24\/11\/2026/)).toBeVisible();
  const ajuste = await previa.evaluate((el) => {
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    return img ? getComputedStyle(img).objectFit : null;
  });
  expect(ajuste).toBe('contain');
  const caixaDaPrevia = (await previa.boundingBox())!;
  const caixaDoCampo = (await folha.getByRole('textbox', { name: 'Vídeo', exact: true }).boundingBox())!;
  expect(Math.abs(caixaDaPrevia.width - caixaDoCampo.width)).toBeLessThanOrEqual(4);
  const trocar = (await folha.getByRole('button', { name: 'Trocar imagem ou GIF' }).boundingBox())!;
  const remover = (await folha.getByRole('button', { name: 'Remover imagem' }).boundingBox())!;
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
