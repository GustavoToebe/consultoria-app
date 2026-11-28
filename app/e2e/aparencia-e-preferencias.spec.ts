import { expect, test, type Locator, type Page } from '@playwright/test';

import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { colunasEstaveis, diferencasVizinhas } from './alturasDeColunas';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type Resposta } from './api-falsa';

/**
 * Aparência e preferências (25/11): título igual ao menu, "Restaurar padrão" secundário no cabeçalho com confirmação na tela,
 * cinco seções (Tema e cores, Leitura, Layout, Treino e dados, Navegador) com uma linha por opção, o nome de cada opção uma
 * vez só, temas sem código de cor, prévia da cor de ação inerte, e as seções em colunas empilhadas pela faixa (1 no
 * celular, 2 na normal e na larga, 3 na ultralarga). O aluno vê o mesmo componente numa folha, numa coluna. Menu aberto
 * (o padrão). Capturas só com `E2E_CAPTURAS` (pasta fora do git). Só dados fictícios.
 * Sem vazios (28/11): o cartão "Avisos no celular" (regras de atenção ligadas) entra nas colunas como mais uma peça, na mais
 * baixa (embaixo de Navegador em 2 colunas, de Leitura em 3), e nenhum cartão ocupa a largura toda.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;
const SECOES = ['Tema e cores', 'Leitura', 'Layout', 'Treino e dados', 'Navegador'];
const NOMES = ['Tema', 'Cor de ação', 'Tamanho do texto', 'Contraste', 'Bordas reforçadas', 'Animações', 'Largura do conteúdo', 'Detalhes abrem', 'Unidade da carga', 'Mostrar gráficos', 'Barras de rolagem escuras'];
/** Colunas esperadas (área ao lado do menu de 240 px): 1040 é normal, 1680 é larga, 3200 é ultralarga. */
const COLUNAS: Record<number, number> = { 390: 1, 1280: 2, 1920: 2, 3440: 3 };
/** A seção embaixo da qual o "Avisos no celular" cai (a coluna mais baixa pelo peso, `dominio/alvenaria.test.ts`). */
const VIZINHA_DOS_AVISOS: Record<number, string> = { 1: 'navegador', 2: 'navegador', 3: 'leitura' };
const AVISOS = 'Avisos no celular';

/** A rolagem é da `Tela`, não da página: para caber tudo, a janela cresce na altura (a faixa depende só da largura). */
async function capturar(page: Page, nome: string, inteira = true) {
  if (!CAPTURAS) return;
  const janela = page.viewportSize()!;
  if (inteira) await page.setViewportSize({ width: janela.width, height: 2600 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
  if (inteira) await page.setViewportSize(janela);
}

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

const semRolagemHorizontal = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const secao = (page: Page | Locator, titulo: string) => page.getByRole('heading', { name: titulo, level: 2, exact: true });

async function abrirAjustes(page: Page, largura: number, preferencias: object = {}, pushDemorado?: Resposta) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  // Com as regras de atenção ligadas e quem recebe o aviso, para o cartão "Avisos no celular" entrar nas colunas.
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { unidadeDeCargaHabilitada: true, regrasAtencaoHabilitada: true, permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    // Com ATUALIZACAO_LER o menu busca o ponto das atualizações.
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /eu/preferencias-de-push': pushDemorado ?? { corpo: { atencao: true } },
  });
  await page.goto('/treinador/ajustes');
  await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
  await expect(secao(page, 'Navegador')).toBeVisible();
  if (!pushDemorado) await expect(secao(page, AVISOS)).toBeVisible();
  return errosDaPagina;
}

