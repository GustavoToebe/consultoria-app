import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ConteudoMobilidadeApi, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Sobras do editor em lista + inspetor (`docs/planos/editor-treino-inspetor.md`, S1 a S5): o grupo de exercícios abre no
 * inspetor, a prescrição da série lado a lado conforme a largura, e a dieta e a mobilidade no mesmo layout. Duas colunas a
 * partir de 960 px de conteúdo (1440 e 1280); 1024 e 390 empilham. Dados fictícios. Com `CAPTURAS=<pasta>`, guarda as telas.
 */

const LARGURAS = [1440, 1280, 1024, 390] as const;
const duasColunas = (largura: number) => largura >= 1280;

async function tema(page: Page, escuro: boolean) {
  if (!escuro) return;
  await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  // A rolagem é de um ScrollView: a tela alta mostra o editor inteiro numa captura.
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 2600 });
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

// ---- Treino: grupo no inspetor e prescrição lado a lado ----

async function abrirTreino(page: Page) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByRole('textbox', { name: 'Nome da sessão' })).toHaveValue('Peito e tríceps');
  return api;
}

for (const largura of LARGURAS) {
  test(`treino: linha do grupo compacta e a edição do grupo ${duasColunas(largura) ? 'no inspetor' : 'embaixo dela'} (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirTreino(page);
    const linha = page.getByRole('button', { name: /^Grupo Superset/ });
    await expect(linha).toBeVisible();
    // Fechado, a lista não traz os controles do grupo.
    await expect(page.getByRole('button', { name: /^Desfazer o grupo Superset/ })).toHaveCount(0);
    await linha.click();
    await expect(page.getByRole('button', { name: /^Desfazer o grupo Superset/ })).toBeVisible();
    await expect(page.getByLabel(/Descanso depois do grupo/).first()).toHaveValue('90');
    if (duasColunas(largura)) {
      // O grupo toma o lugar do exercício no inspetor; escolher um exercício volta a ele.
      await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toHaveCount(0);
      await page.getByRole('button', { name: /^Exercício 1 de 7: Supino reto com barra/ }).click();
      await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Desfazer o grupo Superset/ })).toHaveCount(0);
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const [largura, escuro] of [[1440, false], [1280, false], [1280, true], [1024, false], [390, false], [390, true]] as const) {
  test(`treino: Repetições, Carga, Esforço e Descanso ${largura >= 1024 ? 'de duas em duas' : 'uma por linha'} (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, escuro);
    const { naoTratadas, errosDaPagina } = await abrirTreino(page);
    if (!duasColunas(largura)) await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    const caixa = async (nome: string) => {
      const b = await page.getByRole('heading', { name: nome, exact: true }).first().boundingBox();
      if (!b) throw new Error(`sem ${nome}`);
      return b;
    };
    const [rep, carga, esforco, descanso] = [await caixa('Repetições'), await caixa('Carga'), await caixa('Esforço'), await caixa('Descanso')];
    if (largura >= 1024) {
      // 2 + 2: Repetições ao lado da Carga, Esforço ao lado do Descanso, e a carga de cada série numa linha embaixo.
      expect(Math.abs(rep.y - carga.y)).toBeLessThan(2);
      expect(carga.x).toBeGreaterThan(rep.x + 100);
      expect(Math.abs(esforco.y - descanso.y)).toBeLessThan(2);
      expect(esforco.y).toBeGreaterThan(rep.y + 40);
      await expect(page.getByRole('heading', { name: 'Carga de cada série', exact: true })).toBeVisible();
    } else {
      expect(carga.y).toBeGreaterThan(rep.y + 40);
      expect(Math.abs(rep.x - carga.x)).toBeLessThan(2);
      expect(descanso.y).toBeGreaterThan(esforco.y + 40);
    }
    await capturar(page, `treino-${largura}${escuro ? '-escuro' : ''}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- Dieta ----

const DIETA_ID = 'p0000000-0000-4000-8000-0000000000d1';

function alimento(uid: string, nome: string, kcal: number): ItemDieta {
  return { uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal, proteina: 10, carboidrato: 20, gordura: 5, manual: true };
}

const DIETA: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'c-a', rotulo: 'A', itens: [alimento('pao', 'Pão fictício', 150)] }] },
    {
      uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null,
      opcoes: [
        { uid: 'a-a', rotulo: 'A', itens: [alimento('arroz', 'Arroz fictício', 190)] },
        { uid: 'a-b', rotulo: 'B', itens: [alimento('batata', 'Batata fictícia', 170)] },
      ],
    },
  ],
};

const DETALHE_DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: DIETA_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: DIETA,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000d1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

for (const [largura, escuro] of [[1440, false], [1280, false], [1280, true], [1024, false], [390, false], [390, true]] as const) {
  test(`dieta: refeições ${duasColunas(largura) ? 'na lista e a escolhida no inspetor' : 'empilhadas, abrindo uma a uma'} (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DETALHE_DIETA },
    });
    await page.goto(`/treinador/dietas/${DIETA_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const itemDaLista = (n: number, titulo: string) => page.getByRole('button', { name: new RegExp(`^Refeição ${n} de 2: ${titulo}`) });
    if (duasColunas(largura)) {
      await expect(itemDaLista(1, '07:00 · Café da manhã')).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('heading', { name: '07:00 · Café da manhã', level: 3 })).toBeVisible();
      await expect(page.getByRole('button', { name: /Abrir todas|Fechar todas/ })).toHaveCount(0);
      await itemDaLista(2, '12:00 · Almoço').click();
      await expect(itemDaLista(2, '12:00 · Almoço')).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('textbox', { name: 'Nome' }).first()).toHaveValue('Almoço');
      // As duas opções do almoço cabem lado a lado no inspetor.
      const [a, b] = [await page.getByRole('heading', { name: 'Opção A' }).boundingBox(), await page.getByRole('heading', { name: 'Opção B' }).boundingBox()];
      if (!a || !b) throw new Error('sem opção');
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      // Adicionar escolhe a refeição nova.
      await page.getByRole('button', { name: 'Adicionar refeição' }).click();
      await expect(page.getByRole('button', { name: /^Refeição 3 de 3: Refeição 3/ })).toHaveAttribute('aria-current', 'true');
    } else {
      await expect(page.getByRole('button', { name: /^Refeição \d de/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir todas' })).toBeVisible();
      await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
      await expect(page.getByRole('heading', { name: 'Opção B' })).toBeVisible();
      await expect(page.getByRole('button', { name: '07:00 · Café da manhã, fechado' })).toBeVisible();
    }
    await capturar(page, `dieta-${largura}${escuro ? '-escuro' : ''}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- Mobilidade ----

const MOB_ID = 'p0000000-0000-4000-8000-0000000000e1';

const MOBILIDADE: ConteudoMobilidadeApi = {
  orientacoes: null,
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: [
      { uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null },
      { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null },
    ] },
    // Item sem nome: a lista marca a seção para corrigir (é o que trava o salvar).
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: '', prescricao: '30s', videoUrl: null }] },
  ],
};

