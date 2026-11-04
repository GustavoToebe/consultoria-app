import { expect, test, type Page } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { CLARO, ESCURO, PALETA_DE_IDENTIFICACAO, tingido } from '../src/tema/tokens';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Clareza do editor de treino (reunião de 30/10): posição do exercício por extenso, mover exercício × mover grupo,
// percentuais por série e a folha de receitas de séries. Só dados fictícios; nada chega ao banco.
const ID_PLANO = 'm0000000-0000-4000-8000-000000000030';
const PASTA_FORCA = 'p0000000-0000-4000-8000-000000000031';

const semCarga = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null, referenciaUid: null };
const daWs = (percentualMin: number, percentualMax: number | null) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin, percentualMax, referenciaUid: null });
const serie = (uid: string, tipo: string, extra: Partial<Serie> = {}): Serie => ({
  uid, tipo, repsMin: 3, repsMax: 3, carga: semCarga, esforco: null, descansoSegundos: null, tecnica: null, ...extra,
});

/** Três FS com percentuais diferentes por série e uma WS: "3x3 - FS 50% · 70% · 85% a 90% da WS". */
const seriesDoAgachamento: Serie[] = [
  serie('fs-1', 'FEEDER', { carga: daWs(50, null) }),
  serie('fs-2', 'FEEDER', { carga: daWs(70, null) }),
  serie('fs-3', 'FEEDER', { carga: daWs(85, 90) }),
  serie('ws-1', 'WORKING', { repsMin: 3, repsMax: 6, esforco: { rir: 1, rpe: null } }),
];

const receita = (id: string, nome: string, series: Serie[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', nome, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series }, ...extra,
});

const receitas: Receita[] = [
  receita('m0000000-0000-4000-8000-000000000032', 'Força com preparação', [
    serie('r1-fs', 'FEEDER', { repsMin: 5, repsMax: 5, carga: daWs(60, null) }),
    serie('r1-ws', 'WORKING', { repsMin: 4, repsMax: 6 }),
  ], { pastaId: PASTA_FORCA, descricao: 'Uma de preparação e uma de trabalho.' }),
  receita('m0000000-0000-4000-8000-000000000033', 'Volume fictício', [
    serie('r2-ws', 'WORKING', { repsMin: 8, repsMax: 10 }),
    serie('r2-bo1', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: 'r2-ws' } }),
    serie('r2-bo2', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: 'r2-ws' } }),
  ]),
];

async function planoComDoisExercicios(page: Page, listaDeReceitas: Receita[] = receitas) {
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [
          { uid: 'ex-1', exercicioId: null, nome: 'Agachamento fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: seriesDoAgachamento },
          { uid: 'ex-2', exercicioId: null, nome: 'Remada fictícia', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: [serie('ws-r', 'WORKING', { repsMin: 8, repsMax: 12 })] },
        ],
      }],
    },
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [{ id: PASTA_FORCA, nome: 'Força', versao: 1 }] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'SERIES' ? listaDeReceitas : []),
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
    [`PUT /receitas/${ID_PLANO}/conteudo`]: (p, route) => { Object.assign(plano, p.corpo as Receita, { versao: plano.versao + 1 }); return json(route, plano); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return api;
}

/**
 * Em duas colunas (1280) o exercício se escolhe tocando no item da lista; no estreito (390) o título do cartão abre e fecha
 * (um por vez). O item da lista tem a posição e o total no nome acessível.
 */
async function escolherExercicio(page: Page, largura: number, posicao: number, total: number, nome: string) {
  if (largura >= 960) await page.getByRole('button', { name: new RegExp(`^Exercício ${posicao} de ${total}: ${nome}`) }).click();
  else await page.getByRole('button', { name: `Editar ${nome}`, exact: true }).click();
}

