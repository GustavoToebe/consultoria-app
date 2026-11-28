import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import type { ResultadoDoConvite } from '../src/api/convitesEmLote';
import type { AlunoResumo } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type Resposta } from './api-falsa';

/**
 * Convite de acesso em lote (28/11): atalho "Sem acesso ao app" na lista de Alunos, seleção (inclusive "Marcar todos do
 * filtro", acima de 100), "Gerar convites (N)" com confirmação, chamadas de 100 em sequência, folha "Convites gerados" com
 * WhatsApp, copiar, "Enviado" visual e CSV, e a nova tentativa só do lote que falhou. Só dados fictícios, API simulada.
 */
const VALIDO_ATE = '2026-12-06T02:59:59Z'; // 05/12/2026 às 23:59:59 de Brasília
const VALIDADE = '05/12/2026';
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const linkDe = (alunoId: string) => `https://app.exemplo.invalid/convite#codigo=codigo-${alunoId.slice(-4)}`;

function aluno(n: number, nome: string, extra: Partial<AlunoResumo> = {}): AlunoResumo {
  return { id: id(n), nome, ativo: true, temAcesso: false, planoAtivo: null, ultimoRegistro: null, responsavelId: TREINADOR.id, atualizacao: null, ...extra };
}

/** Telefone como a API grava; `null` = sem telefone. Davi já tem acesso quando o convite chega (outra pessoa gerou antes). */
const TELEFONES: Record<string, string | null> = { [id(1)]: '(45) 99999-8888', [id(2)]: '(45) 3222-1111', [id(3)]: null };
const QUATRO = [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo'), aluno(3, 'Carla Teste'), aluno(4, 'Davi Modelo')];
const NOMES = new Map(QUATRO.map((a) => [a.id, a.nome]));

/** `GET /alunos` que honra `acesso`, `pagina` e `tamanho` (padrão 30, teto 100), como a API. */
function lista(todos: AlunoResumo[]): Resposta {
  return (pedido, route) => {
    const filtrados = pedido.busca.getAll('acesso').includes('SEM') ? todos.filter((a) => !a.temAcesso) : todos;
    const tamanho = Math.min(100, Number(pedido.busca.get('tamanho') ?? 30));
    const pagina = Number(pedido.busca.get('pagina') ?? 0);
    return json(route, { itens: filtrados.slice(pagina * tamanho, (pagina + 1) * tamanho), total: filtrados.length });
  };
}

function resultado(alunoId: string): ResultadoDoConvite {
  const nome = NOMES.get(alunoId) ?? `Aluno ${alunoId.slice(-3)}`;
  if (alunoId === id(4)) return { alunoId, nome, telefone: null, situacao: 'JA_TEM_ACESSO', link: null, validoAte: null };
  return { alunoId, nome, telefone: alunoId in TELEFONES ? TELEFONES[alunoId] : '(45) 98888-7777', situacao: 'GERADO', link: linkDe(alunoId), validoAte: VALIDO_ATE };
}

/** `POST /alunos/lote/convites`; `falhar(n)` = a n-ésima chamada (1, 2, ...) responde 500. */
function convites(falhar: (n: number) => boolean = () => false): Resposta {
  let n = 0;
  return (pedido, route) => {
    n++;
    if (falhar(n)) return json(route, erroApi(500, 'Erro inesperado.').corpo, 500);
    const { alunoIds } = pedido.corpo as { alunoIds: string[] };
    return json(route, { resultados: alunoIds.map(resultado) });
  };
}

async function abrir(page: Page, alunos: AlunoResumo[], post: Resposta = convites()) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': lista(alunos),
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'POST /alunos/lote/convites': post,
  });
}

const postsDosConvites = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/alunos/lote/convites');
const corpoDe = (p: PedidoFalso) => (p.corpo as { alunoIds: string[] }).alunoIds;
const folha = (page: Page) => page.getByRole('dialog', { name: 'Convites gerados' });
const confirmacao = (page: Page) => page.getByRole('alertdialog', { name: 'Gerar convites de acesso?' });

