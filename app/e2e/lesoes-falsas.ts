import { expect, type Page } from '@playwright/test';

import type { AlunoDetalhe, Lesao } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { ALUNO_FINANCEIRO_ID, estadoFinanceiro, rotasDoFinanceiro } from './financeiro-falso';

/** Ficha › Dados só com o histórico de lesões (cenas da tabela: acabamento da linha tingida). Só dados fictícios. */
export const ID = ALUNO_FINANCEIRO_ID;

const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, ultimoAcesso: null,
};

export const lesao = (id: string, regiao: string, p: Partial<Lesao> = {}): Lesao => ({
  id, regiao, descricao: null, dataInicio: null, dataFim: null, situacao: 'RECUPERADA', observacao: null, ...p,
});
const ativa = (id: string, regiao: string) => lesao(id, regiao, { situacao: 'ATIVA', descricao: 'Tendinite', dataInicio: '2026-10-01', observacao: 'Evitar desenvolvimento acima da cabeça.' });
const recuperada = (id: string, regiao: string) => lesao(id, regiao, { descricao: 'Entorse leve', dataInicio: '2026-03-01', dataFim: '2026-05-15' });

/** `ultima`: a ativa é a última linha. `meio`: a ativa fica entre outra ativa e as recuperadas (as ativas vêm sempre primeiro). */
export const CENAS: Record<'ultima' | 'meio', Lesao[]> = {
  ultima: [ativa('a1', 'Ombro direito'), ativa('a2', 'Cotovelo esquerdo')],
  meio: [ativa('a1', 'Ombro direito'), ativa('a2', 'Cotovelo esquerdo'), recuperada('r1', 'Joelho esquerdo'), recuperada('r2', 'Punho direito')],
};

export async function abrirLesoes(page: Page, largura: number, tema: 'CLARO' | 'ESCURO' | 'AREIA', lesoes: Lesao[], extra: Record<string, string> = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.addInitScript(([id, t, e]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, ...e })), [TREINADOR.id, tema, extra] as const);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { pagamentosHabilitados: false, recebimentoOnlineHabilitado: false, permissoes: [...PERMISSOES_TREINADOR] })),
    ...rotasDoFinanceiro(estadoFinanceiro({ contratacoes: [], cobrancas: [] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: { corpo: lesoes },
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Dados do aluno' })).toBeVisible();
  return api;
}
