import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, AguaRegistrada, PlanoResumo, RegistroAguaEnvio } from '../src/api/tipos';
import { dietaFalsa, fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Água do dia (docs/planos/agua-do-aluno.md): o aluno marca copos de 250 ml contra a "Água por dia" da dieta, na mesma
 * fila de envio das séries; sem meta na dieta nada aparece; o treinador vê os últimos 7 dias na ficha. O relógio fica em
 * segunda-feira, 19/10/2026 (meio-dia em Brasília). Dados fictícios.
 */

async function abrirComoAluno(page: Page, largura: number, extra: RespostasApi, caminho: string, agua = 3 as number | null) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  const enviados: RegistroAguaEnvio[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: dietaFalsa(4, agua) },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'POST /aluno/agua': async (pedido, route) => {
      const lote = (pedido.corpo as { registros: RegistroAguaEnvio[] }).registros;
      enviados.push(...lote);
      await json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    ...extra,
  });
  await page.goto(caminho);
  return { ...api, enviados };
}

for (const largura of [390, 1280]) {
  test(`aluno marca e tira copos hoje e em outro dia, e vai na fila (${largura}px)`, async ({ page }) => {
    const { enviados, naoTratadas, errosDaPagina } = await abrirComoAluno(page, largura, {}, '/aluno/dieta');
    const cartao = page.getByRole('heading', { name: 'Água de hoje' });
    await expect(cartao).toBeVisible();
    await expect(page.getByText('Nada marcado neste dia')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar um copo' })).toBeDisabled();

    await page.getByRole('button', { name: 'Mais um copo' }).click();
    await expect(page.getByText('0,25 L de 3,0 L')).toBeVisible();
    await page.getByRole('button', { name: 'Mais um copo' }).click();
    await expect(page.getByText('0,5 L de 3,0 L')).toBeVisible();
    await expect(page.getByText('2 copos')).toBeVisible();
    await page.getByRole('button', { name: 'Tirar um copo' }).click();
    await expect(page.getByText('0,25 L de 3,0 L')).toBeVisible();
    // "1 copo" (singular) também é o rótulo dos dois botões: o texto do dia é o terceiro.
    await expect(page.getByText('1 copo', { exact: true })).toHaveCount(3);

    // Vai na fila 2 s depois da última marcação, com o valor final do dia (um registro só, um id).
    await expect.poll(() => enviados.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => enviados[enviados.length - 1].aguaMl, { timeout: 15_000 }).toBe(250);
    expect(new Set(enviados.map((r) => r.id)).size).toBe(1);
    expect(enviados[enviados.length - 1].data).toBe('2026-10-19');

    // Outro dia: o chip do dia abre a água dele, que é outro registro.
    await page.getByRole('radio', { name: 'Água, 18/10' }).click();
    await expect(page.getByRole('heading', { name: 'Água em 18/10' })).toBeVisible();
    await page.getByRole('button', { name: 'Mais um copo' }).click();
    await expect(page.getByText('0,25 L de 3,0 L')).toBeVisible();
    await expect.poll(() => enviados.some((r) => r.data === '2026-10-18'), { timeout: 15_000 }).toBe(true);
    expect(enviados.find((r) => r.data === '2026-10-18')?.id).not.toBe(enviados[0].id);
    // O ✓ do chip diz que o dia tem registro.
    await expect(page.getByRole('radio', { name: 'Água, 19/10, hoje, com registro' })).toBeVisible();

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Início: cartão compacto de hoje com o que já está no servidor', async ({ page }) => {
  const servidor: AguaRegistrada[] = [{ data: '2026-10-19', aguaMl: 1500 }];
  const { errosDaPagina } = await abrirComoAluno(page, 390, { 'GET /aluno/agua': { corpo: servidor } }, '/aluno');
  await expect(page.getByRole('heading', { name: 'Água de hoje' })).toBeVisible();
  await expect(page.getByText('1,5 L de 3,0 L')).toBeVisible();
  await expect(page.getByText('6 copos')).toBeVisible();
  // Compacto: sem os outros dias.
  await expect(page.getByRole('radio', { name: /Água, 18\/10/ })).toHaveCount(0);
  // O botão do treino de hoje continua à vista na primeira tela do celular.
  expect(errosDaPagina).toEqual([]);
});

test('sem "Água por dia" na dieta o cartão não aparece', async ({ page }) => {
  await abrirComoAluno(page, 390, {}, '/aluno', null);
  await expect(page.getByText('Seu treinador ainda não publicou um plano alimentar.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Dieta, 4 refeições/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Água de hoje' })).toHaveCount(0);
  await page.goto('/aluno/dieta');
  await expect(page.getByRole('heading', { name: 'Dieta', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Água de hoje' })).toHaveCount(0);
});

test('sem internet a água fica na fila e a Conta mostra que está aguardando envio', async ({ page }) => {
  await abrirComoAluno(page, 1280, { 'POST /aluno/agua': erroApi(503, 'Servidor fora do ar.') }, '/aluno/dieta');
  await page.getByRole('button', { name: 'Mais um copo' }).click();
  await expect(page.getByText('0,25 L de 3,0 L')).toBeVisible();
  await page.getByRole('link', { name: 'Conta' }).first().click();
  await expect(page.getByText('1 aguardando envio.')).toBeVisible({ timeout: 15_000 });
});

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const DIETA_ATIVA = {
  id: 'd0000000-0000-4000-8000-000000000002', alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta', inicio: '2026-10-05', fim: '2026-11-01',
  ativo: true, versaoPublicada: 1, publicadoEm: '2026-10-05T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
} as unknown as PlanoResumo;

for (const largura of [390, 1280]) {
  test(`treinador vê a água dos últimos 7 dias na ficha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'DIETA_LER'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/agua`]: { corpo: [{ data: '2026-10-19', aguaMl: 1500 }, { data: '2026-10-17', aguaMl: 0 }] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [DIETA_ATIVA] },
      [`GET /planos-dieta/${DIETA_ATIVA.id}/versoes/1`]: { corpo: dietaFalsa(4, 3).dieta },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await expect(page.getByRole('heading', { name: 'Água', exact: true })).toBeVisible();
    await expect(page.getByText('Registrou 2 de 7 dias')).toBeVisible();
    await expect(page.getByText('1,5 L de 3,0 L')).toBeVisible();
    await expect(page.getByText('0,0 L de 3,0 L')).toBeVisible();
    // Dia sem registro é "—", nunca zero.
    await expect(page.getByText('—').first()).toBeVisible();
    const pedido = pedidos.find((p) => p.caminho === `/alunos/${ALUNO_ID}/agua`);
    expect(pedido?.busca.get('de')).toBe('2026-10-13');
    expect(pedido?.busca.get('ate')).toBe('2026-10-19');
    expect(errosDaPagina).toEqual([]);
  });
}