async function abrirAcoesEGerar(page: Page, n: number) {
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  await page.getByRole('dialog', { name: 'Ações em lote' }).getByRole('button', { name: `Gerar convites (${n})` }).click();
  await expect(confirmacao(page).getByText(`Gera um link de acesso para ${n} ${n === 1 ? 'aluno' : 'alunos'}. Links anteriores deixam de valer.`)).toBeVisible();
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('3 alunos sem acesso: confirmação, links, WhatsApp, copiar, Enviado, sem telefone, CSV e "Não gerados"', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      // O WhatsApp abre fora do app: a página de teste responde no lugar do wa.me (nada sai da máquina).
      await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, [...QUATRO, aluno(9, 'Eva Com Acesso', { temAcesso: true })]);
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Eva Com Acesso/ })).toBeVisible();

      // O atalho preenche o filtro Acesso (botão comum) e some quando já está aplicado.
      await page.getByRole('button', { name: 'Sem acesso ao app', exact: true }).click();
      await expect(page.getByRole('link', { name: /^Abrir Eva Com Acesso/ })).toHaveCount(0);
      expect(pedidos.filter((p) => p.caminho === '/alunos').at(-1)?.busca.getAll('acesso')).toEqual(['SEM']);
      await expect(page.getByRole('button', { name: 'Sem acesso ao app', exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      await page.getByRole('button', { name: 'Marcar visíveis', exact: true }).click();
      await expect(page.getByText('4 alunos marcados', { exact: false })).toBeVisible();
      await abrirAcoesEGerar(page, 4);
      await confirmacao(page).getByRole('button', { name: 'Gerar convites', exact: true }).click();

      const f = folha(page);
      await expect(f.getByText('3 convites gerados', { exact: true })).toBeVisible();
      await expect(f.getByText('1 já tinha acesso')).toBeVisible();
      await expect(f.getByText('Os links não ficam guardados: baixe ou envie antes de fechar.')).toBeVisible();
      expect(postsDosConvites(pedidos).map(corpoDe)).toEqual([[id(1), id(2), id(3), id(4)]]);
      for (const n of [1, 2, 3]) await expect(f.getByText(linkDe(id(n)), { exact: true })).toBeVisible();
      await expect(f.getByText(`(45) 99999-8888 · Válido até ${VALIDADE}`)).toBeVisible();
      await expect(f.getByText(`Sem telefone · Válido até ${VALIDADE}`)).toBeVisible();

      // "Não gerados": Davi, sem link, com o motivo.
      await expect(f.getByText('Não gerados')).toBeVisible();
      await expect(f.getByText('Já tem acesso ao app.')).toBeVisible();
      await expect(f.getByText(linkDe(id(4)))).toHaveCount(0);

      // Enviar pelo WhatsApp: wa.me com o 55 e a mensagem pronta; abrir não marca "Enviado" sozinho.
      const mensagemDaAna = `Oi, Ana! Seu acesso ao app da ${MARCA.nome} está pronto: ${linkDe(id(1))}. Válido até ${VALIDADE}.`;
      const enviadoAna = f.getByRole('checkbox', { name: 'Enviado para Ana Fictícia' });
      await expect(enviadoAna).toHaveAttribute('aria-checked', 'false');
      const [popup] = await Promise.all([page.waitForEvent('popup'), f.getByRole('button', { name: 'Enviar pelo WhatsApp para Ana Fictícia' }).click()]);
      await popup.waitForLoadState();
      const url = new URL(popup.url());
      expect(url.origin + url.pathname).toBe('https://wa.me/5545999998888');
      expect(url.searchParams.get('text')).toBe(mensagemDaAna);
      await popup.close();
      await expect(enviadoAna).toHaveAttribute('aria-checked', 'false');
      await enviadoAna.click();
      await expect(enviadoAna).toHaveAttribute('aria-checked', 'true');
      await expect(f.getByRole('checkbox', { name: 'Enviado para Bruno Exemplo' })).toHaveAttribute('aria-checked', 'false');

      // Copiar mensagem: o mesmo texto do WhatsApp (telefone fixo de 10 dígitos também vale).
      await f.getByRole('button', { name: 'Copiar mensagem para Bruno Exemplo' }).click();
      await expect(page.getByText('Mensagem copiada.')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText()))
        .toBe(`Oi, Bruno! Seu acesso ao app da ${MARCA.nome} está pronto: ${linkDe(id(2))}. Válido até ${VALIDADE}.`);

      // Sem telefone: botão desabilitado com o motivo visível; copiar continua.
      await expect(f.getByRole('button', { name: 'Enviar pelo WhatsApp para Carla Teste' })).toBeDisabled();
      await expect(f.getByText('Sem telefone cadastrado')).toBeVisible();
      await expect(f.getByRole('button', { name: 'Copiar mensagem para Carla Teste' })).toBeEnabled();

      // CSV: aviso junto ao botão (e no nome acessível), só os gerados, com o BOM.
      await expect(f.getByText('O arquivo tem links de acesso: não compartilhe.')).toBeVisible();
      const baixar = f.getByRole('button', { name: 'Baixar CSV. O arquivo tem links de acesso: não compartilhe.' });
      const [arquivo] = await Promise.all([page.waitForEvent('download'), baixar.click()]);
      expect(arquivo.suggestedFilename()).toMatch(/^convites-\d{4}-\d{2}-\d{2}\.csv$/);
      const csv = readFileSync(await arquivo.path(), 'utf-8');
      expect(csv.split('\r\n')).toEqual([
        '﻿nome;telefone;link;validade',
        `Ana Fictícia;(45) 99999-8888;${linkDe(id(1))};${VALIDADE}`,
        `Bruno Exemplo;(45) 3222-1111;${linkDe(id(2))};${VALIDADE}`,
        `Carla Teste;;${linkDe(id(3))};${VALIDADE}`,
        '',
      ]);

      // Fechar descarta: nada dos links fica na tela nem no armazenamento do navegador.
      await f.getByRole('button', { name: 'Concluir', exact: true }).click();
      await expect(folha(page)).toHaveCount(0);
      const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
      expect(guardado).not.toContain('codigo-');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('150 sem acesso: "Marcar todos do filtro" alcança as outras páginas e o app faz 2 chamadas, de 100 e de 50', async ({ page }) => {
      const muitos = Array.from({ length: 150 }, (_, i) => aluno(100 + i, `Aluno Fictício ${100 + i}`));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, muitos);
      await page.goto('/treinador/alunos?acesso=SEM');
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      await page.getByRole('button', { name: 'Marcar todos do filtro (150)' }).click();
      await expect(page.getByText('150 alunos marcados (acima de 100, só os convites de acesso).').first()).toBeVisible();
      // A coleta paginou a lista com o mesmo filtro, de 100 em 100.
      const coleta = pedidos.filter((p) => p.caminho === '/alunos' && p.busca.get('tamanho') === '100');
      expect(coleta.map((p) => p.busca.get('pagina'))).toEqual(['0', '1']);
      expect(coleta.every((p) => p.busca.getAll('acesso').includes('SEM'))).toBe(true);

      await page.getByRole('button', { name: 'Ações', exact: true }).click();
      const acoes = page.getByRole('dialog', { name: 'Ações em lote' });
      // As outras ações seguem no teto de 100 da API: desabilitadas com o motivo.
      await expect(acoes.getByRole('button', { name: 'Trocar responsável' })).toBeDisabled();
      await expect(acoes.getByText('Esta ação vale para até 100 alunos por vez.').first()).toBeVisible();
      await acoes.getByRole('button', { name: 'Gerar convites (150)' }).click();
      await expect(confirmacao(page).getByText('Gera um link de acesso para 150 alunos. Links anteriores deixam de valer.')).toBeVisible();
      await confirmacao(page).getByRole('button', { name: 'Gerar convites', exact: true }).click();

      await expect(folha(page).getByText('150 convites gerados')).toBeVisible();
      const posts = postsDosConvites(pedidos).map(corpoDe);
      expect(posts.map((l) => l.length)).toEqual([100, 50]);
      expect(posts.flat()).toEqual(muitos.map((a) => a.id));
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('vazio: todos já tinham acesso; a folha abre sem convite e o CSV fica desabilitado com o motivo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, [aluno(4, 'Davi Modelo')]);
      await page.goto('/treinador/alunos?acesso=SEM');
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      await page.getByRole('button', { name: 'Marcar visíveis', exact: true }).click();
      await abrirAcoesEGerar(page, 1);
      await confirmacao(page).getByRole('button', { name: 'Gerar convites', exact: true }).click();
      const f = folha(page);
      await expect(f.getByText('Nenhum convite gerado', { exact: true })).toBeVisible();
      await expect(f.getByText('1 já tinha acesso')).toBeVisible();
      await expect(f.getByText('Já tem acesso ao app.')).toBeVisible();
      await expect(f.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
      await expect(f.getByText('Nenhum convite gerado.', { exact: true })).toBeVisible();
      expect(postsDosConvites(pedidos).map(corpoDe)).toEqual([[id(4)]]);
      expect(errosDaPagina).toEqual([]);
    });

    test('lote que falha: mostra qual, "Tentar de novo" pede confirmação e reenvia só ele', async ({ page }) => {
      const muitos = Array.from({ length: 150 }, (_, i) => aluno(100 + i, `Aluno Fictício ${100 + i}`));
      const { pedidos, errosDaPagina } = await abrir(page, muitos, convites((n) => n === 2));
      await page.goto('/treinador/alunos?acesso=SEM');
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      await page.getByRole('button', { name: 'Marcar todos do filtro (150)' }).click();
      await expect(page.getByText('150 alunos marcados', { exact: false }).first()).toBeVisible();
      await abrirAcoesEGerar(page, 150);
      await confirmacao(page).getByRole('button', { name: 'Gerar convites', exact: true }).click();

      const f = folha(page);
      await expect(f.getByText('100 convites gerados')).toBeVisible();
      await expect(f.getByText('50 alunos ficaram sem convite')).toBeVisible();
      await expect(f.getByText('Lote 2 de 2 (50 alunos) não foi gerado.', { exact: false })).toBeVisible();
      expect(postsDosConvites(pedidos)).toHaveLength(2);

      // Nada é gerado de novo sem confirmar outra vez; cancelar volta à folha sem chamada.
      await f.getByRole('button', { name: 'Tentar de novo (50)' }).click();
      await expect(confirmacao(page).getByText('Gera um link de acesso para 50 alunos. Links anteriores deixam de valer.')).toBeVisible();
      await confirmacao(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(confirmacao(page)).toHaveCount(0);
      expect(postsDosConvites(pedidos)).toHaveLength(2);

      await f.getByRole('button', { name: 'Tentar de novo (50)' }).click();
      await confirmacao(page).getByRole('button', { name: 'Gerar convites', exact: true }).click();
      await expect(f.getByText('150 convites gerados')).toBeVisible();
      await expect(f.getByText('50 alunos ficaram sem convite')).toHaveCount(0);
      const posts = postsDosConvites(pedidos).map(corpoDe);
      expect(posts).toHaveLength(3);
      expect(posts[2]).toEqual(posts[1]);
      expect(posts[2]).toEqual(muitos.slice(100).map((a) => a.id));
      expect(errosDaPagina).toEqual([]);
    });
  });
}
