import { expect, test, type Page } from '@playwright/test';

import type { AnamneseDetalhe, AnamneseResumo, ConteudoQuestionario } from '../src/api/tipos';
import { ALUNO, json, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

const ANAMNESE_ID = 'n0000000-0000-4000-8000-000000000001';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

/** Uma pergunta condicional (só aparece com "Sim") e uma grade obrigatória de duas linhas. */
const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: ['Responda com calma.'],
  secoes: [
    {
      uid: 's1',
      titulo: 'Histórico',
      perguntas: [
        { id: 'lesao', tipo: 'SIM_NAO', rotulo: 'Tem alguma lesão?', obrigatoria: true },
        { id: 'qual', tipo: 'TEXTO', rotulo: 'Qual lesão?', obrigatoria: true, mostrarSe: { perguntaId: 'lesao', valores: ['sim'] } },
        {
          id: 'frequencia',
          tipo: 'GRADE',
          rotulo: 'Com que frequência você pratica',
          obrigatoria: true,
          linhas: [{ id: 'corrida', rotulo: 'Corrida' }, { id: 'musculacao', rotulo: 'Musculação' }],
          colunas: [{ id: 'nunca', rotulo: 'Nunca' }, { id: 'as-vezes', rotulo: 'Às vezes' }, { id: 'sempre', rotulo: 'Sempre' }],
        },
      ],
    },
  ],
};

const PENDENTE: AnamneseDetalhe = {
  id: ANAMNESE_ID,
  alunoId: ALUNO_ID,
  nomeAluno: null,
  situacao: 'PENDENTE',
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001',
  questionarioVersaoNumero: 1,
  questionarioNome: null,
  modelo: MODELO,
  respostas: {},
  atribuidaEm: '2026-10-18T12:00:00Z',
  atribuidaPorNome: null,
  enviadaEm: null,
  revisadaEm: null,
  revisadaPorNome: null,
  dispensadaEm: null,
  dispensadaPorNome: null,
  alteracoes: [],
  dispensaMotivo: null,
  versao: 1,
};

/** Botão de uma opção dentro do grupo (`Escolha`) com o rótulo dado. */
const opcao = (page: Page, grupo: string, rotulo: string) =>
  page.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });

