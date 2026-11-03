import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, AlunoResumo, Atualizacao, ConteudoDieta, PastaResumo, PlanoDetalhe, PlanoResumo, RegistroPeso } from '../src/api/tipos';
import {
  ALUNO, MARCA, PERMISSOES_TREINADOR, rotasDaPasta, sessao, simularApi, TREINADOR,
  type PastaFalsa, type PlanoDaPastaFalsa, type RespostasApi,
} from './api-falsa';

/**
 * Reunião de 30/10 (Análise 4): caminho do treinador mais claro na renovação do ciclo.
 * - Finalizar a pasta mostra o peso que a atualização já gravou e avisa quando um peso novo na mesma data vai
 *   substituí-lo. Desde a D8 o campo nasce com o peso sugerido da atualização da pasta, com a nota para conferir.
 * - "Voltar à pasta" nos editores do plano do aluno leva à ficha com a Folha da pasta aberta, passa pela guarda de saída
 *   e funciona com o editor aberto direto pela URL. O `?pastaId=` sai do endereço depois de abrir a Folha (C22).
 * - A atualização ao lado do editor é um `<a href>` que abre sempre em outra aba.
 * - "Publicar tudo" da Folha da pasta (C21, tudo ou nada, problemas por plano) e "Copiar pasta para outro aluno" (D7).
 * Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-000000000017';
const PLANO_ID = 'd0000000-0000-4000-8000-000000000001';
const ATUALIZACAO_ID = 'e0000000-0000-4000-8000-000000000005';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PASTAS: PastaResumo[] = [
  { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-06', fim: '2026-10-20', concluidaEm: null },
];
const PASTA_RENOVADA: PastaResumo = {
  id: 'f0000000-0000-4000-8000-000000000018', alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-10-21', fim: '2026-11-04', concluidaEm: null,
};

// Enviada na data dela (20/10): a API gravou o peso respondido nesse dia.
const ATUALIZACAO: Atualizacao = {
  id: ATUALIZACAO_ID, pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, dataAtualizacao: '2026-10-20',
  fase: 'ENVIADA', diasParaData: -11, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-10-20T12:00:00Z', feedback: null, versao: 1, resumo: null,
};

const PESOS: RegistroPeso[] = [
  { id: 'r1', data: '2026-10-06', pesoKg: 83.1, variacao: null, observacao: null },
  { id: 'r2', data: '2026-10-20', pesoKg: 82.4, variacao: -0.7, observacao: null },
];

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null,
  aguaLitros: null, refeicoes: [],
};

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Dieta do Plano 17', inicio: '2026-10-06', fim: '2026-10-20', ativo: false,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [],
};

/** A ficha, a Folha da pasta e o editor de dieta da pasta, com a atualização enviada e o peso dela. */
async function abrir(page: Page, permissoesExtras: string[], extras: RespostasApi = {}) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', ...permissoesExtras] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    'GET /alimentos': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: [ATUALIZACAO] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: PESOS },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DIETA },
    [`POST /pastas/${PASTA_ID}/finalizar`]: { corpo: { ...PASTAS[0], concluidaEm: '2026-10-31T12:00:00Z' } },
    ...extras,
  });
}

const LINHA_DO_PESO = /Peso já registrado na data da atualização: 82,4 kg em 20\/10/;
const NOTA_JA_REGISTRADO = '82,4 kg, da atualização de 20/10 (já registrado)';
const SUBSTITUI = 'Vai substituir o peso da atualização';
const AVISO_DA_COPIA =
  'Copia a versão publicada de cada plano (o rascunho, se ainda não foi publicado). Os planos chegam como rascunho, sem os ergogênicos da dieta e sem o questionário escolhido; nada é publicado para o aluno.';

