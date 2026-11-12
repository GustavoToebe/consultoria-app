import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';

/**
 * Foto de perfil do aluno pela equipe (C44), ao lado do nome no cabeçalho da ficha (guia de 11/11, pág. 31), só com
 * `ALUNO_ALTERAR` e aluno não anonimizado. O próprio círculo (56 px no PC, 44 no celular) é o botão e abre a Folha "Foto de
 * perfil" em qualquer largura. Troca pela galeria (reduzida no aparelho), remove com confirmação na tela e a foto do topo
 * baixa de novo. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const CAMINHO = `/alunos/${ALUNO_ID}/foto-perfil`;
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
  // A foto fica no cabeçalho, ao lado do nome; a ficha abre no Resumo.
  await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toHaveAttribute('aria-selected', 'true');
  // O bloco antigo de "Dados do aluno" saiu: a foto se troca só no círculo.
  await expect(page.getByText(/Aparece no topo da ficha/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Trocar|Escolher|Tirar|Remover) foto$/ })).toHaveCount(0);
  return { ...api, jpeg, anonimizar: () => { ficha = { ...ficha, anonimizado: true, ativo: false }; } };
}

const pedidosDaFoto = (pedidos: PedidoFalso[], metodo: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === CAMINHO);
const foto = (page: Page) => page.getByRole('img', { name: `Foto de perfil de ${ALUNO.nome}` });

async function escolherArquivo(page: Page, jpeg: Buffer, clicar: () => Promise<void>) {
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), clicar()]);
  await seletor.setFiles({ name: 'retrato-ficticio.jpg', mimeType: 'image/jpeg', buffer: jpeg });
}

for (const [largura, tamanho] of [[1280, 56], [390, 44]] as const) {
  test(`${largura} px: o círculo de ${tamanho} px ao lado do nome abre a Folha "Foto de perfil" para trocar e remover`, async ({ page }) => {
    const { pedidos, errosDaPagina, jpeg } = await abrirFicha(page, { largura, permissoes: PERMISSOES_TREINADOR, comFoto: false });
    const circulo = page.getByRole('button', { name: CANTO });
    const caixa = (await circulo.boundingBox())!;
    expect(Math.round(caixa.width)).toBe(tamanho);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    // Ao lado do título (o h1 é o nome), na mesma faixa de cima.
    const titulo = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(titulo.x);
    expect(caixa.y).toBeLessThan(titulo.y + titulo.height);
    // Não há mais camada de hover nem a foto grande no Resumo.
    await expect(page.getByRole('button', { name: /^(Trocar|Remover) foto de perfil$/ })).toHaveCount(0);

    // Sem foto: a Folha só oferece escolher.
    await circulo.click();
    const folha = page.getByRole('dialog', { name: 'Foto de perfil' });
    await expect(folha.getByText('Escolher da galeria')).toBeVisible();
    await expect(folha.getByText('Remover foto')).toHaveCount(0);
    // "Tirar foto" só no celular nativo.
    await expect(folha.getByText('Tirar foto')).toHaveCount(0);
    const baixadas = pedidosDaFoto(pedidos, 'GET').length;
    await escolherArquivo(page, jpeg, () => folha.getByText('Escolher da galeria').click());
    await expect.poll(() => pedidosDaFoto(pedidos, 'PUT').length, { timeout: 15_000 }).toBe(1);
    // O arquivo vai com nome fixo, já em JPEG: o nome original não sai do aparelho.
    const corpo = String(pedidosDaFoto(pedidos, 'PUT')[0].corpo);
    expect(corpo).toContain('filename="foto.jpg"');
    expect(corpo).not.toContain('retrato-ficticio');
    await expect(page.getByText('Foto de perfil salva.')).toBeVisible();
    await expect.poll(() => pedidosDaFoto(pedidos, 'GET').length).toBeGreaterThan(baixadas);
    await expect(foto(page)).toBeVisible();

    // Com foto, a Folha oferece remover, que pede confirmação na tela.
    await circulo.click();
    await page.getByRole('dialog', { name: 'Foto de perfil' }).getByText('Remover foto').click();
    await expect(page.getByText('Remover a foto de perfil?')).toBeVisible();
    expect(pedidosDaFoto(pedidos, 'DELETE')).toHaveLength(0);
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await expect.poll(() => pedidosDaFoto(pedidos, 'DELETE').length).toBe(1);
    await expect(page.getByText('Foto de perfil removida.')).toBeVisible();
    await expect(foto(page)).toHaveCount(0);

    // A foto acompanha o nome em todas as abas.
    await page.getByRole('tab', { name: 'Ficha do aluno', exact: true }).click();
    await expect(page.getByRole('button', { name: CANTO })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`equipe sem ALUNO_ALTERAR vê só a foto, sem nada por cima, em ${largura}px`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirFicha(page, { largura, permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_ALTERAR'), comFoto: true });
    await expect(foto(page)).toBeVisible();
    await foto(page).hover();
    await expect(page.getByRole('button', { name: new RegExp(`^${CANTO}$`) })).toHaveCount(0);
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
  const circulo = page.getByRole('button', { name: CANTO });
  const galeria = () => page.getByRole('dialog', { name: 'Foto de perfil' }).getByText('Escolher da galeria');
  await circulo.click();
  await escolherArquivo(page, ficha.jpeg, () => galeria().click());
  await expect(page.getByText('A foto passa do tamanho permitido.')).toBeVisible();
  await expect(circulo).toBeEnabled();

  // Anonimizado entre abrir a ficha e enviar: aviso, a ficha é buscada de novo e a edição sai do círculo.
  resposta = erroApi(409, 'Aluno anonimizado.', 'ALUNO_ANONIMIZADO');
  ficha.anonimizar();
  await circulo.click();
  await escolherArquivo(page, ficha.jpeg, () => galeria().click());
  await expect(page.getByText('Aluno anonimizado.')).toBeVisible();
  await expect(page.getByRole('button', { name: CANTO })).toHaveCount(0);
  await expect(foto(page)).toBeVisible();
  expect(ficha.errosDaPagina).toEqual([]);
});

test('aluno anonimizado: a equipe com ALUNO_ALTERAR não vê a edição da foto', async ({ page }) => {
  const { errosDaPagina } = await abrirFicha(page, { largura: 390, permissoes: PERMISSOES_TREINADOR, comFoto: false, ficha: { ...FICHA, anonimizado: true, ativo: false } });
  await expect(page.getByText('Anonimizado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: CANTO })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
