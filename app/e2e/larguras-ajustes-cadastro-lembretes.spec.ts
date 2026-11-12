import { expect, test, type Locator, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Larguras no PC (12/11): Ajustes e Novo aluno saíram da faixa estreita centralizada (1040 e 640) para a largura útil,
 * com as colunas por assunto lado a lado quando o contêiner cabe; no celular, uma coluna na ordem de antes. Os campos não
 * esticam além de 560 px. Lembretes do Financeiro: aba própria (o Recebimento online é outra aba), o cartão segue com a
 * largura de formulário, alinhado ao cabeçalho. Menu aberto (o padrão). Só dados fictícios.
 */
const CAPTURAS = process.env.E2E_CAPTURAS;

async function capturar(page: Page, nome: string) {
  await page.screenshot({ path: CAPTURAS ? `${CAPTURAS}/${nome}.png` : test.info().outputPath(`${nome}.png`), fullPage: true });
}

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function comTema(page: Page, tema: 'CLARO' | 'ESCURO') {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
}

const PC = [[1920, 1080], [1440, 900]] as const;
/** 1280 com o menu aberto: as colunas ainda cabem (o conteúdo é mais estreito que 1040, e antes também era). */
const PC_COM_1280 = [...PC, [1280, 800]] as const;

test.describe('Ajustes', () => {
  async function abrir(page: Page, largura: number, altura: number) {
    await page.setViewportSize({ width: largura, height: altura });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { unidadeDeCargaHabilitada: true })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    });
    await page.goto('/treinador/ajustes');
    await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Unidade da carga' })).toBeVisible();
    return errosDaPagina;
  }
  const tema = (page: Page) => page.getByRole('radiogroup', { name: 'Tema' });
  const contraste = (page: Page) => page.getByRole('radiogroup', { name: 'Contraste' });
  const unidade = (page: Page) => page.getByRole('radiogroup', { name: 'Unidade da carga' });

  for (const [largura, altura] of PC_COM_1280) test(`${largura} px: tema à esquerda, o resto à direita, mais largo que a faixa de 1040 a partir de 1440`, async ({ page }) => {
    const errosDaPagina = await abrir(page, largura, altura);
    await capturar(page, `ajustes-${largura}`);
    const t = await caixa(tema(page));
    const c = await caixa(contraste(page));
    const u = await caixa(unidade(page));
    // Lado a lado e começando na mesma altura (título dos dois cartões na mesma linha).
    expect(c.x).toBeGreaterThan(t.x + t.width);
    const tituloTema = await caixa(page.getByText('Tema', { exact: true }).first());
    const tituloContraste = await caixa(page.getByText('Contraste', { exact: true }).first());
    expect(Math.abs(tituloTema.y - tituloContraste.y)).toBeLessThan(4);
    // A unidade fica na coluna da direita, embaixo do contraste.
    expect(Math.abs(u.x - c.x)).toBeLessThan(2);
    expect(u.y).toBeGreaterThan(c.y);
    // O interruptor fica na borda direita da coluna da direita: ele marca até onde o conteúdo vai.
    const bordas = await caixa(page.getByRole('switch', { name: 'Bordas reforçadas' }));
    const direita = bordas.x + bordas.width;
    if (largura >= 1440) expect(direita - t.x).toBeGreaterThan(1040);
    // Nenhuma coluna passa de 720 px (o interruptor não se afasta do rótulo).
    expect(direita - c.x).toBeLessThanOrEqual(720);
    expect(t.width).toBeLessThanOrEqual(720);
    // "Restaurar padrão" depois das duas colunas.
    const restaurar = await caixa(page.getByRole('button', { name: 'Restaurar padrão' }));
    expect(restaurar.y).toBeGreaterThan(u.y + u.height);
    expect(restaurar.y).toBeGreaterThan(t.y + t.height);
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });

  test('390 px: uma coluna na ordem de antes (Tema, Contraste, ..., Unidade, Restaurar)', async ({ page }) => {
    const errosDaPagina = await abrir(page, 390, 844);
    const t = await caixa(tema(page));
    const c = await caixa(contraste(page));
    const u = await caixa(unidade(page));
    expect(c.y).toBeGreaterThan(t.y + t.height);
    expect(u.y).toBeGreaterThan(c.y + c.height);
    expect(Math.abs(t.x - c.x)).toBeLessThan(2);
    const restaurar = await caixa(page.getByRole('button', { name: 'Restaurar padrão' }));
    expect(restaurar.y).toBeGreaterThan(u.y + u.height);
    await semRolagemHorizontal(page);
    await capturar(page, 'ajustes-390');
    expect(errosDaPagina).toEqual([]);
  });

  test('1440 px no tema escuro: as duas colunas', async ({ page }) => {
    await comTema(page, 'ESCURO');
    const errosDaPagina = await abrir(page, 1440, 900);
    expect((await caixa(contraste(page))).x).toBeGreaterThan((await caixa(tema(page))).x + 300);
    await capturar(page, 'ajustes-1440-escuro');
    expect(errosDaPagina).toEqual([]);
  });
});

