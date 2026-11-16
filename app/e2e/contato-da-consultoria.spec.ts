import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Contato da consultoria (N1, passo B3 de `docs/planos/contato-da-consultoria.md`): o bloco "Contato" da Marca manda os
 * três campos em todo PUT (em branco apaga na API), o 422 `MARCA_INVALIDA` cai no campo e o aluno vê "Falar com o
 * treinador" na Conta só quando a consultoria tem número. Só dados fictícios. Capturas em `E2E_CAPTURAS`, se definida.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const BASE: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const COM_CONTATO: ConsultoriaResponse = { ...BASE, whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test' };

async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/contato-${nome}.png`, fullPage: true });
}

async function abrirMarca(page: Page, largura: number, consultoria: ConsultoriaResponse, put: RespostasApi[string]) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
    'PUT /consultoria/marca': put,
  });
  await page.goto('/treinador/marca');
  await expect(page.getByRole('heading', { name: 'Contato' })).toBeVisible();
  return api;
}

/** O PUT devolve o que recebeu (com os vazios como nulo), como a API. */
const ecoar: RespostasApi[string] = (p, route) => {
  const c = p.corpo as Record<string, string>;
  const vazio = (v: string) => v || null;
  return json(route, { ...BASE, versao: 4, whatsapp: vazio(c.whatsapp), emailRemetenteNome: vazio(c.emailRemetenteNome), emailResponderPara: vazio(c.emailResponderPara) });
};

const campo = (page: Page, nome: string) => page.getByRole('textbox', { name: nome, exact: true });
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar marca', exact: true });
const putDaMarca = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) => pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca');

for (const largura of [390, 1280]) {
  test(`Marca (${largura}): preenche os três campos do Contato e o PUT leva os três`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirMarca(page, largura, BASE, ecoar);
    await expect(salvar(page)).toHaveCount(0);
    await campo(page, 'WhatsApp da consultoria').fill('45999998888');
    await expect(campo(page, 'WhatsApp da consultoria')).toHaveValue('(45) 99999-8888');
    await campo(page, 'Nome que aparece nos e-mails').fill('Equipe Fictícia');
    await campo(page, 'Responder para').fill('contato@exemplo.test');
    await capturar(page, `marca-${largura}`);
    await salvar(page).click();
    await expect(page.getByText('Marca salva. Os alunos veem a nova marca ao abrir o app.')).toBeVisible();
    expect(putDaMarca(pedidos)?.corpo).toMatchObject({ versao: 3, whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test' });
    // Gravado e devolvido igual: nada mais a salvar.
    await expect(salvar(page)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Marca (${largura}): o erro local trava o salvar com o motivo e o 422 da API cai no campo`, async ({ page }) => {
    const { errosDaPagina } = await abrirMarca(page, largura, BASE,
      erroApi(422, 'Marca inválida.', 'MARCA_INVALIDA', [{ field: 'emailResponderPara', message: 'O servidor recusou este e-mail.' }]));
    await campo(page, 'WhatsApp da consultoria').fill('4599');
    await expect(page.getByText('Informe o WhatsApp com DDD, por exemplo (45) 99999-8888.')).toBeVisible();
    await expect(salvar(page)).toBeDisabled();
    await campo(page, 'WhatsApp da consultoria').fill('');
    await campo(page, 'Responder para').fill('contato@exemplo.test');
    await salvar(page).click();
    await expect(page.getByText('O servidor recusou este e-mail.')).toBeVisible();
    await expect(campo(page, 'Responder para')).toHaveAttribute('aria-invalid', 'true');
    await capturar(page, `marca-erro-${largura}`);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Marca (${largura}): salvar outro campo não apaga o contato (o PUT manda os três gravados)`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirMarca(page, largura, COM_CONTATO, ecoar);
    await expect(campo(page, 'WhatsApp da consultoria')).toHaveValue('(45) 99999-8888');
    await expect(salvar(page)).toHaveCount(0);
    await campo(page, 'Nome da consultoria').fill('Consultoria Nova Fictícia');
    await salvar(page).click();
    await expect(page.getByText('Marca salva. Os alunos veem a nova marca ao abrir o app.')).toBeVisible();
    expect(putDaMarca(pedidos)?.corpo).toMatchObject({ nome: 'Consultoria Nova Fictícia', whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test' });
    expect(errosDaPagina).toEqual([]);
  });

  test(`Conta do aluno (${largura}): com número aparece "Falar com o treinador" e abre o wa.me fora do app`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }));
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      ...(await sessao(page, ALUNO, { whatsappDaConsultoria: '45999998888' })),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    const item = page.getByRole('button', { name: /^Falar com o treinador/ });
    await expect(item).toBeVisible();
    // A Conta rola por dentro: a captura de página inteira para no primeiro quadro.
    await item.scrollIntoViewIfNeeded();
    await capturar(page, `conta-${largura}`);
    const [popup] = await Promise.all([page.waitForEvent('popup'), item.click()]);
    await popup.waitForLoadState();
    const url = new URL(popup.url());
    expect(url.origin + url.pathname).toBe('https://wa.me/5545999998888');
    expect(url.search).toBe('');
    expect(errosDaPagina).toEqual([]);
  });

  test(`Conta do aluno (${largura}): sem número o item não aparece`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    await expect(page.getByRole('link', { name: /^Ajuda/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Falar com o treinador/ })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
