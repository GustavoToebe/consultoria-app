import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CompromissoDoAluno } from '../src/api/agendaTipos';
import type { AnamneseDetalhe, Atualizacao, ConteudoDieta, ItemDieta, Refeicao } from '../src/api/tipos';
import type { ItemDaVitrineDoAluno } from '../src/api/vitrineTipos';
import { ALUNO, erroApi, sessao, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { colunasEstaveis, conferirAlturasDeColunas, maiorVazioDentroDosCartoes } from './alturasDeColunas';

/** Fim das colunas vizinhas (px) e vazio embaixo do conteúdo de um cartão (px, com o recuo do cartão). */
const LIMITE_DAS_COLUNAS = 80;
const VAZIO_MAXIMO = 48;

/**
 * Início do aluno no computador (27/11, no padrão do treinador; `dominio/arranjoDoInicioLargo`): o contêiner é o da `Tela`
 * (começa ao lado do menu e preenche a área). Da área lado a lado (972) até a faixa `normal`, duas colunas: principal com
 * Hoje (com os exercícios de hoje), Dieta de hoje (as refeições), compromissos, Sua semana e Seu nível; apoio fixo com
 * pendências e Água. Nas faixas `larga` e `ultralarga` (27/11, auditoria dos buracos), três colunas medidas: Hoje, Dieta de
 * hoje e pendências abrem as colunas e o resto vai para onde elas terminam juntas (`e2e/alturasDeColunas`). Embaixo, o ano
 * de treinos e a vitrine em fileira. No topo, o aviso "Seu novo plano está disponível" quando a versão em uso não é a
 * última vista no aparelho.
 * O celular (390) não muda. Só dados fictícios. Com `E2E_CAPTURAS=<pasta>` grava as capturas da matriz (fora do git).
 */

const VITRINE: ItemDaVitrineDoAluno[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `v0000000-0000-4000-8000-00000000000${n}`, nome: `Item fictício ${n}`, descricao: 'Descrição fictícia.', tipo: 'FISICO',
  precoCentavos: 4990 * n, precoVigenteCentavos: 4990 * n, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null, categoria: null,
}));
const ANAMNESE = {
  id: 'n0000000-0000-4000-8000-000000000001', alunoId: 'a0000000-0000-4000-8000-000000000002', nomeAluno: null, situacao: 'PENDENTE',
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001', questionarioVersaoNumero: 1, questionarioNome: null, modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: {}, atribuidaEm: '2026-10-18T12:00:00Z', atribuidaPorNome: null, enviadaEm: null, revisadaEm: null, revisadaPorNome: null,
  dispensadaEm: null, dispensadaPorNome: null, alteracoes: [], dispensaMotivo: null, versao: 1,
} as AnamneseDetalhe;
const ATUALIZACAO_ATRASADA = {
  id: 'z0000000-0000-4000-8000-000000000001', pastaId: 'p0000000-0000-4000-8000-000000000001', alunoId: 'a0000000-0000-4000-8000-000000000002', nomeAluno: null,
  dataAtualizacao: '2026-10-17', fase: 'ABERTA', diasParaData: -2, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1,
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001', questionarioNome: null, modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: null, enviadaEm: null, feedback: null, versao: 1, resumo: null,
} as Atualizacao;
const compromisso = (id: string, data: string, hora: string): CompromissoDoAluno => {
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  return { id, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 3600_000).toISOString(), data, hora, horaFim: `${Number(hora.slice(0, 2)) + 1}:00`,
    duracaoMinutos: 60, local: 'Sala 2', situacao: 'AGENDADO', responsavelNome: 'Treinadora Teste', lembretesMinutos: [30] };
};

// Segunda, 19/10 (relógio fixo às 12:00 de Brasília): o treino A com 7 exercícios (o Hoje mostra 5 e "+2 exercícios").
const SESSOES = [sessaoFalsa('sa', 'Peito e tríceps', 1, 7), sessaoFalsa('sb', 'Costas e bíceps', 3, 4), sessaoFalsa('sc', 'Pernas', 5, 6)];
const VERSAO_DO_TREINO = 't0000000-0000-4000-8000-000000000002';
const VERSAO_DA_DIETA = 'd0000000-0000-4000-8000-000000000001';
const alimento = (uid: string, kcal: number): ItemDieta => ({
  uid, alimentoId: null, nome: 'Alimento fictício', quantidade: 100, unidade: 'g', kcal, proteina: 10, carboidrato: 10, gordura: 5, manual: true,
}) as ItemDieta;
const REFEICOES: Refeicao[] = [['Café da manhã', '07:00', 420], ['Lanche da manhã', '10:00', 180], ['Almoço', '12:30', 650], ['Lanche da tarde', '16:00', 220], ['Jantar', '20:00', 540]]
  .map(([nome, horario, kcal], i) => ({ uid: `r${i}`, nome: String(nome), horario: String(horario), observacao: null, opcoes: [{ uid: `o${i}`, rotulo: 'A', itens: [alimento(`i${i}`, Number(kcal))] }] }));
