import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { PastaModelo, Receita } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Folha "Nova semana de treino" (e as iguais: nova dieta, nova mobilidade, novo modelo; 27/11): nome focado ao abrir e
 * Enter cria; descrição de 2 linhas que cresce, sem a alça, com o contador; coleção num seletor com busca e
 * "+ Nova coleção…" que cria ali mesmo; aberta pela "+" de uma coleção, vem marcada com ela; sem nome, o erro vai no
 * campo e o "Criar e editar" continua habilitado; rodapé Cancelar + Criar e editar. Só dados fictícios.
 * Capturas com `E2E_CAPTURAS`: `<base>/planejamento-novo-modelo-<caso>-<largura>-<tema>.png`.
 */
const BASE = process.env.E2E_CAPTURAS;
type Tema = 'ESCURO' | 'CLARO';

const COLECOES: PastaModelo[] = [
  { id: 'p0000000-0000-4000-8000-000000000001', nome: 'Hipertrofia', versao: 1 },
  { id: 'p0000000-0000-4000-8000-000000000002', nome: 'Avançados', versao: 1 },
];
const [HIPERTROFIA] = COLECOES;
const ID_NOVO = 'r0000000-0000-4000-8000-000000000099';
const MODELOS: Receita[] = [
  { id: 'r0000000-0000-4000-8000-000000000001', tipo: 'PLANO_TREINO', origem: 'CONSULTORIA', nome: 'Semana de hipertrofia', descricao: null, conteudo: null, ordem: 1, pastaId: HIPERTROFIA.id, versao: 1 },
];

async function abrir(page: Page, { tema = 'ESCURO', extra = {} }: { tema?: Tema; extra?: RespostasApi } = {}) {
  await page.addInitScript(([usuario, prefs]) => {
    try { localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs)); } catch { /* sem armazenamento */ }
  }, [TREINADOR.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }] as const);
  let lista = [...COLECOES];
  let criado: Receita | null = null;
  const r = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (_p, route) => json(route, criado ? [...MODELOS, criado] : MODELOS),
    'POST /receitas': (p, route) => { criado = { ...(p.corpo as Receita), id: ID_NOVO, origem: 'CONSULTORIA', ordem: 2, versao: 1 }; return json(route, criado, 201); },
    [`GET /receitas/${ID_NOVO}`]: (_p, route) => json(route, criado),
    'GET /pastas-modelos': (_p, route) => json(route, lista),
    'POST /pastas-modelos': (p, route) => {
      const nova = { id: `p0000000-0000-4000-8000-00000000009${lista.length}`, nome: (p.corpo as { nome: string }).nome, versao: 1 };
      lista = [...lista, nova];
      return json(route, nova);
    },
    ...extra,
  });
  page.on('dialog', (d) => { r.errosDaPagina.push(`diálogo do navegador: ${d.message()}`); void d.dismiss(); });
  await page.goto('/treinador/planejamento?aba=treino');
  await expect(page.getByRole('button', { name: 'Hipertrofia, aberto', exact: true })).toBeVisible();
  return r;
}

const folhaNova = (page: Page) => page.getByRole('dialog', { name: 'Nova semana de treino' });
const campoNome = (page: Page) => folhaNova(page).getByRole('textbox', { name: 'Nome do modelo', exact: true });
const seletor = (page: Page, valor: string) => folhaNova(page).getByRole('button', { name: `Coleção: ${valor}. Escolher.`, exact: true });
const listaDeColecoes = (page: Page) => page.getByRole('dialog', { name: 'Coleção do modelo' });
const posts = (r: { pedidos: { metodo: string; caminho: string; corpo?: unknown }[] }, caminho: string) =>
  r.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === caminho).map((p) => p.corpo);

