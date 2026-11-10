import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';

/**
 * Foto de perfil do aluno pela equipe (C44), no próprio círculo do topo da ficha, só com `ALUNO_ALTERAR` e aluno não
 * anonimizado. No PC com mouse (1280 px), a camada aparece no hover ou no foco com câmera e lixeira; no celular (390 px),
 * o botão do canto abre a Folha "Foto de perfil". Troca pela galeria (reduzida no aparelho), remove com confirmação na
 * tela e a foto do topo baixa de novo. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const CAMINHO = `/alunos/${ALUNO_ID}/foto-perfil`;
const TROCAR = 'Trocar foto de perfil';
const REMOVER = 'Remover foto de perfil';
const CANTO = 'Foto de perfil: trocar ou remover';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

/** JPEG fictício gerado no próprio navegador (um degradê, sem pessoa nenhuma). */
async function jpegFicticio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const degrade = ctx.createLinearGradient(0, 0, 256, 256);
    degrade.addColorStop(0, '#d9b38c');
    degrade.addColorStop(1, '#5a7d9a');
    ctx.fillStyle = degrade;
    ctx.fillRect(0, 0, 256, 256);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

/** A API da foto com estado: começa com ou sem foto; o PUT responde o que o teste pedir. */
async function abrirFicha(page: Page, o: { largura: number; permissoes: string[]; comFoto: boolean; ficha?: AlunoDetalhe; put?: (route: Route) => Promise<void> }) {
  await page.setViewportSize({ width: o.largura, height: 900 });
  let temFoto = o.comFoto;
  let ficha = o.ficha ?? FICHA;
  let jpeg: Buffer = Buffer.alloc(0);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
    [`GET ${CAMINHO}`]: (_p, route) => (temFoto
      ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg })
      : json(route, erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO').corpo, 404)),
    [`PUT ${CAMINHO}`]: async (_p, route) => {
      if (o.put) return o.put(route);
      temFoto = true;
      return json(route, { atualizadaEm: '2026-11-02T12:00:00Z' });
    },
    [`DELETE ${CAMINHO}`]: (_p, route) => {
      temFoto = false;
      return route.fulfill({ status: 204 });
    },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  jpeg = await jpegFicticio(page);
  // A foto fica no topo do Resumo, a aba em que a ficha abre.
  await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toHaveAttribute('aria-selected', 'true');
  // O bloco antigo de "Dados do aluno" saiu: a foto se troca só no círculo.
  await expect(page.getByText(/Aparece no topo da ficha/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Trocar|Escolher|Tirar|Remover) foto$/ })).toHaveCount(0);
  return { ...api, jpeg, anonimizar: () => { ficha = { ...ficha, anonimizado: true, ativo: false }; } };
}

const pedidosDaFoto = (pedidos: PedidoFalso[], metodo: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === CAMINHO);
const foto = (page: Page) => page.getByRole('img', { name: `Foto de perfil de ${ALUNO.nome}` });
/** A camada é o pai dos botões; escondida, fica com opacidade 0 (continua no Tab, para o foco revelá-la). */
const camada = (page: Page) => page.getByRole('button', { name: TROCAR }).locator('..');

async function escolherArquivo(page: Page, jpeg: Buffer, clicar: () => Promise<void>) {
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), clicar()]);
  await seletor.setFiles({ name: 'retrato-ficticio.jpg', mimeType: 'image/jpeg', buffer: jpeg });
}