test('aluno responde a anamnese: a condição mostra e esconde a pergunta, a grade exige todas as linhas e o envio fica só leitura', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/anamnese': { corpo: PENDENTE },
    [`POST /aluno/anamnese/${ANAMNESE_ID}/enviar`]: (p, route) => {
      const corpo = p.corpo as { respostas: AnamneseDetalhe['respostas'] };
      return json(route, { ...PENDENTE, situacao: 'ENVIADA', respostas: corpo.respostas, enviadaEm: '2026-10-19T12:00:00Z', versao: 2 });
    },
  });
  const envios = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/enviar'));
  await page.goto('/aluno/anamnese');
  await expect(page.getByRole('heading', { name: 'Anamnese', level: 1 })).toBeVisible();
  await expect(page.getByText('Responda com calma.')).toBeVisible();

  // A pergunta condicional só aparece com "Sim" e some de novo com "Não".
  const qual = page.getByLabel('Qual lesão? *');
  await expect(qual).toHaveCount(0);
  await opcao(page, 'Tem alguma lesão? *', 'Sim').click();
  await expect(qual).toBeVisible();
  await qual.fill('Joelho');
  await opcao(page, 'Tem alguma lesão? *', 'Não').click();
  await expect(qual).toHaveCount(0);

  // Grade obrigatória com uma linha só: não envia.
  await opcao(page, 'Corrida', 'Sempre').click();
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Responda todas as linhas.').first()).toBeVisible();
  expect(envios()).toHaveLength(0);

  await opcao(page, 'Musculação', 'Às vezes').click();
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Anamnese enviada. Seu treinador vai ver as respostas.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar anamnese' })).toHaveCount(0);

  expect(envios()).toHaveLength(1);
  // A resposta da pergunta escondida não vai (nunca vira "não").
  expect(envios()[0].corpo).toEqual({
    questionarioVersaoId: PENDENTE.questionarioVersaoId,
    respostas: { lesao: false, frequencia: { corrida: 'sempre', musculacao: 'as-vezes' } },
  });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('treinador vê a anamnese respondida no cartão da ficha, com "Não se aplica" na pergunta escondida', async ({ page }) => {
  const enviada: AnamneseDetalhe = {
    ...PENDENTE,
    nomeAluno: ALUNO.nome,
    situacao: 'ENVIADA',
    questionarioNome: 'Anamnese inicial',
    atribuidaPorNome: TREINADOR.nome,
    respostas: { lesao: false, frequencia: { corrida: 'sempre', musculacao: 'as-vezes' } },
    enviadaEm: '2026-10-19T12:00:00Z',
    versao: 2,
  };
  const resumo: AnamneseResumo = {
    id: ANAMNESE_ID,
    situacao: 'ENVIADA',
    questionarioNome: 'Anamnese inicial',
    questionarioVersaoNumero: 1,
    atribuidaEm: enviada.atribuidaEm,
    enviadaEm: enviada.enviadaEm,
    revisadaEm: null,
    dispensadaEm: null,
    dispensaMotivo: null,
    alteracoesParaRevisar: 0,
    versao: 2,
  };
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: {
      corpo: {
        id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1,
        diasAtualizacao: null, anonimizado: false, emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
      },
    },
    [`GET /alunos/${ALUNO_ID}/anamneses`]: { corpo: [resumo] },
    [`GET /anamneses/${ANAMNESE_ID}`]: { corpo: enviada },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const cartao = page.getByText('Questionário inicial que o aluno responde no app.');
  await expect(cartao).toBeVisible();
  await page.getByText('Anamnese inicial').first().click();

  const folha = page.getByRole('dialog');
  await expect(folha.getByText('Respondida pelo aluno em', { exact: false })).toBeVisible();
  await expect(folha.getByText('Não se aplica')).toBeVisible();
  await expect(folha.getByText('Sempre')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Marcar como revisada' })).toBeVisible();
  // A ficha pede outras rotas (pastas, peso...), que a API falsa responde 404: aqui só importa não quebrar a tela.
  expect(errosDaPagina).toEqual([]);
});

/**
 * Anamnese em páginas (como o formulário do treinador): três seções, a primeira com descrição formatada, nota de 1 a 10
 * com os textos das pontas, duas perguntas de foto (desligadas na configuração falsa), grade de três colunas e aceite.
 */
const MODELO_EM_PAGINAS: ConteudoQuestionario = {
  formato: 2,
  instrucoes: ['Responda com calma; dá para continuar depois.'],
  secoes: [
    {
      uid: 'p1',
      titulo: 'Dados pessoais',
      descricao: 'Apenas para **fins fiscais**.\n\n__Leia com atenção__ antes de responder.',
      perguntas: [
        { id: 'nome', tipo: 'TEXTO', rotulo: 'Nome completo', obrigatoria: true },
        { id: 'sono', tipo: 'NOTA', rotulo: 'Quão reparador é o seu sono?', obrigatoria: true, min: 1, max: 10, rotuloMin: 'Nada', rotuloMax: 'Muito' },
      ],
    },
    {
      uid: 'p2',
      titulo: 'Fotos',
      perguntas: [
        { id: 'frente', tipo: 'FOTOS', rotulo: 'Foto de frente', obrigatoria: true, max: 1 },
        { id: 'costas', tipo: 'FOTOS', rotulo: 'Foto de costas', obrigatoria: true, max: 1 },
      ],
    },
    {
      uid: 'p3',
      titulo: 'Sintomas e regras',
      perguntas: [
        {
          id: 'sintomas', tipo: 'GRADE', rotulo: 'Com que frequência você sente', obrigatoria: true,
          linhas: [{ id: 'azia', rotulo: 'Azia' }, { id: 'insonia', rotulo: 'Insônia' }],
          colunas: [{ id: 'nunca', rotulo: 'Nunca' }, { id: 'ocasionalmente', rotulo: 'Ocasionalmente' }, { id: 'sempre', rotulo: 'Sempre' }],
        },
        { id: 'regras', tipo: 'ACEITE', rotulo: 'Regras da consultoria', obrigatoria: true, texto: 'O plano é **individual**.', declaracao: 'Li e concordo com as regras.' },
      ],
    },
  ],
};

test('anamnese em páginas: avançar confere a página, voltar mantém as respostas, o rascunho reabre na página e o envio vai na última', async ({ page }) => {
  const pendente: AnamneseDetalhe = { ...PENDENTE, modelo: MODELO_EM_PAGINAS };
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/anamnese': { corpo: pendente },
    [`POST /aluno/anamnese/${ANAMNESE_ID}/enviar`]: (p, route) => {
      const corpo = p.corpo as { respostas: AnamneseDetalhe['respostas'] };
      return json(route, { ...pendente, situacao: 'ENVIADA', respostas: corpo.respostas, enviadaEm: '2026-10-19T12:00:00Z', versao: 2 });
    },
  });
  const envios = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/enviar'));
  const avancar = page.getByRole('button', { name: 'Avançar para a próxima parte' });
  const voltar = page.getByRole('button', { name: 'Voltar à parte anterior' });
  await page.goto('/aluno/anamnese');

  // Página 1: instruções, descrição com negrito e sublinhado, sem "Voltar".
  await expect(page.getByText('Parte 1 de 3')).toBeVisible();
  await expect(page.getByText('Responda com calma; dá para continuar depois.')).toBeVisible();
  const negrito = page.getByText('fins fiscais', { exact: true });
  await expect(negrito).toHaveCSS('font-family', /Inter_700Bold/);
  await expect(page.getByText('Leia com atenção', { exact: true })).toHaveCSS('text-decoration-line', 'underline');
  await expect(voltar).toHaveCount(0);

  // Avançar com obrigatória vazia: mostra o erro e fica na página.
  await avancar.click();
  await expect(page.getByText('Preencha este campo.').first()).toBeVisible();
  await expect(page.getByText('Parte 1 de 3')).toBeVisible();

  await page.getByLabel('Nome completo *').fill('Fulano Fictício');
  await expect(page.getByText('1 = Nada')).toBeVisible();
  await expect(page.getByText('10 = Muito')).toBeVisible();
  await expect(page.getByRole('radio', { name: /^0 de/ })).toHaveCount(0);
  await page.getByRole('radio', { name: '7 de 10' }).click();
  await expect(page.getByRole('radio', { name: '7 de 10' })).toHaveAttribute('aria-checked', 'true');
  await avancar.click();

  // Página 2: as duas perguntas de foto, cada uma com o aviso (fotos desligadas no servidor).
  await expect(page.getByText('Parte 2 de 3')).toBeVisible();
  await expect(page.getByText('Fotos ainda não disponíveis.')).toHaveCount(2);
  await expect(page.getByText('Responda com calma; dá para continuar depois.')).toHaveCount(0);

  // Voltar mantém o que foi respondido.
  await voltar.click();
  await expect(page.getByText('Parte 1 de 3')).toBeVisible();
  await expect(page.getByLabel('Nome completo *')).toHaveValue('Fulano Fictício');
  await expect(page.getByRole('radio', { name: '7 de 10' })).toHaveAttribute('aria-checked', 'true');
  await avancar.click();
  await expect(page.getByText('Parte 2 de 3')).toBeVisible();

  // O rascunho guarda a página: reabrindo, volta à parte 2 com as respostas.
  await page.reload();
  await expect(page.getByText('Parte 2 de 3')).toBeVisible();
  await avancar.click();

  // Página 3: grade de três colunas e o aceite; a grade incompleta não envia.
  await expect(page.getByText('Parte 3 de 3')).toBeVisible();
  await expect(avancar).toHaveCount(0);
  await expect(page.getByText('individual', { exact: true })).toHaveCSS('font-family', /Inter_700Bold/);
  await opcao(page, 'Azia', 'Ocasionalmente').click();
  await page.getByRole('checkbox', { name: 'Li e concordo com as regras.' }).click();
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Responda todas as linhas.')).toBeVisible();
  await expect(page.getByText('Falta responder esta linha.')).toBeVisible();
  expect(envios()).toHaveLength(0);

  await opcao(page, 'Insônia', 'Nunca').click();
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Anamnese enviada. Seu treinador vai ver as respostas.')).toBeVisible();
  expect(envios()).toHaveLength(1);
  expect(envios()[0].corpo).toEqual({
    questionarioVersaoId: PENDENTE.questionarioVersaoId,
    respostas: { nome: 'Fulano Fictício', sono: 7, sintomas: { azia: 'ocasionalmente', insonia: 'nunca' }, regras: true },
  });

  // Enviada: tudo numa rolagem, só leitura, a grade como lista.
  await expect(page.getByText('Parte 1 de 3')).toHaveCount(0);
  await expect(page.getByText('Sintomas e regras')).toBeVisible();
  await expect(page.getByText('7 de 10')).toBeVisible();
  await expect(page.getByText('Ocasionalmente')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Grade de sintomas (cinco colunas, como a anamnese real): no celular cada linha cabe em duas fileiras sem quebrar o alvo de toque. */
test('grade de cinco colunas no celular (390 px): duas fileiras, alvo de 44 px e fonte de 12 px ou mais', async ({ page }) => {
  const modelo: ConteudoQuestionario = {
    formato: 2,
    instrucoes: [],
    secoes: [{
      uid: 's1', titulo: 'Sintomas',
      perguntas: [{
        id: 'sintomas', tipo: 'GRADE', rotulo: 'Com que frequência você sente', obrigatoria: true,
        linhas: [{ id: 'azia', rotulo: 'Azia' }, { id: 'insonia', rotulo: 'Insônia' }],
        colunas: ['Nunca', 'Raramente', 'Ocasionalmente', 'Frequentemente', 'Sempre'].map((r) => ({ id: r.toLowerCase(), rotulo: r })),
      }],
    }],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await simularApi(page, { ...(await sessaoDeAluno(page)), 'GET /aluno/anamnese': { corpo: { ...PENDENTE, modelo } } });
  await page.goto('/aluno/anamnese');
  await page.getByRole('radiogroup', { name: 'Azia' }).waitFor();
  for (const linha of ['Azia', 'Insônia']) {
    const medidas = await page.getByRole('radiogroup', { name: linha }).getByRole('button').evaluateAll((botoes) => botoes.map((b) => {
      const caixa = b.getBoundingClientRect();
      return { topo: Math.round(caixa.top), altura: caixa.height, largura: caixa.width, fonte: parseFloat(getComputedStyle(b.querySelector('*') ?? b).fontSize) };
    }));
    expect(medidas).toHaveLength(5);
    expect(new Set(medidas.map((m) => m.topo)).size, `fileiras de ${linha}`).toBe(2);
    for (const m of medidas) {
      expect(m.altura).toBeGreaterThanOrEqual(44);
      expect(m.largura).toBeGreaterThanOrEqual(44);
      expect(m.fonte).toBeGreaterThanOrEqual(12);
    }
  }
});
