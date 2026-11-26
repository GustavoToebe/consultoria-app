import { expect, test, type Page } from '@playwright/test';

import { ALUNO, erroApi, sessao, simularApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';

/**
 * Início do aluno com o retorno ligado: `GET /aluno/sessoes-concluidas` sai UMA vez por abertura em qualquer largura
 * (o `AlunoProvider` busca; o mapa de treinos usa a mesma resposta). Só dados fictícios.
 */

async function abrir(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 1080 });
  await page.addInitScript((id) => { try { localStorage.removeItem('menu-lateral-recolhido'); localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })); } catch { /* sem armazenamento */ } }, ALUNO.id);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
  });
  await page.goto('/aluno');
  await expect(page.getByLabel(/^Mapa de treinos:/)).toBeVisible();
  // Folga para uma segunda chamada tardia aparecer, se existir.
  await page.waitForTimeout(1500);
  return api;
}

for (const largura of [390, 1280, 1920]) {
  test(`${largura}: o Início lê as sessões concluídas uma vez só`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, largura);
    const leituras = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/sessoes-concluidas');
    expect(leituras).toHaveLength(1);
    // A leitura única cobre os 12 meses do mapa (hoje fixo: segunda, 19/10/2026), não só os 60 dias do provedor.
    expect(leituras[0].busca.get('de')).toBe('2025-10-20');
    expect(leituras[0].busca.get('ate')).toBe('2026-10-21');
    expect(errosDaPagina).toEqual([]);
  });
}