const DIETA = {
  dieta: {
    id: VERSAO_DA_DIETA, planoId: 'd0000000-0000-4000-8000-000000000002', numero: 1, titulo: 'Dieta', inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z',
    conteudo: {
      objetivo: null, dataInicio: null, profissional: null, observacoes: null, orientacoes: [], suplementacao: [], ergogenicos: null, aguaLitros: 3, variacoes: [], refeicoes: REFEICOES,
    } satisfies ConteudoDieta,
  },
};

interface Cenario {
  largura: number;
  altura?: number;
  tema?: 'ESCURO' | 'CLARO';
  minimizado?: boolean;
  retorno?: boolean;
  pendencias?: boolean;
  compromissos?: boolean;
  vitrine?: boolean;
  dieta?: 'ok' | 'erro';
  /** O que já estava gravado como visto no aparelho (nulo = nada: a primeira abertura grava a base, sem aviso). */
  vistos?: { treino: string | null; dieta: string | null } | null;
}

const CHAVE_DOS_VISTOS = `treinos:${ALUNO.id}:planoVisto`;

async function abrir(page: Page, c: Cenario) {
  const { largura, altura = 1080, tema = 'ESCURO', minimizado = false, retorno = true, pendencias = true, compromissos = true, vitrine = true, dieta = 'ok' } = c;
  const vistos = c.vistos === undefined ? { treino: VERSAO_DO_TREINO, dieta: VERSAO_DA_DIETA } : c.vistos;
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t, min, chave, v]) => {
    try {
      if (sessionStorage.getItem('inicio-preparado')) return;
      sessionStorage.setItem('inicio-preparado', '1');
      localStorage.removeItem('menu-lateral-recolhido');
      if (min) localStorage.setItem('menu-lateral-recolhido', '1');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
      if (v) localStorage.setItem(chave, v); else localStorage.removeItem(chave);
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, tema, minimizado, CHAVE_DOS_VISTOS, vistos ? JSON.stringify(vistos) : null] as const);
  await fixarHoje(page);
  const respostas: RespostasApi = {
    ...(await sessaoDeAlunoComTreino(page, SESSOES)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: retorno, vitrineHabilitada: vitrine })),
    'GET /aluno/dieta': dieta === 'erro' ? erroApi(503, 'Servidor fora do ar.') : { corpo: DIETA },
    'GET /aluno/atualizacao': pendencias ? { corpo: ATUALIZACAO_ATRASADA } : erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    ...(pendencias ? { 'GET /aluno/anamnese': { corpo: ANAMNESE } } : {}),
    ...(compromissos ? { 'GET /aluno/compromissos': { corpo: [compromisso('k1', '2026-10-21', '10:00'), compromisso('k2', '2026-10-28', '18:00')] } } : {}),
    ...(vitrine ? { 'GET /aluno/vitrine': { corpo: VITRINE } } : {}),
  };
  const api = await simularApi(page, respostas);
  await page.goto('/aluno');
  return api;
}

type Caixa = { x: number; y: number; width: number; height: number };
const caixa = async (l: Locator): Promise<Caixa> => {
  await expect(l).toBeVisible();
  let b: Caixa | null = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const cartaoCom = (page: Page, dentro: Locator) => page.getByTestId('cartao').filter({ has: dentro });
const grade = (page: Page) => page.getByLabel(/^Mapa de treinos:/);
const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, exact: true });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const ranking = (pedidos: { metodo: string; caminho: string }[]) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/comunidade/ranking');
const dentro = (a: Caixa, b: Caixa) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
const fim = (c: Caixa) => c.y + c.height;
const apoio = (page: Page) => page.getByRole('complementary', { name: /^Pendências/ });

