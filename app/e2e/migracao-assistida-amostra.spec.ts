import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Migração assistida, fase 2: a etapa "Amostra" da planilha completa, entre a prévia e a confirmação, só com a chave
 * ligada. Mostra 5 alunos por vez (o que a confirmação gravaria, em rascunho), "Ver os próximos" pede `inicio=5`, a
 * confirmação leva o hash da amostra, o 503 `MIGRACAO_INDISPONIVEL` esconde a etapa, resposta nova pede a amostra de novo
 * e nada fica no aparelho. API falsa, só dados fictícios. 390 e 1440, claro e escuro.
 */
const ANALISE = {
  abas: [
    { indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhaDoCabecalho: 1, linhas: 7, campos: { ALUNO: 0 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 1, nome: 'Treinos', tipo: 'TREINO', linhaDoCabecalho: 1, linhas: 3, campos: { EXERCICIO: 0 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
  ],
  ligacoes: [],
  resumo: {
    alunos: 7, alunosInativos: 0, pesos: 3, pesosIniciais: 0, pesosIniciaisNoHistorico: 0, treinos: 1, exercicios: 2,
    refeicoes: 1, itensDeDieta: 2, suplementos: 0, exerciciosNaLista: 0, nomesDeExercicio: { certo: 1, provavel: 0, nenhum: 1 },
    nomesDeAlimento: { certo: 0, provavel: 0, nenhum: 0 }, prescricoes: 2, prescricoesNaoEntendidas: 0, prescricoesComSobra: 0,
    faixasRecuperadasDeData: 0,
  },
  problemas: [], problemasAlem: 0, problemasPorTipo: {},
  exercicios: [{ nome: 'Remada inventada', nivel: 'NENHUM', sugestao: null, origem: null, nota: 0, ocorrencias: 1, respostaSalva: null, idSalvo: null }],
  alimentos: [],
  suplementos: [],
  respostasSalvas: 0,
};
const CRIACAO = {
  alunosNovos: 6, alunosNovosInativos: 0, alunosReaproveitados: 1, pesos: 3, pesosIniciais: 0, pesosJaRegistrados: 0,
  exercicios: 1, pastas: 7, treinos: 1, sessoes: 1, exerciciosNosTreinos: 2, exerciciosLigados: 1, series: 3,
  dietas: 1, refeicoes: 1, itens: 2, itensLigados: 0, suplementos: 1, ergogenicos: 0, ergogenicosPulados: 0, faixasRecuperadasDeData: 0,
};
const PREVIA = {
  hash: 'hash-da-previa', criacao: CRIACAO, partesPuladas: [{ parte: 'OBJETIVO_E_OBSERVACOES', permissao: 'ALUNO_SENSIVEL_ALTERAR' }],
  pendencias: { exerciciosProvaveis: 0, alimentosProvaveis: 0, ligacoesAmbiguas: 0, suplementosSemClassificacao: 0 },
  validacaoDosTreinos: { erros: 0, avisos: 0 },
  problemas: [], problemasAlem: 0, problemasPorTipo: {},
};
const CONFIRMACAO = {
  importacaoId: 'i0000000-0000-4000-8000-000000000098', situacao: 'CONCLUIDA', criados: CRIACAO, partesPuladas: PREVIA.partesPuladas,
  validacaoDosTreinos: PREVIA.validacaoDosTreinos, problemas: 0, problemasPorTipo: {},
};

const serie = (uid: string) => ({ uid, tipo: 'WS', repsMin: 8, repsMax: 10 });
const TREINO = {
  objetivo: null, orientacoes: null, sessoes: [{
    uid: 'ss1', nome: 'Treino A', diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
    exercicios: [
      { uid: 'ex1', exercicioId: 'e1', nome: 'Supino de exemplo', modalidade: null, videoUrl: null, observacao: null, progressao: true, unidade: 'kg', series: [serie('a1'), serie('a2')] },
      { uid: 'ex2', exercicioId: null, nome: 'Remada inventada', modalidade: null, videoUrl: null, observacao: null, progressao: true, unidade: 'kg', series: [serie('b1')] },
    ],
  }],
};
const item = (uid: string, nome: string, quantidade: number | null) => ({
  uid, alimentoId: null, nome, quantidade, unidade: 'g', kcal: null, proteina: null, carboidrato: null, gordura: null, manual: true,
});
const DIETA = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, ergogenicos: [], aguaLitros: null,
  refeicoes: [{ uid: 'r1', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [{ uid: 'o1', rotulo: 'Opção 1', itens: [item('i1', 'Arroz de exemplo', 100), item('i2', 'Feijão de exemplo', null)] }] }],
  suplementacao: [{ uid: 'su1', nome: 'Creatina de exemplo', dose: '5 g' }],
};
const vazio = (numero: number, nome: string) => ({
  numero, situacao: 'NOVO', nome, ativo: true, email: null, telefone: null, objetivo: null, observacoes: null,
  pesos: 0, ultimosPesos: [], treino: null, dieta: null,
});
const PRIMEIRA = {
  hash: 'hash-da-amostra', total: 7, inicio: 0, pasta: 'Importada da planilha (rascunho)',
  alunos: [
    {
      numero: 1, situacao: 'NOVO', nome: 'Aluna Fictícia Um', ativo: true, email: 'aluna.um@exemplo.com', telefone: null, objetivo: null,
      observacoes: null, pesos: 3, ultimosPesos: [{ data: '2026-09-01', kg: 70 }, { data: '2026-10-01', kg: 71.5 }],
      treino: TREINO, dieta: DIETA,
    },
    // Já é aluno e só recebe pesos: sem treino nem dieta, sem pasta.
    { ...vazio(2, 'Aluno Fictício Dois'), situacao: 'EXISTENTE', ativo: null, pesos: 1, ultimosPesos: [{ data: '2026-10-02', kg: 80 }] },
    vazio(3, 'Aluno Fictício Três'), vazio(4, 'Aluno Fictício Quatro'), vazio(5, 'Aluno Fictício Cinco'),
  ],
};
const SEGUNDA = { ...PRIMEIRA, inicio: 5, alunos: [vazio(6, 'Aluno Fictício Seis'), { ...vazio(7, 'Aluno Fictício Sete'), ativo: false }] };
const TEXTO_FIXO = 'Tudo entra em rascunho na pasta “Importada da planilha (rascunho)”; nada é publicado; aluno que já existe só ganha mais uma pasta.';

type Amostra = 'ok' | 'indisponivel' | 'falhaUmaVez' | 'vazia';

async function preparar(page: Page, largura: number, opcoes: { habilitada?: boolean; amostra?: Amostra; preferencias?: object; segurar?: Promise<void> } = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (opcoes.preferencias) {
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, p), [TREINADOR.id, JSON.stringify(opcoes.preferencias)] as const);
  }
  const pedidos = { previa: 0, amostra: [] as string[], confirmar: [] as string[], ignorados: [] as string[] };
  let falhar = opcoes.amostra === 'falhaUmaVez';
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, migracaoAssistidaHabilitada: opcoes.habilitada ?? true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'GET /alimentos/fatores': { corpo: [] },
    'POST /importacoes/planilha-completa/analisar': (_p, route) => json(route, ANALISE),
    'POST /importacoes/planilha-completa/previa': (_p, route) => {
      pedidos.previa += 1;
      return json(route, PREVIA);
    },
    'POST /importacoes/planilha-completa/amostra': async (p, route) => {
      const inicio = p.busca.get('inicio') ?? '0';
      pedidos.amostra.push(inicio);
      if (opcoes.segurar) await opcoes.segurar;
      if (opcoes.amostra === 'vazia') return json(route, { ...PRIMEIRA, total: 0, alunos: [] });
      if (opcoes.amostra === 'indisponivel') {
        const e = erroApi(503, 'A migração assistida não está disponível.', 'MIGRACAO_INDISPONIVEL');
        return json(route, e.corpo, 503);
      }
      if (falhar) {
        falhar = false;
        const e = erroApi(500, 'Erro inesperado.');
        return json(route, e.corpo, 500);
      }
      return json(route, inicio === '5' ? SEGUNDA : PRIMEIRA);
    },
    'POST /importacoes/planilha-completa/confirmar': (p, route) => {
      pedidos.confirmar.push(p.busca.get('hash') ?? '');
      pedidos.ignorados.push(p.busca.get('alunosIgnorados') ?? '');
      return json(route, CONFIRMACAO);
    },
  });
  return { ...api, pedidos };
}

