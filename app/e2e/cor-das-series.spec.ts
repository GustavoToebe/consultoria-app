import { expect, test, type Locator, type Page } from '@playwright/test';

import type { RegistroEnvio, Sessao } from '../src/api/tipos';
import { coresDaAcao, PALETA_DE_IDENTIFICACAO, PALETAS } from '../src/tema/tokens';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';
import { linhaDaSerie } from './linhaDaSerie';

/**
 * Séries do treino pintadas (25/11) no montar e no executar, e a preferência "Cor das séries" (Ajustes do treinador e
 * Aparência da Conta do aluno, a mesma `ui/PreferenciasDoApp`): Cor do tipo (padrão) ou Cor de ação em todas, com o selo
 * neutro e o nome do tipo escrito. Também os dois defeitos do editor de 25/11: a linha aberta sem textos sobrepostos e a
 * coluna grudada abaixo da barra medida (não mais 80 px fixos). Só dados fictícios.
 */

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const fundo = (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
// A marca falsa nasce no tema Claro; a cor de ação padrão (índigo) não depende da marca.
const ACAO_NO_CLARO = coresDaAcao('INDIGO', PALETAS.CLARO.cores, 'claro', '#386CB8').acao;

async function abrirEditor(page: Page, largura: number, preferencias: Record<string, unknown> | null = null) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (preferencias) await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
}

async function irAoEditor(page: Page, largura: number) {
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  if (largura < 960) await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
  // Supino: FS (aberta), WS e Back off.
  await expect(page.getByTestId('bloco-aberto')).toBeVisible();
}

test('Ajustes: "Cor das séries" nasce Cor do tipo; Cor de ação pinta as séries do editor na cor de ação, com o selo neutro, e sobrevive ao recarregar', async ({ page }) => {
  await abrirEditor(page, 1280);
  await irAoEditor(page, 1280);
  // Cor do tipo: a WS (2ª linha) em índigo de identificação, faixa e selo; o FS aberto ganha a faixa azul.
  expect(await fundo(page.getByTestId('bloco-2-faixa'))).toBe(rgb(PALETA_DE_IDENTIFICACAO.claro.INDIGO));
  expect(await fundo(page.getByTestId('bloco-1-faixa'))).toBe(rgb(PALETA_DE_IDENTIFICACAO.claro.AZUL));
  const seloWs = linhaDaSerie(page, /^Série 2 · WS/).getByText('WS', { exact: true });
  expect(await seloWs.evaluate((e) => getComputedStyle(e).color)).toBe(rgb(PALETA_DE_IDENTIFICACAO.claro.INDIGO));

  await page.goto('/treinador/ajustes');
  const grupo = page.getByRole('radiogroup', { name: 'Cor das séries' });
  await expect(grupo.getByRole('radio', { name: 'Cor do tipo' })).toHaveAttribute('aria-checked', 'true');
  await grupo.getByRole('radio', { name: 'Cor de ação' }).click();
  await expect(grupo.getByRole('radio', { name: 'Cor de ação' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`treinos:${id}:preferencias`), TREINADOR.id)).toContain('"corDasSeries":"ACAO"');

  await irAoEditor(page, 1280);
  for (const n of [1, 2, 3]) expect(await fundo(page.getByTestId(`bloco-${n}-faixa`))).toBe(rgb(ACAO_NO_CLARO));
  // O tipo continua escrito, agora no selo neutro (sem a cor de identificação).
  await expect(seloWs).toBeVisible();
  expect(await seloWs.evaluate((e) => getComputedStyle(e).color)).not.toBe(rgb(PALETA_DE_IDENTIFICACAO.claro.INDIGO));
  await page.reload();
  await expect(page.getByTestId('bloco-aberto')).toBeVisible();
  expect(await fundo(page.getByTestId('bloco-2-faixa'))).toBe(rgb(ACAO_NO_CLARO));
});

