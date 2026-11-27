import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, PastaResumo, PlanoResumo } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, PERMISSOES_TREINADOR, rotasDaPasta, sessao, simularApi, TREINADOR, type PlanoDaPastaFalsa, type RespostasApi } from './api-falsa';

/**
 * Folha da pasta redesenhada (bloco F de `docs/planos/atualizacao-pasta-e-questionarios.md`, à risca, com a "Ordem
 * sugerida" no ⓘ): topo com situação, período (uma vez só), "Finalizar" secundário e o ⓘ; a atualização logo abaixo, com
 * o questionário do período dentro; planos em abas Treino | Dieta | Mobilidade com a contagem, um selo por linha e o
 * "Publicar alterações (N)" primário embaixo da lista (secundário quando há atualização para revisar); editar e copiar
 * para outro período no ⋯. As capturas (linha e Folha, 390 e 1280, claro e escuro) saem do último bloco, na pasta
 * `E2E_CAPTURAS` (o "antes" e o "depois" usam os mesmos dados). Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-000000000017';
const captura = (nome: string) => (process.env.E2E_CAPTURAS ? `${process.env.E2E_CAPTURAS}/${nome}` : test.info().outputPath(nome));

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const PASTA: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-11-16', fim: '2026-11-30', concluidaEm: null, liberarEm: '2026-12-01' };
const ATUALIZACAO: Atualizacao = {
  id: 'e0000000-0000-4000-8000-000000000005', pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, dataAtualizacao: '2026-11-26',
  fase: 'ENVIADA', diasParaData: -1, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-11-26T12:00:00Z', feedback: null, versao: 1, resumo: null,
};
const BASE: Omit<PlanoResumo, 'id' | 'titulo'> = {
  alunoId: ALUNO_ID, pastaId: PASTA_ID, inicio: PASTA.inicio, fim: PASTA.fim, ativo: false, versaoPublicada: 0,
  publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};
const TREINO: PlanoResumo = { ...BASE, id: 'b0000000-0000-4000-8000-000000000001', titulo: 'Treino do Plano 17', ativo: true, versaoPublicada: 2, publicadoEm: '2026-11-16T12:00:00Z', versao: 4 };
const RASCUNHO: PlanoResumo = { ...BASE, id: 'd0000000-0000-4000-8000-000000000001', titulo: 'Importada da planilha (rascunho)' };
const DIETA_ALTERADA: PlanoResumo = { ...BASE, id: 'd0000000-0000-4000-8000-000000000002', titulo: 'Dieta do Plano 17', ativo: true, versaoPublicada: 1, publicadoEm: '2026-11-16T12:00:00Z', rascunhoAlteradoDepoisDePublicar: true, versao: 3 };
const MOBILIDADE: PlanoResumo = { ...BASE, id: 'c0000000-0000-4000-8000-000000000001', titulo: 'Mobilidade do Plano 17', versaoPublicada: 1, publicadoEm: '2026-11-26T12:00:00Z', liberarEm: '2026-12-01', versao: 2 };
/** As capturas: duas dietas pendentes (o rascunho repetido do plano F), treino em uso e mobilidade agendada. */
const PLANOS_DAS_CAPTURAS: PlanoDaPastaFalsa[] = [
  { tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }, { tipo: 'dieta', plano: DIETA_ALTERADA }, { tipo: 'mobilidade', plano: MOBILIDADE },
];
const PERMISSOES = [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER'];

async function abrir(page: Page, opcoes: { tema?: 'CLARO' | 'ESCURO'; planos: PlanoDaPastaFalsa[]; enviada?: boolean; permissoes?: string[]; extras?: RespostasApi }) {
  const permissoes = opcoes.permissoes ?? PERMISSOES;
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00-03:00'));
  if (opcoes.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, opcoes.tema] as const);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 1 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
    [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: { corpo: { pasta: PASTA } },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: opcoes.enviada === false ? erroApi(404, 'Sem atualização.', 'NAO_ENCONTRADO') : { corpo: ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: opcoes.enviada === false ? [] : [ATUALIZACAO] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    ...rotasDaPasta({ alunoId: ALUNO_ID, pastaId: PASTA_ID, planos: opcoes.planos.map((p) => ({ ...p, plano: { ...p.plano } })), permissoes }),
    ...opcoes.extras,
  });
}

