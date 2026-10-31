import { expect, test, type Page } from '@playwright/test';
import type { Configuracao, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
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

const ID_METODOLOGIA = 'm0000000-0000-4000-8000-000000000010';
const ID_SERIES = 'm0000000-0000-4000-8000-000000000011';
const ID_PLANO = 'm0000000-0000-4000-8000-000000000012';

function receita(id: string, tipo: Receita['tipo'], nome: string, conteudo: unknown): Receita {
  return { id, tipo, nome, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo };
}

function serieDaPiramide(uid: string, reps: number, referencia: string | null): Serie {
  return {
    uid,
    tipo: 'WORKING',
    repsMin: reps,
    repsMax: reps,
    carga: referencia
      ? { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: 15, referenciaUid: referencia }
      : { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null },
    esforco: null,
    descansoSegundos: null,
    tecnica: { tipo: 'PIRAMIDE_DECRESCENTE' },
  };
}

async function abrirModelo(page: Page, atual: Receita, lista: (tipo: string | null) => Receita[], outras: Receita[] = []) {
  const porId = new Map([atual, ...outras].map((r) => [r.id, r]));
  const rotas: Record<string, (p: { corpo: unknown }, route: Parameters<typeof json>[0]) => Promise<void>> = {};
  for (const [id, item] of porId) {
    rotas[`GET /receitas/${id}`] = (_p, route) => json(route, item);
  }
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (p, route) => json(route, lista(p.busca.get('tipo'))),
    ...rotas,
    [`PUT /receitas/${atual.id}`]: (p, route) => {
      Object.assign(atual, p.corpo as Receita, { versao: atual.versao + 1 });
      return json(route, atual);
    },
  });
  await page.goto(`/treinador/planejamento/modelo/${atual.id}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return api;
}

for (const largura of [390, 1280]) {
  test(`catálogo: tipos da lista, desfazer e técnicas que permanecem (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const metodologia = receita(ID_METODOLOGIA, 'METODOLOGIA', 'Metodologia fictícia', structuredClone(CONFIGURACAO_PADRAO));
    const series = receita(ID_SERIES, 'SERIES', 'Séries fictícias', { series: [serieDaPiramide('serie-inicial', 8, null)] });
    const api = await abrirModelo(page, metodologia, (tipo) => (tipo === 'METODOLOGIA' ? [metodologia] : tipo === 'SERIES' ? [series] : []), [series]);

    await page.getByRole('button', { name: 'Adicionar da lista', exact: true }).first().click();
    await expect(page.getByRole('checkbox', { name: 'Aquecimento, já está na metodologia' })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Ativação', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Finalizadora', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar (2)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ativação, recolhido', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalizadora, recolhido', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remover o tipo Ativação', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ativação, recolhido', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ativação, recolhido', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Remover a técnica Forced reps', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar da lista', exact: true }).nth(1).click();
    await page.getByRole('checkbox', { name: '21s', exact: true }).click();
    await page.getByRole('checkbox', { name: 'GVT (10×10)', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar (2)', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    await expect(page.getByText('Modelo salvo.', { exact: true })).toBeVisible();
    await page.goto(`/treinador/planejamento/modelo/${ID_METODOLOGIA}`);
    await expect(page.getByRole('button', { name: '21s, recolhido', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GVT (10×10), recolhido', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forced reps, recolhido', exact: true })).toHaveCount(0);

    await page.goto(`/treinador/planejamento/modelo/${ID_SERIES}`);
    await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await expect(page.getByRole('button', { name: '21s', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GVT (10×10)', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forced reps', exact: true })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`catálogo: criar grupo sem combinações e pirâmide decrescente (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const semCombinacao: Configuracao = { ...structuredClone(CONFIGURACAO_PADRAO), combinacoes: [] };
    const exercicio = (uid: string, nome: string) => ({
      uid, exercicioId: null, nome, modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null,
      series: [serieDaPiramide(`${uid}-s`, 8, null)],
    });
    const plano = receita(ID_PLANO, 'PLANO_TREINO', 'Semana fictícia', {
      objetivo: null,
      orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: semCombinacao },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [exercicio('ex-1', 'Supino fictício'), exercicio('ex-2', 'Remada fictícia')],
      }],
    });
    const piramide = receita('m0000000-0000-4000-8000-000000000013', 'SERIES', 'Pirâmide decrescente', {
      series: [
        serieDaPiramide('11111111-1111-4111-8111-111111111111', 8, null),
        serieDaPiramide('22222222-2222-4222-8222-222222222222', 10, '11111111-1111-4111-8111-111111111111'),
        serieDaPiramide('33333333-3333-4333-8333-333333333333', 12, '22222222-2222-4222-8222-222222222222'),
      ],
    });
    const api = await abrirModelo(page, plano, (tipo) => (tipo === 'SERIES' ? [piramide] : []));
    await expect(page.getByText('A metodologia não tem combinações.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar grupo', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Editar Supino fictício', exact: true }).click();
    await page.getByRole('button', { name: 'Usar receita', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar receita Pirâmide decrescente', exact: true }).click();
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^1x10 - WS \+ Pirâmide decrescente 10% a 15% abaixo da referência/)).toBeVisible();
    // As três séries têm o mesmo título ("Trabalho · WS + Pirâmide decrescente"); a de 10 reps é a segunda faixa.
    await page.getByRole('button', { name: 'Trabalho · WS + Pirâmide decrescente, recolhido', exact: true }).nth(1).click();
    await expect(page.getByRole('button', { name: 'Série 1 · WS', exact: true })).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