const DETALHE_MOB: PlanoDetalhe<ConteudoMobilidadeApi> = {
  plano: {
    id: MOB_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: MOBILIDADE,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000e1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

for (const [largura, escuro] of [[1440, false], [1280, false], [1280, true], [1024, false], [390, false], [390, true]] as const) {
  test(`mobilidade: seções ${duasColunas(largura) ? 'na lista e a escolhida no inspetor' : 'empilhadas'} (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: DETALHE_MOB },
    });
    await page.goto(`/treinador/mobilidades/${MOB_ID}`);
    await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const secao1 = page.getByRole('textbox', { name: 'Seção 1' });
    const secao2 = page.getByRole('textbox', { name: 'Seção 2' });
    if (duasColunas(largura)) {
      const item1 = page.getByRole('button', { name: 'Seção 1 de 2: Aquecimento. 2 itens: Gato-vaca, Lunge' });
      const item2 = page.getByRole('button', { name: 'Seção 2 de 2: Alongamento, corrigir. 1 item' });
      await expect(item1).toHaveAttribute('aria-current', 'true');
      await expect(item2).toBeVisible();
      await expect(secao1).toHaveValue('Aquecimento');
      await expect(secao2).toHaveCount(0);
      await item2.click();
      await expect(secao2).toHaveValue('Alongamento');
      await expect(secao1).toHaveCount(0);
      await page.getByRole('button', { name: 'Adicionar seção' }).click();
      await expect(page.getByRole('textbox', { name: 'Seção 3' })).toHaveValue('');
      await expect(page.getByRole('button', { name: /^Seção 3 de 3: Seção 3/ })).toHaveAttribute('aria-current', 'true');
    } else {
      await expect(page.getByRole('button', { name: /^Seção \d de/ })).toHaveCount(0);
      await expect(secao1).toHaveValue('Aquecimento');
      await expect(secao2).toHaveValue('Alongamento');
    }
    await capturar(page, `mobilidade-${largura}${escuro ? '-escuro' : ''}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