/** Hoje como o campo de data mostra (dd/mm/aaaa, fuso local). */
function hojeNaTela(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

for (const largura of [390, 1280]) {
  test(`finalizar: mostra o peso da atualização, sem peso sugerido o campo começa vazio e avisa da substituição (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    // Sem peso sugerido (a atualização da pasta não trouxe peso): o campo fica vazio.
    const { pedidos, errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER'], {
      [`GET /pastas/${PASTA_ID}/peso-sugerido`]: { corpo: { pesoKg: null, data: null } },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);

    const pasta = page.getByRole('dialog', { name: 'Plano 17' });
    // A ordem sugerida fica recolhida: o botão principal continua o de antes.
    await expect(pasta.getByRole('button', { name: /Ordem sugerida para renovar o ciclo, recolhido/ })).toBeVisible();
    await expect(pasta.getByText('Finalizar não publica nada.')).toHaveCount(0);
    await pasta.getByRole('button', { name: /Ordem sugerida para renovar o ciclo/ }).click();
    await expect(pasta.getByText('Finalizar a pasta anterior.')).toBeVisible();
    await expect(pasta.getByText('Finalizar não publica nada.')).toBeVisible();
    await expect(pasta.getByText('Publicar não abre um ciclo novo: para um novo período, renove a pasta.')).toBeVisible();

    await pasta.getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByText(LINHA_DO_PESO)).toBeVisible();
    const peso = folha.getByRole('textbox', { name: 'Peso (opcional)' });
    await expect(peso).toHaveValue('');
    await expect(folha.getByText(/Peso preenchido com o da atualização/)).toHaveCount(0);
    // Sem sugestão, a data nasce hoje.
    const data = folha.getByRole('textbox', { name: 'Data do peso' });
    await expect(data).toHaveValue(hojeNaTela());

    // Peso novo na data da atualização: avisa que substitui; em outra data, não.
    await data.fill('20/10/2026');
    await peso.fill('81,9');
    await expect(folha.getByText('Vai substituir o peso da atualização')).toBeVisible();
    // Data fixa no passado: o peso é "registro" e não aceita o futuro, então uma data perto de hoje quebraria com o relógio.
    await data.fill('15/03/2025');
    await expect(folha.getByText('Vai substituir o peso da atualização')).toHaveCount(0);

    // Finalizar sem peso novo continua possível.
    await peso.fill('');
    await folha.getByRole('button', { name: 'Finalizar pasta' }).click();
    await expect(page.getByRole('dialog', { name: 'Finalizar “Plano 17”' })).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/finalizar`);
    expect(post?.corpo).toEqual({ data: null, pesoKg: null, observacao: null });
    expect(errosDaPagina).toEqual([]);
  });

  // C76: o peso é "registro" (de 1900 até hoje). Ano 0261 e data futura mostram a mensagem no campo e travam o Finalizar.
  test(`finalizar: data do peso em 0261 ou no futuro é recusada no campo e trava o Finalizar (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    const data = folha.getByRole('textbox', { name: 'Data do peso' });
    const finalizar = folha.getByRole('button', { name: 'Finalizar pasta' });
    const mensagem = folha.getByText('Data do peso: use uma data entre 01/01/1900 e hoje');

    await expect(finalizar).toBeEnabled();
    await data.fill('15/03/0261');
    await expect(data).toHaveValue('15/03/0261');
    await expect(mensagem).toBeVisible();
    await expect(finalizar).toBeDisabled();

    await data.fill('01/01/2099');
    await expect(mensagem).toBeVisible();
    await expect(finalizar).toBeDisabled();

    await data.fill('15/03/2025');
    await expect(mensagem).toHaveCount(0);
    await expect(finalizar).toBeEnabled();
    expect(pedidos.filter((p) => p.caminho === `/pastas/${PASTA_ID}/finalizar`)).toHaveLength(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: sem ATUALIZACAO_LER a linha do peso não aparece (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina, pedidos } = await abrir(page, []);
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByRole('textbox', { name: 'Peso (opcional)' })).toHaveValue('');
    await expect(folha.getByText(LINHA_DO_PESO)).toHaveCount(0);
    // Sem as permissões o peso sugerido nem é pedido (dado sensível).
    expect(pedidos.some((p) => p.caminho.endsWith('/peso-sugerido'))).toBe(false);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor aberto direto pela URL: "Voltar à pasta" abre a ficha com a Folha da pasta (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    const voltar = page.getByRole('link', { name: 'Voltar à pasta' });
    await expect(voltar).toHaveAttribute('href', `/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    await voltar.click();
    await expect(page.getByRole('dialog', { name: 'Plano 17' })).toBeVisible();
    // C22: aberta a Folha, o `?pastaId=` sai do endereço (recarregar não a reabre).
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    expect(errosDaPagina).toEqual([]);
  });

  test(`"Voltar à pasta" com alteração pendente pergunta antes, e na ficha o menu não pergunta de novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    await page.getByLabel('Água por dia (opcional)').fill('2,5');
    await page.getByRole('link', { name: 'Voltar à pasta' }).click();
    await expect(page.getByText('Sair sem salvar?')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/treinador/dietas/${PLANO_ID}`);
    await page.getByRole('button', { name: 'Sair sem salvar' }).click();
    const pasta = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(pasta).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));

    // O editor saiu da pilha: navegar a partir da ficha não traz a pergunta de volta.
    await pasta.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(pasta).toHaveCount(0);
    await page.getByRole('link', { name: 'Alunos', exact: true }).first().click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(page.getByText('Sair sem salvar?')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`pasta renovada sem atualização: mostra a última enviada, com a pasta e a data dela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    // A dieta é da pasta renovada (Plano 18), que ainda não tem atualização; a enviada é a do Plano 17.
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER'], {
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [...PASTAS, PASTA_RENOVADA] },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: { ...DIETA, plano: { ...DIETA.plano, pastaId: PASTA_RENOVADA.id, titulo: 'Dieta do Plano 18' } } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    await expect(page.getByText('Atualização de Plano 17 · 20/10/2026')).toBeVisible();
    await expect(page.getByText('A pasta deste plano ainda não tem atualização.')).toBeVisible();
    await expect(page.getByText('Sem atualização nesta pasta.')).toHaveCount(0);
    const link = page.getByRole('link', { name: /Abrir atualização de Plano 17 de 20\/10\/2026 em outra aba/ });
    await expect(link).toHaveAttribute('href', `/treinador/atualizacoes/${ATUALIZACAO_ID}`);
    // O "Voltar à pasta" continua sendo o da pasta do plano.
    await expect(page.getByRole('link', { name: 'Voltar à pasta' })).toHaveAttribute('href', `/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_RENOVADA.id}`);
    expect(errosDaPagina).toEqual([]);
  });
}

// Treino já publicado e sem alteração (fica de fora do "Publicar tudo"); a dieta nunca foi publicada.
const TREINO: PlanoResumo = {
  id: 'b0000000-0000-4000-8000-000000000001', alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Treino do Plano 17',
  inicio: '2026-10-06', fim: '2026-10-20', ativo: true, versaoPublicada: 2, publicadoEm: '2026-10-06T12:00:00Z',
  rascunhoAlteradoDepoisDePublicar: false, versao: 3,
};
const DESTINO: AlunoResumo = {
  id: 'a0000000-0000-4000-8000-0000000000b1', nome: 'Aluna Destino', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null,
};
/** Permissões de quem publica e copia a pasta inteira (somadas às de `abrir`). */
const PERMISSOES_DA_PASTA = ['TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER'];

/** A ficha com a pasta simulada por `rotasDaPasta` (planos mutáveis: publicar muda a versão). */
async function abrirComPasta(page: Page, extra: Partial<PastaFalsa> = {}, permissoes = PERMISSOES_DA_PASTA, respostas: RespostasApi = {}) {
  const planos: PlanoDaPastaFalsa[] = [{ tipo: 'treino', plano: { ...TREINO } }, { tipo: 'dieta', plano: { ...DIETA.plano } }];
  const pasta: PastaFalsa = {
    alunoId: ALUNO_ID, pastaId: PASTA_ID, planos,
    permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', ...permissoes], ...extra,
  };
  const api = await abrir(page, permissoes, { ...rotasDaPasta(pasta), ...respostas });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
  return { ...api, pasta };
}

for (const largura of [390, 1280]) {
  test(`publicar tudo: erro na dieta não publica nada e lista o problema por plano (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { erros: [{ field: 'dieta.refeicoes', message: 'Inclua ao menos uma refeição.' }] });
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();

    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('Nada foi publicado', { exact: true })).toBeVisible();
    await expect(folha.getByText('Dieta: Dieta do Plano 17')).toBeVisible();
    await expect(folha.getByText('Inclua ao menos uma refeição.')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Abrir Dieta: Dieta do Plano 17' })).toBeVisible();
    // Nada mudou: a dieta segue em rascunho e só a rota da pasta foi chamada (nenhuma publicação plano a plano).
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/publicar')).map((p) => [p.caminho, p.corpo]))
      .toEqual([[`/pastas/${PASTA_ID}/publicar`, { confirmarAvisos: false, versoes: { [PLANO_ID]: DIETA.plano.versao } }]]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: com sucesso diz quantos foram publicados e os selos mudam (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirComPasta(page);
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();
    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('1 publicado, 1 sem alteração.')).toBeVisible();
    // A Folha continua aberta e recarrega os planos: a dieta passa a v1 e o treino segue na v2.
    await expect(folha.getByText('Publicado v1', { exact: true })).toBeVisible();
    await expect(folha.getByText('Publicado v2', { exact: true })).toBeVisible();
    await expect(folha.getByText('Rascunho', { exact: true })).toHaveCount(0);

    // De novo, sem nada alterado: nada para publicar.
    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('Nada para publicar: os planos já estão publicados e sem alteração.')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: avisos pedem "Publicar mesmo assim" (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { avisos: [{ field: 'dieta.aguaLitros', message: 'Sem água por dia.' }] });
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('Nada foi publicado ainda', { exact: true })).toBeVisible();
    await expect(folha.getByText('Sem água por dia.')).toBeVisible();
    await folha.getByRole('button', { name: 'Publicar mesmo assim' }).click();
    await expect(folha.getByText('1 publicado, 1 sem alteração.')).toBeVisible();
    expect(pedidos.filter((p) => p.caminho === `/pastas/${PASTA_ID}/publicar`).map((p) => p.corpo))
      .toEqual([
        { confirmarAvisos: false, versoes: { [PLANO_ID]: DIETA.plano.versao } },
        { confirmarAvisos: true, versoes: { [PLANO_ID]: DIETA.plano.versao } },
      ]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: sem a permissão de publicar a dieta alterada, o botão fica desabilitado com o motivo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const permissoes = PERMISSOES_DA_PASTA.filter((p) => p !== 'DIETA_PUBLICAR');
    const { pedidos, errosDaPagina } = await abrirComPasta(page, {}, permissoes);
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(folha.getByText('Falta permissão para publicar a dieta.')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' })).toBeDisabled();
    expect(pedidos.some((p) => p.caminho.endsWith('/publicar'))).toBe(false);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: sem ler o treino o botão fica ativo e o 403 da API é explicado (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    // Sem TREINO_LER a Folha não sabe se o treino tem alteração; ele tem, e falta TREINO_PUBLICAR: a API recusa tudo.
    const permissoes = PERMISSOES_DA_PASTA.filter((p) => p !== 'TREINO_LER' && p !== 'TREINO_PUBLICAR');
    const planos: PlanoDaPastaFalsa[] = [
      { tipo: 'treino', plano: { ...TREINO, rascunhoAlteradoDepoisDePublicar: true } },
      { tipo: 'dieta', plano: { ...DIETA.plano } },
    ];
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { planos }, permissoes);
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    const botao = folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' });
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(folha.getByText('Você não tem permissão para publicar todos os planos com alteração desta pasta. Nada foi publicado.')).toBeVisible();
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/publicar')).map((p) => p.caminho)).toEqual([`/pastas/${PASTA_ID}/publicar`]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: lista que falhou ao carregar desabilita o botão com o motivo e "Tentar de novo" libera (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { listaFalhaNaPrimeiraVez: ['dieta'] });
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    const botao = folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' });
    await expect(folha.getByText('Não foi possível carregar a dieta. Tente de novo.')).toBeVisible();
    await expect(botao).toBeDisabled();
    const tentar = folha.getByRole('button', { name: 'Tentar carregar os planos de novo' });
    await expect(tentar).toBeVisible();
    expect(pedidos.some((p) => p.caminho.endsWith('/publicar'))).toBe(false);

    await tentar.click();
    await expect(botao).toBeEnabled();
    await expect(folha.getByText('Não foi possível carregar a dieta. Tente de novo.')).toHaveCount(0);
    await expect(tentar).toHaveCount(0);

    // Liberado, publica com a versão que a lista recarregada trouxe, sem aviso de que os planos mudaram.
    await botao.click();
    await expect(folha.getByText('1 publicado, 1 sem alteração.')).toBeVisible();
    await expect(folha.getByText(/Os planos mudaram/)).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho === `/pastas/${PASTA_ID}/publicar`).map((p) => p.corpo))
      .toEqual([{ confirmarAvisos: false, versoes: { [PLANO_ID]: DIETA.plano.versao } }]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: versão velha (outra pessoa salvou) dá 409, recarrega com aviso e o segundo pedido leva a versão nova (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { outraPessoaSalvou: [PLANO_ID] });
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();
    const listasDeDieta = () => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `/alunos/${ALUNO_ID}/planos-dieta`).length;
    const antes = listasDeDieta();

    const recarga = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().endsWith(`/alunos/${ALUNO_ID}/planos-dieta`));
    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('Os planos mudaram enquanto você olhava. Nada foi publicado; confira e publique de novo.')).toBeVisible();
    await recarga;
    expect(listasDeDieta()).toBeGreaterThan(antes);
    // Nada foi publicado: a dieta segue em rascunho.
    await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();

    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('1 publicado, 1 sem alteração.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/publicar`).map((p) => p.corpo)).toEqual([
      { confirmarAvisos: false, versoes: { [PLANO_ID]: DIETA.plano.versao } },
      { confirmarAvisos: false, versoes: { [PLANO_ID]: DIETA.plano.versao + 1 } },
    ]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`publicar tudo: dois pendentes do mesmo tipo orientam a arquivar um deles, com os títulos, sem tentar de novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const outraDieta: PlanoResumo = { ...DIETA.plano, id: 'd0000000-0000-4000-8000-000000000002', titulo: 'Dieta B do Plano 17' };
    const planos: PlanoDaPastaFalsa[] = [
      { tipo: 'treino', plano: { ...TREINO } },
      { tipo: 'dieta', plano: { ...DIETA.plano } },
      { tipo: 'dieta', plano: outraDieta },
    ];
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { planos });
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await folha.getByRole('button', { name: 'Publicar tudo da pasta Plano 17' }).click();
    await expect(folha.getByText('Nada foi publicado', { exact: true })).toBeVisible();
    await expect(folha.getByText('Há mais de uma dieta pendente nesta pasta (“Dieta do Plano 17” e “Dieta B do Plano 17”). Nada foi publicado. Arquive o que não deve ir ao aluno (⋯ › Excluir plano) e publique de novo.')).toBeVisible();
    // Nada publicado e nenhuma nova tentativa sozinha.
    await expect(folha.getByText('Rascunho', { exact: true })).toHaveCount(2);
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/publicar`)).toHaveLength(1);
    expect(errosDaPagina).toEqual([]);
  });

  test(`copiar pasta: mobilidade fora do plano é pulada e o aviso diz que ela não foi copiada (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirComPasta(page, { copiaPulados: [{ tipo: 'mobilidade', motivo: 'FUNCIONALIDADE_FORA_DO_PLANO' }] }, PERMISSOES_DA_PASTA, {
      'GET /alunos': { corpo: { itens: [DESTINO], total: 1 } },
      [`GET /alunos/${DESTINO.id}`]: { corpo: { ...FICHA, id: DESTINO.id, nome: DESTINO.nome } },
      [`GET /alunos/${DESTINO.id}/pastas`]: { corpo: [] },
    });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Mais ações da pasta Plano 17' }).click();
    await page.getByRole('button', { name: /Copiar pasta para outro aluno/ }).click();
    const folha = page.getByRole('dialog', { name: 'Copiar pasta para outro aluno' });
    await folha.getByRole('button', { name: 'Aluno: Escolher. Escolher.' }).click();
    await page.getByRole('dialog', { name: 'Escolher aluno' }).getByRole('radio', { name: DESTINO.nome }).click();
    await folha.getByRole('button', { name: 'Copiar pasta', exact: true }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Pasta copiada para Aluna Destino, com os planos em rascunho. A mobilidade não foi copiada porque está fora do plano da consultoria.')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`copiar pasta para outro aluno: aviso, aluno, título e o atalho para a ficha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, {}, PERMISSOES_DA_PASTA, {
      'GET /alunos': { corpo: { itens: [{ ...DESTINO, id: ALUNO_ID, nome: ALUNO.nome }, DESTINO], total: 2 } },
      [`GET /alunos/${DESTINO.id}`]: { corpo: { ...FICHA, id: DESTINO.id, nome: DESTINO.nome } },
      [`GET /alunos/${DESTINO.id}/pastas`]: { corpo: [] },
    });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Mais ações da pasta Plano 17' }).click();
    await page.getByRole('button', { name: /Copiar pasta para outro aluno/ }).click();

    const folha = page.getByRole('dialog', { name: 'Copiar pasta para outro aluno' });
    await expect(folha.getByText(AVISO_DA_COPIA)).toBeVisible();
    await expect(folha.getByRole('textbox', { name: 'Título da nova pasta' })).toHaveValue('Plano 17');
    await expect(folha.getByText('Escolha o aluno.')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Copiar pasta', exact: true })).toBeDisabled();

    // O próprio aluno não aparece entre os destinos.
    await folha.getByRole('button', { name: 'Aluno: Escolher. Escolher.' }).click();
    const escolha = page.getByRole('dialog', { name: 'Escolher aluno' });
    await expect(escolha.getByRole('radio', { name: ALUNO.nome })).toHaveCount(0);
    await escolha.getByRole('radio', { name: DESTINO.nome }).click();
    await expect(escolha).toHaveCount(0);
    await folha.getByRole('textbox', { name: 'Título da nova pasta' }).fill('Plano 17 da Aluna');
    await folha.getByRole('button', { name: 'Copiar pasta', exact: true }).click();

    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Pasta copiada para Aluna Destino, com os planos em rascunho.')).toBeVisible();
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/copiar-para-aluno`);
    expect(post?.corpo).toEqual({ alunoId: DESTINO.id, titulo: 'Plano 17 da Aluna', inicio: null, fim: null });
    // Nunca navega sozinho: só pelo atalho do aviso.
    expect(new URL(page.url()).pathname).toBe(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Abrir ficha de Aluna Destino' }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${DESTINO.id}$`));
    expect(errosDaPagina).toEqual([]);
  });

  test(`copiar pasta: aluno anonimizado mostra o motivo na folha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirComPasta(page, { copia: { status: 409, codigo: 'ALUNO_ANONIMIZADO', mensagem: 'Aluno anonimizado.' } }, PERMISSOES_DA_PASTA, {
      'GET /alunos': { corpo: { itens: [DESTINO], total: 1 } },
    });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Mais ações da pasta Plano 17' }).click();
    await page.getByRole('button', { name: /Copiar pasta para outro aluno/ }).click();
    const folha = page.getByRole('dialog', { name: 'Copiar pasta para outro aluno' });
    await folha.getByRole('button', { name: 'Aluno: Escolher. Escolher.' }).click();
    await page.getByRole('dialog', { name: 'Escolher aluno' }).getByRole('radio', { name: DESTINO.nome }).click();
    await folha.getByRole('button', { name: 'Copiar pasta', exact: true }).click();
    await expect(folha.getByText(/Este aluno foi anonimizado/)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: peso e data nascem com os da atualização e, sem edição, não gravam peso de novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { pesoSugerido: { pesoKg: 82.4, data: '2026-10-20' } });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByRole('textbox', { name: 'Peso (opcional)' })).toHaveValue('82,4');
    await expect(folha.getByRole('textbox', { name: 'Data do peso' })).toHaveValue('20/10/2026');
    await expect(folha.getByText(NOTA_JA_REGISTRADO)).toBeVisible();
    await expect(folha.getByText(/finalizar assim não grava de novo/)).toBeVisible();
    // Intacto não substitui nada nem pede conferência, e a linha do peso não sai repetida.
    await expect(folha.getByText(SUBSTITUI)).toHaveCount(0);
    await expect(folha.getByText(/Peso preenchido com o da atualização/)).toHaveCount(0);
    await expect(folha.getByText(LINHA_DO_PESO)).toHaveCount(0);
    // A observação é só da equipe: o formulário diz isso logo abaixo do campo.
    await expect(folha.getByText('Só a equipe vê esta observação.', { exact: false })).toBeVisible();

    await folha.getByRole('button', { name: 'Finalizar pasta' }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Pasta finalizada.', { exact: true })).toBeVisible();
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/finalizar`);
    expect(post?.corpo).toEqual({ data: null, pesoKg: null, observacao: null });
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: só a observação conta como edição e grava na data da atualização, substituindo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { pesoSugerido: { pesoKg: 82.4, data: '2026-10-20' } });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByText(NOTA_JA_REGISTRADO)).toBeVisible();

    await folha.getByRole('textbox', { name: 'Observação (opcional)' }).fill('Em jejum');
    await expect(folha.getByText(NOTA_JA_REGISTRADO)).toHaveCount(0);
    await expect(folha.getByText('Peso preenchido com o da atualização de 20/10/2026; confira antes de salvar.')).toBeVisible();
    await expect(folha.getByText(SUBSTITUI)).toBeVisible();
    await expect(folha.getByText(LINHA_DO_PESO)).toBeVisible();

    await folha.getByRole('button', { name: 'Finalizar pasta' }).click();
    await expect(folha).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/finalizar`);
    expect(post?.corpo).toEqual({ data: '2026-10-20', pesoKg: 82.4, observacao: 'Em jejum' });
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: valor e data editados gravam o peso novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { pesoSugerido: { pesoKg: 82.4, data: '2026-10-20' } });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    const peso = folha.getByRole('textbox', { name: 'Peso (opcional)' });
    await expect(peso).toHaveValue('82,4');

    // "82,40" é o mesmo número: continua sem edição.
    await peso.fill('82,40');
    await expect(folha.getByText(NOTA_JA_REGISTRADO)).toBeVisible();

    // Outra data é edição: sai a nota, entra a conferência; fora da data da atualização, nada a substituir.
    const data = folha.getByRole('textbox', { name: 'Data do peso' });
    await data.fill('31/10/2026');
    await expect(folha.getByText(NOTA_JA_REGISTRADO)).toHaveCount(0);
    await expect(folha.getByText(/Peso preenchido com o da atualização/)).toBeVisible();
    await expect(folha.getByText(SUBSTITUI)).toHaveCount(0);

    // Valor novo: a nota de conferência some.
    await peso.fill('81,9');
    await expect(folha.getByText(/Peso preenchido com o da atualização/)).toHaveCount(0);
    await folha.getByRole('button', { name: 'Finalizar pasta' }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Pasta finalizada e peso registrado.')).toBeVisible();
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/finalizar`);
    expect(post?.corpo).toEqual({ data: '2026-10-31', pesoKg: 81.9, observacao: null });
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: falha no peso sugerido deixa o campo vazio, sem erro na tela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirComPasta(page, { pesoSugerido: 'erro' });
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect.poll(() => pedidos.some((p) => p.caminho === `/pastas/${PASTA_ID}/peso-sugerido`)).toBe(true);
    await expect(folha.getByRole('textbox', { name: 'Peso (opcional)' })).toHaveValue('');
    await expect(folha.getByRole('textbox', { name: 'Data do peso' })).toHaveValue(hojeNaTela());
    await expect(folha.getByText(/Peso preenchido com o da atualização/)).toHaveCount(0);
    await expect(folha.getByText(/já registrado\)/)).toHaveCount(0);
    await expect(folha.getByText(LINHA_DO_PESO)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`C22: o ?pastaId= sai do endereço, recarregar não reabre e "Voltar à pasta" volta à mesma ficha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirComPasta(page);
    const folha = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(folha).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    await page.reload();
    const linha = page.getByRole('button', { name: /^Pasta Plano 17, aberta/ });
    await expect(linha).toBeVisible();
    await expect(folha).toHaveCount(0);

    // Da ficha para o editor e de volta: a Folha reabre na ficha que já estava aberta.
    await linha.click();
    await folha.getByRole('button', { name: 'Editar dieta do aluno' }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/dietas/${PLANO_ID}$`));
    await page.getByRole('link', { name: 'Voltar à pasta' }).click();
    await expect(folha).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    expect(errosDaPagina).toEqual([]);
  });
}

