import { expect, test, type Locator, type Page } from '@playwright/test';

import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Aparência e preferências (25/11): título igual ao menu, "Restaurar padrão" secundário no cabeçalho com confirmação na tela,
 * cinco seções (Tema e cores, Leitura, Layout, Treino e dados, Navegador) com uma linha por opção, o nome de cada opção uma
 * vez só, temas sem código de cor, prévia da cor de ação inerte, e as seções em colunas empilhadas pela faixa (1 no
 * celular, 2 na normal e na larga, 3 na ultralarga). O aluno vê o mesmo componente numa folha, numa coluna. Menu aberto
 * (o padrão). Capturas só com `E2E_CAPTURAS` (pasta fora do git). Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;
const SECOES = ['Tema e cores', 'Leitura', 'Layout', 'Treino e dados', 'Navegador'];
const NOMES = ['Tema', 'Cor de ação', 'Tamanho do texto', 'Contraste', 'Bordas reforçadas', 'Animações', 'Largura do conteúdo', 'Detalhes abrem', 'Unidade da carga', 'Mostrar gráficos', 'Barras de rolagem escuras'];
/** Colunas esperadas (área ao lado do menu de 240 px): 1040 é normal, 1680 é larga, 3200 é ultralarga. */
const COLUNAS: Record<number, number> = { 390: 1, 1280: 2, 1920: 2, 3440: 3 };

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

async function abrirAjustes(page: Page, largura: number, preferencias: object = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { unidadeDeCargaHabilitada: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto('/treinador/ajustes');
  await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
  await expect(secao(page, 'Navegador')).toBeVisible();
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

    // Cada opção tem o nome escrito uma vez só (o "Variações de tom" também), e nenhum título repete o da seção.
    for (const nome of [...NOMES, 'Variações de tom']) await expect(page.getByText(nome, { exact: true })).toHaveCount(1);
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
