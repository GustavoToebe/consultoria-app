import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { fixarHoje, MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * App do aluno na web, Conta (27/11, contêiner do treinador): as peças (perfil, seções, convite e "Excluir minha conta") em
 * colunas empilhadas (`ui/Alvenaria`, `dominio/colunasDaConta`): 1 no celular e na faixa compacta, 2 na normal, 3 na larga e
 * na ultralarga; o título e a primeira coluna na borda esquerda do contêiner, ao lado do menu, e as colunas terminando perto
 * da mesma altura (sem buraco). Capturas com `E2E_CAPTURAS` (ou `CAPTURAS_ALUNO_LAYOUT`, pasta fora do git), junto com as
 * de Aparência e preferências do treinador na mesma largura, para comparar. Só dados fictícios.
 */

const BASE = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS_ALUNO_LAYOUT;
type Tema = 'ESCURO' | 'CLARO';
/** Menu aberto (240 px): 1024 de janela = área compacta; 1280 normal; 1920 larga; 3440 ultralarga. */
const MATRIZ: { largura: number; altura: number; colunas: number; temas: Tema[] }[] = [
  { largura: 390, altura: 844, colunas: 1, temas: ['ESCURO', 'CLARO'] },
  { largura: 1024, altura: 768, colunas: 1, temas: ['ESCURO'] },
  { largura: 1280, altura: 720, colunas: 2, temas: ['ESCURO', 'CLARO'] },
  { largura: 1920, altura: 1080, colunas: 3, temas: ['ESCURO', 'CLARO'] },
  { largura: 3440, altura: 1440, colunas: 3, temas: ['ESCURO', 'CLARO'] },
];
const PECAS = ['cabecalho-do-perfil', 'secao-perfil', 'secao-dados', 'secao-convite', 'secao-privacidade', 'secao-seguranca', 'secao-app', 'excluir-minha-conta'];

async function preparar(page: Page, largura: number, altura: number, tema: Tema, id = ALUNO.id) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([usuario, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs));
    } catch { /* quadro sem armazenamento */ }
  }, [id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }] as const);
}

async function abrir(page: Page) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: false })),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: '2026-11-10T12:00:00-03:00' } },
    'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste da Silva', telefone: '(45) 99999-8888', emailDeAcesso: ALUNO.email, versao: 1 } },
    'GET /aluno/comunidade/perfil': { corpo: { perfilReservado: false, reservadoEfetivo: false, destaques: [], cor: 'ROXO', moldura: 'DUPLA', exibicaoDoNome: 'NOME', opcoesDeDestaque: [] } },
    'GET /aluno/indicacao': { corpo: { link: 'https://exemplo.test/inscricao/codigo-ficticio' } },
  });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  await expect(page.getByTestId('cabecalho-do-perfil')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Meus dados,/ })).toBeVisible();
  return api;
}

/** A rolagem é da `Tela`: para a captura mostrar a tela toda, a janela cresce na altura (as faixas só dependem da largura). */
async function capturar(page: Page, nome: string) {
  if (!BASE) return;
  fs.mkdirSync(BASE, { recursive: true });
  const janela = page.viewportSize()!;
  await page.setViewportSize({ width: janela.width, height: Math.max(janela.height, 1500) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASE, `${nome}.png`) });
  await page.setViewportSize(janela);
}

const caixas = (page: Page) => Promise.all(PECAS.map(async (id) => {
  const c = await page.getByTestId(id).boundingBox();
  if (!c) throw new Error(`sem caixa: ${id}`);
  return c;
}));

