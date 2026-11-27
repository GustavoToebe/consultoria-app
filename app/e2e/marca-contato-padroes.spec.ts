import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

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

async function abrir(page: Page, largura: number, altura: number, caminho: string, tema: 'ESCURO' | 'CLARO' = 'ESCURO', consultoria: unknown = { corpo: CHEIA }) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': consultoria as never,
    'PUT /consultoria/marca': (p, route) => json(route, { ...CHEIA, ...(p.corpo as object), marca: CHEIA.marca, versao: 4 }),
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

test('Marca: a prévia muda ao vivo com o tema, a cor e o nome; o Contato e o acompanhamento não estão mais nela', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 1080, '/treinador/configuracoes/marca');
  const inicio = page.getByTestId('previa-da-paleta');
  const entrar = page.getByTestId('previa-de-entrar');
  await expect(inicio).toBeVisible();
  await expect(entrar).toBeVisible();
  for (const titulo of ['Identidade', 'Cor da marca', 'Fonte do nome', 'Tema padrão']) await expect(page.getByRole('heading', { level: 2, name: titulo })).toBeVisible();
  for (const fora of ['Contato', 'Acompanhamento', 'Redes sociais']) await expect(page.getByRole('heading', { name: fora, exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'Claras' }).getByRole('radio', { name: 'Areia', exact: true }).click();
  await expect(inicio).toHaveCSS('background-color', rgb(PALETAS.AREIA.cores.fundo));
  await expect(entrar).toHaveCSS('background-color', rgb(PALETAS.AREIA.cores.fundo));
  await expect(page.getByText('Paleta Areia', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome da consultoria' }).fill('Equipe Nova Fictícia');
  await expect(inicio.getByText('Equipe Nova Fictícia')).toBeVisible();
  await expect(entrar.getByText('Equipe Nova Fictícia')).toBeVisible();
  // O "Entrar" da tela de entrar pinta a cor da marca escolhida.
  await page.getByRole('radiogroup', { name: 'Cor da marca' }).getByRole('radio', { name: 'Verde', exact: true }).click();
  await expect(entrar.getByText('Entrar', { exact: true }).locator('..')).toHaveCSS('background-color', rgb('#15803D'));
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

// Capturas pedidas (27/11): 1920 e 3440×1440, escuro e claro, das três telas; e o celular da Marca (prévia embaixo).
for (const [largura, altura] of [[1920, 1080], [3440, 1440]] as const) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`capturas ${largura}, ${tema.toLowerCase()}: Marca, Contato e Padrões do acompanhamento`, async ({ page }) => {
      test.skip(!process.env.E2E_CAPTURAS, 'só com E2E_CAPTURAS');
      const sufixo = `${largura}-${tema.toLowerCase()}`;
      const { errosDaPagina } = await abrir(page, largura, altura, '/treinador/configuracoes/marca', tema);
      await expect(page.getByTestId('previa-de-entrar')).toBeVisible();
      await capturar(page, `marca-${sufixo}`);
      await page.getByRole('link', { name: /^Escolher o tema do meu painel/ }).scrollIntoViewIfNeeded();
      await capturar(page, `marca-rolada-${sufixo}`);
      await page.goto('/treinador/configuracoes/contato');
      await expect(page.getByRole('heading', { level: 1, name: 'Contato' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'WhatsApp da consultoria' })).toHaveValue('(45) 99999-8888');
      await capturar(page, `contato-${sufixo}`);
      await page.goto('/treinador/configuracoes/padroes-do-acompanhamento');
      await expect(page.getByRole('heading', { level: 1, name: 'Padrões do acompanhamento' })).toBeVisible();
      await page.getByRole('button', { name: /^Ciclo menstrual: textos das fases/ }).first().click();
      await capturar(page, `padroes-${sufixo}`);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

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
