import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

import type { EventoAuditoria } from '../src/api/equipeTipos';
import { fixarHoje } from './aluno';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Auditoria mais útil (27/11): agrupada por dia (Hoje, Ontem, a data, em Brasília), hora na coluna Quando, bolinha da
 * categoria e iniciais de quem fez; resumo com o objeto afetado; atalhos (Tudo, Sem logins, Alunos…) que viram a lista de
 * ações da `acao`, em interseção com o filtro Ação; "Carregar mais"; detalhe num painel fixo à direita a partir de 1600
 * px de área e na folha abaixo disso. Tela larga (28/11): atalhos em chips de uma escolha, "Filtros" ao lado, a contagem na barra
 * (sem o título "Eventos" no cartão), colunas com teto, painel do topo do cartão até o fim da área visível e grudado ao
 * rolar, sem campo vazio no detalhe. Relógio em 19/10/2026 12:00 de Brasília; só dados fictícios. Capturas em
 * `E2E_CAPTURAS`, se definida.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const NOMES = ['Ana Fictícia', 'Bruno Exemplo', 'Carla Teste', 'Sistema'];
const PERFIS = ['Administrador', 'Treinador', 'Estagiário'];
type Molde = Pick<EventoAuditoria, 'acao' | 'entidade' | 'objetoNome' | 'origem'>;
const MOLDES: Molde[] = [
  { acao: 'LOGIN_SUCESSO', entidade: 'USUARIO', objetoNome: null, origem: 'App Android' },
  { acao: 'ALUNO_CRIADO', entidade: 'ALUNO', objetoNome: 'Vitor Exemplo Santos', origem: 'Web' },
  { acao: 'TREINO_PUBLICADO', entidade: 'TREINO', objetoNome: 'Treino de Bia Teste', origem: 'Web' },
  { acao: 'COBRANCA_CANCELADA', entidade: 'COBRANCA', objetoNome: '11/2026 de R$ 997,00', origem: 'Web' },
  { acao: 'QUESTIONARIO_PUBLICADO', entidade: 'QUESTIONARIO', objetoNome: 'Padrão', origem: 'Web' },
  { acao: 'LOGIN_SUCESSO', entidade: 'USUARIO', objetoNome: null, origem: 'Web' },
  { acao: 'PERFIL_ALTERADO', entidade: 'PERFIL', objetoNome: 'Estagiário', origem: 'Web' },
  { acao: 'MARCA_ALTERADA', entidade: 'CONSULTORIA', objetoNome: null, origem: 'Web' },
  { acao: 'ALUNO_ALTERADO', entidade: 'ALUNO', objetoNome: null, origem: 'App iOS' },
  { acao: 'USUARIO_CONVIDADO', entidade: 'USUARIO', objetoNome: 'Diego Modelo', origem: 'Web' },
];
// O primeiro às 11:00 de Brasília de hoje e um a cada 47 minutos para trás: 252 eventos em uns oito dias.
const TODOS: EventoAuditoria[] = Array.from({ length: 252 }, (_, i) => {
  const m = MOLDES[i % MOLDES.length];
  const nome = NOMES[i % NOMES.length];
  return {
    id: `e-${i}`, usuarioId: nome === 'Sistema' ? null : `m-${i % 3}`, nomeUsuario: nome, ...m,
    usuarioPerfil: nome === 'Sistema' ? null : PERFIS[i % NOMES.length],
    entidadeId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, resumo: 'Texto fixo que repete a ação.',
    criadoEm: new Date(Date.parse('2026-10-19T14:00:00Z') - i * 47 * 60_000).toISOString(),
  };
});

/** `GET /auditoria` paginado de 50 e filtrado por `acao` repetida, como a API. */
function auditoria(eventos: EventoAuditoria[], pedidos: PedidoFalso[]) {
  return (p: PedidoFalso, route: Route) => {
    pedidos.push(p);
    const acoes = p.busca.getAll('acao');
    const exceto = p.busca.getAll('acaoExceto');
    // Os tetos da API: `acao` até 100, `acaoExceto` até 50 (acima, 400).
    if (acoes.length > 100 || exceto.length > 50) return json(route, erroApi(400, 'Escolha menos valores.', 'FILTRO_INVALIDO').corpo, 400);
    const filtrados = eventos.filter((e) => (!acoes.length || acoes.includes(e.acao)) && !exceto.includes(e.acao));
    const pagina = Number(p.busca.get('pagina') ?? 0);
    return json(route, { itens: filtrados.slice(pagina * 50, pagina * 50 + 50), total: filtrados.length, pagina });
  };
}