const fundo = (botao: Locator) => botao.evaluate((el) => getComputedStyle(el).backgroundColor);

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 }); });

    test('caminho feliz: "Publicar alterações (2)" primário diz o que vai publicar, publica e trava sem nada a publicar', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: { ...TREINO, rascunhoAlteradoDepoisDePublicar: true } }, { tipo: 'dieta', plano: RASCUNHO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Plano 17' });
      // Topo: o período uma vez só e o "Finalizar" secundário (o primário é o Publicar).
      await expect(folha.getByText(/^Período:/)).toHaveCount(1);
      const publicar = folha.getByRole('button', { name: 'Publicar alterações (2) da pasta Plano 17' });
      await expect(folha.getByText('Vai publicar 2 planos: “Treino do Plano 17” e “Importada da planilha (rascunho)”.', { exact: false })).toBeVisible();
      await expect(publicar).toBeEnabled();
      expect(await fundo(publicar)).not.toBe(await fundo(folha.getByRole('button', { name: 'Finalizar pasta' })));
      // Abas com a contagem; o treino com alteração tem um selo só.
      await expect(folha.getByRole('tab', { name: 'Treino (1)' })).toHaveAttribute('aria-selected', 'true');
      await expect(folha.getByRole('tab', { name: 'Dieta (1)' })).toBeVisible();
      await expect(folha.getByRole('tabpanel', { name: 'Treino (1)' }).getByText('Alterações não publicadas', { exact: true })).toBeVisible();
      await expect(folha.getByText('Em uso pelo aluno · Publicado v2 em 16/11')).toBeVisible();
      await publicar.click();
      await expect(folha.getByText(/^Treino e dieta publicad/)).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Publicar alterações (0) da pasta Plano 17' })).toBeDisabled();
      await expect(folha.getByText('Nada para publicar: os planos desta pasta já estão publicados.')).toBeVisible();
      // Sem o que publicar, a escolha de quando o aluno vê some.
      await expect(folha.getByRole('radio', { name: 'Liberar agora' })).toHaveCount(0);
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/publicar'))).toHaveLength(1);
      expect(errosDaPagina).toEqual([]);
    });

    test('atualização para revisar: "Revisar" é o primário e o Publicar vira secundário; o questionário fica no cartão dela', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { planos: [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Plano 17' });
      const revisar = folha.getByRole('button', { name: 'Revisar atualização' });
      const publicar = folha.getByRole('button', { name: 'Publicar alterações (1) da pasta Plano 17' });
      await expect(publicar).toBeEnabled();
      const finalizar = folha.getByRole('button', { name: 'Finalizar pasta' });
      expect(await fundo(publicar)).toBe(await fundo(finalizar));
      expect(await fundo(revisar)).not.toBe(await fundo(publicar));
      await expect(folha.getByRole('button', { name: /^Questionário deste período/ })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('erro da API ao publicar (500): nada muda e a mensagem aparece na Folha', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, {
        enviada: false, planos: [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }],
        extras: { [`POST /pastas/${PASTA_ID}/publicar`]: erroApi(500, 'Falha no servidor.') },
      });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Plano 17' });
      await folha.getByRole('button', { name: 'Publicar alterações (1) da pasta Plano 17' }).click();
      await expect(folha.getByText(/Falha no servidor|Não foi possível|Tente de novo/).first()).toBeVisible();
      await folha.getByRole('tab', { name: 'Dieta (1)' }).click();
      await expect(folha.getByText('Rascunho', { exact: true })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('vazio: aba sem plano diz que não há e oferece o "Novo"', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Plano 17' });
      await folha.getByRole('tab', { name: 'Dieta (0)' }).click();
      const painel = folha.getByRole('tabpanel', { name: 'Dieta (0)' });
      await expect(painel.getByText('Sem dietas nesta pasta')).toBeVisible();
      await expect(painel.getByRole('button', { name: 'Nova dieta' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('sem PASTA_ALTERAR: sem Finalizar no topo nem Editar e Copiar no ⋯', async ({ page }) => {
      const permissoes = PERMISSOES.filter((p) => p !== 'PASTA_ALTERAR');
      const { errosDaPagina } = await abrir(page, { enviada: false, permissoes, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Plano 17' });
      await expect(folha.getByRole('tab', { name: 'Treino (1)' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Finalizar pasta' })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /Editar pasta|Copiar para outro período/ })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('⋯ da pasta: "Editar pasta" e "Copiar para outro período" vêm primeiro e abrem as folhas de sempre', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Mais ações da pasta Plano 17' }).click();
      const menu = page.getByRole('dialog', { name: 'Plano 17' });
      const itens = menu.getByRole('button');
      await expect(itens.filter({ hasText: 'Editar pasta' })).toBeVisible();
      await expect(itens.filter({ hasText: 'Copiar para outro período' })).toBeVisible();
      await itens.filter({ hasText: 'Editar pasta' }).click();
      await expect(page.getByRole('dialog', { name: 'Editar pasta' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    for (const tema of ['CLARO', 'ESCURO'] as const) {
      test(`capturas: linha e Folha da pasta (${tema})`, async ({ page }) => {
        const sufixo = `${tema.toLowerCase()}-${largura}`;
        // Sem a entrada em cascata das linhas: a captura não pega a lista no meio da animação.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const { errosDaPagina } = await abrir(page, { tema, planos: PLANOS_DAS_CAPTURAS });
        await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
        const linha = page.getByRole('button', { name: /^Pasta Plano 17, aberta/ });
        await expect(linha).toBeVisible();
        await linha.scrollIntoViewIfNeeded();
        await page.screenshot({ path: captura(`linha-da-pasta-${sufixo}.png`) });

        await linha.click();
        const folha = page.getByRole('dialog', { name: 'Plano 17' });
        await expect(folha.getByText('Treino do Plano 17')).toBeVisible();
        await page.screenshot({ path: captura(`folha-topo-${sufixo}.png`) });
        await folha.getByText('Treino do Plano 17').scrollIntoViewIfNeeded();
        await page.screenshot({ path: captura(`folha-planos-${sufixo}.png`) });
        // Depois do redesenho: a aba Dieta (o rascunho repetido e a trava dos duplicados) e o ⓘ aberto.
        const abaDieta = folha.getByRole('tab', { name: /^Dieta/ });
        if (await abaDieta.count()) {
          await abaDieta.click();
          await folha.getByText('Dieta do Plano 17', { exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: captura(`folha-dieta-${sufixo}.png`) });
          const ajuda = folha.getByRole('button', { name: 'Sobre esta tela' });
          await ajuda.scrollIntoViewIfNeeded();
          await ajuda.click();
          await expect(folha.getByRole('dialog', { name: 'Sobre esta tela' })).toBeVisible();
          await page.screenshot({ path: captura(`folha-ajuda-${sufixo}.png`) });
        }
        expect(errosDaPagina).toEqual([]);
      });
    }
  });
}
