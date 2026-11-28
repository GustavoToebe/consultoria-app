import { expect, test, type Locator, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, LEMBRETES_PADRAO, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Financeiro › Lembretes (28/11): configuração + prévia do e-mail + "Quem recebe e por onde" ("Próximos envios" só depois
 * de 01/12: até lá o cartão não aparece). Da faixa larga (área ≥ 1600; 1920 com o menu aberto) em diante duas colunas, a da
 * direita fixa ao rolar; abaixo, empilhadas. Linha do tempo de botões de alternar (`aria-pressed`), dias "digite ou escolha",
 * rodapé fixo só com alteração e prévia do texto real por envio (Antes · No dia · Depois em rádio, `ui/Escolha`), com a marca
 * e "Abra o app para ver como pagar", sem botão de pagar. Só dados fictícios, API simulada.
 */

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

async function abrir(page: Page, estado: EstadoFinanceiro, extra: RespostasApi = {}, permissoes?: string[]) {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page, permissoes)), ...rotasDoFinanceiro(estado), ...extra });
  await page.goto('/treinador/financeiro?aba=lembretes');
  await expect(page.getByRole('tab', { name: 'Lembretes', selected: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lembretes de cobrança' })).toBeVisible();
  return api;
}

const ligados = () => estadoFinanceiro({ lembretes: { ...LEMBRETES_PADRAO, ligado: true, versao: 0 } });
const ponto = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true });
const diasAntes = (page: Page) => page.getByRole('button', { name: /^Dias antes: / });
const diasDepois = (page: Page) => page.getByRole('button', { name: /^Dias depois: / });
const rodape = (page: Page) => page.getByText('Alterações não salvas', { exact: true });
const envio = (page: Page, nome: string) => page.getByRole('radiogroup', { name: 'Qual envio mostrar' }).getByRole('radio', { name: nome, exact: true });

test('1920 px: duas colunas, a prévia ao lado e fixa ao rolar; 1280 empilha; 390 sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { errosDaPagina } = await abrir(page, ligados());
  const config = page.getByRole('heading', { name: 'Lembretes de cobrança' });
  const previa = page.getByRole('heading', { name: 'Prévia do e-mail' });
  await expect.poll(async () => Math.abs((await caixa(config)).y - (await caixa(previa)).y)).toBeLessThan(2);
  expect((await caixa(previa)).x).toBeGreaterThan((await caixa(config)).x + 600);
  // A coluna da direita é `sticky` (fixa ao rolar), e "Quem recebe" fica embaixo da prévia; "Próximos envios" não aparece.
  const posicao = await previa.evaluate((el) => {
    let no: HTMLElement | null = el as HTMLElement;
    while (no && getComputedStyle(no).position !== 'sticky') no = no.parentElement;
    return no ? 'sticky' : 'nenhuma';
  });
  expect(posicao).toBe('sticky');
  expect((await caixa(page.getByRole('heading', { name: 'Quem recebe e por onde' }))).y).toBeGreaterThan((await caixa(previa)).y);
  await expect(page.getByRole('heading', { name: 'Próximos envios' })).toHaveCount(0);
  await expect(page.getByText('Previsão indisponível')).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await caixa(previa)).y > (await caixa(config)).y + 200).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previa).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

test('linha do tempo: cada ponto liga e desliga o envio; rodapé com Cancelar e Salvar só com alteração', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const estado = ligados();
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  const grupo = page.getByRole('group', { name: 'Quando mandar o lembrete' });
  await expect(grupo.getByRole('button')).toHaveCount(3);
  await expect(ponto(page, 'Lembrete 3 dias antes: ligado')).toHaveAttribute('aria-pressed', 'true');
  await expect(ponto(page, 'Lembrete no vencimento: ligado')).toHaveAttribute('aria-pressed', 'true');
  await expect(ponto(page, 'Lembrete 3 dias depois: ligado')).toHaveAttribute('aria-pressed', 'true');
  await expect(rodape(page)).toHaveCount(0);
  await expect(page.getByText('Tudo salvo', { exact: true })).toHaveCount(0);

  // Desligar o "antes" põe 0 ("Não manda") e o resumo segue; religar volta aos 3 dias.
  await ponto(page, 'Lembrete 3 dias antes: ligado').click();
  await expect(ponto(page, 'Lembrete 3 dias antes: desligado')).toHaveAttribute('aria-pressed', 'false');
  await expect(diasAntes(page)).toHaveAccessibleName('Dias antes: Não manda. Escolher.');
  await expect(page.getByText('Lembretes no dia e 3 dias depois do vencimento.')).toBeVisible();
  await expect(rodape(page)).toBeVisible();
  await ponto(page, 'Lembrete 3 dias antes: desligado').click();
  await expect(diasAntes(page)).toHaveAccessibleName('Dias antes: 3 dias. Escolher.');
  await expect(rodape(page)).toHaveCount(0);

  // Teclado: Espaço no ponto focado alterna.
  await ponto(page, 'Lembrete no vencimento: ligado').focus();
  await page.keyboard.press('Space');
  await expect(ponto(page, 'Lembrete no vencimento: desligado')).toBeFocused();
  await expect(page.getByRole('switch', { name: 'No dia do vencimento' })).not.toBeChecked();

  // Cancelar volta ao salvo, sem PUT.
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(rodape(page)).toHaveCount(0);
  await expect(ponto(page, 'Lembrete no vencimento: ligado')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);

  // "Dias depois" digitado: 10; salvar manda os valores da tela.
  await diasDepois(page).click();
  await page.getByLabel('Digite ou escolha').fill('10');
  await page.getByRole('option', { name: '10 dias' }).first().click();
  await expect(diasDepois(page)).toHaveAccessibleName('Dias depois: 10 dias. Escolher.');
  await expect(ponto(page, 'Lembrete 10 dias depois: ligado')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Lembretes salvos.')).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT');
  expect(put?.corpo).toMatchObject({ ligado: true, diasAntes: 3, noDia: true, diasDepois: 10, versao: 0 });
  await expect(rodape(page)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('desligados: controles no cinza do desabilitado, com a frase; a prévia continua', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, estadoFinanceiro());
  await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toBeVisible();
  await expect(ponto(page, 'Lembrete 3 dias antes: ligado')).toBeDisabled();
  await expect(diasAntes(page)).toBeDisabled();
  await expect(diasDepois(page)).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'No dia do vencimento' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Prévia do e-mail' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('sem FINANCEIRO_ALTERAR: leitura com o motivo, sem interruptor nem rodapé', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, ligados(), {}, ['FINANCEIRO_LER']);
  await expect(page.getByText('Para mudar os lembretes, peça a quem administra o financeiro.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Mandar lembretes por e-mail' })).toHaveCount(0);
  await expect(ponto(page, 'Lembrete 3 dias antes: ligado')).toBeDisabled();
  await expect(diasAntes(page)).toBeDisabled();
  await expect(rodape(page)).toHaveCount(0);
  expect(PERMISSOES_TREINADOR).not.toContain('FINANCEIRO_ALTERAR');
  expect(errosDaPagina).toEqual([]);
});

