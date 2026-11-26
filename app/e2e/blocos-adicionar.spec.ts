import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ConteudoMobilidadeApi, ItemDieta, PlanoDetalhe, Refeicao } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { ALUNO_ID as ALUNO_DO_TREINO, BIBLIOTECA, PLANO_ID as PLANO_DO_TREINO, planoDetalhe } from './editor-inspetor.dados';

/**
 * Blocos "Adicionar próxima refeição" (dieta), "Adicionar próximo exercício" (treino) e "Adicionar próxima seção"
 * (mobilidade) no fim da lista (26/11): botões um embaixo do outro, na largura útil do bloco, mesma altura, ícone e rótulo
 * alinhados à esquerda (`BotaoDoBloco`); "Adicionar refeição/exercício/seção" é `acao` e os demais `secundario`. Medidas
 * com `boundingBox`/`getBoundingClientRect`; os cliques ainda fazem a ação. Com `CAPTURAS=<pasta>`, guarda as telas do
 * bloco (1280, escuro e claro; a mobilidade só no escuro). Dados fictícios.
 */

// Bloco: borda de 1 px + padding de `espaco(2)` = 16 em cada lado (`BlocoAdicionar`).
const RECUO = 1 + 16;
// Botão: borda de 1 px + `paddingHorizontal: espaco(2)` (`Botao`).
const RECUO_DO_BOTAO = 1 + 16;

const DIETA_ID = 'p0000000-0000-4000-8000-0000000000d1';
const DIETA_ALUNO = 'a0000000-0000-4000-8000-0000000000d2';
const MOB_ID = 'p0000000-0000-4000-8000-0000000000m1';
const MOB_ALUNO = 'a0000000-0000-4000-8000-0000000000m1';

type Tema = 'CLARO' | 'ESCURO';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const temaDaPreferencia = (page: Page, tema: Tema) => (tema === 'ESCURO'
  ? page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id])
  : Promise.resolve());

// ---- Dieta ----
const alimento = (id: string, nome: string, kcal: number): Alimento =>
  ({ id, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: 5, carboidrato: 20, gordura: 2, gramasPorUnidade: null, fonte: null, origem: 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo: null });
const PAO = alimento('pao', 'Pão fictício', 266);
const ARROZ = alimento('arroz', 'Arroz fictício', 128);
const item = (uid: string, a: Alimento, quantidade: number): ItemDieta => {
  const f = quantidade / 100;
  return { uid, alimentoId: a.id, nome: a.nome, quantidade, unidade: 'g', kcal: (a.kcal ?? 0) * f, proteina: 5 * f, carboidrato: 20 * f, gordura: 2 * f, manual: false };
};
const refeicao = (uid: string, nome: string, a: Alimento): Refeicao =>
  ({ uid, nome, horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: [item(`${uid}-i`, a, 100)] }] });
const CONTEUDO_DIETA: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [refeicao('cafe', 'Café da manhã', PAO), refeicao('almoco', 'Almoço', ARROZ)], variacoes: [],
};
const detalheDaDieta: PlanoDetalhe<ConteudoDieta> = {
  plano: { id: DIETA_ID, alunoId: DIETA_ALUNO, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1 },
  rascunho: CONTEUDO_DIETA,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000d3', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

async function abrirDieta(page: Page, largura: number, tema: Tema = 'CLARO') {
  await page.setViewportSize({ width: largura, height: 900 });
  await temaDaPreferencia(page, tema);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'BIBLIOTECA_LER', 'MODELO_LER', 'MODELO_APLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': (p: PedidoFalso, route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(p.busca.get('tipo') === 'SUPLEMENTO' ? [] : [PAO, ARROZ]) }),
    'GET /alimentos/fatores': { corpo: [] },
    'GET /receitas': { corpo: [] },
    'GET /pastas-modelos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${DIETA_ALUNO}`]: { corpo: { id: DIETA_ALUNO, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${DIETA_ALUNO}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-dieta/${DIETA_ID}`]: { corpo: detalheDaDieta },
  });
  await page.goto(`/treinador/dietas/${DIETA_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
  return api;
}

// ---- Treino ----
async function abrirTreino(page: Page, largura: number, tema: Tema = 'CLARO') {
  await page.setViewportSize({ width: largura, height: 900 });
  await temaDaPreferencia(page, tema);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'MODELO_LER', 'MODELO_APLICAR'] })),
    [`GET /alunos/${ALUNO_DO_TREINO}`]: { corpo: { id: ALUNO_DO_TREINO, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_DO_TREINO}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /receitas': { corpo: [] },
    'GET /pastas-modelos': { corpo: [] },
    [`GET /planos-treino/${PLANO_DO_TREINO}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
  await page.goto(`/treinador/treinos/${PLANO_DO_TREINO}`);
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
  return api;
}

