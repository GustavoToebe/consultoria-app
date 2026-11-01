import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Planilha completa (fases 1 e 2): a página inteira que lê as abas, deixa trocar o tipo e responder os nomes, mostra a prévia
 * em frases e confirma em rascunho; a guarda de saída; o 409 PREVIA_DESATUALIZADA; e o "Desfazer importação" no
 * histórico; na fase 2, o formato e o aluno de cada aba (um aluno por aba, blocos) e as respostas guardadas de uma
 * importação anterior (marcadas, com o aviso, e esquecidas). API falsa, dados fictícios (nomes de exercício, de aba e os
 * nomes de aluno que a própria planilha traz no nome da aba ou no bloco). 390 e 1280.
 */
const ID = 'i0000000-0000-4000-8000-000000000099';
const ANALISE = {
  abas: [
    { indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhaDoCabecalho: 1, linhas: 3, campos: { CODIGO: 0, ALUNO: 1 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 1, nome: 'Rotinas', tipo: 'ROTINAS', linhaDoCabecalho: 1, linhas: 2, campos: { CODIGO: 0 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 2, nome: 'Exercícios', tipo: 'TREINO', linhaDoCabecalho: 1, linhas: 5, campos: { EXERCICIO: 2 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 3, nome: 'Notas', tipo: 'DESCONHECIDA', linhaDoCabecalho: 0, linhas: 4, campos: {}, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
  ],
  ligacoes: [
    { abaFilha: 1, colunaFilha: 1, abaMae: 0, colunaMae: 0, por: 'CODIGO', ligadas: 2, naoLigadas: 0, ambiguas: 0, pendentes: [] },
    { abaFilha: 2, colunaFilha: 1, abaMae: 1, colunaMae: 0, por: 'NOME', ligadas: 4, naoLigadas: 0, ambiguas: 1, pendentes: [{ linha: 6, candidatas: [2, 3] }] },
  ],
  resumo: {
    alunos: 3, alunosInativos: 0, pesos: 4, pesosIniciais: 0, pesosIniciaisNoHistorico: 0, treinos: 2, exercicios: 5,
    refeicoes: 0, itensDeDieta: 0, suplementos: 2, exerciciosNaLista: 0, nomesDeExercicio: { certo: 1, provavel: 1, nenhum: 1 },
    nomesDeAlimento: { certo: 0, provavel: 0, nenhum: 0 }, prescricoes: 5, prescricoesNaoEntendidas: 0, prescricoesComSobra: 0,
    faixasRecuperadasDeData: 0,
  },
  problemas: [], problemasAlem: 0, problemasPorTipo: {},
  exercicios: [
    { nome: 'Supino reto c/ hal.', nivel: 'PROVAVEL', sugestao: 'Supino reto com halteres', origem: 'BIBLIOTECA', nota: 0.7, ocorrencias: 3, respostaSalva: null, idSalvo: null },
    { nome: 'Xyzzy fictício', nivel: 'NENHUM', sugestao: null, origem: null, nota: 0, ocorrencias: 1, respostaSalva: null, idSalvo: null },
  ],
  alimentos: [],
  suplementos: [
    { nome: 'Creatina', sugestao: 'SUPLEMENTO', ocorrencias: 2, destinoSalvo: null },
    { nome: 'Remédio Fictício', sugestao: null, ocorrencias: 1, destinoSalvo: null },
  ],
  respostasSalvas: 0,
};
/**
 * Fase 2: uma aba de um aluno (o nome da aba), uma aba com dois alunos em blocos e respostas guardadas de uma importação
 * anterior (o tipo de uma aba, um nome e um suplemento). Nomes fictícios.
 */
const BLOCO = { linha: 2, tipo: 'TREINO', aluno: 'Ana Fictícia', situacao: 'NOVO', titulo: 'Treino A', linhas: 3 };
const ANALISE_FASE2 = {
  ...ANALISE,
  respostasSalvas: 5,
  ligacoes: [],
  abas: [
    { indice: 0, nome: 'Ana Fictícia', tipo: 'TREINO', linhaDoCabecalho: 2, linhas: 4, campos: { EXERCICIO: 0, SERIES: 1 }, avisos: [],
      formato: 'UM_ALUNO', blocos: [BLOCO, { ...BLOCO, linha: 7, titulo: 'Treino B', linhas: 1 }], tipoSalvo: null },
    { indice: 1, nome: 'Treinos', tipo: 'TREINO', linhaDoCabecalho: 2, linhas: 2, campos: { EXERCICIO: 0, PRESCRICAO: 1 }, avisos: [],
      formato: 'BLOCOS', tipoSalvo: null, blocos: [
        { ...BLOCO, aluno: 'Bruno Inventado', situacao: 'EXISTENTE', titulo: null, linhas: 1 },
        { ...BLOCO, linha: 5, aluno: 'Carla Exemplo', situacao: 'AMBIGUO', titulo: null, linhas: 1 },
      ] },
    { indice: 2, nome: 'Notas', tipo: 'DESCONHECIDA', linhaDoCabecalho: 1, linhas: 4, campos: {}, avisos: [], formato: 'TABELA', blocos: [],
      tipoSalvo: 'IGNORAR' },
  ],
  exercicios: [
    { ...ANALISE.exercicios[0], respostaSalva: 'BIBLIOTECA', idSalvo: 'e1' },
    ANALISE.exercicios[1],
  ],
  suplementos: [ANALISE.suplementos[0], { ...ANALISE.suplementos[1], destinoSalvo: 'SENSIVEL' }],
};
const CRIACAO = {
  alunosNovos: 3, alunosNovosInativos: 0, alunosReaproveitados: 0, pesos: 4, pesosIniciais: 0, pesosJaRegistrados: 0,
  exercicios: 1, pastas: 2, treinos: 2, sessoes: 3, exerciciosNosTreinos: 5, exerciciosLigados: 4, series: 12,
  dietas: 0, refeicoes: 0, itens: 0, itensLigados: 0, suplementos: 0, ergogenicos: 0, ergogenicosPulados: 0, faixasRecuperadasDeData: 0,
};
const PREVIA = {
  hash: 'hash-da-planilha', criacao: CRIACAO, partesPuladas: [{ parte: 'PESOS', permissao: 'ALUNO_SENSIVEL_ALTERAR' }],
  pendencias: { exerciciosProvaveis: 0, alimentosProvaveis: 0, ligacoesAmbiguas: 0, suplementosSemClassificacao: 1 },
  validacaoDosTreinos: { erros: 0, avisos: 2 },
  problemas: [
    { aba: 'Alunos', linha: 3, campo: 'EMAIL', tipo: 'EMAIL_INVALIDO' },
    { aba: 'Alunos', linha: 4, campo: 'EMAIL', tipo: 'EMAIL_INVALIDO' },
    { aba: 'Exercícios', linha: 5, campo: null, tipo: 'EXERCICIO_SEM_SERIE' },
  ],
  problemasAlem: 0, problemasPorTipo: { EMAIL_INVALIDO: 2, EXERCICIO_SEM_SERIE: 1 },
};
const CONFIRMACAO = {
  importacaoId: ID, situacao: 'CONCLUIDA_COM_ERROS', criados: CRIACAO, partesPuladas: PREVIA.partesPuladas,
  validacaoDosTreinos: PREVIA.validacaoDosTreinos, problemas: 3, problemasPorTipo: PREVIA.problemasPorTipo,
};
const ITEM = {
  id: ID, destino: 'planilha-completa', nomeArquivo: '.xlsx', criadoEm: '2026-10-31T15:00:00Z',
  linhas: 14, novos: 10, atualizados: 0, ignorados: 0, comErro: 3, situacao: 'CONCLUIDA_COM_ERROS',
};
const DETALHE = {
  ...ITEM, configuracao: {}, erros: [
    { linha: 3, campo: 'EMAIL', motivo: 'Alunos: EMAIL_INVALIDO' },
    { linha: 4, campo: 'EMAIL', motivo: 'Alunos: EMAIL_INVALIDO' },
  ],
};
const DESFEITA = {
  importacaoId: ID, ficaramAlem: 0,
  partes: [
    { tipo: 'PLANO_TREINO', apagados: 1, ficaram: 1, motivos: { PUBLICADO: 1 } },
    { tipo: 'PLANO_DIETA', apagados: 0, ficaram: 0, motivos: {} },
    { tipo: 'PASTA', apagados: 1, ficaram: 1, motivos: { COM_PLANOS: 1 } },
    { tipo: 'PESO', apagados: 4, ficaram: 0, motivos: {} },
    { tipo: 'EXERCICIO', apagados: 0, ficaram: 1, motivos: { EM_USO: 1 } },
    { tipo: 'ALUNO', apagados: 2, ficaram: 1, motivos: { COM_ACESSO: 1 } },
  ],
  ficaram: [{ tipo: 'ALUNO', id: 'a1', motivo: 'COM_ACESSO' }],
};

/** Respostas mandadas na prévia/confirmação: a parte `respostas` do multipart. */
function respostasDoPedido(corpo: string): unknown {
  const marca = 'name="respostas"';
  const i = corpo.indexOf(marca);
  if (i < 0) return null;
  const inicio = corpo.indexOf('{', i);
  return JSON.parse(corpo.slice(inicio, corpo.indexOf('\r\n--', inicio)));
}

async function preparar(page: Page, largura: number, opcoes: { desatualizadaUmaVez?: boolean; analise?: unknown } = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  const pedidos = { analisar: 0, previa: 0, confirmar: [] as string[], desfazer: 0, respostas: null as unknown, esquecer: 0 };
  let desatualizada = opcoes.desatualizadaUmaVez ?? false;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [ITEM], total: 1, pagina: 0 } },
    [`GET /importacoes/${ID}`]: { corpo: DETALHE },
    'GET /exercicios': { corpo: [{ id: 'e1', nome: 'Supino reto com halteres', grupoMuscular: 'Peito' }, { id: 'e2', nome: 'Remada curvada fictícia', grupoMuscular: 'Costas' }] },
    'POST /importacoes/planilha-completa/analisar': (_p, route) => {
      pedidos.analisar += 1;
      return json(route, opcoes.analise ?? ANALISE);
    },
    'DELETE /importacoes/planilha-completa/respostas-salvas': (_p, route) => {
      pedidos.esquecer += 1;
      return json(route, { apagadas: 5 });
    },
    'POST /importacoes/planilha-completa/previa': (_p, route) => {
      pedidos.previa += 1;
      pedidos.respostas = respostasDoPedido(route.request().postDataBuffer()?.toString('utf8') ?? '');
      return json(route, PREVIA);
    },
    'POST /importacoes/planilha-completa/confirmar': (p, route) => {
      pedidos.confirmar.push(p.busca.get('hash') ?? '');
      if (desatualizada) {
        desatualizada = false;
        const e = erroApi(409, 'Algo mudou desde a prévia. Gere a prévia de novo.', 'PREVIA_DESATUALIZADA');
        return json(route, e.corpo, 409);
      }
      return json(route, CONFIRMACAO);
    },
    [`POST /importacoes/${ID}/desfazer`]: (_p, route) => {
      pedidos.desfazer += 1;
      return json(route, DESFEITA);
    },
  });
  return { ...api, pedidos };
}

