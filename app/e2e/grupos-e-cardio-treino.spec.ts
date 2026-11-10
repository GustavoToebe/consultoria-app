import { expect, test, type Page } from '@playwright/test';
import type { ConteudoTreino, Receita } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoFalsa } from './aluno';

// Dia de treino fictício com dois exercícios de peso livre, lado a lado. Nada chega ao banco: a API é simulada.
const ID = 'm0000000-0000-4000-8000-000000000004';

async function abrirDiaDeTreino(page: Page, observacaoDaRemada: string | null = null) {
  const dia = sessaoFalsa('dia', 'Dia de teste', 1, 2);
  dia.exercicios = dia.exercicios.map((e, i) => ({ ...e, nome: ['Supino de teste', 'Remada de teste'][i], modalidade: 'LIVRE', progressao: true, observacao: i === 1 ? observacaoDaRemada : null }));
  const conteudo: ConteudoTreino = { objetivo: null, orientacoes: null, sessoes: [dia] };
  let atual: Receita = { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino fictício', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    [`GET /receitas/${ID}`]: (_p, route) => json(route, atual),
    [`PUT /receitas/${ID}/conteudo`]: (p, route) => { atual = { ...atual, ...p.corpo as Receita, versao: atual.versao + 1 }; return json(route, atual); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  // O que o app mandou no último PUT (a resposta simulada só depois guarda o estado).
  return { ...api, salvo: () => (api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { conteudo: ConteudoTreino }).conteudo };
}

for (const largura of [390, 1280]) {
  test(`treino: criar grupo Superset com 2 exercícios pela folha (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirDiaDeTreino(page);
    await page.getByRole('button', { name: 'Criar grupo', exact: true }).click();
    const criar = page.getByRole('button', { name: 'Criar grupo', exact: true }).last();
    // Sem exercício marcado o botão está travado, com o motivo.
    await expect(criar).toBeDisabled();
    await expect(page.getByText('Pede de 2 a', { exact: false })).toBeVisible();
    await page.getByRole('checkbox', { name: '1. Supino de teste', exact: true }).check();
    await page.getByRole('checkbox', { name: '2. Remada de teste', exact: true }).check();
    await expect(criar).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('folha-criar-grupo.png'), fullPage: true });
    await criar.click();
    await expect(page.getByRole('button', { name: /^Desfazer o grupo Superset/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('grupo-criado.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const dia = api.salvo().sessoes[0];
    expect(dia.grupos).toHaveLength(1);
    expect(dia.grupos[0]).toMatchObject({ tecnica: 'SUPERSET' });
    expect(dia.exercicios.map((e) => e.grupoUid)).toEqual([dia.grupos[0].uid, dia.grupos[0].uid]);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`treino: "Adicionar cardio" cria o item de cardio pela folha, sem seletor de modalidade (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirDiaDeTreino(page);
    // O exercício não tem mais Modalidade, Alterar, Carga do exercício nem Progressão (04/11).
    await expect(page.getByText('Modalidade:', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Alterar modalidade', exact: true })).toHaveCount(0);
    await expect(page.getByText('Carga do exercício', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Progressão de carga', { exact: false })).toHaveCount(0);
    // O cardio entra pelo botão ao lado de "Adicionar exercício", na mesma folha da biblioteca.
    await page.getByRole('button', { name: 'Adicionar cardio', exact: true }).first().click();
    await expect(page.getByText('Escolher cardio', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar na biblioteca', exact: true }).fill('Esteira de teste');
    await page.getByRole('button', { name: 'Usar só o nome Esteira de teste, fora da biblioteca', exact: true }).click();
    await expect(page.getByText('Escolher cardio', { exact: true })).toHaveCount(0);
    // O novo fica escolhido: no estreito o cartão dele já nasce aberto.
    if (largura < 960) await expect(page.getByRole('button', { name: 'Fechar Esteira de teste', exact: true })).toBeVisible();
    await expect(page.getByText(/Cardio tem prescrição própria/)).toBeVisible();
    // Sem séries de força: só a prescrição de cardio.
    await expect(page.getByRole('button', { name: 'Adicionar série', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova série', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Novo cardio', exact: true }).click();
    await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('40');
    await page.getByRole('radio', { name: 'Zona 2', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('cardio.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const [supino, remada, esteira] = api.salvo().sessoes[0].exercicios;
    expect(esteira).toMatchObject({ nome: 'Esteira de teste', exercicioId: null, modalidade: 'CARDIO', unidade: 'nenhuma' });
    expect(esteira.series).toHaveLength(1);
    expect(esteira.series[0]).toMatchObject({ tipo: null, carga: null, esforco: null, tecnica: null, cardio: { duracaoMin: 40, zona: 2 } });
    // Os outros exercícios não mudam.
    expect([supino.modalidade, remada.modalidade]).toEqual(['LIVRE', 'LIVRE']);
    expect([supino.series.length, remada.series.length]).toEqual([3, 3]);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`treino: "Instruções, vídeo e cadência" fica fechado sem conteúdo e aberto com conteúdo (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirDiaDeTreino(page, 'Desça devagar, fictício.');
    const abrirExercicio = async (n: number, nome: string) => {
      if (largura >= 960) await page.getByRole('button', { name: new RegExp(`^Exercício ${n} de 2: ${nome}`) }).click();
      else await page.getByRole('button', { name: `Editar ${nome}`, exact: true }).click();
    };
    // 10/11: o nome de exibição entrou no mesmo recolhido, que diz o que já tem ("(com observação)").
    const extras = page.getByRole('button', { name: /^Nome de exibição e instruções/ });
    const observacao = page.getByRole('textbox', { name: 'Observação para o aluno', exact: true });
    // Supino sem instrução, vídeo nem cadência: fechado, e as séries vêm logo depois do nome.
    await abrirExercicio(1, 'Supino de teste');
    await expect(extras.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(observacao).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('extras-fechados.png'), fullPage: true });
    // Abre e fecha pelo botão.
    await extras.first().click();
    await expect(extras.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(observacao.first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true }).first()).toHaveValue('Supino de teste');
    await extras.first().click();
    await expect(observacao).toHaveCount(0);
    // Remada com observação: já abre aberto, com o texto.
    await abrirExercicio(2, 'Remada de teste');
    await expect(observacao.last()).toHaveValue('Desça devagar, fictício.');
    await expect(extras.last()).toHaveAttribute('aria-expanded', 'true');
    await expect(extras.last()).toHaveAccessibleName('Nome de exibição e instruções (com observação)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('extras-abertos.png'), fullPage: true });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
