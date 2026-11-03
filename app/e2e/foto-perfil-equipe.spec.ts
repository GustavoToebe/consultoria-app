import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Foto de perfil do aluno pela equipe (C44): na ficha, Dados do aluno › Cadastro, só com `ALUNO_ALTERAR` e aluno não
 * anonimizado. Troca pela galeria (reduzida no aparelho), remove com confirmação na tela e a foto do topo baixa de novo.
 * Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const CAMINHO = `/alunos/${ALUNO_ID}/foto-perfil`;

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

/** JPEG de 1 pixel (o mesmo da comparação de fotos). */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);

/** A API da foto com estado: começa com ou sem foto; o PUT responde o que o teste pedir. */
async function abrirFicha(page: Page, o: { permissoes: string[]; comFoto: boolean; ficha?: AlunoDetalhe; put?: (route: Route) => Promise<void> }) {
  let temFoto = o.comFoto;
  let ficha = o.ficha ?? FICHA;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
    [`GET ${CAMINHO}`]: (_p, route) => (temFoto
      ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG })
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
  await expect(page.getByText('Dados do aluno', { exact: true })).toBeVisible();
  return { ...api, anonimizar: () => { ficha = { ...ficha, anonimizado: true, ativo: false }; } };
}

const pedidosDaFoto = (pedidos: PedidoFalso[], metodo: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === CAMINHO);

async function escolherDaGaleria(page: Page, botao: string) {
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: botao, exact: true }).click()]);
  await seletor.setFiles({ name: 'retrato-ficticio.png', mimeType: 'image/png', buffer: pngDeCor(64, [120, 140, 160]) });
}

for (const largura of [390, 1280]) {
  test(`equipe com ALUNO_ALTERAR troca e remove a foto de perfil do aluno em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirFicha(page, { permissoes: PERMISSOES_TREINADOR, comFoto: false });
    // Sem foto: escolher, sem "Remover foto".
    await expect(page.getByRole('button', { name: 'Escolher foto', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover foto' })).toHaveCount(0);
    const baixadas = pedidosDaFoto(pedidos, 'GET').length;

    await escolherDaGaleria(page, 'Escolher foto');
    await expect.poll(() => pedidosDaFoto(pedidos, 'PUT').length, { timeout: 15_000 }).toBe(1);
    // O arquivo vai com nome fixo, já em JPEG: o nome original não sai do aparelho.
    const corpo = String(pedidosDaFoto(pedidos, 'PUT')[0].corpo);
    expect(corpo).toContain('filename="foto.jpg"');
    expect(corpo).not.toContain('retrato-ficticio');
    await expect(page.getByText('Foto de perfil salva.')).toBeVisible();
    // A foto do topo é baixada de novo e aparece; o botão vira "Trocar foto".
    await expect.poll(() => pedidosDaFoto(pedidos, 'GET').length).toBeGreaterThan(baixadas);
    await expect(page.getByRole('img', { name: `Foto de perfil de ${ALUNO.nome}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trocar foto', exact: true })).toBeVisible();

    // Remover pede confirmação na tela (nada de confirm do navegador).
    await page.getByRole('button', { name: 'Remover foto', exact: true }).click();
    await expect(page.getByText('Remover a foto de perfil?')).toBeVisible();
    expect(pedidosDaFoto(pedidos, 'DELETE')).toHaveLength(0);
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await expect.poll(() => pedidosDaFoto(pedidos, 'DELETE').length).toBe(1);
    await expect(page.getByText('Foto de perfil removida.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover foto' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: `Foto de perfil de ${ALUNO.nome}` })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`equipe sem ALUNO_ALTERAR vê a foto, sem trocar nem remover, em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirFicha(page, { permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_ALTERAR'), comFoto: true });
    await expect(page.getByRole('img', { name: `Foto de perfil de ${ALUNO.nome}` })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Trocar|Escolher|Tirar|Remover) foto$/ })).toHaveCount(0);
    expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho === CAMINHO)).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('foto recusada (422) vira aviso e o aluno anonimizado (409) some com os botões', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let resposta = erroApi(422, 'A foto passa do tamanho permitido.', 'FOTO_GRANDE_DEMAIS');
  const ficha = await abrirFicha(page, {
    permissoes: PERMISSOES_TREINADOR, comFoto: true,
    put: (route) => json(route, resposta.corpo, resposta.status),
  });
  await escolherDaGaleria(page, 'Trocar foto');
  await expect(page.getByText('A foto passa do tamanho permitido.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trocar foto', exact: true })).toBeVisible();

  // Anonimizado entre abrir a ficha e enviar: aviso, a ficha é buscada de novo e os botões saem.
  resposta = erroApi(409, 'Aluno anonimizado.', 'ALUNO_ANONIMIZADO');
  ficha.anonimizar();
  await escolherDaGaleria(page, 'Trocar foto');
  await expect(page.getByText('Aluno anonimizado.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Trocar|Escolher|Remover) foto$/ })).toHaveCount(0);
  expect(ficha.errosDaPagina).toEqual([]);
});

test('aluno anonimizado: a equipe com ALUNO_ALTERAR não vê os botões da foto', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const { errosDaPagina } = await abrirFicha(page, { permissoes: PERMISSOES_TREINADOR, comFoto: false, ficha: { ...FICHA, anonimizado: true, ativo: false } });
  await expect(page.getByText('Anonimizado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Trocar|Escolher|Remover) foto$/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