for (const largura of [390, 1280, 1920, 3440]) for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`treinador ${largura} px ${tema.toLowerCase()}: cinco seções, cada nome uma vez, ${COLUNAS[largura]} coluna(s), prévia inerte`, async ({ page }) => {
    const errosDaPagina = await abrirAjustes(page, largura, { tema });

    // As cinco seções e as colunas pela posição dos títulos, depois de a alvenaria medir e assentar as peças.
    await expect(async () => {
      const xs: number[] = [];
      for (const titulo of SECOES) xs.push(Math.round((await caixa(secao(page, titulo))).x));
      expect(new Set(xs).size).toBe(COLUNAS[largura]);
      // Sem metade da tela vazia: a última coluna começa longe da primeira.
      if (COLUNAS[largura] > 1) expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300);
    }).toPass({ timeout: 10_000 });

    // Todos os cartões nas colunas (28/11): "Avisos no celular" é mais uma peça, na coluna mais baixa no momento, com a
    // largura de uma coluna; nenhuma peça na largura toda.
    const colunas = await colunasEstaveis(page, 'preferencias');
    expect(colunas).toHaveLength(COLUNAS[largura]);
    const daVizinha = colunas.find((c) => c.pecas.includes(VIZINHA_DOS_AVISOS[COLUNAS[largura]]))!;
    expect(daVizinha.pecas.at(-1), colunas.map((c) => c.pecas.join('+')).join(' | ')).toBe('avisos');
    const larguraDaColuna = (await caixa(page.getByTestId('preferencias-tema'))).width;
    for (const chave of ['leitura', 'layout', 'treino', 'navegador', 'avisos']) {
      expect(Math.abs((await caixa(page.getByTestId(`preferencias-${chave}`))).width - larguraDaColuna)).toBeLessThan(2);
    }
    // Em 2 colunas as duas terminam perto (estimado: ~80 px em 1280, ~30 em 1920); em 3, Tema e cores sozinho manda na
    // altura e não há o que equilibrar. Folga larga de propósito: o limite foi estimado, não medido.
    if (COLUNAS[largura] === 2) expect(Math.max(...diferencasVizinhas(colunas)), colunas.map((c) => `${c.pecas.join('+')}=${Math.round(c.fim)}`).join(' | ')).toBeLessThan(160);

    // Cada opção tem o nome escrito uma vez só (o "Variações de tom" também), e nenhum título repete o da seção.
    // "Cor de ação" também é opção da linha "Cor das séries" (a outra é "Cor do tipo"): 2 textos.
    for (const nome of [...NOMES, 'Variações de tom']) await expect(page.getByText(nome, { exact: true })).toHaveCount(nome === 'Cor de ação' ? 2 : 1);
    for (const titulo of SECOES) await expect(page.getByText(titulo, { exact: true })).toHaveCount(1);
    // A janela dos aniversários saiu daqui (25/11): é a opção do bloco, no ⋯ da edição do Início.
    await expect(page.getByText('Aniversários', { exact: true })).toHaveCount(0);

    // Temas sem código de cor.
    expect(await page.getByRole('radiogroup', { name: 'Tema' }).innerText()).not.toMatch(/#[0-9A-F]{6}/i);
    await expect(page.getByRole('radio', { name: 'Padrão da consultoria. O tema escolhido em Marca' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Variações de tom' }).getByRole('radio')).toHaveCount(7);

    // Prévia da cor de ação: caixa "Prévia", botão desabilitado de verdade e fora da ordem de foco, e o selo "Editando".
    const previa = page.getByRole('group', { name: 'Prévia', exact: true });
    const botao = previa.getByRole('button', { name: 'Adicionar refeição', disabled: true });
    await expect(botao).toBeVisible();
    expect(await botao.getAttribute('tabindex')).toBeNull();
    expect(await previa.getAttribute('tabindex')).toBeNull();
    await expect(previa.getByText('Editando', { exact: true })).toBeVisible();

    // Interruptores e segmentos à direita da linha (no celular o segmento desce, o interruptor não).
    const bordas = await caixa(page.getByRole('switch', { name: 'Bordas reforçadas' }));
    const leitura = await caixa(secao(page, 'Leitura'));
    expect(bordas.x).toBeGreaterThan(leitura.x + 150);
    expect(bordas.width).toBeGreaterThanOrEqual(44);

    // "Restaurar padrão" no cabeçalho, acima das seções.
    const restaurar = await caixa(page.getByRole('button', { name: 'Restaurar padrão' }));
    expect(restaurar.y + restaurar.height).toBeLessThan((await caixa(secao(page, 'Tema e cores'))).y);

    await semRolagemHorizontal(page);
    await capturar(page, `ajustes-${largura}-${tema.toLowerCase()}`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('treinador 1280 px: com o aviso ainda carregando, as seções já aparecem; o cartão entra nas colunas quando chega', async ({ page }) => {
  let soltar = () => {};
  const chegou = new Promise<void>((r) => { soltar = r; });
  const errosDaPagina = await abrirAjustes(page, 1280, {}, async (_p, r) => { await chegou; await json(r, { atencao: true }); });
  // A peça do aviso existe vazia (altura 0) e não segura a alvenaria: as cinco seções aparecem, sem o cartão.
  for (const titulo of SECOES) await expect(secao(page, titulo)).toBeVisible();
  await expect(secao(page, AVISOS)).toHaveCount(0);
  soltar();
  await expect(page.getByRole('switch', { name: 'Avisar quando a atualização de um aluno tiver pontos de atenção' })).toBeChecked();
  const colunas = await colunasEstaveis(page, 'preferencias');
  expect(colunas.find((c) => c.pecas.includes('navegador'))!.pecas.at(-1)).toBe('avisos');
  expect(errosDaPagina).toEqual([]);
});

test('treinador 1280 px: Restaurar abre a confirmação, Cancelar não muda nada e Restaurar volta ao padrão', async ({ page }) => {
  const errosDaPagina = await abrirAjustes(page, 1280, { contraste: 'ALTO', tema: 'ESCURO' });
  const alto = page.getByRole('radiogroup', { name: 'Contraste' }).getByRole('radio', { name: 'Alto', exact: true });
  await expect(alto).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Restaurar as preferências?' });
  await expect(painel.getByText(/^Volta todas as preferências deste aparelho ao padrão/)).toBeVisible();
  await capturar(page, 'ajustes-1280-restaurar', false);
  await painel.getByRole('button', { name: 'Cancelar' }).click();
  await expect(painel).toBeHidden();
  await expect(alto).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await painel.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.getByText('Preferências restauradas.')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Contraste' }).getByRole('radio', { name: 'Padrão', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`aluno ${largura} px: a folha de Aparência numa coluna, sem Aniversários, com Restaurar no topo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      ...(await sessao(page, ALUNO)),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste', emailDeAcesso: ALUNO.email, versao: 1 } },
      'GET /aluno/indicacao': { corpo: { link: null } },
    });
    await page.goto('/aluno/conta');
    await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
    const folha = page.getByRole('dialog', { name: 'Aparência e preferências' });
    await expect(secao(folha, 'Navegador')).toBeVisible();

    const xs: number[] = [];
    for (const titulo of SECOES) xs.push(Math.round((await caixa(secao(folha, titulo))).x));
    expect(new Set(xs).size).toBe(1);
    await expect(folha.getByText('Aniversários', { exact: true })).toHaveCount(0);
    await expect(folha.getByRole('radio', { name: 'Padrão da consultoria. O tema que o seu treinador escolheu' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Adicionar refeição', disabled: true })).toBeVisible();
    await capturar(page, `aluno-${largura}`);

    // A confirmação abre por cima da folha e responde ao toque.
    await folha.getByRole('button', { name: 'Restaurar padrão' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Restaurar as preferências?' });
    await expect(painel).toBeVisible();
    await capturar(page, `aluno-${largura}-restaurar`, false);
    await painel.getByRole('button', { name: 'Restaurar', exact: true }).click();
    await expect(painel).toBeHidden();
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}
