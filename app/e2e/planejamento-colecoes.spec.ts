import { expect, test, type Locator, type Page } from '@playwright/test';

import type { PastaModelo, Receita, TipoReceita } from '../src/api/tipos';
import { erroApi, PERMISSOES_TREINADOR, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Planejamento agrupado por coleção: um cartão por coleção em ordem alfabética, "Sem coleção" por último, a busca
 * procura em todas (a coleção que fica sem resultado some) e as abas Dieta, Pacotes e Mobilidade agrupam do mesmo
 * jeito. Só dados fictícios.
 */
const COLECOES: PastaModelo[] = [
  { id: 'p0000000-0000-4000-8000-000000000001', nome: 'Hipertrofia', versao: 1 },
  { id: 'p0000000-0000-4000-8000-000000000002', nome: 'Avançados', versao: 1 },
];
const [HIPERTROFIA, AVANCADOS] = COLECOES;

function modelo(n: number, tipo: TipoReceita, nome: string, pastaId: string | null, descricao: string | null = null): Receita {
  return { id: `r0000000-0000-4000-8000-00000000000${n}`, tipo, nome, descricao, conteudo: null, ordem: n, pastaId, versao: 1 };
}

const MODELOS: Receita[] = [
  modelo(1, 'PLANO_TREINO', 'Semana de hipertrofia', HIPERTROFIA.id),
  modelo(2, 'PLANO_TREINO', 'Semana avançada', AVANCADOS.id),
  modelo(3, 'PLANO_TREINO', 'Semana solta', null, 'Iniciação'),
  modelo(4, 'SESSAO_TREINO', 'Dia de pernas', HIPERTROFIA.id),
  modelo(5, 'PLANO_DIETA', 'Dieta base', null),
  modelo(6, 'PASTA_PLANO', 'Pacote inicial', AVANCADOS.id),
  modelo(7, 'MOBILIDADE', 'Mobilidade geral', HIPERTROFIA.id),
];

async function abrir(page: Page, aba = '', extra: RespostasApi = {}) {
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /receitas': { corpo: MODELOS },
    'GET /pastas-modelos': { corpo: COLECOES },
    ...extra,
  });
  await page.goto(`/treinador/planejamento${aba ? `?aba=${aba}` : ''}`);
  return { naoTratadas, errosDaPagina };
}

/** A faixa de uma coleção é um botão nomeado "<coleção>, aberto|recolhido" (`CabecalhoDeGrupo`). */
const faixa = (page: Page, nome: string, estado: 'aberto' | 'recolhido' = 'aberto') =>
  page.getByRole('button', { name: `${nome}, ${estado}`, exact: true });
const modeloNaTela = (page: Page, nome: string) => page.getByText(nome, { exact: true });

async function topo(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox();
  expect(caixa).not.toBeNull();
  return caixa!.y;
}

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('aba Treino: um cartão por coleção em ordem alfabética, "Sem coleção" por último, cada modelo no seu', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toBeVisible();
      const yAvancados = await topo(faixa(page, 'Avançados'));
      const yHipertrofia = await topo(faixa(page, 'Hipertrofia'));
      const ySem = await topo(faixa(page, 'Sem coleção'));
      expect(yAvancados).toBeLessThan(yHipertrofia);
      expect(yHipertrofia).toBeLessThan(ySem);
      // Cada modelo embaixo da própria faixa.
      const yAvancada = await topo(modeloNaTela(page, 'Semana avançada'));
      expect(yAvancada).toBeGreaterThan(yAvancados);
      expect(yAvancada).toBeLessThan(yHipertrofia);
      const yDeHipertrofia = await topo(modeloNaTela(page, 'Semana de hipertrofia'));
      expect(yDeHipertrofia).toBeGreaterThan(yHipertrofia);
      expect(yDeHipertrofia).toBeLessThan(ySem);
      expect(await topo(modeloNaTela(page, 'Semana solta'))).toBeGreaterThan(ySem);
      // Só os modelos do chip escolhido (Semanas de treino) contam: um por coleção.
      await expect(page.getByText('1 modelo', { exact: true })).toHaveCount(3);
      await expect(modeloNaTela(page, 'Dia de pernas')).toHaveCount(0);
      // "Organizar coleções" fica ao lado da busca; não existe mais filtro de coleção.
      await expect(page.getByRole('button', { name: 'Organizar coleções', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Coleção:/ })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('a busca procura em todas as coleções (sem acento, nome e descrição) e a coleção sem resultado some', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Avançados')).toBeVisible();
      const busca = page.getByRole('textbox', { name: 'Buscar modelo', exact: true });
      await busca.fill('iniciacao');
      await expect(modeloNaTela(page, 'Semana solta')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      await expect(faixa(page, 'Hipertrofia')).toHaveCount(0);
      await busca.fill('AVANÇADA');
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana avançada')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await busca.fill('xyz');
      await expect(page.getByText('Nenhum modelo com essa busca.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('trocar o chip de tipo mantém o agrupamento; recolher numa lista não recolhe na outra', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await faixa(page, 'Hipertrofia').click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await page.getByLabel('Dias de treino', { exact: true }).click();
      await expect(modeloNaTela(page, 'Dia de pernas')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      // De volta às semanas, a coleção continua recolhida como ficou.
      await page.getByLabel('Semanas de treino', { exact: true }).click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('recolher a coleção esconde os modelos dela; abrir ou buscar traz de volta', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      await faixa(page, 'Hipertrofia').click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana avançada')).toBeVisible();
      await faixa(page, 'Hipertrofia', 'recolhido').click();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      // Recolhida de novo, a busca reabre: o resultado nunca fica escondido.
      await faixa(page, 'Hipertrofia').click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await page.getByRole('textbox', { name: 'Buscar modelo', exact: true }).fill('hipertrofia');
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('se as coleções não carregam, mostra o erro e não agrupa', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, '', { 'GET /pastas-modelos': erroApi(500, 'Falha fictícia nas coleções.') });
      await expect(page.getByText('Falha fictícia nas coleções.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('as abas Atualização e Anamnese não mostram coleção nenhuma', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, 'atualizacao', { 'GET /questionarios': { corpo: [] } });
      await expect(page.getByText('Nenhum questionário ainda.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Organizar coleções', exact: true })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=anamnese');
      await expect(page.getByText('Nenhuma anamnese ainda. Crie uma em branco e monte as seções.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('o lápis da faixa abre "Organizar coleções" já renomeando a coleção', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      // "Sem coleção" não é uma coleção: não tem lápis.
      await expect(page.getByRole('button', { name: /^Renomear coleção Sem coleção/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'Renomear coleção Hipertrofia', exact: true }).click();
      const folha = page.getByRole('dialog', { name: 'Organizar coleções' });
      await expect(folha).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Renomear coleção', exact: true })).toHaveValue('Hipertrofia');
      await expect(folha.getByRole('button', { name: 'Salvar nome', exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Dieta, Pacotes e Mobilidade agrupam do mesmo jeito', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, 'dieta');
      await expect(faixa(page, 'Sem coleção')).toBeVisible();
      await expect(modeloNaTela(page, 'Dieta base')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=pacotes');
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(modeloNaTela(page, 'Pacote inicial')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=mobilidade');
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Mobilidade geral')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
