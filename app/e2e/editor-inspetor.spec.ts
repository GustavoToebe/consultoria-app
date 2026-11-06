import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Editor de treino em lista + inspetor (plano `docs/planos/editor-treino-inspetor.md`): no PC (1440) a lista de exercícios
 * à esquerda e o escolhido à direita; no celular (390) a lista empilhada, com um exercício aberto por vez.
 */

const PC = { width: 1440, height: 1000 };
const CELULAR = { width: 390, height: 900 };

async function abrir(page: Page, comProblema: boolean) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(comProblema)),
    // O rascunho salvo volta com a versão seguinte; publicar devolve a v1.
    [`PUT /planos-treino/${PLANO_ID}/rascunho`]: (p, route) => {
      const d = planoDetalhe(false);
      const corpo = p.corpo as { conteudo: typeof d.rascunho };
      return json(route, { ...d, plano: { ...d.plano, versao: 2 }, rascunho: corpo.conteudo });
    },
    [`POST /planos-treino/${PLANO_ID}/publicar`]: (_p, route) => {
      const d = planoDetalhe(false);
      return json(route, { ...d, plano: { ...d.plano, versao: 3, versaoPublicada: 1, publicadoEm: '2026-11-04T12:00:00Z' } });
    },
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByRole('textbox', { name: 'Nome da sessão' })).toHaveValue('Peito e tríceps');
  return api;
}

// Fora o refresh da sessão (a API falsa o recusa ao abrir).
const escritas = (pedidos: PedidoFalso[]) => pedidos.filter((p) => (p.metodo === 'PUT' || p.metodo === 'POST') && !p.caminho.startsWith('/auth/')).map((p) => `${p.metodo} ${p.caminho}`);
const item = (page: Page, n: number, nome: string) => page.getByRole('button', { name: new RegExp(`^Exercício ${n} de 7: ${nome}`) });
// As sessões também são abas: as das séries começam por "Série".
const abasDasSeries = (page: Page) => page.getByRole('tab', { name: /^Série \d/ });
const abaSelecionada = (page: Page) => page.getByRole('tab', { name: /^Série \d/, selected: true });

test.describe('editor de treino em janela larga (1920)', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('o conteúdo usa o espaço todo ao lado do menu, sem faixas vazias nem rolagem na horizontal', async ({ page }) => {
    await abrir(page, false);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    // Menu lateral de 240 px; com o limite antigo (1440) o título começava em ~412 px. Agora logo depois do menu e do padding (~308).
    const titulo = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(titulo!.x).toBeLessThan(340);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('editor de treino no PC (1440)', () => {
  test.use({ viewport: PC });

  test('lista com o escolhido realçado, inspetor, abas das séries e "Nova série"', async ({ page }) => {
    const api = await abrir(page, false);
    // Em duas colunas o inspetor já abre no 1º exercício.
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(item(page, 1, 'Supino reto com barra')).toHaveAttribute('aria-current', 'true');

    await item(page, 3, 'Crucifixo na máquina').click();
    await expect(item(page, 3, 'Crucifixo na máquina')).toHaveAttribute('aria-current', 'true');
    await expect(item(page, 1, 'Supino reto com barra')).not.toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Crucifixo na máquina');

    await item(page, 1, 'Supino reto com barra').click();
    await expect(page.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Supino reto com barra');
    await expect(abasDasSeries(page)).toHaveCount(3);
    await expect(abaSelecionada(page)).toHaveAccessibleName(/^Série 1 · FS/);
    await page.getByRole('tab', { name: /^Série 2 · WS/ }).click();
    await expect(page.getByRole('tab', { name: /^Série 2 · WS/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/^Editando: Série 2( ·|$)/)).toBeVisible();

    // "+ Nova série" mostra um botão por tipo; um toque cria o grupo próprio e a aba dele fica escolhida.
    await page.getByRole('button', { name: 'Nova série', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar Aquecimento', exact: true }).click();
    await expect(abasDasSeries(page)).toHaveCount(4);
    await expect(abaSelecionada(page)).toHaveAccessibleName(/Aquecimento/);
    const numero = (await abaSelecionada(page).getAttribute('aria-label'))?.match(/^Série (\d+)/)?.[1];
    await expect(page.getByText(new RegExp(`^Editando: Série ${numero}( ·|$)`))).toBeVisible();

    // Nada vai à API sem o "Salvar rascunho" ou o "Publicar".
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
    expect(escritas(api.pedidos)).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('"ir ao primeiro" escolhe o exercício e a aba do problema', async ({ page }) => {
    const api = await abrir(page, true);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    await page.getByRole('button', { name: /ir ao primeiro/ }).click();
    await expect(item(page, 2, 'Supino inclinado com halteres')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('tab', { name: /^Série 2 · Back off/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/^Editando: Série 2( ·|$)/)).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });

  test('"Publicar para o aluno" salva o que mudou e publica', async ({ page }) => {
    const api = await abrir(page, false);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Supino reto');
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
    expect(escritas(api.pedidos)).toEqual([]);

    await page.getByRole('button', { name: 'Publicar para o aluno', exact: true }).click();
    await expect(page.getByText('Publicado v1. O aluno já vê esta versão.')).toBeVisible();
    expect(escritas(api.pedidos)).toEqual([`PUT /planos-treino/${PLANO_ID}/rascunho`, `POST /planos-treino/${PLANO_ID}/publicar`]);
    const publicar = api.pedidos.find((p) => p.caminho.endsWith('/publicar'))?.corpo as { versao: number; confirmarAvisos: boolean };
    expect(publicar).toMatchObject({ versao: 2, confirmarAvisos: false });
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
});

test.describe('editor de treino no celular (390)', () => {
  test.use({ viewport: CELULAR });

  test('um exercício aberto por vez, com as abas das séries', async ({ page }) => {
    const api = await abrir(page, false);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar Supino reto com barra', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Série 2 · WS/ }).click();
    await expect(page.getByRole('tab', { name: /^Série 2 · WS/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/^Editando: Série 2( ·|$)/)).toBeVisible();

    await page.getByRole('button', { name: 'Editar Crucifixo na máquina', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar Crucifixo na máquina', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fechar Supino reto com barra', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true })).toBeVisible();
    expect(escritas(api.pedidos)).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('"ir ao primeiro" abre o exercício e a aba do problema', async ({ page }) => {
    const api = await abrir(page, true);
    await page.getByRole('button', { name: /ir ao primeiro/ }).click();
    await expect(page.getByRole('button', { name: 'Fechar Supino inclinado com halteres', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Série 2 · Back off/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/^Editando: Série 2( ·|$)/)).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });

  test('"Publicar" publica sem mudança pendente', async ({ page }) => {
    const api = await abrir(page, false);
    await expect(page.getByRole('button', { name: 'Publicar para o aluno' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByText('Publicado v1. O aluno já vê esta versão.')).toBeVisible();
    // Sem alteração o rascunho não é salvo de novo: só a publicação vai à API.
    expect(escritas(api.pedidos)).toEqual([`POST /planos-treino/${PLANO_ID}/publicar`]);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
});
