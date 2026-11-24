// tela larga: revisão (24/11)
import { expect, test, type Page } from '@playwright/test';

import type { AvaliacaoFisica } from '../src/api/avaliacaoFisicaTipos';
import type { ContratacaoResponse, CobrancaResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, Atualizacao, DiaDeTreino, EvolucaoRespostas, ItemDeAtividade, Lesao, PastaResumo, PlanoResumo, RegistroPeso } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel } from './financeiro-falso';

/**
 * Tela larga: revisão (24/11) das abas da Ficha do aluno (plano `docs/planos/tela-larga-revisao-ficha.md`). Confere por
 * geometria, em 1280, 1920, 2560 e 3440 px com o menu aberto, que a aba Dados não estica: em 1280 e 1920 as duas colunas
 * (3:2) até `LARGURA_EDITOR_DE_CAMPOS`, alinhadas à esquerda (4.10 de `docs/design-e-front.md`); em 2560 e 3440 três pilhas
 * (revisão 2, `docs/planos/tela-larga-revisao-2.md`), cada uma até `LARGURA_EDITOR_DE_CAMPOS`. Capturas só com
 * `CAPTURAS_TELA_LARGA_GRUPO` (pasta fora do git) e `FASE` (`antes` ou `depois`). Relógio em 19/10/2026; só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ID = ALUNO_FINANCEIRO_ID;
const PERMISSOES = [
  ...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'REGISTRO_REAGIR', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER', 'PASTA_ALTERAR',
  'TREINO_ALTERAR', 'DIETA_ALTERAR', 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR', 'ALUNO_EXPORTAR',
];

const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: '(45) 90000-0000', objetivo: 'Ganhar força e melhorar o condicionamento.',
  cpf: null, endereco: null, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 30, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, ultimoAcesso: { tipo: 'LOGIN', em: '2026-10-17T15:30:00Z' },
};

const PASTA_ATUAL: PastaResumo = { id: 'f0000000-0000-4000-8000-0000000000a1', alunoId: ID, titulo: 'Pasta de outubro', inicio: '2026-10-01', fim: '2026-10-30', concluidaEm: null };
const PASTA_ANTIGA: PastaResumo = { id: 'f0000000-0000-4000-8000-0000000000a2', alunoId: ID, titulo: 'Pasta de setembro', inicio: '2026-09-01', fim: '2026-09-30', concluidaEm: '2026-09-30T20:00:00Z' };
const plano = (id: string, titulo: string, pastaId: string): PlanoResumo => ({
  id, alunoId: ID, pastaId, titulo, inicio: '2026-10-01', fim: '2026-10-30', ativo: pastaId === PASTA_ATUAL.id, versaoPublicada: 1,
  publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 2,
});

const ATUALIZACAO: Atualizacao = {
  id: 'b0000000-0000-4000-8000-0000000000b1', pastaId: PASTA_ATUAL.id, alunoId: ID, nomeAluno: ALUNO.nome, dataAtualizacao: '2026-10-30',
  fase: 'NENHUMA', diasParaData: 11, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1,
  questionarioVersaoId: null, questionarioNome: null, modelo: null, respostas: null, enviadaEm: null, feedback: null, versao: 1, resumo: null,
};

const serie = (n: number, carga: number, reps: number) => ({
  id: `s${n}`, serieUid: `su${n}`, tipo: 'WS', trabalho: true, carga, unidade: 'kg', repeticoes: reps, concluida: true, observacao: null,
});
const dia = (data: string, i: number): DiaDeTreino => ({
  data,
  sessoes: [{
    sessaoUid: `sessao-${i % 2}`, sessao: i % 2 ? 'Treino B' : 'Treino A', planoVersaoId: 'v1',
    exercicios: [
      { exercicioUid: 'e1', exercicioId: 'ex1', nome: 'Supino reto', grupoMuscular: 'Peito', series: [serie(1, 60 + i, 10), serie(2, 60 + i, 8)] },
      { exercicioUid: 'e2', exercicioId: 'ex2', nome: 'Agachamento livre', grupoMuscular: 'Pernas', series: [serie(3, 80 + i, 8)] },
    ],
  }],
});
const DIAS = ['2026-09-22', '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-17'].map(dia);

const PESOS: RegistroPeso[] = ['2026-08-01', '2026-08-20', '2026-09-05', '2026-09-20', '2026-10-05', '2026-10-17'].map((data, i) => ({
  id: `p${i}`, data, pesoKg: 84 - i * 0.6, variacao: i ? -0.6 : null, observacao: null,
}));

const medidas = (k: number) => ({
  bracoDireito: 36 + k, bracoEsquerdo: 35.5 + k, peitoral: 102 - k, cintura: 88 - k, abdomen: 90 - k, quadril: 101 - k,
  coxaDireita: 58, coxaEsquerda: 57.5, panturrilhaDireita: 38, panturrilhaEsquerda: 37.5,
});
const AVALIACOES: AvaliacaoFisica[] = [
  { id: 'av1', data: '2026-10-05', medidas: medidas(1), observacao: null, pesoKg: 81, versao: 1, criadoEm: '2026-10-05T12:00:00Z', alteradoEm: '2026-10-05T12:00:00Z' },
  { id: 'av2', data: '2026-09-05', medidas: medidas(0), observacao: null, pesoKg: 82.8, versao: 1, criadoEm: '2026-09-05T12:00:00Z', alteradoEm: '2026-09-05T12:00:00Z' },
];

const EVOLUCAO: EvolucaoRespostas = {
  limite: 12, atualizacoes: 4,
  series: [
    { perguntaId: 'q1', tipo: 'NOTA', rotulo: 'Como foi a semana de treinos?', rotuloCurto: 'Treinos', unidade: null, casas: null, min: 0, max: 10, pontos: [] },
    { perguntaId: 'q2', tipo: 'NOTA', rotulo: 'Qualidade do sono', rotuloCurto: 'Sono', unidade: null, casas: null, min: 0, max: 10, pontos: [] },
    { perguntaId: 'q3', tipo: 'NUMERO', rotulo: 'Passos por dia (média)', rotuloCurto: 'Passos', unidade: 'passos', casas: 0, min: null, max: null, pontos: [] },
  ].map((s, k) => ({
    ...s, tipo: s.tipo as 'NOTA' | 'NUMERO',
    pontos: ['2026-07-30', '2026-08-30', '2026-09-30', '2026-10-15'].map((data, i) => ({ atualizacaoId: `at${i}`, data, valor: k === 2 ? 7000 + i * 600 : 6 + (i % 3) })),
  })),
};

const agora = new Date('2026-10-19T12:00:00-03:00').getTime();
const ATIVIDADE: ItemDeAtividade[] = [
  { tipo: 'TREINO_CONCLUIDO', titulo: 'Treino concluído', quando: new Date(agora - 2 * 86_400_000).toISOString(), destino: null },
  { tipo: 'PESO_REGISTRADO', titulo: 'Peso registrado', quando: new Date(agora - 2 * 86_400_000).toISOString(), destino: null },
  { tipo: 'PLANO_PUBLICADO', titulo: 'Plano publicado', quando: new Date(agora - 18 * 86_400_000).toISOString(), destino: { tipo: 'PASTA', id: PASTA_ATUAL.id } },
];

const lesao = (id: string, regiao: string, p: Partial<Lesao> = {}): Lesao => ({
  id, regiao, descricao: null, dataInicio: null, dataFim: null, situacao: 'RECUPERADA', observacao: null, ...p,
});
const LESOES = [
  lesao('l1', 'Ombro direito', { descricao: 'Tendinite', situacao: 'ATIVA', dataInicio: '2026-10-01', observacao: 'Evitar desenvolvimento acima da cabeça até a liberação do fisioterapeuta.' }),
  lesao('l2', 'Joelho esquerdo', { descricao: 'Entorse leve', dataInicio: '2026-03-01', dataFim: '2026-05-15' }),
];

const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000d1', alunoId: ID, planoComercialId: 'b0000000-0000-4000-8000-0000000000d1',
  planoNome: 'Trimestral', periodicidade: 'TRIMESTRAL', valorCentavos: 99_700, motivoValor: null, inicio: '2026-10-19', diaVencimento: 19,
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-10-19T12:00:00Z', versao: 0, minimoAte: null,
  terminoVigencia: '2027-01-19', diasRestantesVigencia: 92, alertaRenovacao: 'EM_DIA',
};
const COBRANCA: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000e1', contratacaoId: CONTRATACAO.id, alunoId: ID, alunoNome: ALUNO.nome,
  planoNome: 'Trimestral', competencia: '2026-10-19', vencimento: '2026-10-19', valorCentavos: 99_700, situacao: 'ABERTA', vencida: false, diasDeAtraso: null,
  pagoEm: null, forma: null,
};

async function abrir(page: Page, largura: number, aba: string, opcoes: { tamanhoTexto?: string; tema?: string; altura?: number; enviada?: boolean; vazio?: boolean } = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? (largura >= 2560 ? 1440 : largura >= 1920 ? 1080 : 900) });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, prefs);
    } catch { /* quadro sem armazenamento */ }
  }, [TREINADOR.id, JSON.stringify({ tema: opcoes.tema ?? 'ESCURO', larguraConteudo: 'AUTOMATICA', ...(opcoes.tamanhoTexto ? { tamanhoTexto: opcoes.tamanhoTexto } : {}) })] as const);
  const atualizacao: Atualizacao = opcoes.enviada ? { ...ATUALIZACAO, fase: 'ENVIADA', enviadaEm: '2026-10-18T12:00:00Z' } : ATUALIZACAO;
  // `vazio`: sem plano contratado e sem lesões (o estado que não é o de sucesso, nas capturas).
  const financeiro = estadoFinanceiro(opcoes.vazio ? { contratacoes: [], cobrancas: [] } : { contratacoes: [CONTRATACAO], cobrancas: [COBRANCA] });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: PERMISSOES, retornoHabilitado: true })),
    ...rotasDoFinanceiro(financeiro), ...rotasDoResponsavel(estadoDoResponsavel()),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: null, versao: 1, diasAtualizacaoPadrao: 30 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: { corpo: opcoes.vazio ? [] : LESOES },
    [`GET /alunos/${ID}/pastas`]: { corpo: [PASTA_ATUAL, PASTA_ANTIGA] },
    [`GET /alunos/${ID}/pastas/vigente`]: { corpo: { pasta: PASTA_ATUAL } },
    [`GET /alunos/${ID}/planos-treino`]: { corpo: [plano('t1', 'Treino de outubro', PASTA_ATUAL.id), plano('t0', 'Treino de setembro', PASTA_ANTIGA.id)] },
    [`GET /alunos/${ID}/planos-dieta`]: { corpo: [plano('d1', 'Dieta de outubro', PASTA_ATUAL.id)] },
    [`GET /alunos/${ID}/planos-mobilidade`]: { corpo: [] },
    'GET /planos-dieta/d1/versoes/1': { corpo: { id: 'vd1', planoId: 'd1', numero: 1, titulo: 'Dieta de outubro', inicio: null, fim: null, publicadoEm: '2026-10-01T12:00:00Z', conteudo: { aguaLitros: 3 } } },
    // `enviada`: a atualização da pasta já chegou, e a linha da pasta ganha "Revisar atualização" (a linha com ação).
    [`GET /alunos/${ID}/atualizacao`]: { corpo: atualizacao },
    [`GET /alunos/${ID}/atualizacoes`]: { corpo: [atualizacao] },
    [`GET /alunos/${ID}/atualizacoes/evolucao`]: { corpo: EVOLUCAO },
    [`GET /alunos/${ID}/execucoes`]: { corpo: DIAS },
    [`GET /alunos/${ID}/mobilidade/registros`]: { corpo: [] },
    [`GET /alunos/${ID}/agua`]: { corpo: ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-17', '2026-10-18'].map((data, i) => ({ data, aguaMl: 1500 + i * 400 })) },
    [`GET /alunos/${ID}/sessoes-concluidas`]: {
      corpo: {
        totalConcluidos: 4,
        sessoes: DIAS.slice(-4).map((d, i) => ({
          id: `sc${i}`, planoVersaoId: 'v1', sessaoUid: `sessao-${i % 2}`, sessaoNome: i % 2 ? 'Treino B' : 'Treino A', data: d.data, concluida: true,
          resultado: 'COMPLETA', duracaoSegundos: 3600 + i * 300, comentario: i === 3 ? 'Senti o ombro no fim do treino.' : null, vistoEm: i < 2 ? `${d.data}T22:00:00Z` : null,
        })),
      },
    },
    [`GET /alunos/${ID}/recordes/semana`]: {
      corpo: { de: '2026-10-13', ate: '2026-10-19', total: 1, series: [{ alunoId: ID, alunoNome: ALUNO.nome, data: '2026-10-17', exercicioId: 'ex2', exercicioNome: 'Agachamento livre', recordes: [{ tipo: 'MAIOR_CARGA', carga: 88, repeticoes: 8, valor: 88 }] }] },
    },
    [`GET /alunos/${ID}/trocas-de-exercicio`]: {
      corpo: {
        de: '2026-10-13', ate: '2026-10-19',
        trocas: [{
          data: '2026-10-17', planoVersaoId: 'v1', sessaoUid: 'sessao-0', sessao: 'Treino A', exercicioUid: 'e1',
          principal: { exercicioId: 'ex1', nome: 'Supino reto' }, alternativa: { exercicioId: 'ex3', nome: 'Supino com halteres' }, series: 3, vistoEm: null,
        }],
      },
    },
    [`GET /alunos/${ID}/pesos`]: { corpo: PESOS },
    [`GET /alunos/${ID}/avaliacoes-fisicas`]: { corpo: AVALIACOES },
    [`GET /alunos/${ID}/fotos`]: { corpo: [] },
    [`GET /alunos/${ID}/atividade-recente`]: { corpo: { itens: ATIVIDADE } },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
  });
  await page.goto(`/treinador/alunos/${ID}?aba=${aba}`);
  await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toBeVisible();
  return api;
}

