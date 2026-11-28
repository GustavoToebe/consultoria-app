import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { fixarHoje, MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { colunasEstaveis, conferirAlturasDeColunas } from './alturasDeColunas';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * App do aluno na web, Conta (27/11, contêiner do treinador; cartões em 28/11): os cartões (perfil, seções e convite) em
 * colunas empilhadas pela altura medida (`aluno/inicio/ColunasMedidas`, `dominio/colunasDaConta`): 1 no celular e na faixa
 * compacta, 2 na normal, 3 na larga e na ultralarga; o perfil no topo da primeira coluna, o título e a primeira coluna na
 * borda esquerda do contêiner, ao lado do menu, e nenhuma coluna terminando mais de 80 px antes da vizinha
 * (`e2e/alturasDeColunas`, testID `conta-coluna-<chave>`). Capturas com `E2E_CAPTURAS` (ou `CAPTURAS_ALUNO_LAYOUT`, pasta
 * fora do git), junto com as de Aparência e preferências do treinador na mesma largura, para comparar. Só dados fictícios.
 */

const BASE = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS_ALUNO_LAYOUT;
const PREFIXO = 'conta-coluna';
type Tema = 'ESCURO' | 'CLARO';
/** Menu aberto (240 px): 1024 de janela = área compacta; 1280 normal; 1920 e 2560 larga; 3440 ultralarga. */
const MATRIZ: { largura: number; altura: number; colunas: number; temas: Tema[] }[] = [
  { largura: 390, altura: 844, colunas: 1, temas: ['ESCURO', 'CLARO'] },
  { largura: 1024, altura: 768, colunas: 1, temas: ['ESCURO'] },
  { largura: 1280, altura: 720, colunas: 2, temas: ['ESCURO', 'CLARO'] },
  { largura: 1920, altura: 1080, colunas: 3, temas: ['ESCURO', 'CLARO'] },
  { largura: 2560, altura: 1440, colunas: 3, temas: ['ESCURO', 'CLARO'] },
  { largura: 3440, altura: 1440, colunas: 3, temas: ['ESCURO', 'CLARO'] },
];

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
  await colunasEstaveis(page, PREFIXO);
  await page.screenshot({ path: path.join(BASE, `${nome}.png`) });
  await page.setViewportSize(janela);
}

/** Caixa de cada peça medida (a moldura posicionada pelas colunas), na ordem do DOM, que é a de leitura. */
const caixasDasPecas = (page: Page) => page.evaluate((p) => [...document.querySelectorAll<HTMLElement>(`[data-testid^="${p}-"]`)]
  .map((el) => {
    const r = el.getBoundingClientRect();
    return { nome: el.dataset.testid!.slice(p.length + 1), y: r.y, width: r.width, height: r.height, right: r.right };
  })
  .filter((c) => c.height >= 1), PREFIXO);

for (const { largura, altura, colunas, temas } of MATRIZ) {
  for (const tema of temas) {
    test(`Conta em ${largura} px ${tema.toLowerCase()}: ${colunas} coluna(s) empilhada(s), sem buraco, na borda do contêiner`, async ({ page }) => {
      await preparar(page, largura, altura, tema);
      const { errosDaPagina } = await abrir(page);
      // A captura sai antes da conferência (é ela que mostra o buraco, se houver).
      await colunasEstaveis(page, PREFIXO);
      await capturar(page, `conta-${largura}-${tema.toLowerCase()}`);
      const lidas = await conferirAlturasDeColunas(page, { prefixo: PREFIXO, colunasEsperadas: colunas });
      test.info().annotations.push({ type: 'fim das colunas', description: lidas.map((c) => `${c.pecas.join('+')}: ${Math.round(c.fim)}`).join(' | ') });
      // A ordem de leitura começa pelo perfil, no topo da primeira coluna.
      expect(lidas[0].pecas[0]).toBe('perfil');
      // O título e a primeira coluna na mesma borda (a do contêiner, ao lado do menu).
      const titulo = (await page.getByRole('heading', { level: 1, name: 'Conta' }).boundingBox())!;
      expect(Math.abs(lidas[0].x - titulo.x)).toBeLessThan(4);
      const c = await caixasDasPecas(page);
      if (colunas > 1) {
        // Todas as peças com a largura da célula, e a última coluna perto da borda direita (sem faixa vazia à direita).
        const larguras = c.map((b) => Math.round(b.width));
        expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThan(2);
        expect(largura - Math.max(...c.map((b) => b.right))).toBeLessThan(80);
      } else {
        // Uma coluna: as peças em ordem, uma embaixo da outra.
        for (let i = 1; i < c.length; i++) expect(c[i].y).toBeGreaterThan(c[i - 1].y);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('Conta: "Trocar senha" abre a folha a partir da coluna', async ({ page }) => {
  await preparar(page, 1920, 1080, 'ESCURO');
  await abrir(page);
  await colunasEstaveis(page, PREFIXO);
  await page.getByRole('button', { name: /^Trocar senha/ }).click();
  await expect(page.getByRole('dialog', { name: 'Trocar senha' })).toBeVisible();
});

test('Conta em 1920: com a API do perfil fora, as linhas dizem que não carregou e as colunas continuam sem buraco', async ({ page }) => {
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
  await colunasEstaveis(page, PREFIXO);
  await capturar(page, 'conta-1920-erro');
  await conferirAlturasDeColunas(page, { prefixo: PREFIXO, colunasEsperadas: 3 });
});

// Comparação: Aparência e preferências do treinador (`ui/Alvenaria`) nas mesmas larguras e temas. Só captura.
test.describe('capturas de comparação: Aparência e preferências do treinador', () => {
  test.skip(!BASE, 'só com E2E_CAPTURAS');
  for (const { largura, altura } of MATRIZ.filter((m) => m.largura >= 1280)) for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`treinador ${largura} ${tema.toLowerCase()}`, async ({ page }) => {
      await preparar(page, largura, altura, tema, TREINADOR.id);
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { unidadeDeCargaHabilitada: true })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      });
      await page.goto('/treinador/ajustes');
      await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
      if (!BASE) return;
      const janela = page.viewportSize()!;
      await page.setViewportSize({ width: janela.width, height: Math.max(janela.height, 1500) });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(BASE, `treinador-ajustes-${largura}-${tema.toLowerCase()}.png`) });
    });
  }
});
