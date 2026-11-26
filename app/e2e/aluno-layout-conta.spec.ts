import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { fixarHoje, MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, sessao, simularApi } from './api-falsa';

/**
 * App do aluno na web, Conta (`docs/planos/aluno-web-layout.md`, seção 8, 26/11): só conferir que segue o padrão das outras
 * telas do aluno na web: no contêiner de 1312 centralizado, com o título e o bloco de 984 na borda esquerda dele, na regra de formulário (perfil e índice em 320 à esquerda, seções em até 640;
 * D6 de `tela-larga-revisao-app-do-aluno.md`), uma coluna no celular. Capturas só com `CAPTURAS_ALUNO_LAYOUT` (pasta fora do
 * git) e `CAPTURAS_FASE`. Só dados fictícios.
 */

const BASE = process.env.CAPTURAS_ALUNO_LAYOUT;
const FASE = process.env.CAPTURAS_FASE ?? 'depois';
/** A matriz da 0.5 de `orientacoes-de-design-26-11.md` (claro e escuro em 390, 1280 e 1920; 1024 também com o menu minimizado). */
const MATRIZ: { largura: number; altura: number; recolhido?: boolean; temas: ('ESCURO' | 'CLARO')[] }[] = [
  { largura: 390, altura: 844, temas: ['ESCURO', 'CLARO'] },
  { largura: 1024, altura: 768, temas: ['ESCURO'] },
  { largura: 1024, altura: 768, recolhido: true, temas: ['ESCURO'] },
  { largura: 1280, altura: 720, temas: ['ESCURO', 'CLARO'] },
  { largura: 1536, altura: 864, temas: ['ESCURO'] },
  { largura: 1920, altura: 1080, temas: ['ESCURO', 'CLARO'] },
  { largura: 2560, altura: 1440, temas: ['ESCURO'] },
  { largura: 3440, altura: 1440, temas: ['ESCURO'] },
];

async function preparar(page: Page, largura: number, altura: number, tema: 'ESCURO' | 'CLARO' = 'ESCURO', recolhido = false) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1');
      else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(prefs));
    } catch { /* quadro sem armazenamento */ }
  }, [ALUNO.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }, recolhido] as const);
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
  return api;
}

/**
 * Borda esquerda do contêiner das telas do aluno (1312, centralizado; decisão do Gustavo de 26/11): com espaço, centrado na
 * área ao lado do menu (a barra de rolagem da tela, até ~15 px, desloca a conta em até ~8 px); sem espaço, a borda da área
 * com o recuo de 16 da `Tela`. O título de todas as telas do aluno cai nesse x.
 */
async function bordaDoContainer(page: Page): Promise<number> {
  const { menu, janela } = await page.evaluate(() => ({
    menu: document.querySelector('[role="menubar"]')?.getBoundingClientRect().right ?? 0,
    janela: document.documentElement.clientWidth,
  }));
  const area = janela - menu;
  return area >= 1312 + 2 * 16 + 15 ? menu + (area - 1312) / 2 : menu + 16;
}

const caixa = async (l: Locator) => {
  const c = await l.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};

for (const { largura, altura, recolhido, temas } of MATRIZ) {
  const nome = `${largura}${recolhido ? '-minimizado' : ''}`;
  test(`Conta em ${nome} px: ${largura < 1024 ? 'uma coluna' : 'perfil à esquerda e seções em até 640, na borda esquerda do contêiner do aluno'}`, async ({ page }) => {
    for (const tema of temas) {
      await preparar(page, largura, altura, tema, recolhido);
      const { errosDaPagina } = await abrir(page);
      const perfil = page.getByTestId('cabecalho-do-perfil');
      const secao = page.getByRole('button', { name: /^Meus dados,/ });
      await expect(secao).toBeVisible();
      await page.waitForTimeout(400);
      if (BASE) {
        const pasta = path.join(BASE, FASE);
        fs.mkdirSync(pasta, { recursive: true });
        await page.screenshot({ path: path.join(pasta, `conta-${nome}-${tema.toLowerCase()}.png`) });
      }
      const p = await caixa(perfil);
      const s = await caixa(secao);
      const titulo = await caixa(page.getByRole('heading', { level: 1, name: 'Conta' }));
      if (largura >= 1280) {
        // Duas colunas (320 + 24 + 640): a seção à direita do perfil; título e perfil na borda esquerda do contêiner de 1312.
        expect(s.x).toBeGreaterThan(p.x + p.width);
        expect(s.width).toBeLessThanOrEqual(641);
        // O título na borda do bloco: a do cartão do perfil (que tem o próprio recuo por dentro).
        expect(p.x - titulo.x).toBeGreaterThanOrEqual(0);
        expect(p.x - titulo.x).toBeLessThan(32);
        expect(Math.abs(titulo.x - (await bordaDoContainer(page)))).toBeLessThan(10);
        // O bloco de 984 termina antes da borda direita do contêiner (não estica até 1312).
        expect(s.x + s.width - titulo.x).toBeLessThanOrEqual(985);
      }
      if (largura === 390) expect(s.y).toBeGreaterThan(p.y + p.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    }
  });
}