async function preparar(page: Page, largura: number, altura: number, opcoes: { tema?: string; eventos?: EventoAuditoria[]; lista?: RespostasApi[string] } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, prefs);
    } catch { /* quadro sem armazenamento */ }
  }, [TREINADOR.id, JSON.stringify({ tema: opcoes.tema ?? 'ESCURO', larguraConteudo: 'AUTOMATICA' })] as const);
  const pedidos: PedidoFalso[] = [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'AUDITORIA_LER'], perfil: { id: 'p-adm', nome: 'Administrador', acessoTotal: true } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /auditoria/pessoas': { corpo: NOMES.slice(0, 3).map((nome, i) => ({ id: `m-${i}`, nome })) },
    'GET /auditoria': opcoes.lista ?? auditoria(opcoes.eventos ?? TODOS, pedidos),
  });
  return { ...api, pedidos };
}

const tabela = (page: Page) => page.getByRole('table', { name: 'Eventos da auditoria' });
const linhas = (page: Page) => tabela(page).locator('[role="row"][aria-selected]');
const painel = (page: Page) => page.getByRole('region', { name: 'Detalhe do evento' });
const contagem = (page: Page, n: number) => page.getByText(`${n} eventos neste filtro`, { exact: true });
const VAZIO_DO_PAINEL = 'Escolha um evento para ver o detalhe';

async function capturar(page: Page, nome: string) {
  if (!process.env.E2E_CAPTURAS) return;
  fs.mkdirSync(process.env.E2E_CAPTURAS, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(process.env.E2E_CAPTURAS, `auditoria-${nome}.png`) });
}

