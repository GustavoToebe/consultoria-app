import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, Marca } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Paletas da marca, caminho inteiro (plano paletas-da-marca, passo 6): o treinador salva a paleta Oceano na Marca, a
 * API (de mentira, com estado) a devolve ao recarregar, e o aluno abre o Início já nela. A preferência pessoal do aluno
 * vence a da consultoria, "Padrão da consultoria" volta a ela e um código que o app não conhece cai no Escuro sem
 * quebrar. Dados fictícios.
 */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const LARGURAS = [390, 1280];

/** Fundo do primeiro `div` (a partir da raiz do app) que tem cor: é o fundo que o app pinta atrás de tudo. */
const fundoDaRaiz = (page: Page) =>
  page.evaluate(() => {
    const fila: Element[] = [document.getElementById('root') ?? document.body];
    while (fila.length) {
      const e = fila.shift()!;
      if (e instanceof HTMLDivElement) {
        const cor = getComputedStyle(e).backgroundColor;
        if (cor !== 'rgba(0, 0, 0, 0)' && cor !== 'transparent') return cor;
      }
      fila.push(...Array.from(e.children));
    }
    return null;
  });
const esquemaDeCores = (page: Page) => page.evaluate(() => document.documentElement.style.colorScheme);

/** Erros do console que não são o 404 de uma rota que a API de mentira não simula (isso o `naoTratadas` mostra). */
function errosDoConsole(page: Page) {
  const erros: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text());
  });
  return erros;
}

test.describe('treinador salva a paleta e a API a devolve ao recarregar', () => {
  for (const largura of LARGURAS) {
    test(`Oceano salva na Marca e volta selecionada depois de recarregar (${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      // A "base" da consultoria: o PUT troca a paleta e tudo que o app lê depois (consultoria, /eu, refresh) a devolve.
      let marca: Marca = { ...MARCA, temaPadrao: 'CLARO' };
      let versao = 3;
      const consultoria = (): ConsultoriaResponse => ({ marca, versao, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' });
      const base = await sessao(page, TREINADOR, ADMIN);
      const corpoDe = (chave: string) => (base[chave] as { corpo: object }).corpo;
      const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
        ...base,
        'POST /auth/refresh': (_p, route) => json(route, { ...corpoDe('POST /auth/refresh'), marca }),
        'GET /eu': (_p, route) => json(route, { ...corpoDe('GET /eu'), marca }),
        'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /consultoria': (_p, route) => json(route, consultoria()),
        'PUT /consultoria/marca': (p, route) => {
          marca = { ...marca, temaPadrao: (p.corpo as { temaPadrao: Marca['temaPadrao'] }).temaPadrao };
          versao += 1;
          return json(route, consultoria());
        },
      });
      const erros = errosDoConsole(page);

      await page.goto('/treinador/marca');
      const oceano = page.getByRole('group', { name: 'Escuras' }).getByRole('radio', { name: 'Oceano', exact: true });
      await expect(oceano).toHaveAttribute('aria-checked', 'false');
      await oceano.click();
      await page.getByRole('button', { name: 'Salvar marca', exact: true }).click();
      await expect(page.getByText('Marca salva. Os alunos veem a nova marca ao abrir o app.')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca')?.corpo).toMatchObject({ temaPadrao: 'OCEANO', versao: 3 });

      await page.reload();
      await expect(page.getByRole('group', { name: 'Escuras' }).getByRole('radio', { name: 'Oceano', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('group', { name: 'Claras' }).getByRole('radio', { name: 'Claro', exact: true })).toHaveAttribute('aria-checked', 'false');
      expect(errosDaPagina).toEqual([]);
      expect(erros).toEqual([]);
      expect(naoTratadas).toEqual([]);
    });
  }
});

interface Abertura {
  /** Código vindo da API em `marca.temaPadrao` (string solta, para poder testar um código desconhecido). */
  temaPadrao: string;
  /** Preferência pessoal gravada no aparelho antes de abrir (nenhuma = o padrão, "Padrão da consultoria"). */
  preferencia?: 'ESCURO' | 'CLARO' | 'AREIA' | 'SISTEMA' | 'CONSULTORIA';
}

async function abrirComoAluno(page: Page, largura: number, { temaPadrao, preferencia }: Abertura, caminho = '/aluno') {
  await page.setViewportSize({ width: largura, height: 844 });
  if (preferencia) {
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, preferencia]);
  }
  const marca = { ...MARCA, temaPadrao } as unknown as Marca;
  const base = await sessaoDeAluno(page);
  const comMarca: RespostasApi = {};
  for (const chave of ['POST /auth/refresh', 'GET /eu', 'GET /aluno/painel']) {
    comMarca[chave] = { corpo: { ...(base[chave] as { corpo: object }).corpo, marca } };
  }
  const api = await simularApi(page, {
    ...base,
    ...comMarca,
    'GET /aluno/dieta': { corpo: { dieta: null } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  });
  const erros = errosDoConsole(page);
  await page.goto(caminho);
  return { ...api, erros };
}

for (const largura of LARGURAS) {
  test.describe(`aluno, ${largura}px`, () => {
    test('com Oceano na consultoria e sem preferência pessoal, o Início abre na paleta, em modo escuro', async ({ page }) => {
      const { errosDaPagina, erros, naoTratadas } = await abrirComoAluno(page, largura, { temaPadrao: 'OCEANO' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Aluno.');
      expect(PALETAS.OCEANO.modo).toBe('ESCURO');
      await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.OCEANO.cores.fundo));
      await expect.poll(() => esquemaDeCores(page)).toBe('dark');
      expect(errosDaPagina).toEqual([]);
      expect(erros).toEqual([]);
      expect(naoTratadas).toEqual([]);
    });

    test('a preferência pessoal Claro vence a paleta da consultoria', async ({ page }) => {
      const { errosDaPagina, erros } = await abrirComoAluno(page, largura, { temaPadrao: 'OCEANO', preferencia: 'CLARO' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Aluno.');
      await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.CLARO.cores.fundo));
      await expect.poll(() => esquemaDeCores(page)).toBe('light');
      expect(errosDaPagina).toEqual([]);
      expect(erros).toEqual([]);
    });

    test('"Padrão da consultoria" nas Preferências volta à paleta da consultoria', async ({ page }) => {
      const { errosDaPagina, erros } = await abrirComoAluno(page, largura, { temaPadrao: 'OCEANO', preferencia: 'CLARO' }, '/aluno/conta');
      await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.CLARO.cores.fundo));
      await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
      const padrao = page.getByRole('radio', { name: /^Padrão da consultoria/ });
      await expect(padrao).toHaveAttribute('aria-checked', 'false');
      await padrao.click();
      await expect(padrao).toHaveAttribute('aria-checked', 'true');
      await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.OCEANO.cores.fundo));
      await expect.poll(() => esquemaDeCores(page)).toBe('dark');
      expect(errosDaPagina).toEqual([]);
      expect(erros).toEqual([]);
    });

    test('código de tema desconhecido vindo da API não quebra o Início: cai no Escuro', async ({ page }) => {
      const { errosDaPagina, erros } = await abrirComoAluno(page, largura, { temaPadrao: 'FUTURA' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Aluno.');
      await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.ESCURO.cores.fundo));
      await expect.poll(() => esquemaDeCores(page)).toBe('dark');
      expect(errosDaPagina).toEqual([]);
      expect(erros).toEqual([]);
    });
  });
}
