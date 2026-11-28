import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import type { TermosVigentes } from '../src/api/tipos';
import { ALUNO, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/** Contato (fictício) da consultoria que a API monta no lugar do marcador. Só o campo `rascunho` diz que é rascunho. */
export const CONTATO_FICTICIO = '- **Consultoria:** Equipe Teste\n- **WhatsApp:** (45) 99999-8888\n- **E-mail:** contato@exemplo.test';

/**
 * Os textos REAIS (`api/src/main/resources/termos/*.md`) servidos como a API os serve (`Termos.documentos` e
 * `Termos.notasInternas`): sem a linha do título, com o marcador do contato trocado e a nota `[REVISAR COM ADVOGADO: ...]`
 * fora do texto. Colchete de modelo novo nos `.md` que a API não trate continua aqui e faz as specs de ausência falharem.
 */
const NOTA_INTERNA = /[ \t]*\[REVISAR COM ADVOGADO:\s*([^\]]+?)\s*\]/g;
const MARCADOR = '{{CONTATO_DA_CONSULTORIA}}';

function lerTermo(arquivo: string): { titulo: string; bruto: string } {
  const tudo = readFileSync(join(process.cwd(), '..', 'api', 'src', 'main', 'resources', 'termos', arquivo), 'utf8').replace(/\r\n/g, '\n').trim();
  const quebra = tudo.indexOf('\n');
  return { titulo: tudo.slice(0, quebra).replace(/^#+\s*/, '').trim(), bruto: tudo.slice(quebra + 1).trim() };
}

const ARQUIVOS = [['TERMO_USO', 'termo-de-uso.md'], ['AVISO_PRIVACIDADE', 'aviso-de-privacidade.md']] as const;
const LIDOS = ARQUIVOS.map(([id, arquivo]) => ({ id, ...lerTermo(arquivo) }));

/** Como a API serve ao aluno e à equipe (o texto é o mesmo; só a equipe recebe `notasInternas`). */
export const TERMOS: TermosVigentes = {
  versao: '2026-10-26',
  rascunho: true,
  aceito: true,
  aceitoEm: '2026-11-28T14:00:00Z',
  documentos: LIDOS.map((d) => ({ id: d.id, titulo: d.titulo, texto: d.bruto.replace(NOTA_INTERNA, '').split(MARCADOR).join(CONTATO_FICTICIO) })),
  notasInternas: LIDOS.flatMap((d) => [...d.bruto.matchAll(NOTA_INTERNA)].map((m) => ({ documentoId: d.id, documentoTitulo: d.titulo, texto: m[1].trim() }))),
};

/** O que o aluno recebe: o mesmo texto, sem as notas. */
export const TERMOS_DO_ALUNO: TermosVigentes = { ...TERMOS, aceito: false, aceitoEm: null, notasInternas: [] };

/** Colchete de modelo ou marcador que nunca pode chegar à tela do aluno (o mesmo padrão do teste da API). */
export const COLCHETE_DE_MODELO = /\[[A-ZÀ-Ú][^\]]*(PREENCHER|REVISAR|CONTATO)[^\]]*\]|\{\{/;

export type Tema = 'CLARO' | 'ESCURO';

const preferencias = (page: Page, id: string, tema: Tema) =>
  page.addInitScript(([i, t]) => localStorage.setItem(`treinos:${i}:preferencias`, JSON.stringify({ tema: t })), [id, tema] as const);

/** Termos e privacidade da equipe (Configurações › Termos e privacidade), com `GET /termos` trocável. */
export async function abrirTermosDaEquipe(page: Page, largura: number, tema: Tema, rotas: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 1000 });
  await preferencias(page, TREINADOR.id, tema);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' } },
    'GET /termos': { corpo: TERMOS },
    ...rotas,
  });
  await page.goto('/treinador/configuracoes/termos');
  return api;
}

/** Aluno com os termos pendentes: só a tela de aceite aparece. */
export async function abrirAceiteDoAluno(page: Page, largura: number, tema: Tema) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 1000 });
  await preferencias(page, ALUNO.id, tema);
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { termosPendentes: true, termosVersao: TERMOS.versao })),
    'GET /termos': { corpo: TERMOS_DO_ALUNO },
    'POST /termos/aceite': { corpo: { ...TERMOS_DO_ALUNO, aceito: true, aceitoEm: TERMOS.aceitoEm } },
  });
  await page.goto('/aluno');
  return api;
}