for (const [largura, altura] of [[1920, 1080], [3440, 1440]] as const) {
  for (const tema of ['ESCURO', 'CLARO']) {
    test(`${largura} px, ${tema.toLowerCase()}: grupos por dia, painel fixo à direita e o detalhe do evento`, async ({ page }) => {
      const { errosDaPagina, naoTratadas } = await preparar(page, largura, altura, { tema });
      await page.goto('/treinador/auditoria', { waitUntil: 'domcontentloaded' });
      await expect(tabela(page)).toBeVisible();
      await expect(contagem(page, 252)).toBeVisible();
      // O cartão da lista não tem mais o título "Eventos": a contagem mora na barra.
      await expect(page.getByRole('heading', { name: 'Eventos', exact: true })).toHaveCount(0);
      await expect(tabela(page).getByRole('columnheader')).toHaveText(['Quando', 'Quem', 'Ação', 'Resumo']);
      await expect(tabela(page).getByRole('heading', { level: 2, name: 'Hoje' })).toBeVisible();
      await expect(tabela(page).getByRole('heading', { level: 2, name: 'Ontem' })).toBeVisible();
      await expect(tabela(page).getByRole('heading', { level: 2, name: '17/10/2026' })).toBeVisible();
      // Colunas com teto (80, 260, 380 e 640): o que sobra fica no fim da linha, não entre as colunas.
      const cabecalhos = await tabela(page).getByRole('columnheader').evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      }));
      expect(Math.abs(cabecalhos[0].width - 80)).toBeLessThanOrEqual(1);
      [260, 380, 640].forEach((teto, i) => expect(cabecalhos[i + 1].width).toBeLessThanOrEqual(teto + 1));
      // A primeira linha: só a hora, quem, a ação e o objeto (nunca o resumo fixo que repete a ação).
      const primeira = linhas(page).first();
      await expect(primeira).toContainText('11:00');
      await expect(primeira).toContainText('Login realizado');
      await expect(primeira).toContainText('App Android');
      await expect(linhas(page).nth(1)).toContainText('Aluno Vitor Exemplo Santos');
      await expect(linhas(page).nth(4)).toContainText('Questionário “Padrão”');
      await expect(page.getByText('Texto fixo que repete a ação.')).toHaveCount(0);

      // Sem evento escolhido, o painel diz o que fazer; fica à direita da tabela, com ~420 px, começa no topo do cartão
      // (a tabela está dentro dele, logo abaixo do recuo) e desce até perto do fim da área visível.
      await expect(painel(page)).toContainText(VAZIO_DO_PAINEL);
      const t = (await tabela(page).boundingBox())!;
      const p = (await painel(page).boundingBox())!;
      expect(p.x).toBeGreaterThan(t.x + t.width);
      expect(Math.abs(p.width - 420)).toBeLessThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(t.y);
      expect(t.y - p.y).toBeLessThanOrEqual(40);
      expect(p.height).toBeGreaterThan(altura / 2);
      // Em 3440 a linha passa da soma dos tetos: a sobra fica depois do Resumo.
      const fimDoResumo = cabecalhos[3].x + cabecalhos[3].width;
      if (largura === 3440) expect(fimDoResumo).toBeLessThan(t.x + t.width - 100);
      else expect(fimDoResumo).toBeLessThanOrEqual(t.x + t.width);
      await capturar(page, `${largura}-${tema.toLowerCase()}-sem-selecao`);

      // Login: sem objeto, o detalhe não mostra "Objeto —"; a origem fica.
      await linhas(page).first().click();
      await expect(painel(page).getByLabel('Origem: App Android')).toBeVisible();
      await expect(painel(page).getByLabel(/^Objeto:/)).toHaveCount(0);
      await expect(painel(page)).not.toContainText('Objeto');

      await linhas(page).nth(1).click();
      await expect(linhas(page).nth(1)).toHaveAttribute('aria-selected', 'true');
      // Quem: nome e perfil de acesso; o perfil fica só no detalhe, a linha da lista segue com as iniciais e o nome.
      await expect(painel(page).getByLabel('Quem: Bruno Exemplo · Treinador', { exact: true })).toBeVisible();
      await expect(linhas(page).nth(1)).not.toContainText('Treinador');
      await expect(painel(page).getByLabel('Quando: 19/10/2026 às 10:13:00')).toBeVisible();
      await expect(painel(page).getByLabel('Objeto: Aluno Vitor Exemplo Santos')).toBeVisible();
      await expect(painel(page).getByLabel('Origem: Web')).toBeVisible();
      await expect(painel(page).getByText('Alunos', { exact: true })).toBeVisible();
      await expect(painel(page).getByRole('link', { name: 'Abrir ficha do aluno' })).toHaveAttribute('href', `/treinador/alunos/${TODOS[1].entidadeId}`);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await capturar(page, `${largura}-${tema.toLowerCase()}-com-selecao`);

      // Teclado: Enter numa linha troca o detalhe; Esc fecha e devolve o foco à linha.
      await linhas(page).nth(3).focus();
      await page.keyboard.press('Enter');
      await expect(painel(page).getByLabel('Objeto: Cobrança 11/2026 de R$ 997,00')).toBeVisible();
      // Evento do sistema: sem perfil, só "Sistema".
      await expect(painel(page).getByLabel('Quem: Sistema', { exact: true })).toBeVisible();
      await expect(painel(page).getByRole('link')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(painel(page)).toContainText(VAZIO_DO_PAINEL);
      await expect(linhas(page).nth(3)).toBeFocused();

      // Ao rolar a página o painel fica grudado e inteiro na área visível, enquanto a tabela sobe.
      await page.mouse.move(t.x + t.width / 2, t.y + 200);
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => (await tabela(page).boundingBox())!.y).toBeLessThan(t.y - 500);
      const grudado = (await painel(page).boundingBox())!;
      expect(grudado.y).toBeGreaterThanOrEqual(0);
      expect(grudado.y + grudado.height).toBeLessThanOrEqual(altura + 1);
      await page.mouse.wheel(0, -5000);
      await expect.poll(async () => (await tabela(page).boundingBox())!.y).toBeGreaterThan(t.y - 1);

      // "Sem logins": a `acao` leva o catálogo menos os logins, e nenhuma linha de login sobra.
      await page.getByRole('radio', { name: 'Sem logins' }).click();
      await expect(page).toHaveURL(/atalho=sem-logins/);
      await expect(linhas(page).first()).toContainText('Aluno cadastrado');
      await expect(tabela(page).getByText('Login realizado')).toHaveCount(0);
      await expect(contagem(page, 252 - 51)).toBeVisible();
      await capturar(page, `${largura}-${tema.toLowerCase()}-sem-logins`);

      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('atalhos: viram a lista de ações, combinam com o filtro Ação e o conflito não chama a API', async ({ page }) => {
  const { pedidos, errosDaPagina } = await preparar(page, 1920, 1080);
  await page.goto('/treinador/auditoria?atalho=sem-logins', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page).first()).toContainText('Aluno cadastrado');
  // "Sem logins" exclui os logins pela `acaoExceto`, sem mandar o catálogo inteiro na `acao`.
  const ultimo = () => pedidos.filter((p) => p.caminho === '/auditoria').at(-1)!.busca;
  expect(ultimo().getAll('acaoExceto')).toEqual(['LOGIN_SUCESSO', 'LOGIN_BLOQUEADO']);
  expect(ultimo().getAll('acao')).toEqual([]);

  // Com o filtro Ação, os logins saem localmente e vai só a `acao`.
  await page.goto('/treinador/auditoria?atalho=sem-logins&acao=LOGIN_SUCESSO,ALUNO_CRIADO', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page).first()).toContainText('Aluno cadastrado');
  expect(ultimo().getAll('acao')).toEqual(['ALUNO_CRIADO']);
  expect(ultimo().getAll('acaoExceto')).toEqual([]);

  // Alunos: a lista da categoria cabe no teto da `acao` (a API falsa recusaria acima de 100).
  await page.goto('/treinador/auditoria?atalho=alunos', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page).first()).toContainText('Aluno cadastrado');
  expect(ultimo().getAll('acao').length).toBe(64);

  // Equipe com a Ação "Aluno cadastrado" e "Perfil editado": fica só o que está nos dois.
  await page.goto('/treinador/auditoria?atalho=equipe&acao=ALUNO_CRIADO,PERFIL_ALTERADO', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page).first()).toContainText('Perfil editado');
  expect(pedidos[pedidos.length - 1].busca.getAll('acao')).toEqual(['PERFIL_ALTERADO']);

  // Sem ação em comum: o vazio diz por quê e a API não é chamada (lista vazia seria "todas").
  const antes = pedidos.length;
  await page.goto('/treinador/auditoria?atalho=sem-logins&acao=LOGIN_SUCESSO', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Nenhuma ação em comum', { exact: true })).toBeVisible();
  await capturar(page, '1920-escuro-sem-acao-em-comum');
  await page.waitForTimeout(300);
  expect(pedidos.slice(antes).filter((p) => p.caminho === '/auditoria')).toHaveLength(0);
  await page.getByRole('button', { name: 'Ver tudo' }).click();
  await expect(linhas(page).first()).toContainText('Login realizado');
  expect(errosDaPagina).toEqual([]);
});

