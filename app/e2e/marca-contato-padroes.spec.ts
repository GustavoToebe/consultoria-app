import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Configurações › Marca, Contato e Padrões do acompanhamento (27/11): a Marca só com a identidade (Identidade, Cor da marca,
 * Fonte do nome e Tema padrão) e a prévia ao vivo; o Contato e os Padrões em telas próprias, gravando o mesmo PUT. Confere
 * a prévia mudando ao vivo, o erro de carga e, com `E2E_CAPTURAS`, captura 1920 e 3440×1440 no escuro e no claro, mais o
 * celular. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true }, cicloHabilitado: true };
const CHEIA: ConsultoriaResponse = {
  marca: { ...MARCA, nome: 'Consultoria Fictícia', corPrimaria: '#2563EB', temaPadrao: 'ESCURO' }, versao: 3, diasAtualizacaoPadrao: 30, metaDoPeso: 'REDUZIR',
  whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test',
  redesSociais: { instagram: 'https://www.instagram.com/ficticia', tiktok: null, youtube: 'https://www.youtube.com/@ficticia', x: null, site: 'https://ficticia.test' },
  textosFasesCiclo: { menstrual: 'Texto fictício da fase.', folicular: null, ovulatoria: null, lutea: null },
};

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function abrir(page: Page, largura: number, altura: number, caminho: string, tema: 'ESCURO' | 'CLARO' = 'ESCURO', consultoria: unknown = { corpo: CHEIA }, extras: Parameters<typeof simularApi>[1] = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': consultoria as never,
    'PUT /consultoria/marca': (p, route) => json(route, { ...CHEIA, ...(p.corpo as object), marca: CHEIA.marca, versao: 4 }),
    ...extras,
  });
  await page.goto(caminho);
  return api;
}

async function capturar(page: Page, nome: string) {
  const base = process.env.E2E_CAPTURAS;
  if (!base) return;
  fs.mkdirSync(base, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(base, `${nome}.png`) });
}