async function escolher(page: Page, botao: RegExp, opcao: RegExp) {
  await page.getByRole('button', { name: botao }).first().click();
  await page.getByRole('radio', { name: opcao }).first().click();
}

async function abrirELer(page: Page) {
  await page.goto('/treinador/importacao');
  await page.getByRole('button', { name: 'Nova importação' }).click();
  await expect(page).toHaveURL(/\/treinador\/importacao\/nova$/);
  await page.getByRole('link', { name: /Planilha completa \(alunos, pesos, treinos e dietas\)/ }).click();
  await expect(page).toHaveURL(/\/treinador\/importacao\/planilha-completa$/);
  await expect(page.getByRole('heading', { name: 'Planilha completa', level: 1 })).toBeVisible();
  await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'planilha.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK ficticio') });
  await page.getByRole('button', { name: 'Continuar' }).click();
}

for (const largura of [390, 1280]) {
  test(`planilha completa: abas, nomes, prévia e confirmação em rascunho em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura);
    await abrirELer(page);

    // Etapa 2: a leitura, o tipo de cada aba (trocar ou ignorar), as ligações e a linha ambígua.
    await expect(page.getByText('4 abas lidas: 3 alunos, 4 pesos, 2 divisões de treino com 5 exercícios e 2 suplementos ou medicações.')).toBeVisible();
    await expect(page.getByText('“Exercícios” liga a “Rotinas” pelo nome: 4 linhas ligadas, 1 ambígua.')).toBeVisible();
    await escolher(page, /^Tipo da aba “Notas”: Não reconhecida/, /^Ignorar esta aba/);
    await expect(page.getByRole('button', { name: /^Tipo da aba “Notas”: Ignorar esta aba/ })).toBeVisible();
    await escolher(page, /^Linha 6 de “Exercícios” liga à: Não ligar/, /^Linha 3 da aba “Rotinas”/);
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Etapa 3: nomes com busca, "aceitar todos", escolher na biblioteca, e suplementos.
    await expect(page.getByText('Supino reto c/ hal.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aceitar todos os prováveis' }).click();
    await expect(page.getByRole('button', { name: /^Resposta para “Supino reto c\/ hal.”: Usar “Supino reto com halteres”/ })).toBeVisible();
    await escolher(page, /^Resposta para “Xyzzy fictício”: Sem resposta/, /^Biblioteca: Remada curvada fictícia/);
    await page.getByLabel('Buscar em exercícios').fill('xyzzy');
    await expect(page.getByText('Supino reto c/ hal.', { exact: true })).toHaveCount(0);
    await page.getByLabel('Buscar em exercícios').fill('');
    await escolher(page, /^Destino de “Remédio Fictício”: Sem resposta/, /^Medicação e ergogênicos/);
    await page.getByRole('button', { name: 'Gerar prévia' }).click();

    // Etapa 4: frases simples, parte pulada, rascunho e problemas agrupados por aba.
    await expect(page.getByText('Treinos e dietas entram em rascunho: nada é publicado e o aluno não vê nada até você revisar e publicar cada plano.')).toBeVisible();
    await expect(page.getByText('Vai criar 3 alunos, sem convite.')).toBeVisible();
    await expect(page.getByText('Vai criar 2 pastas, uma por aluno, com 2 treinos (3 divisões, 5 exercícios, 12 séries), tudo em rascunho.')).toBeVisible();
    await expect(page.getByText('Os pesos ficam de fora: seu perfil não tem a permissão de dados sensíveis do aluno.')).toBeVisible();
    await expect(page.getByText('Aba “Alunos”: E-mail inválido: o aluno entra sem e-mail. · 2 linhas: 3, 4')).toBeVisible();
    await expect(page.getByText('Linha 5 · Aba “Exercícios”: Exercício sem quantidade de séries: entra sem séries (nada é inventado).')).toBeVisible();
    expect(pedidos.respostas).toEqual({
      abas: [{ indice: 3, tipo: 'IGNORAR' }],
      ligacoes: [{ aba: 2, linha: 6, linhaDaMae: 3 }],
      exercicios: [{ nome: 'Supino reto c/ hal.', acao: 'ACEITAR' }, { nome: 'Xyzzy fictício', acao: 'BIBLIOTECA', id: 'e2' }],
      alimentos: [],
      suplementos: [{ nome: 'Remédio Fictício', destino: 'SENSIVEL' }],
    });

    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByText('Criou 3 alunos, sem convite.')).toBeVisible();
    expect(pedidos.confirmar).toEqual(['hash-da-planilha']);
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Importação registrada.')).toBeVisible();
    await expect(page).toHaveURL(/\/treinador\/importacao$/);
    expect(pedidos.analisar).toBe(1);
    expect(pedidos.previa).toBe(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`planilha completa: sair no meio pergunta e o 409 pede a prévia de novo em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura, { desatualizadaUmaVez: true });
    await page.goto('/treinador/importacao/planilha-completa');
    // Sem arquivo, Cancelar sai direto.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page).toHaveURL(/\/treinador\/importacao$/);

    await page.goto('/treinador/importacao/planilha-completa');
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'planilha.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK ficticio') });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Sair sem salvar?')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page).toHaveURL(/\/planilha-completa$/);

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.getByText('Vai criar 3 alunos, sem convite.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByText('Algo mudou desde a prévia (o arquivo ou as respostas). Nada foi gravado.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
    await page.getByRole('button', { name: 'Gerar a prévia de novo' }).click();
    await expect(page.getByText('Vai criar 3 alunos, sem convite.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByText('Criou 3 alunos, sem convite.')).toBeVisible();
    expect(pedidos.previa).toBe(2);
    expect(pedidos.confirmar).toHaveLength(2);

    // Concluída, sair não pergunta mais.
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page).toHaveURL(/\/treinador\/importacao$/);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`planilha completa: desfazer pelo histórico em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura);
    await page.goto('/treinador/importacao');
    await page.getByRole('button', { name: /^Abrir a importação de Planilha completa de 31\/10\/2026/ }).click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText('Importação de Planilha completa').first()).toBeVisible();
    await expect(folha.getByText('Aba “Alunos”: E-mail inválido: o aluno entra sem e-mail. · 2 linhas: 3, 4')).toBeVisible();
    await folha.getByRole('button', { name: 'Desfazer importação' }).click();
    await expect(page.getByText('Desfazer a importação?')).toBeVisible();
    // Cancelar não desfaz.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    expect(pedidos.desfazer).toBe(0);
    await folha.getByRole('button', { name: 'Desfazer importação' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desfazer importação' }).click();
    await expect(page.getByText('8 itens apagados; 4 ficaram, pelos motivos abaixo.')).toBeVisible();
    await expect(page.getByText('Alunos: 2 apagados; 1 ficou (1 já tem acesso ao app).')).toBeVisible();
    await expect(page.getByText('Treinos: 1 apagado; 1 ficou (1 já publicado).')).toBeVisible();
    await expect(page.getByText('Exercícios da biblioteca: 1 ficou (1 em uso por algo criado depois).')).toBeVisible();
    expect(pedidos.desfazer).toBe(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`planilha completa (fase 2): formato de cada aba, respostas salvas marcadas e esquecidas em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura, { analise: ANALISE_FASE2 });
    await abrirELer(page);

    // O formato e o aluno de cada aba; o bloco ambíguo aparece como "não entra".
    await expect(page.getByText(/^Um aluno por aba, 2 tabelas · /)).toBeVisible();
    await expect(page.getByText('De Ana Fictícia (aluno novo, entra só com o nome).')).toBeVisible();
    await expect(page.getByText(/^Vários alunos em blocos \(2 tabelas\) · /)).toBeVisible();
    await expect(page.getByText('2 alunos: Bruno Inventado e Carla Exemplo.')).toBeVisible();
    await expect(page.getByText('Linha 2 · 1 linha · Bruno Inventado (já é seu aluno)')).toBeVisible();
    await expect(page.getByText('Linha 5 · 1 linha · Carla Exemplo (há mais de um aluno com esse nome: não entra)')).toBeVisible();

    // A resposta guardada já vem marcada, com o aviso discreto.
    await expect(page.getByRole('button', { name: /^Tipo da aba “Notas”: Ignorar esta aba/ })).toBeVisible();
    await expect(page.getByText('Respondido na importação anterior')).toHaveCount(1);
    await expect(page.getByText('5 respostas guardadas das importações anteriores: 3 vieram marcadas aqui.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('button', { name: /^Resposta para “Supino reto c\/ hal.”: Biblioteca: Supino reto com halteres/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Destino de “Remédio Fictício”: Medicação e ergogênicos/ })).toBeVisible();
    await expect(page.getByText('Respondido na importação anterior')).toHaveCount(2);
    await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.getByText('Vai criar 3 alunos, sem convite.')).toBeVisible();
    expect(pedidos.respostas).toEqual({
      abas: [{ indice: 2, tipo: 'IGNORAR' }],
      ligacoes: [],
      exercicios: [{ nome: 'Supino reto c/ hal.', acao: 'BIBLIOTECA', id: 'e1' }],
      alimentos: [],
      suplementos: [{ nome: 'Remédio Fictício', destino: 'SENSIVEL' }],
    });

    // Esquecer: pede confirmação; Cancelar não apaga; Esquecer tira as marcas que vieram delas.
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Esquecer as respostas salvas' }).click();
    await expect(page.getByText('Esquecer as respostas salvas?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    expect(pedidos.esquecer).toBe(0);
    await page.getByRole('button', { name: 'Esquecer as respostas salvas' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Esquecer' }).click();
    await expect(page.getByText('5 respostas salvas foram esquecidas.')).toBeVisible();
    expect(pedidos.esquecer).toBe(1);
    await expect(page.getByRole('button', { name: /^Tipo da aba “Notas”: Não reconhecida/ })).toBeVisible();
    await expect(page.getByText('Respondido na importação anterior')).toHaveCount(0);
    await expect(page.getByText('Esquecer as respostas salvas', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.getByText('Vai criar 3 alunos, sem convite.')).toBeVisible();
    expect(pedidos.respostas).toEqual({ abas: [], ligacoes: [], exercicios: [], alimentos: [], suplementos: [] });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