/**
 * Barra numa linha só, à esquerda: atalhos, "Filtros · N", os chips "Filtrando" com o "Limpar" e a contagem por último
 * (variante `arranjo="linhaUnica"` da `ui/BarraDeFiltros`). Os seis atalhos são chips de uma escolha da regra única dos
 * filtros (28/11, decisão do Gustavo: segmento só com 2 ou 3 opções), com o escolhido tonal e com ✓.
 */
test('1920 px: barra de filtros numa linha só, alinhada à esquerda, com a contagem no fim', async ({ page }) => {
  const { errosDaPagina } = await preparar(page, 1920, 1080);
  await page.goto('/treinador/auditoria?acao=ALUNO_CRIADO', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page).first()).toContainText('Aluno cadastrado');
  const segmento = page.getByRole('radiogroup', { name: 'Atalhos de eventos' });
  await expect(segmento.getByRole('radio')).toHaveText(['Tudo', 'Sem logins', 'Alunos', 'Planos', 'Financeiro', 'Equipe']);
  await expect(segmento.getByRole('radio', { name: 'Tudo' })).toHaveAttribute('aria-checked', 'true');
  // Chips de uma escolha: só o escolhido tem o ✓.
  await expect(segmento.locator('svg')).toHaveCount(1);
  await expect(segmento.getByRole('radio', { name: 'Tudo' }).locator('svg')).toHaveCount(1);
  // O atalho não conta como filtro avançado: só a Ação.
  const filtros = page.getByRole('button', { name: 'Filtros, 1 ligado' });
  await expect(filtros).toHaveText('Filtros · 1');
  const limpar = page.getByRole('button', { name: 'Limpar filtros aplicados' });
  // 252 eventos, um "Aluno cadastrado" a cada dez a partir do segundo.
  const n = contagem(page, 26);
  await expect(n).toBeVisible();
  const [s, f, l, c] = await Promise.all([segmento, filtros, limpar, n].map(async (x) => (await x.boundingBox())!));
  // Uma linha só, na ordem atalhos → Filtros → Limpar → contagem, e nada encostado na borda direita.
  for (const b of [f, l, c]) expect(Math.abs((b.y + b.height / 2) - (s.y + s.height / 2))).toBeLessThanOrEqual(4);
  expect(f.x).toBeGreaterThan(s.x + s.width);
  expect(f.x - (s.x + s.width)).toBeLessThanOrEqual(24);
  expect(l.x).toBeGreaterThan(f.x + f.width);
  expect(c.x).toBeGreaterThan(l.x + l.width);
  expect(c.x - (l.x + l.width)).toBeLessThanOrEqual(24);
  // Teclado nos atalhos (grupo de rádio): Espaço escolhe a opção em foco, que ganha o ✓.
  await segmento.getByRole('radio', { name: 'Sem logins' }).focus();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/atalho=sem-logins/);
  await expect(segmento.getByRole('radio', { name: 'Sem logins' })).toHaveAttribute('aria-checked', 'true');
  await expect(segmento.getByRole('radio', { name: 'Sem logins' }).locator('svg')).toHaveCount(1);
  expect(errosDaPagina).toEqual([]);
});

