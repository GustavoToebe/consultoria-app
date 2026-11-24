import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Alimento, AlunoDetalhe, Atualizacao, ConteudoDieta, ConteudoMobilidadeApi, ItemDeAtividade, ItemDieta, PainelTreinador, PlanoDetalhe, Refeicao } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, erroApi, MARCA, PERMISSOES_TREINADOR, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { BIBLIOTECA, PLANO_ID as TREINO_ID, planoDetalhe } from './editor-inspetor.dados';
import { estadoFinanceiro, INADIMPLENTE, PAINEL_COM_DADOS, PERMISSOES_FINANCEIRO, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Tela larga (Ondas A e B): verifica larguras de 1366 a 3440 px com menu aberto e recolhido, ausência de rolagem
 * horizontal, preferência "Largura do conteúdo" (Automática vs Limitada em 1800 px) e as 3 colunas na faixa
 * `ultralarga` (Início, Resumo do aluno, Editor de treino com ResumoDaSessao ao lado, Editor de dieta com TotalDoDia
 * ao lado, Ajuda com 3 colunas e texto corrido limitado, Financeiro › Visão geral). Gera capturas em pasta fora do git.
 */

// Sem CAPTURAS_TELA_LARGA, as capturas vão para um diretório temporário criado só quando o teste captura (nada de caminho fixo).
let pastaTemporaria: string | undefined;
const pastaDasCapturas = () => process.env.CAPTURAS_TELA_LARGA ?? (pastaTemporaria ??= fs.mkdtempSync(path.join(os.tmpdir(), 'capturas-tela-larga-')));

const TODAS_PERMISSOES = [
  ...PERMISSOES_TREINADOR,
  'ATUALIZACAO_LER',
  'REGISTRO_LER',
  'TREINO_LER',
  'TREINO_ALTERAR',
  'TREINO_PUBLICAR',
  'DIETA_LER',
  'DIETA_ALTERAR',
  'DIETA_PUBLICAR',
  'AGENDA_LER',
  'BIBLIOTECA_LER',
  'MODELO_LER',
  ...PERMISSOES_FINANCEIRO,
  'EQUIPE_LER',
  'AUDITORIA_LER',
];

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const DIETA_ID = 'p0000000-0000-4000-8000-0000000000d1';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID,
  nome: ALUNO.nome,
  email: ALUNO.email,
  telefone: null,
  objetivo: null,
  ativo: true,
  temAcesso: true,
  conviteExpiraEm: null,
  versao: 1,
  diasAtualizacao: null,
  anonimizado: false,
  emailDeAcesso: ALUNO.email,
  aguardandoPrimeiroAcesso: false,
};

const SEM_ATUALIZACAO: Atualizacao = {
  id: null,
  pastaId: null,
  alunoId: ALUNO_ID,
  nomeAluno: null,
  dataAtualizacao: null,
  fase: 'NENHUMA',
  diasParaData: 0,
  diasDeAtraso: 0,
  atrasoAte: null,
  atrasoMotivo: null,
  questionarioVersaoNumero: 0,
  questionarioVersaoId: null,
  questionarioNome: null,
  modelo: null,
  respostas: null,
  enviadaEm: null,
  feedback: null,
  versao: null,
  resumo: null,
};

const ATIVIDADE: ItemDeAtividade[] = [
  { tipo: 'PLANO_PUBLICADO', titulo: 'Plano publicado', quando: '2026-10-18T14:00:00Z', destino: null },
  { tipo: 'TREINO_CONCLUIDO', titulo: 'Treino concluído', quando: '2026-10-17T10:00:00Z', destino: null },
];

const PAINEL_INICIO: PainelTreinador = {
  atualizacoesParaRevisar: 3,
  atualizacoesAtrasadas: 2,
  atualizacoesAvisaramAtraso: 0,
  atualizacoesProximas: 5,
  alunosAtivos: 24,
  alunosSemRegistro: [{ id: ALUNO_ID, nome: 'Aluno Fictício 1', ultimoRegistro: '2026-10-05' }],
  ultimasExecucoes: [],
  planosTerminando: [],
  pastasARenovar: 2,
  pastasParaRenovar: [],
  alunosSemPastaComPeriodo: 1,
  alunosSemRegistroTotal: 4,
  alunosSemAcesso: 1,
  alunosInativos: 2,
  sessoesConcluidas7Dias: 18,
};