for (const largura of [390, 1280]) {
  test(`editor: a linha aberta mostra "Série N", "N séries", o selo e o detalhe sem sobrepor, e o tipo não se repete (${largura}px)`, async ({ page }) => {
    await abrirEditor(page, largura);
    // Aquecimento: o nome por extenso é igual ao selo e não aparece duas vezes.
    const d = planoDetalhe(false);
    d.rascunho.sessoes[0].exercicios[0].series.unshift({ ...d.rascunho.sessoes[0].exercicios[0].series[0], uid: 'aq', tipo: 'WARM_UP', repsMin: 10, repsMax: 15, carga: null });
    await page.route(`**/api/planos-treino/${PLANO_ID}`, (route) => (route.request().method() === 'GET' ? json(route, d) : route.fallback()));
    await irAoEditor(page, largura);
    const aberta = linhaDaSerie(page, /^Série 1 · Aquecimento/, true);
    await expect(aberta.getByText('Aquecimento', { exact: true })).toHaveCount(1);
    for (const linha of [aberta, linhaDaSerie(page, /^Série 2 · FS/)]) {
      // Todo texto da linha: nenhum retângulo invade outro (tolerância de 1 px do arredondamento).
      const sobrepostos = await linha.evaluate((raiz) => {
        const folhas = [...raiz.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()));
        const r = folhas.map((e) => ({ e, t: e.textContent!.trim(), b: e.getBoundingClientRect() }));
        const ruins: string[] = [];
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
          // Números em <span> dentro do texto (dígitos tabulares) ficam contidos no pai: não é sobreposição.
          if (r[i].e.contains(r[j].e) || r[j].e.contains(r[i].e)) continue;
          const [a, b] = [r[i].b, r[j].b];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ruins.push(`${r[i].t} × ${r[j].t}`);
        }
        return ruins;
      });
      expect(sobrepostos).toEqual([]);
    }
  });
}

test('editor (2700, três colunas, texto extra): o resumo grudado fica abaixo da barra medida; o exercício escolhido não fica sob a barra (1280)', async ({ page }) => {
  await abrirEditor(page, 2700, { tamanhoTexto: 'EXTRA' });
  await irAoEditor(page, 2700);
  const barra = page.locator('#barra-do-editor');
  const resumo = page.getByTestId('coluna-resumo-sessao');
  await expect(resumo).toBeVisible();
  await page.mouse.move(1000, 700);
  await page.mouse.wheel(0, 1500);
  await expect.poll(async () => (await resumo.boundingBox())!.y - ((await barra.boundingBox())!.y + (await barra.boundingBox())!.height)).toBeGreaterThanOrEqual(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const n of ['Paralelas', 'Supino inclinado com halteres']) {
    await page.getByRole('button', { name: new RegExp(`^Exercício [0-9] de 7: ${n}`) }).click();
    const trocar = page.getByRole('button', { name: `Trocar exercício: ${n}`, exact: true });
    await expect.poll(async () => (await trocar.boundingBox())!.y - ((await barra.boundingBox())!.y + (await barra.boundingBox())!.height)).toBeGreaterThanOrEqual(0);
  }
});

test('tela do exercício (390) em Cor de ação: as séries na cor de ação, o selo do tipo neutro com o nome', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixarHoje(page);
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'CLARO', corDasSeries: 'ACAO' })), ALUNO.id);
  const s: Sessao = sessaoFalsa('cores', 'Treino das cores', 1, 1);
  const base = { repsMin: 6, repsMax: 8, descansoSegundos: null, esforco: null, tecnica: null, carga: null };
  s.exercicios[0] = { ...s.exercicios[0], uid: 'supino', nome: 'Supino de teste', series: [{ ...base, uid: 'aq', tipo: 'WARM_UP' }, { ...base, uid: 'back', tipo: 'BACK_OFF' }] };
  await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, [s])),
    'POST /aluno/execucoes/lote': (p, route) => json(route, { resultados: (p.corpo as { registros: RegistroEnvio[] }).registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) }),
  });
  await page.goto('/aluno/sessao/cores/supino?data=2026-10-19');
  // A ativa (Aquecimento) com a faixa na cor de ação cheia; o nome do tipo continua, sem a cor de identificação.
  expect(await fundo(page.getByTestId('serie-aq-faixa'))).toBe(rgb(ACAO_NO_CLARO));
  const nome = page.getByTestId('serie-aq').getByText('Aquecimento', { exact: true });
  await expect(nome).toBeVisible();
  expect(await nome.evaluate((e) => getComputedStyle(e).color)).not.toBe(rgb(PALETA_DE_IDENTIFICACAO.claro.CIANO));
  await expect(page.getByTestId('serie-back-faixa')).toBeVisible();
});