test('prévia: o texto real de cada envio, a marca, o remetente de Contato e nenhum botão de pagar', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { errosDaPagina } = await abrir(page, ligados(), { 'GET /consultoria': { corpo: { emailRemetenteNome: 'Time Fictício' } } });
  const previa = page.getByTestId('previa-do-email');
  await expect(previa.getByText('Time Fictício via Overtraining')).toBeVisible();
  await expect(previa.getByText('Lembrete de mensalidade - Equipe Teste')).toBeVisible();
  await expect(envio(page, 'Antes')).toBeChecked();
  // Sem logo na sessão: o nome da consultoria no topo do e-mail, no papel branco.
  await expect(previa.getByTestId('topo-da-marca').getByText('Equipe Teste', { exact: true })).toBeVisible();
  await expect(previa.getByText('A mensalidade de Equipe Teste no valor de R$ 250,00 vence em 10/12.')).toBeVisible();
  await envio(page, 'No dia').click();
  await expect(previa.getByText('vence hoje (10/12).', { exact: false })).toBeVisible();
  await envio(page, 'Depois').click();
  await expect(envio(page, 'Depois')).toBeChecked();
  await expect(envio(page, 'Antes')).not.toBeChecked();
  await expect(previa.getByText(/venceu em 10\/12 e ainda está em aberto\. Se você já pagou, desconsidere esta mensagem\./)).toBeVisible();
  await expect(previa.getByText(/Abra o app para ver como pagar: https:\/\/overtraining\.app\/aluno\/conta/)).toBeVisible();
  await expect(previa.getByRole('button')).toHaveCount(0);
  await expect(previa.getByText(/Pagar/)).toHaveCount(0);

  // Envio desligado: a prévia avisa que ele não sai.
  await ponto(page, 'Lembrete 3 dias depois: ligado').click();
  await expect(page.getByText('Este envio está desligado: com a configuração da tela, ele não sai.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('prévia sem o nome de Contato (ou sem ler a consultoria): o nome da consultoria', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, ligados(), { 'GET /consultoria': { status: 403, corpo: { status: 403, message: 'Sem permissão.', codigo: 'PERMISSAO_NEGADA' } } });
  await expect(page.getByTestId('previa-do-email').getByText('Equipe Teste via Overtraining')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('ligar pela tela: o interruptor parte do desligado, escolher os dias e Salvar manda o PUT com eles', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { pedidos, errosDaPagina } = await abrir(page, estadoFinanceiro());
  const interruptor = page.getByRole('switch', { name: 'Mandar lembretes por e-mail' });
  await expect(interruptor).not.toBeChecked();
  await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toBeVisible();
  await expect(diasAntes(page)).toBeDisabled();

  await interruptor.click();
  await expect(interruptor).toBeChecked();
  await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toHaveCount(0);
  await expect(diasAntes(page)).toBeEnabled();

  // "Dias antes" digitado: 5; "Dias depois" digitado: 10. O "no dia" segue ligado (padrão).
  await diasAntes(page).click();
  await page.getByLabel('Digite ou escolha').fill('5');
  await page.getByRole('option', { name: '5 dias' }).first().click();
  await expect(diasAntes(page)).toHaveAccessibleName('Dias antes: 5 dias. Escolher.');
  await diasDepois(page).click();
  await page.getByLabel('Digite ou escolha').fill('10');
  await page.getByRole('option', { name: '10 dias' }).first().click();
  await expect(diasDepois(page)).toHaveAccessibleName('Dias depois: 10 dias. Escolher.');

  expect(pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Lembretes salvos.')).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/financeiro/lembretes');
  expect(put?.corpo).toEqual({ ligado: true, diasAntes: 5, noDia: true, diasDepois: 10, versao: null });
  await expect(rodape(page)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