const ABAS: { aba: string; pronta: (p: Page) => Promise<void> }[] = [
  { aba: 'resumo', pronta: (p) => expect(p.getByRole('heading', { name: 'Última medição', exact: true })).toBeVisible() },
  { aba: 'planos', pronta: (p) => expect(p.getByText('Pasta de outubro').first()).toBeVisible() },
  { aba: 'acompanhamento', pronta: (p) => expect(p.getByText('Água').first()).toBeVisible() },
  { aba: 'evolucao', pronta: (p) => expect(p.getByText('Fotos', { exact: true })).toBeVisible() },
  { aba: 'ficha', pronta: (p) => expect(p.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible() },
];

const PASTA_DAS_CAPTURAS = process.env.CAPTURAS_TELA_LARGA_GRUPO;
const FASE = process.env.FASE ?? 'depois';

test.describe('capturas', () => {
  test.skip(!PASTA_DAS_CAPTURAS, 'só com CAPTURAS_TELA_LARGA_GRUPO');
  for (const largura of [1920, 2560, 3440]) {
    for (const { aba, pronta } of ABAS) {
      test(`${aba} ${largura}`, async ({ page }) => {
        // Alta o bastante para a aba inteira caber (a rolagem é interna à `Tela`, o `fullPage` não a pega).
        const { naoTratadas } = await abrir(page, largura, aba, { altura: 2400 });
        await pronta(page);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/${aba}/${FASE}/${largura}.png`, fullPage: true });
        console.log(`${aba} ${largura} não tratadas:`, [...new Set(naoTratadas)].join(', '));
      });
    }
    // Planos com a linha que tem ação ("Revisar atualização"): o botão cabe na coluna de 720 px.
    test(`planos ${largura} com ação`, async ({ page }) => {
      await abrir(page, largura, 'planos', { altura: 1400, enviada: true });
      await expect(page.getByRole('button', { name: 'Revisar atualização', exact: true })).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/planos/${FASE}/${largura}-revisar.png` });
    });
    if (largura === 2560) {
      test('ficha 2560 texto grande', async ({ page }) => {
        await abrir(page, largura, 'ficha', { altura: 2400, tamanhoTexto: 'EXTRA' });
        await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/ficha/${FASE}/${largura}-texto-extra.png` });
      });
    }
    if (largura >= 2560) {
      test(`ficha ${largura} editando`, async ({ page }) => {
        await abrir(page, largura, 'ficha', { altura: 2400 });
        await page.getByRole('button', { name: 'Editar dados' }).click();
        await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/ficha/${FASE}/${largura}-editando.png` });
      });
      test(`ficha ${largura} vazio claro`, async ({ page }) => {
        await abrir(page, largura, 'ficha', { altura: 1600, vazio: true, tema: 'CLARO' });
        await expect(page.getByText('Nenhuma lesão registrada.', { exact: true })).toBeVisible();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/ficha/${FASE}/${largura}-vazio-claro.png` });
      });
    }
  }
  // Sem regressão no que já existia: 1280 (duas colunas nos Dados, uma no resto) e 390 (celular).
  for (const largura of [1280, 390]) {
    for (const { aba, pronta } of ABAS) {
      test(`${aba} ${largura}`, async ({ page }) => {
        await abrir(page, largura, aba, { altura: 2400 });
        await pronta(page);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${PASTA_DAS_CAPTURAS}/${aba}/${FASE}/${largura}.png` });
      });
    }
  }
});

