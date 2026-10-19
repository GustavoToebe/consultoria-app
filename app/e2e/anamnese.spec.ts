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
    versao: 2,
  };
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: {
      corpo: {
        id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1,
        diasAtualizacao: null, anonimizado: false,
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
