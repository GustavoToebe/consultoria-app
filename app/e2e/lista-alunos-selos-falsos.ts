import type { Page } from '@playwright/test';

import type { AlunoResumo, TagDaConsultoria, TagDeAluno } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Lista de alunos com os quatro tipos de linha do pedido de 24/11 (selos na mesma linha): sem selo, com situação (cobrança
 * vencida), com situação e 1 tag e com situação e 4 tags. Só dados fictícios, API simulada. Usada por
 * `lista-alunos-selos.spec.ts` e por `zz-alunos-capturas.spec.ts`.
 */
const tag = (n: number, nome: string, cor: TagDeAluno['cor']): TagDeAluno => ({ id: `70000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`, nome, cor });
export const TAGS = {
  online: tag(1, 'Online', 'CIANO'), retorno: tag(2, 'Retorno', 'VIOLETA'), presencial: tag(3, 'Presencial', 'MAGENTA'), avancado: tag(4, 'Avançado', 'INDIGO'),
};
const NA_CONSULTORIA: TagDaConsultoria[] = Object.values(TAGS).map((t) => ({ ...t, totalAlunos: 1, versao: 0 }));

const id = (n: number) => `a0000000-0000-4000-8000-00000000000${n}`;
function aluno(n: number, nome: string, tags: TagDeAluno[]): AlunoResumo {
  return {
    id: id(n), nome, ativo: true, temAcesso: true, planoAtivo: { id: `pl${n}`, titulo: 'Treino de outubro' }, ultimoRegistro: null,
    responsavelId: TREINADOR.id, atualizacao: null, tags,
  };
}

export const SEM_SELO = 'Ana Fictícia';
export const SO_SITUACAO = 'Bruno Exemplo';
export const SITUACAO_E_UMA_TAG = 'Carla Teste';
export const SITUACAO_E_QUATRO_TAGS = 'Davi Modelo';

const ALUNOS: AlunoResumo[] = [
  aluno(1, SEM_SELO, []),
  aluno(2, SO_SITUACAO, []),
  aluno(3, SITUACAO_E_UMA_TAG, [TAGS.online]),
  aluno(4, SITUACAO_E_QUATRO_TAGS, [TAGS.online, TAGS.retorno, TAGS.presencial, TAGS.avancado]),
];

export async function abrirListaDeAlunos(page: Page, largura: number, tema: 'CLARO' | 'ESCURO' = 'CLARO') {
  await page.addInitScript(([u, t]) => localStorage.setItem(`treinos:${u}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'FINANCEIRO_LER'], pagamentosHabilitados: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 4, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /tags-de-alunos': { corpo: NA_CONSULTORIA },
    'GET /financeiro/alunos-em-atraso': { corpo: { alunoIds: [id(2), id(3), id(4)], truncado: false } },
  });
}
