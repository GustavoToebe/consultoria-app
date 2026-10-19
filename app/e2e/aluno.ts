import type { Page } from '@playwright/test';

import type { PainelAluno } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, sessao, type RespostasApi } from './api-falsa';

/**
 * Sessão de aluno com o mínimo que o layout pede: painel sem treino nem atualização, sem mobilidade (404) e fotos
 * desligadas. Cada teste soma as rotas da tela que confere.
 */
export async function sessaoDeAluno(page: Page): Promise<RespostasApi> {
  const painel: PainelAluno = {
    atualizacao: null,
    marca: MARCA,
    aluno: { nome: ALUNO.nome },
    treino: null,
    ultimasCargas: {},
    configuracao: { arredondamentoKg: 1, tipoTrabalho: 'WS' },
    geradoEm: '2026-10-19T12:00:00Z',
  };
  return {
    ...(await sessao(page, ALUNO)),
    'GET /aluno/painel': { corpo: painel },
    'GET /aluno/mobilidade': erroApi(404, 'Sem mobilidade publicada.'),
    'GET /aluno/fotos/configuracao': { corpo: { habilitado: false, maximoPorPergunta: 6, bytesMaximo: 1_000_000, porDia: 12 } },
  };
}