/** Espera o arranjo final: pendências (se houver), nível, mapa e vitrine chegaram. */
async function assentar(page: Page, o: { pendencias?: boolean; retorno?: boolean; vitrine?: boolean } = {}) {
  const { pendencias = true, retorno = true, vitrine = true } = o;
  await expect(titulo(page, 'Hoje')).toBeVisible();
  if (pendencias) await expect(titulo(page, 'Suas pendências')).toBeVisible();
  if (retorno) { await expect(page.getByText(/^Nível \d/)).toBeVisible(); await expect(grade(page)).toBeVisible(); }
  if (vitrine) await expect(page.getByText('Item fictício 1')).toBeVisible();
}

/** O conteúdo do Hoje e da Dieta de hoje e os botões da Água, iguais em toda largura do computador. */
async function conferirCartoes(page: Page) {
  const exercicios = page.getByRole('list', { name: 'Exercícios de hoje' });
  await expect(exercicios.getByRole('listitem')).toHaveCount(5);
  await expect(exercicios.getByRole('listitem').first()).toContainText('séries');
  await expect(page.getByText('+2 exercícios')).toBeVisible();
  const refeicoes = page.getByRole('list', { name: 'Refeições de hoje' });
  await expect(refeicoes.getByRole('listitem')).toHaveCount(5);
  // 12:00 de Brasília: a próxima é o almoço das 12:30, com o selo neutro.
  await expect(refeicoes.getByRole('listitem').filter({ hasText: 'Almoço' })).toContainText('Próxima');
  await expect(refeicoes.getByRole('listitem').filter({ hasText: 'Almoço' })).toContainText('650 kcal');
  await expect(page.getByLabel('Total do dia: 2010 kcal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver dieta' })).toBeVisible();
  // Água: "−1 copo" e "+1 copo" dividem a largura do cartão.
  const ag = await caixa(cartaoCom(page, titulo(page, 'Água de hoje')));
  const [menos, mais] = await Promise.all([page.getByRole('button', { name: 'Tirar um copo' }), page.getByRole('button', { name: 'Mais um copo' })].map(caixa));
  expect(Math.abs(menos.width - mais.width)).toBeLessThan(2);
  expect((mais.x + mais.width - menos.x) / ag.width).toBeGreaterThan(0.85);
  // Pendências na coluna estreita: o selo desce e o título fica numa linha (~22 px), sem quebrar em 3 ou 4.
  const anamnese = page.getByRole('link', { name: /^Anamnese inicial/ });
  await expect(anamnese).toContainText('Pendente');
  expect((await caixa(anamnese.getByText('Anamnese inicial'))).height).toBeLessThan(30);
}