test('Marca: a prévia muda ao vivo com o tema, o "Ver em", a cor e o nome; PDF e e-mail embaixo; o Contato não está nela', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 1080, '/treinador/configuracoes/marca');
  const inicio = page.getByTestId('previa-da-paleta');
  const entrar = page.getByTestId('previa-de-entrar');
  const email = page.getByTestId('miniatura-do-email-convite');
  const pdf = page.getByTestId('miniatura-do-pdf');
  await expect(inicio).toBeVisible();
  await expect(entrar).toBeVisible();
  await expect(pdf).toBeVisible();
  for (const titulo of ['Identidade', 'Cor da marca', 'Fonte do nome', 'Tema padrão', 'Prévia']) await expect(page.getByRole('heading', { level: 2, name: titulo, exact: true })).toBeVisible();
  for (const fora of ['Contato', 'Acompanhamento', 'Redes sociais']) await expect(page.getByRole('heading', { name: fora, exact: true })).toHaveCount(0);
  // 1920 de janela dentro de Configurações mede ~1348 (< 1600): a prévia fica embaixo do formulário, sem rolagem lateral.
  const formulario = await page.getByTestId('coluna-do-formulario').boundingBox();
  expect((await inicio.boundingBox())!.y).toBeGreaterThan(formulario!.y + 200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // O remetente do e-mail vem de Contato.
  await expect(email).toContainText('De: Equipe Fictícia');
  // "Ver em" começa no modo do tema padrão (Escuro) e mostra o Claro sem mudar o tema escolhido.
  const verEm = page.getByRole('radiogroup', { name: 'Ver a prévia em' });
  await expect(verEm.getByRole('radio', { name: 'Escuro', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(inicio).toHaveCSS('background-color', rgb(PALETAS.ESCURO.cores.fundo));
  await verEm.getByRole('radio', { name: 'Claro', exact: true }).click();
  await expect(inicio).toHaveCSS('background-color', rgb(PALETAS.CLARO.cores.fundo));
  await expect(page.getByRole('group', { name: 'Escuras' }).getByRole('radio', { name: 'Escuro', exact: true })).toHaveAttribute('aria-checked', 'true');
  // Escolher uma paleta mostra a prévia nela, no modo dela.
  await page.getByRole('group', { name: 'Claras' }).getByRole('radio', { name: 'Areia', exact: true }).click();
  await expect(inicio).toHaveCSS('background-color', rgb(PALETAS.AREIA.cores.fundo));
  await expect(entrar).toHaveCSS('background-color', rgb(PALETAS.AREIA.cores.fundo));
  await expect(page.getByText('Paleta Areia', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome da consultoria' }).fill('Equipe Nova Fictícia');
  await expect(inicio.getByText('Equipe Nova Fictícia')).toBeVisible();
  await expect(entrar.getByText('Equipe Nova Fictícia')).toBeVisible();
  await expect(email).toContainText('Você foi convidado para a Equipe Nova Fictícia.');
  await expect(pdf).toContainText('EQUIPE NOVA FICTÍCIA');
  // O "Entrar" da tela de entrar e o "Criar minha conta" do e-mail pintam a cor da marca escolhida.
  await page.getByRole('radiogroup', { name: 'Cor da marca' }).getByRole('radio', { name: 'Verde', exact: true }).click();
  await expect(entrar.getByText('Entrar', { exact: true }).locator('..')).toHaveCSS('background-color', rgb('#15803D'));
  await expect(email.getByText('Criar minha conta', { exact: true }).locator('..')).toHaveCSS('background-color', rgb('#15803D'));
  expect(errosDaPagina).toEqual([]);
});

test('Marca: com logo, a tela de entrar da prévia mostra a logo (o topo não fica vazio)', async ({ page }) => {
  const marca = { ...CHEIA.marca, logoUrl: `/publico/marcas/${MARCA.id}/logo?v=1` };
  const { errosDaPagina } = await abrir(page, 1280, 900, '/treinador/configuracoes/marca', 'ESCURO', { corpo: { ...CHEIA, marca } }, {
    'GET /publico/marcas/{id}/logo': (_p, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(120, [40, 90, 200]) }),
  });
  const logo = page.getByTestId('previa-de-entrar').locator('img').first();
  await expect(logo).toBeAttached();
  const caixa = await logo.boundingBox();
  expect(caixa!.width).toBeGreaterThan(20);
  expect(caixa!.height).toBeGreaterThan(20);
  expect(errosDaPagina).toEqual([]);
});

test('Marca 3440: formulário à esquerda e a prévia fixa ao lado, os dois celulares lado a lado', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 3440, 1440, '/treinador/configuracoes/marca');
  const previa = page.getByTestId('coluna-da-previa');
  await expect(previa).toBeVisible();
  const inicio = await page.getByTestId('previa-da-paleta').boundingBox();
  const entrar = await page.getByTestId('previa-de-entrar').boundingBox();
  expect(Math.abs(inicio!.y - entrar!.y)).toBeLessThan(2);
  expect(entrar!.x).toBeGreaterThan(inicio!.x + inicio!.width - 1);
  expect(inicio!.width).toBeLessThanOrEqual(381);
  // Fixa ao rolar: levar o fim do formulário à vista não tira o cartão da janela, e ele nunca passa da altura dela.
  await page.getByRole('link', { name: /^Escolher o tema do meu painel/ }).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await previa.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  const depois = (await previa.boundingBox())!;
  expect(depois.y + depois.height).toBeLessThanOrEqual(1440);
  expect(errosDaPagina).toEqual([]);
});

test('Contato: a prévia mostra o WhatsApp e o e-mail ao vivo; Cancelar volta ao salvo; Salvar manda o formato da API', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 1280, 900, '/treinador/configuracoes/contato');
  const whatsapp = page.getByRole('textbox', { name: /^WhatsApp da consultoria/ });
  const testar = page.getByRole('button', { name: /^Testar o WhatsApp/ });
  const conta = page.getByTestId('previa-da-conta');
  const email = page.getByTestId('miniatura-do-email-lembrete');
  await expect(whatsapp).toHaveValue('(45) 99999-8888');
  await expect(testar).toBeVisible();
  await expect(conta).toContainText('Falar com o treinador');
  await expect(email).toContainText('De: Equipe Fictícia');
  await expect(email).toContainText('Responder para: contato@exemplo.test');
  await whatsapp.fill('');
  await expect(conta).toContainText('O aluno não vê o botão do WhatsApp');
  await expect(testar).toHaveCount(0);
  const nome = page.getByRole('textbox', { name: 'Nome que aparece nos e-mails' });
  await nome.fill('');
  await expect(nome).toHaveAttribute('placeholder', 'Consultoria Fictícia');
  await expect(email).toContainText('De: Consultoria Fictícia');
  await expect(page.getByText('Alterações não salvas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(whatsapp).toHaveValue('(45) 99999-8888');
  await expect(nome).toHaveValue('Equipe Fictícia');
  await expect(page.getByRole('button', { name: 'Salvar contato', exact: true })).toHaveCount(0);
  await whatsapp.fill('45988887777');
  await expect(whatsapp).toHaveValue('(45) 98888-7777');
  await page.getByRole('button', { name: 'Salvar contato', exact: true }).click();
  await expect(page.getByText('Contato salvo.', { exact: true })).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca')?.corpo).toMatchObject({
    whatsapp: '(45) 98888-7777', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test',
  });
  expect(errosDaPagina).toEqual([]);
});