test.describe('Novo aluno', () => {
  async function abrir(page: Page, largura: number, altura: number, permissoes = PERMISSOES_TREINADOR) {
    await page.setViewportSize({ width: largura, height: altura });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    });
    await page.goto('/treinador/alunos/novo');
    await expect(page.getByRole('heading', { name: 'Novo aluno', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Treinador responsável').first()).toBeVisible();
    return errosDaPagina;
  }
  const nome = (page: Page) => page.getByLabel('Nome', { exact: true });
  const cpf = (page: Page) => page.getByLabel('CPF (opcional)', { exact: true });
  const dias = (page: Page) => page.getByLabel('Dias para nova atualização (opcional)', { exact: true });
  const titulo = (page: Page, texto: string) => page.getByText(texto, { exact: true }).last();

  for (const [largura, altura] of PC_COM_1280) test(`${largura} px: Cadastro e Dados pessoais lado a lado, campos até 560 px`, async ({ page }) => {
    const errosDaPagina = await abrir(page, largura, altura);
    await capturar(page, `novo-aluno-${largura}`);
    const n = await caixa(nome(page));
    const c = await caixa(cpf(page));
    const d = await caixa(dias(page));
    expect(c.x).toBeGreaterThan(n.x + n.width);
    expect(Math.abs((await caixa(titulo(page, 'Cadastro'))).y - (await caixa(titulo(page, 'Dados pessoais'))).y)).toBeLessThan(4);
    // Até a borda direita da última seção na linha de cima (a terceira em 1920, os dados pessoais em 1440).
    if (largura >= 1440) expect((largura >= 1920 ? d.x + d.width : c.x + c.width) - n.x).toBeGreaterThan(1040);
    for (const campo of [n, c, d, await caixa(page.getByLabel('Rua, avenida… *', { exact: true }))]) expect(campo.width).toBeLessThanOrEqual(560);
    const acompanhamento = await caixa(titulo(page, 'Acompanhamento'));
    if (largura >= 1920) {
      // Cabe a terceira seção na mesma linha, depois dos dados pessoais.
      expect(d.x).toBeGreaterThan(c.x + c.width);
      expect(Math.abs(acompanhamento.y - (await caixa(titulo(page, 'Cadastro'))).y)).toBeLessThan(4);
    } else {
      // Desce para a linha de baixo, à esquerda, sem esticar.
      expect(Math.abs(d.x - n.x)).toBeLessThan(2);
      expect(acompanhamento.y).toBeGreaterThan(c.y);
    }
    // Ordem de foco: o Tab sai do CEP para a rua (dentro da coluna), sem pular para outra seção.
    await page.getByLabel('CEP *', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Rua, avenida… *', { exact: true })).toBeFocused();
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });

  test('390 px: uma coluna, Nome, CPF e Dias na ordem de antes', async ({ page }) => {
    const errosDaPagina = await abrir(page, 390, 844);
    const n = await caixa(nome(page));
    const c = await caixa(cpf(page));
    const d = await caixa(dias(page));
    expect(c.y).toBeGreaterThan(n.y + n.height);
    expect(d.y).toBeGreaterThan(c.y + c.height);
    expect(Math.abs(n.x - c.x)).toBeLessThan(2);
    expect(Math.abs(n.x - d.x)).toBeLessThan(2);
    await semRolagemHorizontal(page);
    await capturar(page, 'novo-aluno-390');
    expect(errosDaPagina).toEqual([]);
  });

  test('1440 px sem dados sensíveis: Cadastro e Acompanhamento lado a lado, sem coluna vazia reservada', async ({ page }) => {
    await comTema(page, 'ESCURO');
    const errosDaPagina = await abrir(page, 1440, 900, PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_SENSIVEL_ALTERAR'));
    await expect(cpf(page)).toHaveCount(0);
    const n = await caixa(nome(page));
    const d = await caixa(dias(page));
    expect(d.x).toBeGreaterThan(n.x + n.width);
    expect(Math.abs((await caixa(titulo(page, 'Cadastro'))).y - (await caixa(titulo(page, 'Acompanhamento'))).y)).toBeLessThan(4);
    await semRolagemHorizontal(page);
    await capturar(page, 'novo-aluno-1440-sem-sensiveis-escuro');
    expect(errosDaPagina).toEqual([]);
  });
});

test.describe('Financeiro › Lembretes', () => {
  for (const [largura, altura] of [...PC, [390, 844]] as const) test(`${largura} px: cartão alinhado ao cabeçalho, com largura de formulário, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await fixarHoje(page);
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro()) });
    await page.goto('/treinador/financeiro?aba=lembretes');
    await expect(page.getByRole('tab', { name: 'Lembretes', selected: true })).toBeVisible();
    // Recebimento online é outra aba: não aparece junto dos lembretes.
    await expect(page.getByText('Lembretes de cobrança', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recebimento online' })).toBeVisible();
    await expect(page.getByLabel('InfiniteTag')).toHaveCount(0);
    const campo = await caixa(page.getByRole('textbox', { name: 'Dias antes do vencimento' }));
    const abas = await caixa(page.getByRole('tab', { name: 'Visão geral' }));
    expect(campo.width).toBeLessThanOrEqual(560);
    expect(campo.x).toBeGreaterThanOrEqual(abas.x);
    await semRolagemHorizontal(page);
    await capturar(page, `lembretes-${largura}`);
    expect(errosDaPagina).toEqual([]);
  });
});