for (const [largura, altura] of [[1280, 720], [1536, 864]] as const) {
  test(`${largura}: duas colunas (principal e apoio fixo ao lado), o ano e a vitrine embaixo`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, { largura, altura });
    await assentar(page);
    await conferirCartoes(page);
    const [h, d, ap, pend, ag, sem, niv, princ, m, v] = await Promise.all([
      titulo(page, 'Hoje'), titulo(page, 'Dieta de hoje'), apoio(page), titulo(page, 'Suas pendências'), cartaoCom(page, titulo(page, 'Água de hoje')),
      cartaoCom(page, titulo(page, 'Sua semana')), cartaoCom(page, titulo(page, 'Seu nível')), page.getByTestId('inicio-principal'),
      cartaoCom(page, grade(page)), cartaoCom(page, titulo(page, 'Vitrine')),
    ].map(caixa));
    // Abaixo de 1600 de área: principal + apoio de 380, fixo ao rolar.
    expect(Math.abs(ap.width - 380)).toBeLessThan(2);
    expect(Math.abs(princ.x + princ.width + 32 - ap.x)).toBeLessThan(2);
    expect(Math.abs(pend.y - h.y)).toBeLessThan(4);
    for (const c of [pend, ag]) expect(dentro(c, ap)).toBe(true);
    expect(ag.y).toBeGreaterThan(pend.y);
    expect(Math.abs(d.x - h.x)).toBeLessThan(2);
    expect(d.y).toBeGreaterThan(h.y);
    // Semana e nível na pilha da principal, abaixo da Dieta: o apoio fica com pendências e Água e cabe na janela.
    for (const c of [sem, niv]) { expect(dentro(c, princ)).toBe(true); expect(c.y).toBeGreaterThan(d.y); }
    expect(niv.y).toBeGreaterThan(fim(sem));
    expect(fim(ap)).toBeLessThanOrEqual(altura);
    const direita = Math.max(m.x + m.width, v.x + v.width);
    expect(Math.abs(ap.x + ap.width - direita)).toBeLessThan(2);
    expect(m.y).toBeGreaterThan(Math.max(fim(princ), fim(ap)) - 1);
    expect(Math.abs(m.x - h.x)).toBeLessThan(2);
    expect(Math.abs(v.y - m.y) < 2 || v.y > fim(m)).toBe(true);
    expect(ranking(pedidos)).toHaveLength(1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

// Faixas larga e ultralarga (27/11, auditoria dos buracos): todos os blocos em colunas da mesma largura, empilhados pela
// altura medida. Hoje abre a primeira, Dieta de hoje a segunda e as pendências a última; o fim das colunas vizinhas fica a
// menos de `LIMITE_DAS_COLUNAS` um do outro e nenhum cartão estica com vazio por dentro.
for (const [largura, altura, colunas] of [[1920, 1080, 3], [2560, 1440, 3], [3440, 1440, 3]] as const) {
  test(`${largura}: ${colunas} colunas medidas, sem buraco embaixo de nenhuma; o ano e a vitrine embaixo`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, { largura, altura });
    await assentar(page);
    await conferirCartoes(page);
    const lidas = await conferirAlturasDeColunas(page, { prefixo: 'inicio-coluna', colunasEsperadas: colunas, limite: LIMITE_DAS_COLUNAS });
    test.info().annotations.push({ type: 'fim das colunas', description: lidas.map((c) => `${c.pecas.join('+')}: ${Math.round(c.fim)}`).join(' | ') });
    expect(lidas[0].pecas[0]).toBe('hoje');
    expect(lidas[1].pecas[0]).toBe('dieta');
    expect(lidas[colunas - 1].pecas[0]).toBe('pendencias');
    const vazio = await maiorVazioDentroDosCartoes(page, 'inicio-coluna');
    expect(vazio.vazio, `vazio dentro de "${vazio.cartao}"`).toBeLessThan(VAZIO_MAXIMO);
    const [h, d, pend, m, v] = await Promise.all([
      titulo(page, 'Hoje'), titulo(page, 'Dieta de hoje'), titulo(page, 'Suas pendências'), cartaoCom(page, grade(page)), cartaoCom(page, titulo(page, 'Vitrine')),
    ].map(caixa));
    // Hoje, Dieta de hoje e pendências na mesma linha, da esquerda para a direita.
    for (const c of [d, pend]) expect(Math.abs(c.y - h.y)).toBeLessThan(4);
    expect(h.x).toBeLessThan(d.x);
    expect(d.x).toBeLessThan(pend.x);
    // Embaixo das colunas: o ano de treinos e a vitrine (lado a lado quando cabem o mapa cheio e dois produtos).
    const fimDasColunas = Math.max(...lidas.map((c) => c.fim));
    expect(m.y).toBeGreaterThan(fimDasColunas - 1);
    expect(Math.abs(m.x - h.x)).toBeLessThan(2);
    expect(Math.abs(v.y - m.y) < 2 || v.y > fim(m)).toBe(true);
    const caixas = await Promise.all((await page.getByTestId(/^inicio-vitrine-/).all()).map(caixa));
    expect(caixas.length).toBeGreaterThan(0);
    for (const c of caixas) { expect(Math.abs(c.y - caixas[0].y)).toBeLessThan(2); expect(c.width).toBeLessThanOrEqual(321); }
    expect(dentro(await caixa(page.getByRole('button', { name: 'Ver tudo da vitrine' })), v)).toBe(true);
    // O conteúdo preenche a área: a borda direita da última coluna é a da linha de baixo.
    const direita = Math.max(m.x + m.width, v.x + v.width);
    const ultima = await caixa(page.getByTestId('inicio-coluna-pendencias'));
    expect(Math.abs(ultima.x + ultima.width - direita)).toBeLessThan(3);
    expect(ranking(pedidos)).toHaveLength(1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920 sem pendências e sem compromissos: só cinco blocos, duas colunas que terminam juntas (três deixariam ~100 px)', async ({ page }) => {
  await abrir(page, { largura: 1920, pendencias: false, compromissos: false });
  await assentar(page, { pendencias: false });
  await expect(titulo(page, 'Suas pendências')).toHaveCount(0);
  const lidas = await conferirAlturasDeColunas(page, { prefixo: 'inicio-coluna', colunasEsperadas: 2, limite: LIMITE_DAS_COLUNAS });
  test.info().annotations.push({ type: 'fim das colunas', description: lidas.map((c) => `${c.pecas.join('+')}: ${Math.round(c.fim)}`).join(' | ') });
  expect(lidas.map((c) => c.pecas[0])).toEqual(['hoje', 'dieta']);
  expect(lidas.flatMap((c) => c.pecas)).toContain('agua');
  const vazio = await maiorVazioDentroDosCartoes(page, 'inicio-coluna');
  expect(vazio.vazio, `vazio dentro de "${vazio.cartao}"`).toBeLessThan(VAZIO_MAXIMO);
});

test('1920 com erro ao carregar a dieta: o aviso e o "Tentar de novo" ficam na coluna da Dieta; sem meta, sem Água', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, { largura: 1920, dieta: 'erro' });
  await assentar(page);
  const aviso = await caixa(page.getByText('Não foi possível carregar a dieta.'));
  const d = await caixa(titulo(page, 'Dieta de hoje'));
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  // Logo abaixo do título da Dieta, na coluna dela (com a Dieta curta, as colunas podem cair para duas: a regra das medidas).
  expect(aviso.y).toBeGreaterThan(d.y);
  expect(aviso.y - d.y).toBeLessThan(120);
  expect(aviso.x).toBeGreaterThanOrEqual(d.x - 1);
  expect(aviso.x).toBeLessThan(d.x + d.width);
  await conferirAlturasDeColunas(page, { prefixo: 'inicio-coluna', colunasEsperadas: (await colunasEstaveis(page, 'inicio-coluna')).length, limite: LIMITE_DAS_COLUNAS });
  await expect(titulo(page, 'Água de hoje')).toHaveCount(0);
  // Sem a dieta não se sabe a versão dela: nada de aviso de plano novo.
  await expect(page.getByTestId('aviso-plano-novo')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('1920 sem o retorno: sem mapa nem nível; a vitrine na largura toda', async ({ page }) => {
  await abrir(page, { largura: 1920, retorno: false });
  await assentar(page, { retorno: false });
  await expect(titulo(page, 'Seu nível')).toHaveCount(0);
  await expect(grade(page)).toHaveCount(0);
  const [v, ultima] = await Promise.all([cartaoCom(page, titulo(page, 'Vitrine')), page.getByTestId('inicio-coluna-pendencias')].map(caixa));
  expect(Math.abs(v.x + v.width - (ultima.x + ultima.width))).toBeLessThan(3);
});

test('aviso de plano novo: treino publicado depois do último visto; "Ver o plano" abre o Treino e o aviso some', async ({ page }) => {
  await abrir(page, { largura: 1280, altura: 720, vistos: { treino: 't-antiga', dieta: VERSAO_DA_DIETA } });
  const aviso = page.getByRole('region', { name: 'Seu novo plano está disponível' });
  await expect(aviso).toContainText('Seu treinador publicou um treino novo.');
  // No topo: antes do Hoje.
  expect((await caixa(aviso)).y).toBeLessThan((await caixa(titulo(page, 'Hoje'))).y);
  await aviso.getByRole('button', { name: 'Ver o plano' }).click();
  await expect(page).toHaveURL(/\/aluno\/treino$/);
  expect(JSON.parse((await page.evaluate((c) => localStorage.getItem(c), CHAVE_DOS_VISTOS))!)).toEqual({ treino: VERSAO_DO_TREINO, dieta: VERSAO_DA_DIETA });
  await page.goto('/aluno');
  await expect(titulo(page, 'Hoje')).toBeVisible();
  await expect(page.getByTestId('aviso-plano-novo')).toHaveCount(0);
});

test('aviso de plano novo: o X fecha e grava; na primeira abertura do aparelho nada aparece e a base é gravada', async ({ page }) => {
  await abrir(page, { largura: 390, altura: 844, vistos: { treino: VERSAO_DO_TREINO, dieta: 'd-antiga' } });
  const aviso = page.getByRole('region', { name: 'Seu novo plano está disponível' });
  await expect(aviso).toContainText('Seu treinador publicou uma dieta nova.');
  await aviso.getByRole('button', { name: 'Fechar o aviso do plano novo' }).click();
  await expect(aviso).toHaveCount(0);
  await expect.poll(() => page.evaluate((c) => localStorage.getItem(c), CHAVE_DOS_VISTOS)).toBe(JSON.stringify({ treino: VERSAO_DO_TREINO, dieta: VERSAO_DA_DIETA }));
  // "Ver meu treino" continua na primeira tela do celular depois de fechar.
  expect(fim(await caixa(page.getByRole('button', { name: /^Ver meu treino/ })))).toBeLessThan(844);
});

test('aviso de plano novo: aparelho sem nada gravado não avisa e grava as versões em uso como vistas', async ({ page }) => {
  await abrir(page, { largura: 1280, altura: 720, vistos: null });
  await assentar(page);
  await expect.poll(() => page.evaluate((c) => localStorage.getItem(c), CHAVE_DOS_VISTOS)).toBe(JSON.stringify({ treino: VERSAO_DO_TREINO, dieta: VERSAO_DA_DIETA }));
  await expect(page.getByTestId('aviso-plano-novo')).toHaveCount(0);
});

test('390: o celular não muda (uma coluna: Hoje → Dieta → Água → pendências → compromissos → semana → nível → mapa → vitrine)', async ({ page }) => {
  const { errosDaPagina, pedidos } = await abrir(page, { largura: 390, altura: 844 });
  await assentar(page, { vitrine: false });
  await expect(page.getByRole('list', { name: 'Exercícios de hoje' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Refeições de hoje' })).toHaveCount(0);
  const caixas = await Promise.all([
    titulo(page, 'Hoje'), page.getByRole('link', { name: /^Dieta,/ }), titulo(page, 'Água de hoje'), titulo(page, 'Suas pendências'),
    titulo(page, 'Seus compromissos'), titulo(page, 'Sua semana'), titulo(page, 'Seu nível'), grade(page), titulo(page, 'Vitrine'),
  ].map(caixa));
  const ys = caixas.map((c) => c.y);
  expect(ys).toEqual([...ys].sort((x, y) => x - y));
  expect(fim(await caixa(page.getByRole('button', { name: /^Ver meu treino/ })))).toBeLessThan(844);
  expect(ranking(pedidos)).toHaveLength(1);
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

// Capturas da matriz (orientações de 26/11, 0.5): só com `E2E_CAPTURAS`, numa pasta fora do git.
const PASTA = process.env.E2E_CAPTURAS;
const MATRIZ: Cenario[] = [
  { largura: 390, altura: 844 }, { largura: 390, altura: 844, tema: 'CLARO' },
  { largura: 1024, altura: 768 }, { largura: 1280, altura: 720 }, { largura: 1280, altura: 720, tema: 'CLARO' },
  { largura: 1536, altura: 864 }, { largura: 1920 }, { largura: 1920, tema: 'CLARO' },
  { largura: 2560, altura: 1440 }, { largura: 3440, altura: 1440 }, { largura: 3440, altura: 1440, tema: 'CLARO' },
  { largura: 1920, pendencias: false, compromissos: false }, { largura: 1280, altura: 720, pendencias: false, compromissos: false, vitrine: false },
  { largura: 1920, dieta: 'erro' }, { largura: 1920, retorno: false },
  { largura: 1920, vistos: { treino: 't-antiga', dieta: 'd-antiga' } }, { largura: 1920, tema: 'CLARO', vistos: { treino: 't-antiga', dieta: 'd-antiga' } },
];
for (const c of MATRIZ) {
  const nome = [c.largura, c.tema ?? 'ESCURO', c.minimizado && 'minimizado', c.pendencias === false && 'sem-pendencias', c.dieta === 'erro' && 'erro-dieta',
    c.retorno === false && 'sem-retorno', c.vitrine === false && 'sem-vitrine', c.vistos && 'plano-novo'].filter(Boolean).join('-');
  test(`captura ${nome}`, async ({ page }) => {
    test.skip(!PASTA, 'só com E2E_CAPTURAS');
    await abrir(page, c);
    await expect(titulo(page, 'Hoje')).toBeVisible();
    if (c.retorno !== false) await expect(grade(page)).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${PASTA}/${nome}.png` });
    // A `Tela` rola por dentro (a página não): rola o último bloco até a vista para a captura do fim.
    await page.getByRole('heading', { name: /Vitrine|Seu ano de treinos|dias? de treino/ }).last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${PASTA}/${nome}-fim.png` });
  });
}