const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });
const caixaDe = async (alvo: ReturnType<Page['locator']>) => {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};
const cartaoCom = (page: Page, titulo: string) =>
  page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) }).first();
async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const LARGURAS = [1280, 1920, 2560, 3440];

// Três colunas (revisão 2, decisão 1): pela largura medida da aba, a mesma régua do Resumo (2560 com o menu aberto é `larga`).
const TRES_COLUNAS = [
  ['Identificação', 'Contato e endereço', 'Objetivo e observações'],
  ['Plano contratado', 'Histórico de lesões'],
  ['Configuração do acompanhamento', 'Acesso ao app', 'Anamnese'],
];

for (const largura of [2560, 3440]) {
  test(`${largura} px: Dados em três pilhas independentes, cada cartão até 1400 px, e a edição no teto`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, largura, 'ficha');
    await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anamnese', exact: true })).toBeVisible();
    await assentado(async () => {
      const colunas = await Promise.all(TRES_COLUNAS.map((c) => Promise.all(c.map((t) => caixaDe(cartaoCom(page, t))))));
      const titulo = await caixaDe(page.getByText('Dados do aluno', { exact: true }));
      const editar = await caixaDe(page.getByRole('button', { name: 'Editar dados' }));
      for (const [i, coluna] of colunas.entries()) {
        // Uma pilha: mesma borda esquerda, na ordem, 24 px entre cada par; nenhum cartão passa do editor de campos.
        for (const c of coluna) {
          expect(Math.abs(c.x - coluna[0].x)).toBeLessThanOrEqual(1);
          expect(c.width).toBeLessThanOrEqual(1401);
        }
        for (let k = 1; k < coluna.length; k++) expect(Math.abs(coluna[k].y - (coluna[k - 1].y + coluna[k - 1].height) - 24)).toBeLessThanOrEqual(1);
        // As três no mesmo topo, lado a lado, sem se sobrepor.
        expect(Math.abs(coluna[0].y - colunas[0][0].y)).toBeLessThanOrEqual(1);
        if (i) expect(coluna[0].x).toBeGreaterThanOrEqual(colunas[i - 1][0].x + colunas[i - 1][0].width + 23);
      }
      // O título começa na 1ª coluna e o "Editar dados" termina na borda da 3ª.
      expect(Math.abs(colunas[0][0].x - titulo.x)).toBeLessThanOrEqual(1);
      const ultima = colunas[2][0];
      expect(Math.abs(editar.x + editar.width - (ultima.x + ultima.width))).toBeLessThanOrEqual(1);
    });
    // A coluna do meio é a mais larga (1,2): as lesões continuam em tabela já em 2560.
    await expect(page.getByRole('table', { name: 'Lesões' })).toHaveCount(1);
    await semRolagemHorizontal(page);

    // Editando: o formulário no teto do editor de campos e os blocos das colunas continuam montados (não buscam de novo).
    await page.getByRole('button', { name: 'Editar dados' }).click();
    const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
    await expect(salvar).toBeVisible();
    const titulo = await caixaDe(page.getByText('Dados do aluno', { exact: true }));
    expect((await caixaDe(salvar)).x + (await caixaDe(salvar)).width - titulo.x).toBeLessThanOrEqual(1401);
    await expect(page.getByRole('heading', { name: 'Plano contratado', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acesso ao app', exact: true })).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `/alunos/${ID}/anamneses`)).toHaveLength(1);
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [1280, 1920]) {
  test(`${largura} px: Dados nas mesmas duas colunas (3:2), sem passar de 1400 px, à esquerda`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, 'ficha');
    await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
    await assentado(async () => {
      const titulo = await caixaDe(page.getByText('Dados do aluno', { exact: true }));
      const editar = await caixaDe(page.getByRole('button', { name: 'Editar dados' }));
      const ident = await caixaDe(cartaoCom(page, 'Identificação'));
      const config = await caixaDe(cartaoCom(page, 'Configuração do acompanhamento'));
      const abaResumo = await caixaDe(page.getByRole('tab', { name: 'Resumo', exact: true }));
      // A aba vai do título (à esquerda, na borda das abas) ao "Editar dados" e não passa do teto do editor de campos.
      expect(Math.abs(ident.x - titulo.x)).toBeLessThanOrEqual(1);
      expect(titulo.x).toBeLessThanOrEqual(abaResumo.x);
      expect(config.x + config.width - ident.x).toBeLessThanOrEqual(1401);
      expect(Math.abs(editar.x + editar.width - (config.x + config.width))).toBeLessThanOrEqual(1);
      // As mesmas duas colunas, 3 para 2, no mesmo topo.
      expect(Math.abs(ident.y - config.y)).toBeLessThanOrEqual(1);
      expect(ident.width / config.width).toBeGreaterThan(1.45);
      expect(ident.width / config.width).toBeLessThan(1.55);
      if (largura >= 1920) expect(config.x + config.width - ident.x).toBeGreaterThan(1390);
    });
    // As lesões ficam em tabela na coluna da esquerda a partir de 1920 (no teto, ~785 px); em 1280, cartões.
    await expect(page.getByRole('table', { name: 'Lesões' })).toHaveCount(largura >= 1920 ? 1 : 0);
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of LARGURAS) {
  test(`${largura} px: Planos com as pastas em colunas, nunca linhas esticadas`, async ({ page }) => {
    await abrir(page, largura, 'planos', { enviada: true });
    const outubro = page.getByRole('button', { name: /^Pasta Pasta de outubro/ });
    const setembro = page.getByRole('button', { name: /^Pasta Pasta de setembro/ });
    await expect(setembro).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar atualização', exact: true })).toBeVisible();
    await assentado(async () => {
      const o = await caixaDe(outubro);
      const s = await caixaDe(setembro);
      // 1280: uma coluna (a mais recente em cima). Da 1920 em diante: lado a lado, cada uma com no máximo a largura de uma coluna.
      if (largura === 1280) expect(s.y).toBeGreaterThan(o.y + o.height);
      else {
        expect(Math.abs(s.y - o.y)).toBeLessThanOrEqual(1);
        expect(s.x).toBeGreaterThan(o.x + o.width);
        // Duas colunas em 1920, três (o teto) em 2560 e 3440: nenhuma passa de ~1000 px.
        expect(o.width).toBeLessThanOrEqual(1000);
      }
    });
    await semRolagemHorizontal(page);
  });

  test(`${largura} px: Resumo com a Atividade recente em 3ª coluna só quando cabem três`, async ({ page }) => {
    const { pedidos } = await abrir(page, largura, 'resumo');
    await expect(page.getByText('Plano publicado', { exact: true })).toBeVisible();
    await assentado(async () => {
      const planejamento = await caixaDe(cartaoCom(page, 'Planejamento'));
      const atividade = await caixaDe(cartaoCom(page, 'Atividade recente'));
      if (largura >= 2560) {
        expect(Math.abs(atividade.y - planejamento.y)).toBeLessThanOrEqual(1);
        expect(atividade.x).toBeGreaterThan(planejamento.x + planejamento.width);
      } else expect(atividade.y).toBeGreaterThan(planejamento.y + planejamento.height);
    });
    // A 3ª coluna já nasce no lugar (a largura vem medida do cabeçalho): a Atividade recente não monta duas vezes.
    expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `/alunos/${ID}/atividade-recente`)).toHaveLength(1);
    await semRolagemHorizontal(page);
  });

  for (const [aba, esquerda, direita] of [
    ['acompanhamento', 'Frequência e mobilidade', 'Água'],
    ['evolucao', 'Peso', 'Avaliação física'],
  ] as const) {
    test(`${largura} px: ${aba} em duas pilhas só a partir de 2560`, async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page, largura, aba);
      await expect(page.getByRole('heading', { name: direita, exact: true })).toBeVisible();
      await assentado(async () => {
        const e = await caixaDe(cartaoCom(page, esquerda));
        const d = await caixaDe(cartaoCom(page, direita));
        if (largura >= 2560) {
          // Lado a lado, mesmo topo, metades iguais.
          expect(Math.abs(e.y - d.y)).toBeLessThanOrEqual(1);
          expect(d.x).toBeGreaterThan(e.x + e.width);
          expect(Math.abs(e.width - d.width)).toBeLessThanOrEqual(2);
        } else if (aba === 'evolucao') expect(d.y).toBeGreaterThan(e.y + e.height);
      });
      if (aba === 'evolucao') {
        // O campo "Medida" não estica: para na largura de formulário (640).
        expect((await caixaDe(page.getByRole('button', { name: /Medida/ }).first())).width).toBeLessThanOrEqual(641);
      }
      // As pilhas nascem no arranjo certo: os cartões não montam numa coluna e remontam em duas (cada um busca uma vez).
      const rota = aba === 'evolucao' ? `/alunos/${ID}/avaliacoes-fisicas` : `/alunos/${ID}/sessoes-concluidas`;
      expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === rota)).toHaveLength(1);
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