const PAO: Alimento = {
  id: 'pao',
  nome: 'Pão fictício',
  baseQuantidade: 100,
  baseUnidade: 'g',
  kcal: 266,
  proteina: 8.4,
  carboidrato: 49.6,
  gordura: 3.2,
  gramasPorUnidade: null,
  fonte: null,
  origem: 'MANUAL',
  fatorCorrecao: null,
  fatorCoccao: null,
  grupo: null,
};
const ARROZ: Alimento = {
  id: 'arroz',
  nome: 'Arroz fictício',
  baseQuantidade: 100,
  baseUnidade: 'g',
  kcal: 128,
  proteina: 2.5,
  carboidrato: 28,
  gordura: 0.2,
  gramasPorUnidade: null,
  fonte: null,
  origem: 'MANUAL',
  fatorCorrecao: null,
  fatorCoccao: null,
  grupo: null,
};

const itemDieta = (uid: string, a: Alimento, quantidade: number): ItemDieta => {
  const fator = quantidade / (a.baseQuantidade ?? 1);
  return {
    uid,
    alimentoId: a.id,
    nome: a.nome,
    quantidade,
    unidade: a.baseUnidade ?? 'g',
    kcal: (a.kcal ?? 0) * fator,
    proteina: (a.proteina ?? 0) * fator,
    carboidrato: (a.carboidrato ?? 0) * fator,
    gordura: (a.gordura ?? 0) * fator,
    manual: false,
  };
};

const REFEICOES: Refeicao[] = [
  {
    uid: 'cafe',
    nome: 'Café da manhã',
    horario: '07:00',
    observacao: null,
    modoDePreparo: null,
    opcoes: [{ uid: 'cafe-a', rotulo: 'A', itens: [itemDieta('cafe-pao', PAO, 50)] }],
  },
  {
    uid: 'almoco',
    nome: 'Almoço',
    horario: '12:00',
    observacao: null,
    modoDePreparo: null,
    // Duas opções: as abas e a comparação dos totais aparecem (o que estica na tela larga sem o teto do painel).
    opcoes: [
      { uid: 'almoco-a', rotulo: 'A', itens: [itemDieta('almoco-arroz', ARROZ, 150)] },
      { uid: 'almoco-b', rotulo: 'B', itens: [itemDieta('almoco-pao', PAO, 80)] },
    ],
  },
];

const DIETA_CONTEUDO: ConteudoDieta = {
  objetivo: null,
  dataInicio: null,
  profissional: null,
  orientacoes: [],
  observacoes: null,
  suplementacao: [],
  ergogenicos: null,
  aguaLitros: null,
  refeicoes: REFEICOES,
  variacoes: [],
};

const DIETA_DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: DIETA_ID,
    alunoId: ALUNO_ID,
    pastaId: null,
    titulo: 'Dieta fictícia',
    inicio: '2026-10-01',
    fim: '2026-10-31',
    ativo: true,
    versaoPublicada: 1,
    publicadoEm: '2026-10-01T12:00:00Z',
    rascunhoAlteradoDepoisDePublicar: false,
    versao: 1,
  },
  rascunho: DIETA_CONTEUDO,
  versoes: [{ id: 'v1', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
};

const MOB_ID = 'p0000000-0000-4000-8000-0000000000b1';
const MOBILIDADE: PlanoDetalhe<ConteudoMobilidadeApi> = {
  plano: {
    id: MOB_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Mobilidade fictícia', inicio: '2026-10-01', fim: '2026-10-31', ativo: true,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: {
    orientacoes: 'Antes do treino.',
    secoes: [
      { uid: 's1', titulo: 'Aquecimento', itens: [
        { uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null },
        { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null },
      ] },
      { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: 'Posterior', prescricao: '30s', videoUrl: null }] },
    ],
  },
  versoes: [],
};

/** Título de cartão (h2): `getByText` pegaria antes o link de mesmo nome do menu lateral. */
const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, level: 2, exact: true }).first();

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

async function semRolagemHorizontal(page: Page) {
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(cliente);
}