for (const { largura, altura, colunas, temas } of MATRIZ) {
  for (const tema of temas) {
    test(`Conta em ${largura} px ${tema.toLowerCase()}: ${colunas} coluna(s) empilhada(s), sem buraco, na borda do contêiner`, async ({ page }) => {
      await preparar(page, largura, altura, tema);
      const { errosDaPagina } = await abrir(page);
      // A captura sai mesmo se a conferência falhar (é ela que mostra o buraco).
      await page.waitForTimeout(600);
      await capturar(page, `conta-${largura}-${tema.toLowerCase()}`);
      await expect(async () => {
        const c = await caixas(page);
        // Colunas pelo x de cada peça (o cartão de excluir tem o recuo por dentro: até 40 px conta como a mesma coluna).
        const xs = c.map((b) => Math.round(b.x)).sort((a, b) => a - b).filter((x, i, todos) => i === 0 || x - todos[i - 1] > 40);
        expect(xs.length).toBe(colunas);
        const colunaDe = (b: { x: number }) => xs.filter((x) => b.x >= x - 1).length - 1;
        const titulo = (await page.getByRole('heading', { level: 1, name: 'Conta' }).boundingBox())!;
        // O título e a primeira coluna na mesma borda (a do contêiner, ao lado do menu).
        expect(Math.abs(xs[0] - titulo.x)).toBeLessThan(4);
        // A ordem de leitura começa pelo perfil, no topo da primeira coluna.
        expect(colunaDe(c[0])).toBe(0);
        if (colunas > 1) {
          // Colunas terminando perto da mesma altura (diferença de no máximo ~uma linha e meia).
          const fins = xs.map((_, k) => Math.max(...c.filter((b) => colunaDe(b) === k).map((b) => b.y + b.height)));
          expect(Math.max(...fins) - Math.min(...fins)).toBeLessThan(140);
          // As seções (a moldura inteira da peça) têm a mesma largura em todas as colunas.
          const larguras = c.filter((_, i) => PECAS[i].startsWith('secao-')).map((b) => Math.round(b.width));
          expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThan(2);
          // A última coluna chega perto da borda direita do conteúdo (sem faixa vazia à direita).
          const direita = Math.max(...c.map((b) => b.x + b.width));
          expect(largura - direita).toBeLessThan(80);
        } else {
          // Uma coluna: as peças em ordem, uma embaixo da outra.
          for (let i = 1; i < c.length; i++) expect(c[i].y).toBeGreaterThan(c[i - 1].y);
        }
      }).toPass({ timeout: 10_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('Conta: "Meus dados" e "Trocar senha" abrem a folha a partir da coluna', async ({ page }) => {
  await preparar(page, 1920, 1080, 'ESCURO');
  await abrir(page);
  await page.getByRole('button', { name: /^Trocar senha/ }).click();
  await expect(page.getByRole('dialog', { name: 'Trocar senha' })).toBeVisible();
});

test('Conta: sem conexão com a API do perfil, as seções que dependem dela somem sem deixar vão', async ({ page }) => {
  await preparar(page, 1920, 1080, 'ESCURO');
  await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: false })),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': erroApi(500, 'Falha no servidor.'),
    'GET /aluno/meus-dados': erroApi(500, 'Falha no servidor.'),
    'GET /aluno/comunidade/perfil': erroApi(500, 'Falha no servidor.'),
    'GET /aluno/indicacao': erroApi(500, 'Falha no servidor.'),
  });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Meus dados, Não foi possível carregar/ })).toBeVisible();
  await capturar(page, 'conta-1920-erro');
});

// Comparação: Aparência e preferências do treinador (a mesma `Alvenaria`) nas mesmas larguras e temas. Só captura.
test.describe('capturas de comparação: Aparência e preferências do treinador', () => {
  test.skip(!BASE, 'só com E2E_CAPTURAS');
  for (const largura of [1280, 1920, 3440]) for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`treinador ${largura} ${tema.toLowerCase()}`, async ({ page }) => {
      await preparar(page, largura, largura === 3440 ? 1440 : largura === 1920 ? 1080 : 720, tema, TREINADOR.id);
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { unidadeDeCargaHabilitada: true })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      });
      await page.goto('/treinador/ajustes');
      await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
      await capturar(page, `treinador-ajustes-${largura}-${tema.toLowerCase()}`);
    });
  }
});
