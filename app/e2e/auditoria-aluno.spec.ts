import { expect, test, type Page } from '@playwright/test';

import type { RegistroEnvio } from '../src/api/tipos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, MEUS_DADOS_VAZIOS, sessaoComTopSetEBackOff, sessaoDeAluno, sessaoDeAlunoComTreino } from './aluno';

/**
 * Auditoria de UI/UX do aluno (03/11, frente 3): selo só nas séries registradas (N3), aviso de série sem carga (N6) e do
 * número inválido (N7), selo de sincronização do rodapé só com algo a dizer (N28) e um e-mail só na Conta. Dados
 * fictícios; relógio em segunda, 19/10/2026. A API é simulada aqui mesmo (`page.route` pelo `simularApi`).
 */

const AVISO_SEM_CARGA = 'Sem carga registrada: esta série não entra no progresso.';
const EXERCICIO = '/aluno/sessao/topo/agacho?data=2026-10-19';

const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

/** As rotas da Conta (foto de perfil e uso de imagem) além do básico do aluno. */
const ROTAS_DA_CONTA: RespostasApi = {
  'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
};

for (const largura of [390, 1280]) {
  test(`N3/N6/N7: sem selo antes de registrar; sem kg avisa; texto que não é número diz o motivo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const { errosDaPagina, naoTratadas } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, sessaoComTopSetEBackOff())),
      'POST /aluno/execucoes/lote': (p, route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ resultados: (p.corpo as { registros: RegistroEnvio[] }).registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) }),
      }),
    });
    await page.goto(EXERCICIO);
    await expect(page.getByText('Série 1', { exact: true })).toBeVisible();

    // N3: série sem registro não tem selo.
    await expect(page.getByText('Ainda não registrado', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Feita', { exact: true })).toHaveCount(0);

    // N7: letras no peso dizem o porquê, junto do campo.
    const peso = page.getByRole('textbox', { name: 'Peso da série 1, em quilos', exact: true });
    await peso.fill('abc');
    await expect(page.getByText('Peso: use só números.', { exact: true })).toBeVisible();
    await peso.fill('');
    await expect(page.getByText('Peso: use só números.', { exact: true })).toHaveCount(0);

    // N6: marcada com o kg vazio (sem sugestão para perguntar), a série avisa que não entra no progresso e ganha o selo.
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
    await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
    await expect(page.getByText(AVISO_SEM_CARGA, { exact: true })).toBeVisible();
    await expect(page.getByText('Feita', { exact: true })).toHaveCount(1);
    // Com o kg preenchido o aviso some.
    await peso.fill('80');
    await expect(page.getByText(AVISO_SEM_CARGA, { exact: true })).toHaveCount(0);

    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`N28: o selo do rodapé só aparece com envio pendente; a Conta mostra o estado completo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const { errosDaPagina, naoTratadas } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, sessaoComTopSetEBackOff())),
      ...ROTAS_DA_CONTA,
      'POST /aluno/execucoes/lote': (_p, route) => route.abort('internetdisconnected'),
    });
    // Fila vazia: o rodapé não tem selo.
    await page.goto(EXERCICIO);
    await expect(page.getByText('Série 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Sincronizado', { exact: true })).toHaveCount(0);

    // Um registro que não saiu: o selo aparece.
    await page.getByRole('textbox', { name: 'Peso da série 1, em quilos', exact: true }).fill('80');
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
    await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
    await expect(page.getByText(/aguardando envio|salvo\(s\) no aparelho/)).toBeVisible({ timeout: 15_000 });
    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`N28: com tudo enviado a Conta diz "Sincronizado" uma vez só, e o rodapé não repete (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina, naoTratadas } = await simularApi(page, { ...(await sessaoDeAluno(page)), ...ROTAS_DA_CONTA });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Sincronizado', { exact: true })).toHaveCount(1);
    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Conta: um e-mail só (o de acesso) e a nota quando o do cadastro é outro (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina, naoTratadas } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      ...ROTAS_DA_CONTA,
      'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, email: 'cadastro@exemplo.test', emailDeAcesso: ALUNO.email } },
    });
    await page.goto('/aluno/conta');
    await expect(page.getByLabel(`E-mail de acesso: ${ALUNO.email}`)).toBeVisible();
    await expect(page.getByLabel(/^E-mail do cadastro/)).toHaveCount(0);
    await expect(page.getByText('cadastro@exemplo.test')).toHaveCount(0);
    await expect(page.getByText('Seu treinador usa outro e-mail no seu cadastro.', { exact: true })).toBeVisible();
    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
