import { expect, test } from '@playwright/test';
import type { Configuracao, Receita } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Criação completa pela tela, com dados fictícios e API simulada.
for (const largura of [390, 1280]) {
  test(`criar metodologia, tipo de preparação, regra e padrão da técnica (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let modelo: Receita | null = null;
    const id = 'm0000000-0000-4000-8000-000000000002';
    const api = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /pastas-modelos': { corpo: [] },
      'GET /receitas': (_p, route) => json(route, modelo ? [modelo] : []),
      'POST /receitas': (p, route) => { modelo = { ...p.corpo as Receita, id, ordem: 1, versao: 1 }; return json(route, modelo, 201); },
      [`GET /receitas/${id}`]: (_p, route) => json(route, modelo),
      [`PUT /receitas/${id}`]: (p, route) => { modelo = { ...modelo!, ...p.corpo as Receita, versao: 2 }; return json(route, modelo); },
    });
    await page.goto('/treinador/planejamento');
    await page.getByRole('button', { name: 'Metodologias', exact: true }).click();
    await page.getByRole('button', { name: 'Nova metodologia', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome do modelo', exact: true }).fill('Metodologia fictícia');
    await page.getByRole('button', { name: 'Criar e editar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar tipo', exact: true }).click();
    // O formulário só pede nome e papel; a regra de percentuais mora no cartão do tipo, depois de criado.
    await page.getByRole('textbox', { name: 'Nome do tipo', exact: true }).fill('Preparação técnica');
    await page.getByRole('button', { name: 'Preparação', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Regra para \d+ séries?$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Criar tipo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Preparação técnica, aberto', exact: true })).toBeVisible();
    await expect(page.getByText('PREPARACAO_TECNICA', { exact: true })).toBeVisible();
    await expect(page.getByText('Regra de percentuais por quantidade', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Regra para 1 série', exact: true }).click();
    await page.getByRole('textbox', { name: '1ª mín. (%)', exact: true }).fill('80');
    await page.getByRole('textbox', { name: '1ª máx. (%)', exact: true }).fill('90');
    await page.getByRole('textbox', { name: 'Explicação para o aluno', exact: true }).fill('Preparação do exemplo fictício.');
    await page.getByRole('button', { name: 'Preparação técnica, aberto', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause, recolhido', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pausa (s)', exact: true }).fill('30');
    await page.getByRole('textbox', { name: 'Quantas pausas', exact: true }).fill('2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('metodologia-criada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = modelo!.conteudo as Configuracao;
    expect(salvo.tipos.at(-1)).toMatchObject({ codigo: 'PREPARACAO_TECNICA', nome: 'Preparação técnica', papel: 'PREPARACAO', regraPercentuais: { '1': [{ min: 80, max: 90 }] } });
    expect(salvo.tecnicas[0].padrao).toMatchObject({ pausaSegundos: 30, pausas: 2 });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