async function capturar(page: Page, nome: string) {
  const pasta = pastaDasCapturas();
  fs.mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${nome}.png`), fullPage: false });
}

async function prepararAmbiente(
  page: Page,
  largura: number,
  opcoes: {
    altura?: number;
    menuRecolhido?: boolean;
    larguraConteudo?: 'AUTOMATICA' | 'LIMITADA';
    tema?: 'ESCURO' | 'CLARO';
  } = {},
) {
  const altura = opcoes.altura ?? 1080;
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  // Cada chamada prepara o aparelho uma vez só (marca na sessionStorage): sem isso, o `reload` reinjetaria a preferência
  // e apagaria a escolha feita na tela. Chamada nova (outro cenário) ganha marca nova e vence a anterior.
  await page.addInitScript(
    ([id, recolhido, prefs, marca]) => {
      try {
        if (sessionStorage.getItem(marca)) return;
        if (recolhido) localStorage.setItem('menu-lateral-recolhido', '1');
        else localStorage.removeItem('menu-lateral-recolhido');
        localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(prefs));
        sessionStorage.setItem(marca, '1');
      } catch { /* quadro sem acesso ao armazenamento (about:blank, iframe do player) */ }
    },
    [
      TREINADOR.id,
      Boolean(opcoes.menuRecolhido),
      {
        tema: opcoes.tema ?? 'ESCURO',
        larguraConteudo: opcoes.larguraConteudo ?? 'AUTOMATICA',
      },
      `e2e-tela-larga-${Math.random()}`,
    ] as const,
  );

  return simularApi(page, {
    // Um `GET /eu` só: um segundo `sessao`/`sessaoComFinanceiro` espalhado depois trocaria as permissões pelas dele.
    ...(await sessaoComFinanceiro(page, TODAS_PERMISSOES)),
    ...rotasDoFinanceiro(estadoFinanceiro({ inadimplentes: [INADIMPLENTE] })),
    'GET /painel': { corpo: PAINEL_INICIO },
    'GET /financeiro/painel': { corpo: PAINEL_COM_DADOS },
    'GET /inscricoes': { corpo: { itens: [], total: 2 } },
    'GET /agenda': { corpo: { itens: [] } },
    'GET /agenda/resumo': { corpo: { dias: [{ data: '2026-10-19', compromissos: 3, eventos: 0 }] } },
    'GET /treinos/recordes-semana': { corpo: { de: '2026-10-13', ate: '2026-10-19', total: 0, series: [] } },
    'GET /treinos/trocas': { corpo: { total: 0, trocas: [] } },
    'GET /alunos/aniversarios': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    'GET /consultoria/configuracao-inscricao': { corpo: { aberta: true, codigo: 'demo' } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'GET /alimentos': (pedido: PedidoFalso, route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pedido.busca.get('tipo') === 'SUPLEMENTO' ? [] : [PAO, ARROZ]),
      }),
    'GET /alimentos/fatores': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [{ id: 'p1', data: '2026-10-15', pesoKg: 80.5, variacao: null, observacao: null }] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: ATIVIDADE } },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    [`GET /planos-treino/${TREINO_ID}`]: { corpo: planoDetalhe(false) },
    [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DIETA_DETALHE },
    [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: MOBILIDADE },
  });
}

test('Ajustes: preferência Largura do conteúdo alterna entre Automática (padrão) e Limitada', async ({ page }) => {
  await prepararAmbiente(page, 1920);
  await page.goto('/treinador/ajustes');
  const grupo = page.getByRole('radiogroup', { name: 'Largura do conteúdo' });
  await expect(grupo).toBeVisible();
  await expect(grupo.getByRole('radio', { name: 'Automática' })).toHaveAttribute('aria-checked', 'true');
  await grupo.getByRole('radio', { name: 'Limitada' }).click();
  await expect(grupo.getByRole('radio', { name: 'Limitada' })).toHaveAttribute('aria-checked', 'true');
  // A escolha vai para o aparelho (chave por usuário), não só para o estado da tela.
  await expect
    .poll(() => page.evaluate((id) => localStorage.getItem(`treinos:${id}:preferencias`), TREINADOR.id))
    .toContain('"larguraConteudo":"LIMITADA"');

  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Largura do conteúdo' }).getByRole('radio', { name: 'Limitada' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await semRolagemHorizontal(page);
});

for (const largura of [1366, 1536, 1920, 2560, 3440]) {
  for (const menuRecolhido of [false, true]) {
    test(`largura ${largura} px (menu ${menuRecolhido ? 'recolhido' : 'aberto'}): sem rolagem horizontal nas telas principais`, async ({ page }) => {
      const { errosDaPagina } = await prepararAmbiente(page, largura, { menuRecolhido });

      for (const rota of ['/treinador', `/treinador/alunos/${ALUNO_ID}`, `/treinador/treinos/${TREINO_ID}`, `/treinador/dietas/${DIETA_ID}`, '/treinador/ajuda', '/treinador/financeiro']) {
        await page.goto(rota);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Sem acesso a esta tela' })).toHaveCount(0);
        await semRolagemHorizontal(page);
      }

      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('3440 px (ultralarga): Automática abre 3 colunas e supera 1800 px; Limitada segura em 1800 px', async ({ page }) => {
  // ---- Automática em 3440 px ----
  await prepararAmbiente(page, 3440, { larguraConteudo: 'AUTOMATICA' });

  // As posições só valem com o layout assentado (a faixa de largura chega depois do primeiro desenho): cada conferência repete até estabilizar.
  const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });

  // 1. Início (> 1800 px)
  await page.goto('/treinador');
  await assentado(async () => {
    const cabecalhoInicio = await caixa(page.getByRole('heading', { name: 'Início', level: 1 }));
    expect(cabecalhoInicio.x).toBeGreaterThan(200);
    const blocoAtualizacoes = await caixa(titulo(page, 'Atualizações'));
    const blocoAlunos = await caixa(titulo(page, 'Alunos'));
    expect(blocoAlunos.x).toBeGreaterThan(blocoAtualizacoes.x);
  });

  // 2. Resumo do aluno (3 colunas: Planejamento | Última medição | Atividade recente)
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await assentado(async () => {
    const planejamento = await caixa(titulo(page, 'Planejamento'));
    const medicao = await caixa(titulo(page, 'Última medição'));
    const atividade = await caixa(titulo(page, 'Atividade recente'));
    expect(medicao.x).toBeGreaterThan(planejamento.x + planejamento.width);
    expect(atividade.x).toBeGreaterThan(medicao.x + medicao.width);
    expect(Math.abs(planejamento.y - medicao.y)).toBeLessThan(8);
    expect(Math.abs(medicao.y - atividade.y)).toBeLessThan(8);
  });

  // 3. Editor de treino (3 colunas: lista | inspetor | ResumoDaSessao ao lado)
  await page.goto(`/treinador/treinos/${TREINO_ID}`);
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
  // Em ultralarga o resumo sai do cartão da sessão e vira a 3ª coluna (`coluna-resumo-sessao`), à direita da lista.
  let tituloTreinoX = 0;
  await assentado(async () => {
    const resumoSessao = await caixa(page.getByTestId('coluna-resumo-sessao'));
    const listaTreino = await caixa(page.getByRole('button', { name: 'Adicionar exercício' }).first());
    expect(resumoSessao.x).toBeGreaterThan(listaTreino.x + listaTreino.width);
    // O recuo lateral sai da mesma régua nos dois editores: o título começa no mesmo x no treino e na dieta.
    tituloTreinoX = (await caixa(page.getByRole('heading', { level: 1 }))).x;
  });

  // 4. Editor de dieta (3 colunas: lista | refeição | TotalDoDia ao lado)
  await page.goto(`/treinador/dietas/${DIETA_ID}`);
  await expect(page.getByRole('heading', { name: /^Refeições \(/ })).toBeVisible();
  await assentado(async () => {
    const totalDia = await caixa(titulo(page, 'Total do dia'));
    const listaRefeicoes = await caixa(page.getByRole('heading', { name: /^Refeições \(/ }));
    expect(totalDia.x).toBeGreaterThan(listaRefeicoes.x + listaRefeicoes.width);
    const tituloDieta = await caixa(page.getByRole('heading', { level: 1 }));
    expect(Math.abs(tituloTreinoX - tituloDieta.x)).toBeLessThanOrEqual(1);
  });

  // 5. Ajuda (3 colunas: índice | conteúdo | Consultar, com texto corrido limitado)
  await page.goto('/treinador/ajuda');
  await assentado(async () => {
    const indice = await caixa(page.getByRole('navigation', { name: 'Tópicos da ajuda' }));
    const comecar = await caixa(titulo(page, 'Começar a usar'));
    const consultar = await caixa(page.getByRole('heading', { name: 'Consultar', level: 2 }));
    expect(comecar.x).toBeGreaterThan(indice.x + indice.width);
    expect(consultar.x).toBeGreaterThan(comecar.x + comecar.width);
    expect(comecar.width).toBeLessThanOrEqual(800);
    // O bloco de 3 colunas fica centralizado na área (margem esquerda igual à direita), como o de 2 colunas.
    const margens = await page.getByTestId('bloco-da-ajuda').evaluate((bloco) => {
      const b = bloco.getBoundingClientRect();
      const area = bloco.parentElement!.getBoundingClientRect();
      return { esquerda: b.left - area.left, direita: area.right - b.right };
    });
    expect(margens.esquerda).toBeGreaterThan(100);
    expect(Math.abs(margens.esquerda - margens.direita)).toBeLessThanOrEqual(2);
  });

  // 6. Financeiro › Visão geral (6 indicadores na mesma linha, tabela <= 1800 px)
  await page.goto('/treinador/financeiro');
  await assentado(async () => {
    const tabelaInadimplencia = await caixa(page.getByRole('table', { name: 'Cobranças vencidas em aberto' }));
    expect(tabelaInadimplencia.width).toBeLessThanOrEqual(1800);
  });

  // ---- Limitada em 3440 px ----
  await prepararAmbiente(page, 3440, { larguraConteudo: 'LIMITADA' });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  // Em Limitada (teto 1800 px), Resumo do aluno não entra em `ultralarga` e Atividade recente volta para baixo.
  await assentado(async () => {
    const planejamentoLim = await caixa(titulo(page, 'Planejamento'));
    const atividadeLim = await caixa(titulo(page, 'Atividade recente'));
    expect(atividadeLim.y).toBeGreaterThan(planejamentoLim.y + planejamentoLim.height);
  });
});

test('capturas visuais em 1920 px (Automática), 3440 px (Automática) e 3440 px (Limitada)', async ({ page }) => {
  test.setTimeout(180_000); // vários cenários e telas em sequência: o tempo padrão (60 s) não basta
  const cenarios: { largura: number; modo: 'AUTOMATICA' | 'LIMITADA'; incluirImportacao?: boolean }[] = [
    { largura: 1920, modo: 'AUTOMATICA' },
    { largura: 3440, modo: 'AUTOMATICA', incluirImportacao: true },
    { largura: 3440, modo: 'LIMITADA' },
  ];

  for (const c of cenarios) {
    await prepararAmbiente(page, c.largura, { larguraConteudo: c.modo, tema: 'ESCURO' });
    const prefixo = `${c.largura}-${c.modo.toLowerCase()}`;

    await page.goto('/treinador');
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    // O gráfico do recebido só desenha depois de medir a própria largura: sem esperar, a captura sai com a área vazia.
    await expect(page.getByRole('img', { name: /^Recebido \(bruto\)/ }).locator('svg rect').first()).toBeAttached();
    await capturar(page, `${prefixo}-inicio`);

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await expect(titulo(page, 'Planejamento')).toBeVisible();
    await capturar(page, `${prefixo}-resumo-aluno`);

    await page.goto(`/treinador/treinos/${TREINO_ID}`);
    await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
    await capturar(page, `${prefixo}-editor-treino`);

    await page.goto(`/treinador/dietas/${DIETA_ID}`);
    await expect(page.getByRole('heading', { name: /^Refeições \(/ })).toBeVisible();
    await capturar(page, `${prefixo}-editor-dieta`);

    await page.goto('/treinador/ajuda');
    await expect(page.getByRole('heading', { name: 'Ajuda', level: 1 })).toBeVisible();
    await capturar(page, `${prefixo}-ajuda`);

    await page.goto('/treinador/financeiro');
    await expect(page.getByText('Resultado do mês (entradas − saídas registradas)')).toBeVisible();
    await capturar(page, `${prefixo}-financeiro`);

    if (c.incluirImportacao) {
      await page.goto('/treinador/importacao');
      await expect(page.getByRole('heading', { name: 'Importação', level: 1 })).toBeVisible();
      await capturar(page, `${prefixo}-importacao`);
    }
  }
});

/**
 * Editor de uma coluna de campos (19/11): o painel do item (inspetor do treino, da dieta e da mobilidade) para em
 * `LARGURA_EDITOR_DE_CAMPOS` (1400), alinhado à esquerda junto da lista; a sobra fica vazia à direita. Abaixo disso nada
 * muda (em 1280 e 1920 com o menu aberto o painel já é menor). Na ultralarga, a 3ª coluna (Total do dia, Resumo da
 * sessão) vem logo depois do painel, no mesmo grupo à esquerda.
 */
const TETO = 1400 + 2;
const VAO_DAS_COLUNAS = 16;

for (const largura of [1280, 1920, 2400, 2800, 3440]) {
  test(`${largura} px (Automática): painel de campos até 1400 px, à esquerda junto da lista`, async ({ page }) => {
    const { errosDaPagina } = await prepararAmbiente(page, largura, { altura: 1600 });
    // Com o menu aberto (240 px) e 16 px de recuo, a partir de 2400 o painel teria mais de 1400 px sem o teto.
    const limitado = largura >= 2400;
    const tres = largura >= 2800;

    // Mobilidade: lista de seções | painel da seção.
    await page.goto(`/treinador/mobilidades/${MOB_ID}`);
    await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
    const lista = await caixa(page.getByRole('group', { name: 'Seções da mobilidade' }));
    const secao = await caixa(page.locator('#secao-s1'));
    expect(secao.width).toBeLessThanOrEqual(TETO);
    if (limitado) expect(secao.width).toBeGreaterThan(1390);
    expect(Math.abs(secao.x - (lista.x + lista.width) - VAO_DAS_COLUNAS)).toBeLessThanOrEqual(2);
    await semRolagemHorizontal(page);
    await capturar(page, `${largura}-automatica-mobilidade`);

    // Dieta: lista de refeições | refeição com abas e comparação | (ultralarga) Total do dia logo depois.
    await page.goto(`/treinador/dietas/${DIETA_ID}`);
    await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
    await expect(page.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' }).getByRole('tab')).toHaveCount(2);
    const refeicao = await caixa(page.locator('#refeicao-almoco'));
    expect(refeicao.width).toBeLessThanOrEqual(TETO);
    if (limitado) expect(refeicao.width).toBeGreaterThan(1390);
    if (tres) {
      const total = await caixa(page.getByTestId('coluna-total-dieta'));
      expect(Math.abs(total.x - (refeicao.x + refeicao.width) - VAO_DAS_COLUNAS)).toBeLessThanOrEqual(2);
    }
    await semRolagemHorizontal(page);
    await capturar(page, `${largura}-automatica-dieta-abas`);

    // Treino: lista de exercícios | inspetor | (ultralarga) Resumo da sessão logo depois.
    await page.goto(`/treinador/treinos/${TREINO_ID}`);
    const inspetor = await caixa(page.locator('#inspetor-do-exercicio'));
    expect(inspetor.width).toBeLessThanOrEqual(TETO);
    if (limitado) expect(inspetor.width).toBeGreaterThan(1390);
    if (tres) {
      const resumo = await caixa(page.getByTestId('coluna-resumo-sessao'));
      expect(Math.abs(resumo.x - (inspetor.x + inspetor.width) - VAO_DAS_COLUNAS)).toBeLessThanOrEqual(2);
    }
    await semRolagemHorizontal(page);
    await capturar(page, `${largura}-automatica-treino`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920 px, menu recolhido: o painel da refeição termina na borda dos cartões de cima', async ({ page }) => {
  await prepararAmbiente(page, 1920, { altura: 1600, menuRecolhido: true });
  await page.goto(`/treinador/dietas/${DIETA_ID}`);
  await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
  await expect(page.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' }).getByRole('tab')).toHaveCount(2);
  await expect(async () => {
    const refeicao = await caixa(page.locator('#refeicao-almoco'));
    // "Lista de compras" é o último item da linha de "Refeições", que vai até a borda direita da área (a dos cartões de cima).
    const listaDeCompras = await caixa(page.getByRole('button', { name: 'Lista de compras' }));
    expect(refeicao.width).toBeLessThanOrEqual(TETO);
    expect(Math.abs(refeicao.x + refeicao.width - (listaDeCompras.x + listaDeCompras.width))).toBeLessThanOrEqual(3);
  }).toPass({ timeout: 10_000 });
  await semRolagemHorizontal(page);
});