test('Carregar mais acrescenta a página seguinte e a contagem fica', async ({ page }) => {
  const { pedidos, errosDaPagina } = await preparar(page, 1920, 1080);
  await page.goto('/treinador/auditoria', { waitUntil: 'domcontentloaded' });
  await expect(linhas(page)).toHaveCount(50);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(linhas(page)).toHaveCount(100);
  expect(pedidos[pedidos.length - 1].busca.get('pagina')).toBe('1');
  await expect(contagem(page, 252)).toBeVisible();
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(linhas(page)).toHaveCount(200);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(linhas(page)).toHaveCount(250);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(linhas(page)).toHaveCount(252);
  await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0);
  // Trocar o atalho recomeça da primeira página.
  await page.getByRole('radio', { name: 'Equipe' }).click();
  await expect(linhas(page).first()).toContainText('Perfil editado');
  await expect(linhas(page)).toHaveCount(50);
  expect(errosDaPagina).toEqual([]);
});

test('1280 px: sem painel fixo, o detalhe abre na folha', async ({ page }) => {
  const { errosDaPagina } = await preparar(page, 1280, 900);
  await page.goto('/treinador/auditoria', { waitUntil: 'domcontentloaded' });
  await expect(tabela(page)).toBeVisible();
  await expect(painel(page)).toHaveCount(0);
  await linhas(page).nth(4).click();
  const folha = page.getByRole('dialog', { name: 'Detalhe do evento' });
  await expect(folha.getByLabel('Objeto: Questionário “Padrão”')).toBeVisible();
  await expect(folha.getByRole('link', { name: 'Abrir questionário' })).toBeVisible();
  await capturar(page, '1280-escuro-folha');
  expect(errosDaPagina).toEqual([]);
});

test('390 px: cartões agrupados por dia e o detalhe na folha', async ({ page }) => {
  const { errosDaPagina } = await preparar(page, 390, 844, { tema: 'CLARO' });
  await page.goto('/treinador/auditoria', { waitUntil: 'domcontentloaded' });
  const lista = page.getByRole('list', { name: 'Eventos da auditoria' });
  await expect(lista.getByRole('heading', { level: 2, name: 'Hoje' })).toBeVisible();
  // Os chips dos atalhos quebram em fileiras e a contagem fica na barra; nada sai da largura (conferido no fim).
  await expect(page.getByRole('radiogroup', { name: 'Atalhos de eventos' })).toBeVisible();
  await expect(contagem(page, 252)).toBeVisible();
  await expect(tabela(page)).toHaveCount(0);
  await capturar(page, '390-claro-cartoes');
  await lista.getByRole('button', { name: /^10:13, Aluno cadastrado, por Bruno Exemplo/ }).click();
  await expect(page.getByRole('dialog', { name: 'Detalhe do evento' }).getByLabel('Quem: Bruno Exemplo · Treinador', { exact: true })).toBeVisible();
  await capturar(page, '390-claro-folha');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(errosDaPagina).toEqual([]);
});

test('erro da API e lista vazia', async ({ page }) => {
  let falhar = true;
  const { errosDaPagina } = await preparar(page, 1920, 1080, {
    lista: (_p, route) => (falhar ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Erro interno.').corpo) }) : json(route, { itens: [], total: 0, pagina: 0 })),
  });
  await page.goto('/treinador/auditoria', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await capturar(page, '1920-escuro-erro');
  falhar = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('Sem eventos neste filtro', { exact: true })).toBeVisible();
  await expect(painel(page)).toHaveCount(0);
  await capturar(page, '1920-escuro-vazio');
  expect(errosDaPagina).toEqual([]);
});