test('1280 px com mouse: a camada aparece no hover e no foco; câmera troca e lixeira remove com confirmação', async ({ page }) => {
  const { pedidos, errosDaPagina, jpeg } = await abrirFicha(page, { largura: 1280, permissoes: PERMISSOES_TREINADOR, comFoto: false });
  const trocar = page.getByRole('button', { name: TROCAR });
  // Sem foto: a camada fica escondida, só com a câmera; sem botão do canto.
  await expect(camada(page)).toHaveCSS('opacity', '0');
  await expect(page.getByRole('button', { name: REMOVER })).toHaveCount(0);
  await expect(page.getByRole('button', { name: CANTO })).toHaveCount(0);
  const tamanho = await camada(page).boundingBox();
  expect(Math.round(tamanho!.width)).toBe(96);

  // Foco de teclado revela a camada.
  await trocar.focus();
  await expect(camada(page)).toHaveCSS('opacity', '1');
  await trocar.blur();
  await expect(camada(page)).toHaveCSS('opacity', '0');

  // Hover revela; a câmera abre direto a escolha do arquivo.
  await trocar.hover();
  await expect(camada(page)).toHaveCSS('opacity', '1');
  const caixa = await trocar.boundingBox();
  expect(caixa!.width).toBeGreaterThanOrEqual(44);
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  const baixadas = pedidosDaFoto(pedidos, 'GET').length;
  await escolherArquivo(page, jpeg, () => trocar.click());
  await expect.poll(() => pedidosDaFoto(pedidos, 'PUT').length, { timeout: 15_000 }).toBe(1);
  // O arquivo vai com nome fixo, já em JPEG: o nome original não sai do aparelho.
  const corpo = String(pedidosDaFoto(pedidos, 'PUT')[0].corpo);
  expect(corpo).toContain('filename="foto.jpg"');
  expect(corpo).not.toContain('retrato-ficticio');
  await expect(page.getByText('Foto de perfil salva.')).toBeVisible();
  await expect.poll(() => pedidosDaFoto(pedidos, 'GET').length).toBeGreaterThan(baixadas);
  await expect(foto(page)).toBeVisible();

  // Com foto, a lixeira aparece ao lado da câmera e pede confirmação na tela.
  await trocar.hover();
  const remover = page.getByRole('button', { name: REMOVER });
  await expect(remover).toHaveCount(1);
  await remover.click();
  await expect(page.getByText('Remover a foto de perfil?')).toBeVisible();
  expect(pedidosDaFoto(pedidos, 'DELETE')).toHaveLength(0);
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect.poll(() => pedidosDaFoto(pedidos, 'DELETE').length).toBe(1);
  await expect(page.getByText('Foto de perfil removida.')).toBeVisible();
  await expect(page.getByRole('button', { name: REMOVER })).toHaveCount(0);
  await expect(foto(page)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('390 px: o botão do canto abre a Folha "Foto de perfil" para trocar e remover', async ({ page }) => {
  const { pedidos, errosDaPagina, jpeg } = await abrirFicha(page, { largura: 390, permissoes: PERMISSOES_TREINADOR, comFoto: true });
  await expect(foto(page)).toBeVisible();
  // Sem camada no toque.
  await expect(page.getByRole('button', { name: TROCAR })).toHaveCount(0);
  const canto = page.getByRole('button', { name: CANTO });
  // O botão do canto mora dentro do círculo, que tem 72 px abaixo de 768 px de largura.
  const circulo = await canto.locator('..').boundingBox();
  expect(Math.round(circulo!.width)).toBe(72);
  const caixa = await canto.boundingBox();
  expect(caixa!.width).toBeGreaterThanOrEqual(44);

  await canto.click();
  const folha = page.getByRole('dialog', { name: 'Foto de perfil' });
  await expect(folha).toBeVisible();
  await expect(folha.getByText('Escolher da galeria')).toBeVisible();
  await expect(folha.getByText('Remover foto')).toBeVisible();
  // "Tirar foto" só no celular nativo.
  await expect(folha.getByText('Tirar foto')).toHaveCount(0);
  await escolherArquivo(page, jpeg, () => folha.getByText('Escolher da galeria').click());
  await expect.poll(() => pedidosDaFoto(pedidos, 'PUT').length, { timeout: 15_000 }).toBe(1);
  await expect(page.getByText('Foto de perfil salva.')).toBeVisible();

  await canto.click();
  await page.getByRole('dialog', { name: 'Foto de perfil' }).getByText('Remover foto').click();
  await expect(page.getByText('Remover a foto de perfil?')).toBeVisible();
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect.poll(() => pedidosDaFoto(pedidos, 'DELETE').length).toBe(1);
  await expect(page.getByText('Foto de perfil removida.')).toBeVisible();
  await expect(foto(page)).toHaveCount(0);
  // Sem foto, a Folha não oferece remover.
  await canto.click();
  await expect(page.getByRole('dialog', { name: 'Foto de perfil' }).getByText('Escolher da galeria')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Foto de perfil' }).getByText('Remover foto')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`equipe sem ALUNO_ALTERAR vê só a foto, sem nada por cima, em ${largura}px`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirFicha(page, { largura, permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_ALTERAR'), comFoto: true });
    await expect(foto(page)).toBeVisible();
    await foto(page).hover();
    await expect(page.getByRole('button', { name: new RegExp(`^(${TROCAR}|${REMOVER}|${CANTO})$`) })).toHaveCount(0);
    expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho === CAMINHO)).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('foto recusada (422) vira aviso e o aluno anonimizado (409) some com a edição', async ({ page }) => {
  let resposta = erroApi(422, 'A foto passa do tamanho permitido.', 'FOTO_GRANDE_DEMAIS');
  const ficha = await abrirFicha(page, {
    largura: 1280, permissoes: PERMISSOES_TREINADOR, comFoto: true,
    put: (route) => json(route, resposta.corpo, resposta.status),
  });
  const trocar = page.getByRole('button', { name: TROCAR });
  await trocar.hover();
  await escolherArquivo(page, ficha.jpeg, () => trocar.click());
  await expect(page.getByText('A foto passa do tamanho permitido.')).toBeVisible();
  await expect(trocar).toBeEnabled();

  // Anonimizado entre abrir a ficha e enviar: aviso, a ficha é buscada de novo e a edição sai do círculo.
  resposta = erroApi(409, 'Aluno anonimizado.', 'ALUNO_ANONIMIZADO');
  ficha.anonimizar();
  await trocar.hover();
  await escolherArquivo(page, ficha.jpeg, () => trocar.click());
  await expect(page.getByText('Aluno anonimizado.')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^(${TROCAR}|${REMOVER})$`) })).toHaveCount(0);
  expect(ficha.errosDaPagina).toEqual([]);
});

test('aluno anonimizado: a equipe com ALUNO_ALTERAR não vê a edição da foto', async ({ page }) => {
  const { errosDaPagina } = await abrirFicha(page, { largura: 390, permissoes: PERMISSOES_TREINADOR, comFoto: false, ficha: { ...FICHA, anonimizado: true, ativo: false } });
  await expect(page.getByText('Anonimizado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: CANTO })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
