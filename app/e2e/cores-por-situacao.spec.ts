import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { AREIA, CLARO, ESCURO, type Cores } from '../src/tema/tokens';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Desabilitado em cinza (D3 de `docs/planos/auditoria-cores.md`): um `Botao` primário desabilitado não usa a cor da marca
 * nem opacidade; fica com fundo `superficie3` e texto `textoSuave`. Aviso de rodapé em âmbar com ícone para o alerta que
 * não é erro (D5). A API é simulada aqui mesmo, sem mexer em `api-falsa.ts`. Dados fictícios.
 */
const TEMAS = { CLARO, ESCURO, AREIA } as const;
type NomeDoTema = keyof typeof TEMAS;

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

async function abrirMarcaComBotaoDesabilitado(page: Page, largura: number, tema: NomeDoTema) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
  });
  await page.goto('/treinador/marca');
  // Sem o nome da consultoria, o "Salvar marca" aparece desabilitado.
  const nome = page.getByRole('textbox', { name: 'Nome da consultoria', exact: true });
  await nome.fill('');
  const botao = page.getByRole('button', { name: 'Salvar marca', exact: true });
  await expect(botao).toBeVisible();
  await expect(botao).toBeDisabled();
  return { api, botao };
}

for (const tema of Object.keys(TEMAS) as NomeDoTema[]) {
  const cores: Cores = TEMAS[tema];
  for (const largura of [390, 1280]) {
    test(`Botao primário desabilitado é cinza, sem a marca nem opacidade (${tema.toLowerCase()}, ${largura}px)`, async ({ page }) => {
      const { api, botao } = await abrirMarcaComBotaoDesabilitado(page, largura, tema);
      await expect(botao).toHaveCSS('background-color', rgb(cores.superficie3));
      await expect(botao).toHaveCSS('border-top-color', rgb(cores.borda));
      await expect(botao).toHaveCSS('opacity', '1');
      await expect(botao.getByText('Salvar marca', { exact: true })).toHaveCSS('color', rgb(cores.textoSuave));
      await expect(page.getByText('Informe o nome da consultoria.', { exact: true })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}

test('aviso de atenção (edição em conflito): borda âmbar, ícone e fica até ser fechado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
    'PUT /consultoria/marca': (_p, route) => json(route, erroApi(409, 'Conflito.', 'CONFLITO_EDICAO').corpo, 409),
  });
  await page.goto('/treinador/marca');
  await page.getByRole('radiogroup', { name: 'Meta do peso dos alunos' }).getByRole('button', { name: 'Aumentar', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar marca', exact: true }).click();
  const aviso = page.getByRole('alert').filter({ hasText: 'A marca foi alterada em outra aba' });
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveCSS('border-top-color', rgb(CLARO.atencao));
  await expect(aviso.locator('svg')).toHaveCount(2); // o ícone de atenção e o X de fechar
  // Não some sozinho (o de sucesso some em 4 s).
  await page.waitForTimeout(4500);
  await expect(aviso).toBeVisible();
  await aviso.getByRole('button', { name: 'Fechar aviso' }).click();
  await expect(aviso).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('marca parecida com o erro: avisa na Marca, sem bloquear o Salvar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
  });
  await page.goto('/treinador/marca');
  const aviso = page.getByTestId('aviso-marca-perto-de-status');
  await page.getByRole('radio', { name: /^Azul\./ }).click();
  await expect(aviso).toHaveCount(0);
  await page.getByRole('radio', { name: /^Vermelho intenso\./ }).click();
  await expect(aviso).toContainText('erro (vermelho)');
  await expect(page.getByRole('button', { name: 'Salvar marca', exact: true })).toBeEnabled();
  expect(api.errosDaPagina).toEqual([]);
});