// ---- Mobilidade ----
const MOBILIDADE: ConteudoMobilidadeApi = {
  orientacoes: 'Antes do treino.',
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: [{ uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null }, { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s', videoUrl: null }] },
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: 'Posterior', prescricao: '30s', videoUrl: null }] },
  ],
};

async function abrirMobilidade(page: Page, largura: number, tema: Tema = 'CLARO') {
  await page.setViewportSize({ width: largura, height: 900 });
  await temaDaPreferencia(page, tema);
  const detalhe: PlanoDetalhe<ConteudoMobilidadeApi> = {
    plano: { id: MOB_ID, alunoId: MOB_ALUNO, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
      versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1 },
    rascunho: MOBILIDADE, versoes: [],
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${MOB_ALUNO}`]: { corpo: { id: MOB_ALUNO, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${MOB_ALUNO}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: detalhe },
  });
  await page.goto(`/treinador/mobilidades/${MOB_ID}`);
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  return api;
}

// ---- Medidas ----
interface Caixa { x: number; y: number; w: number; h: number }
interface Medida {
  bloco: Caixa;
  botoes: { nome: string; caixa: Caixa; icone: Caixa | null; rotulo: Caixa | null; fundo: string }[];
}

/** Mede o bloco tracejado (o ancestral do título com borda `dashed`) e cada botão dentro dele, com o ícone e o rótulo. */
async function medir(page: Page, titulo: string): Promise<Medida> {
  const alvo = page.getByText(titulo, { exact: true }).first();
  await expect(alvo).toBeVisible();
  const medida = await alvo.evaluate((t) => {
    let bloco: HTMLElement | null = t as HTMLElement;
    while (bloco && getComputedStyle(bloco).borderTopStyle !== 'dashed') bloco = bloco.parentElement;
    if (!bloco) return null;
    const caixa = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const botoes = Array.from(bloco.querySelectorAll<HTMLElement>('[role="button"], button')).map((b) => {
      const svg = b.querySelector('svg');
      const rotulo = Array.from(b.querySelectorAll('*')).find((e) => e.children.length === 0 && !e.closest('svg') && (e.textContent ?? '').trim() !== '');
      return {
        nome: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim(), caixa: caixa(b),
        icone: svg ? caixa(svg) : null, rotulo: rotulo ? caixa(rotulo) : null, fundo: getComputedStyle(b).backgroundColor,
      };
    });
    return { bloco: caixa(bloco), botoes };
  });
  expect(medida, `bloco "${titulo}" com borda tracejada`).not.toBeNull();
  return medida!;
}

/** O que vale em toda largura e em todo editor: empilhados, mesma largura (a útil do bloco), alinhados à esquerda, mesma altura e tipo certo. */
async function conferir(page: Page, titulo: string, nomes: string[], tema: Tema) {
  const m = await medir(page, titulo);
  expect(m.botoes.map((b) => b.nome)).toEqual(nomes);
  const util = m.bloco.w - 2 * RECUO;
  const cores = PALETAS[tema].cores;
  m.botoes.forEach((b, i) => {
    // Largura = a útil do bloco, encostada no padrão esquerdo.
    expect(Math.abs(b.caixa.w - util), `${b.nome}: largura ${b.caixa.w} x útil ${util}`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.caixa.x - (m.bloco.x + RECUO)), `${b.nome}: x`).toBeLessThanOrEqual(1);
    // Empilhados: cada um começa onde o anterior termina.
    if (i > 0) expect(b.caixa.y, `${b.nome} abaixo de ${m.botoes[i - 1].nome}`).toBeGreaterThanOrEqual(m.botoes[i - 1].caixa.y + m.botoes[i - 1].caixa.h - 1);
    // Ícone e rótulo à esquerda: o ícone no padding do botão, o rótulo logo depois (nunca centralizados).
    expect(b.icone, `${b.nome}: ícone`).not.toBeNull();
    expect(b.icone!.x - b.caixa.x, `${b.nome}: ícone na esquerda`).toBeLessThanOrEqual(RECUO_DO_BOTAO + 2);
    expect(b.rotulo!.x - (b.icone!.x + b.icone!.w), `${b.nome}: rótulo depois do ícone`).toBeLessThanOrEqual(12);
    expect(b.rotulo!.x + b.rotulo!.w, `${b.nome}: rótulo dentro do botão`).toBeLessThanOrEqual(b.caixa.x + b.caixa.w);
  });
  // Mesma coluna para o ícone e para o rótulo em todos os botões.
  for (const b of m.botoes) {
    expect(Math.abs(b.icone!.x - m.botoes[0].icone!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.rotulo!.x - m.botoes[0].rotulo!.x)).toBeLessThanOrEqual(1);
  }
  // Mesma altura (a de uma linha só; rótulo de duas linhas pode ser mais alto).
  const umaLinha = m.botoes.filter((b) => b.rotulo!.h < 30);
  for (const b of umaLinha) expect(Math.abs(b.caixa.h - umaLinha[0].caixa.h), `${b.nome}: altura`).toBeLessThanOrEqual(1);
  // Tipos: o primeiro é `acao` (fundo `acaoSuave`), os demais `secundario` (fundo `superficie2`).
  m.botoes.forEach((b, i) => expect(b.fundo, `${b.nome}: fundo (${i === 0 ? 'acao' : 'secundario'})`).toBe(rgb(i === 0 ? cores.acaoSuave : cores.superficie2)));
  // O bloco não tem sobra: o último botão termina no padding de baixo.
  const ultimo = m.botoes[m.botoes.length - 1];
  expect(m.bloco.y + m.bloco.h - (ultimo.caixa.y + ultimo.caixa.h), 'sobra embaixo do último botão').toBeLessThanOrEqual(RECUO + 1);
  return m;
}

const dialogo = (page: Page) => page.getByRole('dialog');
async function abreEFecha(page: Page, nome: string) {
  await page.getByRole('button', { name: nome, exact: true }).click();
  await expect(dialogo(page).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
}

const TEMAS: Tema[] = ['CLARO', 'ESCURO'];

test.describe('dieta', () => {
  for (const largura of [1280, 390]) {
    for (const tema of TEMAS) {
      test(`botões do bloco empilhados, largura útil, à esquerda e com os tipos certos (${largura}, ${tema})`, async ({ page }) => {
        const api = await abrirDieta(page, largura, tema);
        await conferir(page, 'Adicionar próxima refeição', ['Adicionar refeição', 'Modelos prontos'], tema);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    test(`"Adicionar refeição" cria o cartão e rola até ele; "Modelos prontos" abre a folha (${largura})`, async ({ page }) => {
      const api = await abrirDieta(page, largura);
      await page.getByRole('button', { name: 'Adicionar refeição', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Refeições (3)' })).toBeVisible();
      // Duas colunas: só a refeição escolhida (a nova) tem cartão, no inspetor; empilhado, os três cartões.
      await expect(page.locator('[id^="refeicao-"]')).toHaveCount(largura >= 1280 ? 1 : 3);
      // Rolou: o cartão novo (o último) tem o topo na janela, e não é uma das duas refeições de antes.
      const nova = page.locator('[id^="refeicao-"]').last();
      expect(await nova.getAttribute('id')).not.toMatch(/^refeicao-(cafe|almoco)$/);
      await expect.poll(async () => { const c = await nova.boundingBox(); return !!c && c.y >= 0 && c.y < 900; }).toBe(true);
      await abreEFecha(page, 'Modelos prontos');
      expect(api.errosDaPagina).toEqual([]);
    });
  }
});

test.describe('treino', () => {
  // 390 = uma coluna (o bloco no fim do cartão da sessão); 1280 e 1600 conferem em qual das faixas a lista fica à esquerda.
  for (const largura of [390, 1280, 1600, 1920]) {
    for (const tema of TEMAS) {
      test(`botões do bloco empilhados, largura útil, à esquerda e com os tipos certos (${largura}, ${tema})`, async ({ page }) => {
        const api = await abrirTreino(page, largura, tema);
        await conferir(page, 'Adicionar próximo exercício', ['Adicionar exercício', 'Adicionar cardio', 'Modelos prontos', 'Criar grupo'], tema);
        // Duas colunas: o bloco é o do fim da lista da esquerda (`ListaDeExercicios`), não o do cartão da sessão.
        const duas = (await page.getByRole('group', { name: 'Exercícios da sessão' }).count()) > 0;
        test.info().annotations.push({ type: 'colunas', description: duas ? 'duas' : 'uma' });
        if (largura === 390) expect(duas).toBe(false);
        if (largura >= 1600) expect(duas).toBe(true);
        expect(api.errosDaPagina).toEqual([]);
      });
    }
  }

  for (const largura of [1280, 390]) {
    test(`cada botão do bloco ainda faz a ação: exercício, cardio, modelos e grupo abrem a folha (${largura})`, async ({ page }) => {
      const api = await abrirTreino(page, largura);
      for (const nome of ['Adicionar exercício', 'Adicionar cardio', 'Modelos prontos', 'Criar grupo']) await abreEFecha(page, nome);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
});

test.describe('mobilidade', () => {
  for (const largura of [1280, 390]) {
    for (const tema of TEMAS) {
      test(`o botão do bloco é cheio, à esquerda e do tipo acao (${largura}, ${tema})`, async ({ page }) => {
        const api = await abrirMobilidade(page, largura, tema);
        await conferir(page, 'Adicionar próxima seção', ['Adicionar seção'], tema);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    test(`"Adicionar seção" cria a seção (${largura})`, async ({ page }) => {
      const api = await abrirMobilidade(page, largura);
      await page.getByRole('button', { name: 'Adicionar seção', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Seções (3)' })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });
  }
});

// ---- Capturas (só com CAPTURAS=<pasta>) ----
test.describe('capturas', () => {
  test.skip(!process.env.CAPTURAS, 'só com CAPTURAS');
  const casos: { nome: string; titulo: string; abrir: typeof abrirDieta; temas: Tema[] }[] = [
    { nome: 'dieta', titulo: 'Adicionar próxima refeição', abrir: abrirDieta, temas: ['ESCURO', 'CLARO'] },
    { nome: 'treino', titulo: 'Adicionar próximo exercício', abrir: abrirTreino, temas: ['ESCURO', 'CLARO'] },
    { nome: 'mobilidade', titulo: 'Adicionar próxima seção', abrir: abrirMobilidade, temas: ['ESCURO'] },
  ];
  for (const c of casos) {
    for (const tema of c.temas) {
      test(`${c.nome} 1280 ${tema}`, async ({ page }) => {
        await c.abrir(page, 1280, tema);
        // O bloco do fim da lista, com a lista em cima: a rolagem é de um contêiner interno.
        await page.getByText(c.titulo, { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${process.env.CAPTURAS}/${c.nome}-1280-${tema === 'ESCURO' ? 'escuro' : 'claro'}.png` });
      });
    }
  }
});