test('Contato vazio em 390: sem WhatsApp a prévia avisa e o remetente é o nome da consultoria, sem rolagem lateral', async ({ page }) => {
  const vazio = { ...CHEIA, whatsapp: null, emailRemetenteNome: null, emailResponderPara: null, redesSociais: null };
  const { errosDaPagina } = await abrir(page, 390, 844, '/treinador/configuracoes/contato', 'ESCURO', { corpo: vazio });
  await expect(page.getByRole('textbox', { name: /^WhatsApp da consultoria/ })).toHaveValue('');
  await expect(page.getByTestId('previa-da-conta')).toContainText('O aluno não vê o botão do WhatsApp');
  await expect(page.getByTestId('miniatura-do-email-lembrete')).toContainText('De: Consultoria Fictícia');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

test('Marca: erro ao carregar mostra a mensagem com "Tentar de novo", sem formulário', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, '/treinador/configuracoes/marca', 'ESCURO', erroApi(500, 'Falha fictícia ao ler a consultoria.', 'ERRO_INTERNO'));
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nome da consultoria' })).toHaveCount(0);
  await capturar(page, 'marca-erro-1280-escuro');
  expect(errosDaPagina).toEqual([]);
});

test('Padrões do acompanhamento: o prazo vai no PUT com o resto gravado; o motivo trava fora de 1 a 365', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 1280, 900, '/treinador/configuracoes/padroes-do-acompanhamento');
  const dias = page.getByRole('textbox', { name: 'Nova atualização a cada (dias)' });
  await expect(dias).toHaveValue('30');
  await dias.fill('400');
  await expect(page.getByText('Use de 1 a 365 dias.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toBeDisabled();
  await dias.fill('14');
  await page.getByRole('button', { name: 'Salvar padrões', exact: true }).click();
  await expect(page.getByText('Padrões do acompanhamento salvos.', { exact: true })).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca')?.corpo).toMatchObject({
    diasAtualizacaoPadrao: 14, metaDoPeso: 'REDUZIR', nome: 'Consultoria Fictícia', corPrimaria: '#2563EB', whatsapp: '(45) 99999-8888',
    textosFasesCiclo: { menstrual: 'Texto fictício da fase.', folicular: null, ovulatoria: null, lutea: null },
  });
  expect(errosDaPagina).toEqual([]);
});

test('captura 390: Marca no celular com a prévia embaixo, e o Contato', async ({ page }) => {
  test.skip(!process.env.E2E_CAPTURAS, 'só com E2E_CAPTURAS');
  const { errosDaPagina } = await abrir(page, 390, 844, '/treinador/marca');
  await expect(page.getByRole('radiogroup', { name: 'Cor da marca' })).toBeVisible();
  await capturar(page, 'marca-390-escuro');
  await page.getByRole('radiogroup', { name: 'Tema padrão da consultoria' }).scrollIntoViewIfNeeded();
  await capturar(page, 'marca-390-escuro-tema');
  await page.getByTestId('previa-da-paleta').scrollIntoViewIfNeeded();
  await capturar(page, 'marca-390-escuro-previa');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/treinador/configuracoes/contato');
  await expect(page.getByRole('heading', { level: 1, name: 'Contato' })).toBeVisible();
  await capturar(page, 'contato-390-escuro');
  expect(errosDaPagina).toEqual([]);
});