const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [390, 1280]) {
  test(`editor: posição do exercício, mover exercício × grupo e percentuais por série (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComDoisExercicios(page);
    // Contadores: o plano inteiro e a sessão aberta, separados.
    await expect(page.getByText('Plano inteiro: 1 sessão · 2 exercícios · 5 séries cadastradas', { exact: true })).toBeVisible();
    await expect(page.getByText('Sessão aberta: 2 exercícios · 5 séries', { exact: true })).toBeVisible();
    // A posição por extenso, sem confundir com o número da série: no estreito, em texto pequeno no alto de cada cartão, com
    // o nome embaixo; em duas colunas, no nome acessível de cada item da lista (e no alto do exercício escolhido).
    await expect(page.getByText(/^Exercício 1 de 2( ·|$)/).first()).toBeVisible();
    if (largura >= 960) {
      await expect(page.getByRole('button', { name: /^Exercício 1 de 2: Agachamento fictício/ })).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('button', { name: /^Exercício 2 de 2: Remada fictícia/ })).toBeVisible();
    } else {
      await expect(page.getByText(/^Exercício 2 de 2( ·|$)/).first()).toBeVisible();
    }
    await escolherExercicio(page, largura, 1, 2, 'Agachamento fictício');
    // Subir e descer o exercício levam o nome dele; os da série, "série N". O primeiro não sobe.
    await expect(page.getByRole('button', { name: 'Subir Agachamento fictício', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Descer Agachamento fictício', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Subir série 1', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Descer série 1', exact: true })).toBeEnabled();
    // Só a seta, em todas as larguras (o nome acessível diz o quê).
    await expect(page.getByText('Mover exercício', { exact: true })).toHaveCount(0);
    // O grupo: uma aba por grupo ("Série 1 · FS"), já aberta no 1º; o título dele diz o tipo e os percentuais de cada série.
    await expect(page.getByRole('tab', { name: /^Série 1 · FS/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/3x3 - FS 50% · 70% · 85% a 90% da WS/).first()).toBeVisible();
    // A série aberta diz o que se edita; a faixa "Exercício 1 · nome" saiu (o exercício já está no alto do cartão).
    await expect(page.getByText('Editando: Série 1 · Preparação · FS', { exact: true })).toBeVisible();
    await expect(page.getByText('Exercício 1 · Agachamento fictício', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Série 3 · Mínimo (%)', exact: true })).toHaveValue('85');
    await expect(page.getByRole('textbox', { name: 'Série 3 · Máximo (%)', exact: true })).toHaveValue('90');
    expect(await semRolagemDeLado(page)).toBe(true);
    // C2: o lixo do exercício (IconeBotao com moldura) tem 44×44 de alvo e a moldura de 40 centrada.
    const lixo = page.getByRole('button', { name: 'Remover Agachamento fictício', exact: true });
    const alvo = (await lixo.boundingBox())!;
    expect(Math.min(alvo.width, alvo.height)).toBeGreaterThanOrEqual(43.5);
    const desenho = (await lixo.locator(':scope > div').first().boundingBox())!;
    expect([Math.round(desenho.width), Math.round(desenho.height)]).toEqual([40, 40]);
    await page.screenshot({ path: testInfo.outputPath('editor-clareza.png'), fullPage: true });
    // Descer a série 1 (o grupo FS) muda só a ordem das séries do exercício.
    await page.getByRole('button', { name: 'Descer série 1', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const corpo = api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { conteudo: { sessoes: { exercicios: { nome: string; series: Serie[] }[] }[] } };
    const [agachamento, remada] = corpo.conteudo.sessoes[0].exercicios;
    expect(agachamento.nome).toBe('Agachamento fictício');
    expect(agachamento.series.map((s) => s.uid)).toEqual(['ws-1', 'fs-1', 'fs-2', 'fs-3']);
    expect(remada.series.map((s) => s.uid)).toEqual(['ws-r']);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`editor: receita de séries com busca, sequência, aviso, aplicar e desfazer (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComDoisExercicios(page);
    await escolherExercicio(page, largura, 2, 2, 'Remada fictícia');
    await page.getByRole('button', { name: 'Usar uma receita de séries', exact: true }).click();
    // Agrupadas por bloco e técnica (Frente G, D16): as duas têm mais de um papel e nenhuma técnica, então são
    // "Receitas completas"; cada uma com a composição, a sequência, a coleção e o aviso de que substitui as séries.
    await expect(page.getByRole('button', { name: 'Receitas completas, aberto', exact: true })).toBeVisible();
    await expect(page.getByText('Coleção: Força', { exact: true })).toBeVisible();
    await expect(page.getByText('Coleção: Sem coleção', { exact: true })).toBeVisible();
    await expect(page.getByText('FS ×1 · WS ×1', { exact: true })).toBeVisible();
    await expect(page.getByText('WS ×1 · Back off ×2', { exact: true })).toBeVisible();
    await expect(page.getByText('Sequência', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(2);
    // Busca pela composição ("back off") e pelo nome, sem acento.
    const busca = page.getByRole('textbox', { name: 'Buscar receita', exact: true });
    await busca.fill('back off');
    await expect(page.getByText('Volume fictício', { exact: true })).toBeVisible();
    await expect(page.getByText('Força com preparação', { exact: true })).toHaveCount(0);
    await busca.fill('forca');
    await expect(page.getByText('Força com preparação', { exact: true })).toBeVisible();
    await expect(page.getByText('Volume fictício', { exact: true })).toHaveCount(0);
    await busca.fill('nada assim');
    await expect(page.getByText('Nenhuma receita com essa busca.', { exact: true })).toBeVisible();
    await busca.fill('back off');
    expect(await semRolagemDeLado(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('folha-receitas.png'), fullPage: true });
    await page.getByRole('button', { name: 'Aplicar receita Volume fictício', exact: true }).click();
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Receita “Volume fictício” aplicada.', { exact: true })).toBeVisible();
    // A receita vira duas abas (uma por grupo); a aberta é a última, o título dela traz a faixa dos números.
    await expect(page.getByRole('tab', { name: /^Série \d/ })).toHaveCount(2);
    await expect(page.getByText(/2x10 a 12 - Back off/).first()).toBeVisible();
    await page.getByRole('tab', { name: /^Série 1 · WS/ }).click();
    await expect(page.getByText(/1x8 a 10 - WS/).first()).toBeVisible();
    // Desfazer volta as séries de antes.
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(page.getByRole('tab', { name: /^Série \d/ })).toHaveCount(1);
    await expect(page.getByText(/2x10 a 12 - Back off/)).toHaveCount(0);
    await expect(page.getByText(/1x8 a 12 - WS/).first()).toBeVisible();
    // Nada foi gravado: aplicar e desfazer só mexem no rascunho da tela.
    expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

/* Frente G, passo 6 (D16, C16): "Usar receita" em seções por bloco e técnica, cada receita uma vez, com a sequência
 * colorida por tipo (selo de texto + cor). */
const cluster = { tipo: 'CLUSTER' as const, pausaSegundos: 15, blocos: [4, 4] };
const restPause = { tipo: 'REST_PAUSE' as const, pausaSegundos: 20, pausas: 1 };
const RECEITAS_EM_BLOCOS: Receita[] = [
  receitas[0],
  receita('m0000000-0000-4000-8000-000000000040', 'Aquecimento fictício', [serie('aq', 'WARM_UP', { repsMin: 10, repsMax: 15 })]),
  receita('m0000000-0000-4000-8000-000000000041', 'Back off fictício', [serie('bo', 'BACK_OFF', { repsMin: 8, repsMax: 10 })]),
  receita('m0000000-0000-4000-8000-000000000042', 'Cluster fictício', [serie('cl', 'WORKING', { repsMin: 8, repsMax: 8, tecnica: cluster })]),
  receita('m0000000-0000-4000-8000-000000000043', 'Rest pause fictício', [serie('rp', 'WORKING', { repsMin: 6, repsMax: 8, tecnica: restPause })]),
];
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

for (const nomeDoTema of ['claro', 'escuro'] as const) {
  for (const largura of [390, 1280]) {
    test(`usar receita: seções por bloco e técnica, sequência colorida por tipo (${nomeDoTema}, ${largura}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, nomeDoTema === 'escuro' ? 'ESCURO' : 'CLARO']);
      const api = await planoComDoisExercicios(page, RECEITAS_EM_BLOCOS);
      await escolherExercicio(page, largura, 2, 2, 'Remada fictícia');
      await page.getByRole('button', { name: 'Usar uma receita de séries', exact: true }).click();
      // Completas primeiro, depois os papéis e as técnicas; cada receita uma vez.
      const secoes = page.getByRole('button', { name: /, (aberto|recolhido)$/ }).filter({ hasText: /^(Receitas completas|Aquecimento|Pós-trabalho|Técnica: .*)/ });
      await expect(secoes).toHaveText([/^Receitas completas/, /^Aquecimento/, /^Pós-trabalho/, /^Técnica: Rest pause/, /^Técnica: Cluster/]);
      for (const nome of ['Força com preparação', 'Aquecimento fictício', 'Back off fictício', 'Cluster fictício', 'Rest pause fictício']) {
        await expect(page.getByText(nome, { exact: true })).toHaveCount(1);
      }
      // O selo do tipo na cor dele (FS azul, WS índigo, Back off magenta, Aquecimento ciano), com o nome escrito.
      const paleta = PALETA_DE_IDENTIFICACAO[nomeDoTema];
      for (const [tipo, cor] of [['FS', paleta.AZUL], ['WS', paleta.INDIGO], ['Back off', paleta.MAGENTA], ['Aquecimento', paleta.CIANO]] as const) {
        await expect(page.getByText(tipo, { exact: true }).last()).toHaveCSS('color', rgb(cor));
      }
      // Recolher uma seção esconde as receitas dela; a busca procura em todas e reabre.
      await page.getByRole('button', { name: 'Aquecimento, aberto', exact: true }).click();
      await expect(page.getByText('Aquecimento fictício', { exact: true })).toHaveCount(0);
      const busca = page.getByRole('textbox', { name: 'Buscar receita', exact: true });
      await busca.fill('cluster');
      await expect(page.getByText('Cluster fictício', { exact: true })).toBeVisible();
      await expect(page.getByText('Rest pause fictício', { exact: true })).toHaveCount(0);
      await busca.fill('aquecimento');
      await expect(page.getByText('Aquecimento fictício', { exact: true })).toBeVisible();
      await busca.fill('');
      expect(await semRolagemDeLado(page)).toBe(true);
      await page.getByText('Cluster fictício', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`usar-receita-${nomeDoTema}-${largura}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Aplicar receita Back off fictício', exact: true }).click();
      await expect(page.getByText('Receita “Back off fictício” aplicada.', { exact: true })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  }
}

// D4 de `docs/planos/auditoria-cores.md`: o selo tem fundo opaco (`tingido` da própria cor), não transparente, para o
// contraste não depender da faixa onde ele está. O "Fora da biblioteca" é um selo neutro na faixa do exercício.
for (const [tema, cores] of [['CLARO', CLARO], ['ESCURO', ESCURO]] as const) {
  test(`editor: selo na faixa do exercício com fundo opaco (${tema.toLowerCase()})`, async ({ page }) => {
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
    await planoComDoisExercicios(page);
    const fundo = tingido(cores.neutro, cores.superficie);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fundo.slice(i, i + 2), 16));
    const selo = page.getByText('Fora da biblioteca', { exact: true }).first();
    await expect(selo).toBeVisible();
    await expect(selo.locator('..')).toHaveCSS('background-color', `rgb(${r}, ${g}, ${b})`);
  });
}

for (const largura of [390, 1280]) {
  test(`editor: remover a sessão fica no ⋯, com "Desfazer", e "Adicionar exercício" vem primeiro (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComDoisExercicios(page);
    // Remover a sessão não é mais um botão solto no rodapé: fica só no ⋯ do cabeçalho.
    await expect(page.getByRole('button', { name: 'Remover sessão', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mais ações da sessão/ })).toHaveCount(1);
    await page.getByRole('button', { name: 'Adicionar sessão', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remover sessão', exact: true })).toHaveCount(0);
    // O primeiro controle da linha de adição é "Adicionar exercício".
    const adicionar = (await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).boundingBox())!;
    const modelos = (await page.getByRole('button', { name: 'Modelos prontos', exact: true }).boundingBox())!;
    expect(adicionar.y < modelos.y || (adicionar.y === modelos.y && adicionar.x < modelos.x)).toBe(true);
    await page.getByRole('button', { name: /^Mais ações da sessão/ }).first().click();
    await page.getByText('Remover sessão', { exact: true }).click();
    await expect(page.getByText(/Sessão “.*” removida\./)).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Mais ações da sessão/ }).first()).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
