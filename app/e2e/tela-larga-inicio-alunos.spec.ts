import { expect, test, type Locator, type Page } from '@playwright/test';

import type { PaginaInadimplentes } from '../src/api/financeiroTipos';
import type { ResumoDaAgenda } from '../src/api/agendaTipos';
import type { AlunoResumo, AtualizacaoDaLista, NumerosDaConsultoria, PainelTreinador, RecordesDaSemana, SituacaoDaAtualizacao } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { PAINEL_COM_DADOS } from './financeiro-falso';

/**
 * tela larga: revisão (24/11), grupo Início, Alunos, Atualizações e Números (plano
 * `docs/planos/tela-larga-revisao-inicio-alunos.md`). Confere por geometria, com o menu aberto, que o espaço extra vira
 * colunas em vez de esticar: o Início usa 6 colunas em 2560, Atualizações põe as linhas em colunas, Alunos põe os grupos
 * em duas colunas só quando cada metade cabe a lista, e Números alinha os indicadores com as colunas de baixo. Em 1280 e
 * 390 nada passa da tela. Só dados fictícios; relógio em 19/10/2026.
 */

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ontem = '2026-10-18';
const NOMES = ['Ana Fictícia', 'Bruno Exemplo', 'Carla Teste', 'Davi Modelo', 'Eva Amostra', 'Fábio Fictício', 'Gina Exemplo', 'Hugo Teste', 'Íris Modelo', 'João Amostra', 'Kátia Fictícia', 'Leo Exemplo', 'Marta Teste', 'Nina Modelo', 'Otávio Amostra', 'Paula Fictícia', 'Quésia Exemplo', 'Rafa Teste', 'Sara Modelo', 'Tiago Amostra'];