async function abrirFolhaNova(page: Page) {
  await page.getByRole('button', { name: 'Nova semana de treino', exact: true }).click();
  await expect(folhaNova(page)).toBeVisible();
}

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('nome focado ao abrir; rodapé Cancelar + Criar e editar; sem nome o erro vai no campo e Enter cria', async ({ page }) => {
      const r = await abrir(page);
      await abrirFolhaNova(page);
      const folha = folhaNova(page);
      await expect(campoNome(page)).toBeFocused();
      const cancelar = folha.getByRole('button', { name: 'Cancelar', exact: true });
      const criar = folha.getByRole('button', { name: 'Criar e editar', exact: true });
      await expect(cancelar).toBeVisible();
      await expect(criar).toBeEnabled();
      // O motivo não fica mais fixo embaixo do botão: só aparece no campo, ao tentar criar.
      await expect(folha.getByText('Informe o nome do modelo.', { exact: true })).toHaveCount(0);
      await criar.click();
      await expect(folha.getByText('Informe o nome do modelo.', { exact: true })).toBeVisible();
      await expect(campoNome(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(campoNome(page)).toBeFocused();
      await expect(criar).toBeEnabled();
      // Só espaços também é vazio; Enter no campo tenta criar.
      await campoNome(page).fill('   ');
      await campoNome(page).press('Enter');
      await expect(folha.getByText('Informe o nome do modelo.', { exact: true })).toBeVisible();
      expect(posts(r, '/receitas')).toEqual([]);
      // Digitar tira o erro.
      await campoNome(page).fill('Semana fictícia nova');
      await expect(folha.getByText('Informe o nome do modelo.', { exact: true })).toHaveCount(0);
      expect(r.naoTratadas).toEqual([]);
      await campoNome(page).press('Enter');
      await page.waitForURL(`**/treinador/planejamento/modelo/${ID_NOVO}`);
      expect(posts(r, '/receitas')).toEqual([expect.objectContaining({ tipo: 'PLANO_TREINO', nome: 'Semana fictícia nova', descricao: null, pastaId: null })]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('Cancelar fecha a folha sem criar nada', async ({ page }) => {
      const r = await abrir(page);
      await abrirFolhaNova(page);
      await campoNome(page).fill('Semana descartada');
      await folhaNova(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(folhaNova(page)).toHaveCount(0);
      expect(posts(r, '/receitas')).toEqual([]);
      expect(r.naoTratadas).toEqual([]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('descrição: começa com 2 linhas, cresce com o texto, sem a alça de redimensionar, com o contador até 300', async ({ page }) => {
      const r = await abrir(page);
      await abrirFolhaNova(page);
      const folha = folhaNova(page);
      const descricao = folha.getByRole('textbox', { name: 'Descrição (opcional)', exact: true });
      await expect(descricao).toHaveCSS('resize', 'none');
      await expect(folha.getByText('0/300', { exact: true })).toBeVisible();
      const antes = (await descricao.boundingBox())!.height;
      // 2 linhas: mais alto que um campo de uma linha (44) e mais baixo que 3 linhas.
      expect(antes).toBeGreaterThan(44);
      expect(antes).toBeLessThan(100);
      await descricao.fill('Linha um\nLinha dois\nLinha três\nLinha quatro\nLinha cinco');
      await expect(folha.getByText('55/300', { exact: true })).toBeVisible();
      await expect.poll(async () => (await descricao.boundingBox())!.height).toBeGreaterThan(antes + 40);
      // O limite é o da API (300), no próprio campo.
      await expect(descricao).toHaveAttribute('maxlength', '300');
      expect(r.naoTratadas).toEqual([]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('coleção: seletor com busca sem acento; "+ Nova coleção “texto”" cria ali mesmo e já vem escolhida', async ({ page }) => {
      const r = await abrir(page);
      await abrirFolhaNova(page);
      // O segmento que quebrava em várias linhas saiu.
      await expect(folhaNova(page).getByRole('radio', { name: 'Sem coleção' })).toHaveCount(0);
      await seletor(page, 'Sem coleção').click();
      const lista = listaDeColecoes(page);
      await expect(lista).toBeVisible();
      const busca = lista.getByRole('textbox', { name: 'Buscar ou criar coleção', exact: true });
      await expect(busca).toBeFocused();
      // Sem texto: "Sem coleção", as coleções em ordem alfabética e, no fim, "+ Nova coleção…".
      await expect(lista.getByRole('option')).toHaveText(['Sem coleção', 'Avançados', 'Hipertrofia', '+ Nova coleção…']);
      await busca.fill('avancados');
      await expect(lista.getByRole('option')).toHaveText(['Avançados']);
      await lista.getByRole('option', { name: 'Avançados', exact: true }).click();
      await expect(seletor(page, 'Avançados')).toBeVisible();
      // Nome novo: a opção do fim cria a coleção com o nome digitado e a escolhe.
      await seletor(page, 'Avançados').click();
      await listaDeColecoes(page).getByRole('textbox', { name: 'Buscar ou criar coleção', exact: true }).fill('  Força ');
      await expect(listaDeColecoes(page).getByRole('option', { name: /^\+ Nova coleção “Força”/ })).toBeVisible();
      await listaDeColecoes(page).getByRole('textbox', { name: 'Buscar ou criar coleção', exact: true }).press('Enter');
      await expect(seletor(page, 'Força')).toBeVisible();
      expect(posts(r, '/pastas-modelos')).toEqual([{ nome: 'Força' }]);
      await campoNome(page).fill('Semana de força');
      await folhaNova(page).getByRole('button', { name: 'Criar e editar', exact: true }).click();
      await page.waitForURL(`**/treinador/planejamento/modelo/${ID_NOVO}`);
      expect(posts(r, '/receitas')).toEqual([expect.objectContaining({ nome: 'Semana de força', pastaId: 'p0000000-0000-4000-8000-000000000092' })]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('"+ Nova coleção…" sem texto abre o campo do nome: repetido dá erro, Enter cria e escolhe', async ({ page }) => {
      const r = await abrir(page);
      await abrirFolhaNova(page);
      await seletor(page, 'Sem coleção').click();
      await listaDeColecoes(page).getByRole('option', { name: '+ Nova coleção…', exact: true }).click();
      const campo = folhaNova(page).getByRole('textbox', { name: 'Nome da nova coleção', exact: true });
      await expect(campo).toBeVisible();
      await expect(campo).toBeFocused();
      await campo.fill(' hipertrofia ');
      await campo.press('Enter');
      await expect(folhaNova(page).getByText('Já existe uma coleção com esse nome. Escolha outro.', { exact: true })).toBeVisible();
      expect(posts(r, '/pastas-modelos')).toEqual([]);
      await campo.fill('Resistência');
      await campo.press('Enter');
      await expect(seletor(page, 'Resistência')).toBeVisible();
      await expect(campo).toHaveCount(0);
      expect(posts(r, '/pastas-modelos')).toEqual([{ nome: 'Resistência' }]);
      expect(r.naoTratadas).toEqual([]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('a "+" da faixa de uma coleção abre a folha já marcada com ela', async ({ page }) => {
      const r = await abrir(page);
      // Só a coleção que aparece na lista (com modelo) tem a faixa; "Sem coleção" não é coleção e não tem "+".
      await expect(page.getByRole('button', { name: /^Nova semana de treino em / })).toHaveCount(1);
      await page.getByRole('button', { name: `Nova semana de treino em ${HIPERTROFIA.nome}`, exact: true }).click();
      await expect(folhaNova(page)).toBeVisible();
      await expect(seletor(page, HIPERTROFIA.nome)).toBeVisible();
      await expect(campoNome(page)).toBeFocused();
      await campoNome(page).fill('Semana de hipertrofia 2');
      await campoNome(page).press('Enter');
      await page.waitForURL(`**/treinador/planejamento/modelo/${ID_NOVO}`);
      expect(posts(r, '/receitas')).toEqual([expect.objectContaining({ nome: 'Semana de hipertrofia 2', pastaId: HIPERTROFIA.id })]);
      expect(r.errosDaPagina).toEqual([]);
    });

    test('erro da API ao criar: a mensagem aparece, a folha fica e dá para tentar de novo', async ({ page }) => {
      const r = await abrir(page, { extra: { 'POST /receitas': erroApi(500, 'Falha fictícia ao criar o modelo.') } });
      await abrirFolhaNova(page);
      await campoNome(page).fill('Semana com falha');
      await folhaNova(page).getByRole('button', { name: 'Criar e editar', exact: true }).click();
      await expect(folhaNova(page).getByText('Falha fictícia ao criar o modelo.', { exact: true })).toBeVisible();
      await expect(folhaNova(page).getByRole('button', { name: 'Criar e editar', exact: true })).toBeEnabled();
      await expect(campoNome(page)).toHaveValue('Semana com falha');
      expect(r.naoTratadas).toEqual([]);
      expect(r.errosDaPagina).toEqual([]);
    });

    for (const tema of ['ESCURO', 'CLARO'] as const) {
      test(`captura ${tema.toLowerCase()}: a folha nova e a aberta dentro de uma coleção`, async ({ page }) => {
        test.skip(!BASE, 'só com E2E_CAPTURAS');
        await abrir(page, { tema });
        await abrirFolhaNova(page);
        await folhaNova(page).getByRole('button', { name: 'Criar e editar', exact: true }).click();
        await expect(folhaNova(page).getByText('Informe o nome do modelo.', { exact: true })).toBeVisible();
        await page.screenshot({ path: path.join(BASE!, `planejamento-novo-modelo-nova-${largura}-${tema.toLowerCase()}.png`) });
        await folhaNova(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page.getByRole('button', { name: `Nova semana de treino em ${HIPERTROFIA.nome}`, exact: true }).click();
        await expect(seletor(page, HIPERTROFIA.nome)).toBeVisible();
        await page.screenshot({ path: path.join(BASE!, `planejamento-novo-modelo-colecao-${largura}-${tema.toLowerCase()}.png`) });
        await seletor(page, HIPERTROFIA.nome).click();
        await expect(listaDeColecoes(page)).toBeVisible();
        await page.screenshot({ path: path.join(BASE!, `planejamento-novo-modelo-seletor-${largura}-${tema.toLowerCase()}.png`) });
        // A mesma folha nos outros grupos: nova dieta, nova mobilidade e novo pacote.
        for (const [aba, rotulo, caso] of [['dieta', 'Novo modelo de dieta', 'dieta'], ['mobilidade', 'Novo modelo de mobilidade', 'mobilidade'], ['pacotes', 'Novo pacote', 'pacote']] as const) {
          await page.goto(`/treinador/planejamento?aba=${aba}`);
          await page.getByRole('button', { name: rotulo, exact: true }).click();
          await expect(page.getByRole('dialog', { name: rotulo }).getByRole('textbox', { name: 'Nome do modelo', exact: true })).toBeVisible();
          await page.screenshot({ path: path.join(BASE!, `planejamento-novo-modelo-${caso}-${largura}-${tema.toLowerCase()}.png`) });
        }
      });
    }
  });
}