/** Do arquivo até a prévia (abas e nomes sem resposta). */
async function ateAPrevia(page: Page) {
  await page.goto('/treinador/importacao/planilha-completa');
  await expect(page.getByRole('heading', { name: 'Planilha completa', level: 1 })).toBeVisible();
  await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'planilha.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK ficticio') });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('“Treinos”', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Gerar prévia' }).click();
  await expect(page.getByText('Treinos e dietas entram em rascunho: nada é publicado e o aluno não vê nada até você revisar e publicar cada plano.')).toBeVisible();
}

/** Nada da amostra no aparelho: nem o nome fictício nem o e-mail em localStorage ou sessionStorage. */
async function nadaNoAparelho(page: Page) {
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(guardado).not.toContain('Aluna Fictícia Um');
  expect(guardado).not.toContain('aluna.um@exemplo.com');
}

for (const largura of [390, 1440]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`amostra: 5 por vez, próximos, voltar e confirmar com o hash da amostra (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura, { preferencias: { tema } });
      await ateAPrevia(page);
      // Na prévia, com a chave ligada, o passo seguinte é a amostra (a confirmação vem depois).
      await expect(page.getByRole('button', { name: 'Confirmar importação' })).toHaveCount(0);
      if (largura < 600) await expect(page.getByText('Etapa 4 de 6 · Prévia')).toBeVisible();
      await page.getByRole('button', { name: 'Ver a amostra' }).click();

      await expect(page.getByText(TEXTO_FIXO)).toBeVisible();
      await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
      await expect(page.getByTestId('faixa-da-amostra')).toBeFocused();
      if (largura < 600) await expect(page.getByText('Etapa 5 de 6 · Amostra')).toBeVisible();
      expect(pedidos.amostra).toEqual(['0']);

      // O primeiro aluno vem aberto: cadastro (ausente é "—", objetivo fica de fora pelo perfil), pesos, treino e dieta.
      const primeiro = page.getByTestId('aluno-da-amostra-1');
      await expect(primeiro.getByText('aluna.um@exemplo.com')).toBeVisible();
      await expect(primeiro.getByText('Fica de fora pelo seu perfil.').first()).toBeVisible();
      await expect(primeiro.getByText('3 pesos para gravar; os 2 mais recentes:')).toBeVisible();
      await expect(primeiro.getByText('01/10/2026 · 71,5 kg')).toBeVisible();
      await expect(primeiro.getByText('1 sessão · 2 exercícios · 3 séries')).toBeVisible();
      await expect(primeiro.getByText('Remada inventada · 1 série')).toBeVisible();
      await expect(primeiro.getByText('Sem par na biblioteca')).toHaveCount(1);
      await expect(primeiro.getByText('Feijão de exemplo · —')).toBeVisible();
      await expect(primeiro.getByText('Creatina de exemplo · 5 g')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`amostra-${largura}-${tema.toLowerCase()}.png`) });
      await primeiro.getByText('Creatina de exemplo · 5 g').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`amostra-planos-${largura}-${tema.toLowerCase()}.png`) });

      // "Ver como o aluno" reaproveita a prévia do editor, só na tela.
      await primeiro.getByRole('button', { name: 'Ver o treino de Aluna Fictícia Um como o aluno' }).click();
      const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
      await expect(folha.getByText('Prévia: é assim que o aluno vê. Nada é registrado aqui.')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`amostra-treino-${largura}-${tema.toLowerCase()}.png`) });
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toHaveCount(0);

      // O que já é aluno abre recolhido e diz que o cadastro não muda; sem plano na planilha, só ganha os pesos.
      await page.getByRole('button', { name: 'Aluno Fictício Dois, recolhido' }).click();
      await expect(page.getByText('Já é seu aluno: o cadastro não muda. Só ganha os pesos abaixo, sem pasta nem plano.')).toBeVisible();
      await expect(page.getByText('02/10/2026 · 80 kg')).toBeVisible();

      await page.getByRole('button', { name: 'Ver os próximos 2' }).click();
      await expect(page.getByText('Alunos 6 a 7 de 7')).toBeVisible();
      await expect(page.getByTestId('faixa-da-amostra')).toBeFocused();
      await expect(page.getByTestId('aluno-da-amostra-6')).toBeVisible();
      await page.getByRole('button', { name: 'Aluno Fictício Sete, recolhido' }).click();
      await expect(page.getByTestId('aluno-da-amostra-7').getByText('Inativo')).toBeVisible();
      expect(pedidos.amostra).toEqual(['0', '5']);
      await expect(page.getByRole('button', { name: /^Ver os próximos|^Ver o próximo/ })).toHaveCount(0);
      // Voltar à página anterior não pede de novo.
      await page.getByRole('button', { name: 'Ver os anteriores' }).click();
      await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
      expect(pedidos.amostra).toEqual(['0', '5']);
      await nadaNoAparelho(page);

      await page.getByRole('button', { name: 'Confirmar importação' }).click();
      await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
      expect(pedidos.confirmar).toEqual(['hash-da-amostra']);
      await nadaNoAparelho(page);
      expect(pedidos.previa).toBe(1);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`amostra: o 503 esconde a etapa e a confirmação segue pela prévia (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura, { amostra: 'indisponivel' });
    await ateAPrevia(page);
    await page.getByRole('button', { name: 'Ver a amostra' }).click();
    await expect(page.getByText('A amostra não está disponível agora. Confira a prévia e confirme.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver a amostra' })).toHaveCount(0);
    await expect(page.getByText(TEXTO_FIXO)).toHaveCount(0);
    if (largura < 600) await expect(page.getByText('Etapa 4 de 5 · Prévia')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
    expect(pedidos.amostra).toEqual(['0']);
    expect(pedidos.confirmar).toEqual(['hash-da-previa']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`amostra: erro com "Tentar de novo" e resposta nova pede a amostra outra vez (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura, { amostra: 'falhaUmaVez' });
    await ateAPrevia(page);
    await page.getByRole('button', { name: 'Ver a amostra' }).click();
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
    expect(pedidos.amostra).toEqual(['0', '0']);

    // Voltar até os nomes e responder: a prévia e a amostra antigas não valem mais.
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: /^Resposta para “Remada inventada”/ }).click();
    await page.getByRole('radio', { name: /^Criar na biblioteca/ }).first().click();
    await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await page.getByRole('button', { name: 'Ver a amostra' }).click();
    await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
    expect(pedidos.amostra).toEqual(['0', '0', '0']);
    expect(pedidos.previa).toBe(2);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('amostra: ignorar e incluir aluno, a faixa conta, nem todos podem sair e a confirmação leva só os ignorados (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, 390);
  await ateAPrevia(page);
  await page.getByRole('button', { name: 'Ver a amostra' }).click();
  await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
  // Todos entram por padrão: selo verde e botão "Ignorar aluno"; a faixa não diz nada de ignorados.
  await expect(page.getByText('Incluído', { exact: true })).toHaveCount(5);
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Três na importação' }).click();
  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Quatro na importação' }).click();
  await expect(page.getByText('Ignorado nesta importação', { exact: true })).toHaveCount(2);
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveText('5 alunos serão importados · 2 ignorados');
  await expect(page.getByRole('button', { name: 'Incluir Aluno Fictício Três na importação' })).toBeVisible();

  // Incluir de volta desfaz só aquele aluno.
  await page.getByRole('button', { name: 'Incluir Aluno Fictício Quatro na importação' }).click();
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveText('6 alunos serão importados · 1 ignorado');

  // A marca vale entre as páginas.
  await page.getByRole('button', { name: 'Ver os próximos 2' }).click();
  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Seis na importação' }).click();
  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Sete na importação' }).click();
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveText('4 alunos serão importados · 3 ignorados');
  await page.getByRole('button', { name: 'Incluir Aluno Fictício Seis na importação' }).click();
  await page.getByRole('button', { name: 'Incluir Aluno Fictício Sete na importação' }).click();
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveText('6 alunos serão importados · 1 ignorado');

  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
  expect(pedidos.confirmar).toEqual(['hash-da-amostra']);
  expect(pedidos.ignorados).toEqual(['3']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('amostra: ignorar todos os alunos trava a confirmação com o motivo e incluir um destrava (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, 390);
  await ateAPrevia(page);
  await page.getByRole('button', { name: 'Ver a amostra' }).click();
  await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
  for (const nome of ['Aluna Fictícia Um', 'Aluno Fictício Dois', 'Aluno Fictício Três', 'Aluno Fictício Quatro', 'Aluno Fictício Cinco']) {
    await page.getByRole('button', { name: `Ignorar ${nome} na importação` }).click();
  }
  await page.getByRole('button', { name: 'Ver os próximos 2' }).click();
  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Seis na importação' }).click();
  await page.getByRole('button', { name: 'Ignorar Aluno Fictício Sete na importação' }).click();
  await expect(page.getByTestId('resumo-dos-ignorados')).toHaveText('0 alunos serão importados · 7 ignorados');
  await expect(page.getByRole('button', { name: /^Confirmar importação/ })).toBeDisabled();
  await expect(page.getByText('Marque pelo menos um aluno para importar.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Incluir Aluno Fictício Sete na importação' }).click();
  await expect(page.getByRole('button', { name: /^Confirmar importação/ })).toBeEnabled();
  await page.getByRole('button', { name: /^Confirmar importação/ }).click();
  await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
  expect(pedidos.ignorados).toEqual(['1,2,3,4,5,6']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const [nome, preferencias] of [['areia', { tema: 'AREIA' }], ['contraste-alto', { tema: 'CLARO', contraste: 'ALTO' }]] as const) {
  test(`amostra: aberta no tema ${nome} (1440px)`, async ({ page }, testInfo) => {
    const { naoTratadas, errosDaPagina } = await preparar(page, 1440, { preferencias });
    await ateAPrevia(page);
    await page.getByRole('button', { name: 'Ver a amostra' }).click();
    await expect(page.getByText('Alunos 1 a 5 de 7')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`amostra-1440-${nome}.png`) });
    await page.getByTestId('aluno-da-amostra-1').getByText('Creatina de exemplo · 5 g').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`amostra-planos-1440-${nome}.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('amostra: carregando segura a confirmação e vazia deixa confirmar (390px)', async ({ page }) => {
  let soltar = () => {};
  const segurar = new Promise<void>((r) => { soltar = r; });
  const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, 390, { amostra: 'vazia', segurar });
  await ateAPrevia(page);
  await page.getByRole('button', { name: 'Ver a amostra' }).click();
  await expect(page.getByText('Montando a amostra…')).toBeVisible();
  const confirmar = page.getByRole('button', { name: /^Confirmar importação/ });
  await expect(confirmar).toBeDisabled();
  await expect(page.getByText('Aguarde a amostra.')).toBeVisible();
  soltar();
  await expect(page.getByText('Nenhum aluno para mostrar', { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTO_FIXO)).toBeVisible();
  await expect(confirmar).toBeEnabled();
  await confirmar.click();
  await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
  expect(pedidos.confirmar).toEqual(['hash-da-amostra']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('amostra: com a chave desligada não há etapa nem pedido (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, 390, { habilitada: false });
  await ateAPrevia(page);
  await expect(page.getByText('Etapa 4 de 5 · Prévia')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver a amostra' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  await expect(page.getByText(/^Importação confirmada\./)).toBeVisible();
  expect(pedidos.amostra).toEqual([]);
  expect(pedidos.confirmar).toEqual(['hash-da-previa']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