test('web: a atualização ao lado do editor é <a href> que abre em outra aba', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
  await page.goto(`/treinador/dietas/${PLANO_ID}`);

  const link = page.getByRole('link', { name: /Abrir atualização de 20\/10\/2026 em outra aba/ });
  await expect(link).toHaveAttribute('href', `/treinador/atualizacoes/${ATUALIZACAO_ID}`);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByText('Abrir atualização em outra aba')).toBeVisible();

  // O clique simples também abre outra aba: o editor fica onde está, com o rascunho.
  await page.getByLabel('Água por dia (opcional)').fill('2,5');
  const nova = context.waitForEvent('page');
  await link.click();
  const aba = await nova;
  await aba.waitForURL(/\/treinador\/atualizacoes\//);
  expect(new URL(aba.url()).pathname).toBe(`/treinador/atualizacoes/${ATUALIZACAO_ID}`);
  expect(new URL(page.url()).pathname).toBe(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByText('Sair sem salvar?')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('web: sem ATUALIZACAO_LER o editor não mostra a atualização, mas mantém o "Voltar à pasta"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, []);
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('link', { name: 'Voltar à pasta' })).toBeVisible();
  await expect(page.getByText('Abrir atualização em outra aba')).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.endsWith('/atualizacao') || p.caminho.endsWith('/atualizacoes'))).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