function situacao(n: number, fase: SituacaoDaAtualizacao['fase'], extra: Partial<SituacaoDaAtualizacao> = {}): SituacaoDaAtualizacao {
  return { id: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, dataAtualizacao: ontem, fase, diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, ...extra };
}
const FASES: SituacaoDaAtualizacao['fase'][] = ['ENVIADA', 'ATRASADA', 'ABERTA', 'REVISADA'];
// Quatro grupos: Para revisar 5, Atrasados 5, Em dia 10 (ABERTA e REVISADA).
const ALUNOS: AlunoResumo[] = NOMES.map((nome, i) => ({
  id: id(i + 1), nome, ativo: true, temAcesso: true, planoAtivo: { id: `pl${i}`, titulo: 'Treino de outubro' }, ultimoRegistro: ontem,
  responsavelId: TREINADOR.id,
  atualizacao: situacao(i, FASES[i % 4], FASES[i % 4] === 'ATRASADA' ? { diasParaData: -3, diasDeAtraso: 3 } : FASES[i % 4] === 'ABERTA' ? { diasParaData: 12 } : {}),
}));
const ATUALIZACOES: AtualizacaoDaLista[] = NOMES.slice(0, 18).map((nome, i) => ({
  id: `b0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, pastaId: `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, alunoId: id(i + 1),
  nomeAluno: nome, dataAtualizacao: ontem, fase: 'ENVIADA', diasParaData: -1, diasDeAtraso: 0, atrasoAte: null,
}));
const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 3, atualizacoesAtrasadas: 2, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 5, alunosAtivos: 24,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [], pastasARenovar: 3, pastasParaRenovar: [], alunosSemPastaComPeriodo: 2,
  alunosSemRegistroTotal: 4, alunosSemAcesso: 3, alunosInativos: 3, sessoesConcluidas7Dias: 18,
};
const RECORDES: RecordesDaSemana = { de: '2026-10-13', ate: '2026-10-19', total: 0, series: [] };
const AGENDA: ResumoDaAgenda = { dias: [{ data: '2026-10-19', compromissos: 4, eventos: 1 }] };
const INADIMPLENTES: PaginaInadimplentes = { itens: [], total: 4, valorTotalCentavos: 124_000, pagina: 0 };
const NUMEROS: NumerosDaConsultoria = {
  meses: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((mes, i) => ({
    mes, parcial: i === 5, alunosAtivos: 30 + i, atualizacoesNoPrazo: 20 + i, atualizacoesAtrasadas: i,
  })),
  equipe: [
    { usuarioId: 'u1', nome: 'Ana Fictícia', alunosAtivos: 32, limiteDeAlunos: 30, atualizacoesAtrasadas: 2, atualizacoesParaRevisar: 5 },
    { usuarioId: 'u2', nome: 'Bia Exemplo', alunosAtivos: 4, limiteDeAlunos: null, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
  ],
  semResponsavel: { alunosAtivos: 3, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
};
const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'REGISTRO_LER', 'TREINO_LER', 'AGENDA_LER', 'FINANCEIRO_LER', 'EQUIPE_LER'];

async function abrir(page: Page, largura: number, altura: number, alunos: AlunoResumo[] = ALUNOS) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([uid]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${uid}:preferencias`, JSON.stringify({ tema: 'ESCURO', larguraConteudo: 'AUTOMATICA' }));
    } catch { /* quadro sem armazenamento */ }
  }, [TREINADOR.id] as const);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: TODAS, pagamentosHabilitados: true, retornoHabilitado: true })),
    'GET /painel': { corpo: PAINEL },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /recordes/semana': { corpo: RECORDES },
    'GET /agenda/resumo': { corpo: AGENDA },
    'GET /financeiro/painel': { corpo: PAINEL_COM_DADOS },
    'GET /financeiro/inadimplentes': { corpo: INADIMPLENTES },
    'GET /inscricoes/configuracao': { corpo: { aberta: false, codigo: null, link: null, responsavelId: null, texto: null, versao: null } },
    'GET /alunos': { corpo: { itens: alunos, total: alunos.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes/pagina': { corpo: { itens: ATUALIZACOES, total: ATUALIZACOES.length } },
    'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: ATUALIZACOES.length, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } },
    'GET /numeros': { corpo: NUMEROS },
  });
}

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}
async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
/** A faixa de largura chega depois do primeiro desenho: cada conferência repete até o layout assentar. */
const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });
const blocoDoInicio = (page: Page, nome: string) => page.getByRole('heading', { name: nome, level: 2, exact: true }).first();
const grupo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, level: 2, exact: true });

// tela larga: revisão (24/11): o Início ganha a 6ª coluna em 2560 (antes as linhas de 5 colunas fechavam em 4).
for (const [largura, altura, mesmaLinha] of [[1920, 1080, false], [2560, 1440, true], [3440, 1440, true]] as const) {
  test(`Início ${largura} px: Agenda ${mesmaLinha ? 'na mesma linha' : 'abaixo'} de Atualizações`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, altura);
    await page.goto('/treinador');
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    await assentado(async () => {
      const atualizacoes = await caixa(blocoDoInicio(page, 'Atualizações'));
      const agenda = await caixa(blocoDoInicio(page, 'Agenda'));
      if (mesmaLinha) {
        expect(Math.abs(agenda.y - atualizacoes.y)).toBeLessThan(4);
        expect(agenda.x).toBeGreaterThan(atualizacoes.x);
      } else {
        expect(agenda.y).toBeGreaterThan(atualizacoes.y + 100);
      }
      // Sem cartão sozinho na última linha: com 6 colunas Alunos desce para junto de Aniversários (o último, Médio, 25/11);
      // em 1920 (5 colunas) Alunos fica na linha de Recebido.
      const vizinho = await caixa(blocoDoInicio(page, mesmaLinha ? 'Aniversários' : 'Recebido e lançamentos'));
      const alunos = await caixa(blocoDoInicio(page, 'Alunos'));
      expect(Math.abs(alunos.y - vizinho.y)).toBeLessThan(4);
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

// tela larga: revisão (24/11): as linhas em caixa de Atualizações ganham colunas (célula de pelo menos 440 px, até 6).
for (const [largura, altura, colunas] of [[390, 844, 1], [1280, 900, 2], [1920, 1080, 3], [2560, 1440, 4], [3440, 1440, 6]] as const) {
  test(`Atualizações ${largura} px: ${colunas} coluna(s) de linhas, nenhuma abaixo de 440 px`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, altura);
    await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
    const linhas = page.getByRole('link', { name: /^Abrir atualização de / });
    await expect(linhas).toHaveCount(18);
    await assentado(async () => {
      const caixas = await linhas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: r.width })));
      const primeiraLinha = caixas.filter((c) => Math.abs(c.y - caixas[0].y) < 2);
      expect(primeiraLinha).toHaveLength(colunas);
      // Ordem de leitura por linha: a 2ª atualização fica à direita da 1ª (ou embaixo, numa coluna só).
      if (colunas > 1) expect(caixas[1].x).toBeGreaterThan(caixas[0].x);
      for (const c of caixas) expect(c.w).toBeLessThanOrEqual(largura);
      if (colunas > 1) for (const c of caixas) expect(c.w).toBeGreaterThanOrEqual(440);
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

// tela larga: revisão (24/11): os grupos de Alunos em duas colunas só com duas metades de ~1000 px; a esquerda leva os primeiros.
for (const [largura, altura, duas] of [[390, 844, false], [1280, 900, false], [1920, 1080, false], [2560, 1440, true], [3440, 1440, true]] as const) {
  test(`Alunos ${largura} px: grupos em ${duas ? 'duas colunas' : 'uma coluna'}`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, altura);
    await page.goto('/treinador/alunos');
    await expect(grupo(page, 'Em dia')).toBeVisible();
    await assentado(async () => {
      const revisar = await caixa(grupo(page, 'Para revisar'));
      const atrasados = await caixa(grupo(page, 'Atrasados'));
      const emDia = await caixa(grupo(page, 'Em dia'));
      // Atrasados sempre embaixo de Para revisar, na mesma coluna.
      expect(Math.abs(atrasados.x - revisar.x)).toBeLessThan(2);
      expect(atrasados.y).toBeGreaterThan(revisar.y);
      if (duas) {
        // [5 + 5] contra [10]: Em dia abre a coluna da direita, na altura de Para revisar.
        expect(emDia.x).toBeGreaterThan(revisar.x + 900);
        expect(Math.abs(emDia.y - revisar.y)).toBeLessThan(4);
        // As colunas da lista continuam (cabeçalho "Plano em uso" em cada cartão).
        await expect(page.getByText('Plano em uso', { exact: true })).toHaveCount(3);
      } else {
        expect(Math.abs(emDia.x - revisar.x)).toBeLessThan(2);
        expect(emDia.y).toBeGreaterThan(atrasados.y);
      }
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

// tela larga: revisão (24/11): os indicadores de Números param no mesmo teto das colunas (antes iam até o fim da área).
for (const [largura, altura] of [[1920, 1080], [2560, 1440], [3440, 1440]] as const) {
  test(`Números ${largura} px: indicadores e colunas terminam na mesma borda direita`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, altura);
    await page.goto('/treinador/numeros');
    await expect(page.getByRole('table', { name: 'Alunos e atualizações de cada membro da equipe' })).toBeVisible();
    await assentado(async () => {
      const ultimoIndicador = await caixa(page.getByLabel(/^Para revisar: /).first());
      const equipe = await caixa(page.getByRole('table', { name: 'Alunos e atualizações de cada membro da equipe' }));
      // A tabela da equipe fica dentro do cartão da coluna da direita (recuo de 20 e borda de 1): a borda do último
      // indicador cai logo depois da tabela, nunca centenas de px adiante (antes: ~450 em 2560 e ~1300 em 3440).
      const sobra = ultimoIndicador.x + ultimoIndicador.width - (equipe.x + equipe.width);
      expect(sobra).toBeGreaterThanOrEqual(0);
      expect(sobra).toBeLessThanOrEqual(24);
      expect(ultimoIndicador.x + ultimoIndicador.width).toBeLessThanOrEqual(largura);
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

// tela larga: revisão (24/11): sem cartão sozinho na linha. Dois grupos pequenos ficam lado a lado em 3440; um grupo só
// segue numa coluna (não há com quem dividir a linha; sugestão S4 do relatório).
test('Alunos 3440 px: dois grupos de um aluno lado a lado; um grupo só, uma coluna da largura da lista', async ({ page }) => {
  const doisGrupos = [ALUNOS[0], ALUNOS[1]];
  const { errosDaPagina } = await abrir(page, 3440, 1440, doisGrupos);
  await page.goto('/treinador/alunos');
  await expect(grupo(page, 'Atrasados')).toBeVisible();
  await assentado(async () => {
    const revisar = await caixa(grupo(page, 'Para revisar'));
    const atrasados = await caixa(grupo(page, 'Atrasados'));
    expect(Math.abs(atrasados.y - revisar.y)).toBeLessThan(4);
    expect(atrasados.x).toBeGreaterThan(revisar.x + 900);
  });
  await semRolagemHorizontal(page);
  expect(errosDaPagina).toEqual([]);
});

test('Alunos 3440 px: um grupo só fica numa coluna', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 3440, 1440, [ALUNOS[0], ALUNOS[4], ALUNOS[8]]);
  await page.goto('/treinador/alunos');
  await expect(grupo(page, 'Para revisar')).toBeVisible();
  await expect(page.getByText('Plano em uso', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Abrir / })).toHaveCount(3);
  await semRolagemHorizontal(page);
  expect(errosDaPagina).toEqual([]);
});
