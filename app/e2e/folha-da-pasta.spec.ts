import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, PastaResumo, PlanoResumo } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, PERMISSOES_TREINADOR, rotasDaPasta, sessao, simularApi, TREINADOR, type PlanoDaPastaFalsa, type RespostasApi } from './api-falsa';

/**
 * Folha da pasta (pedido de 27/11, sobre o bloco F de `docs/planos/atualizacao-pasta-e-questionarios.md`): o título é a
 * pasta pelo período ("Pasta de 16/11 a 30/11"), nunca o nome técnico; uma linha de situação com um selo só ("Vigente" ou
 * "Vencida há N dias") e o período com a duração; à direita "Finalizar pasta", ⓘ e ⋯. Abas Treino · Dieta · Mobilidade
 * com a contagem e o "+ Novo …" na mesma linha; cada plano com o selo logo depois do nome. A publicação mora no rodapé
 * fixo, só com alteração para publicar: "N alterações para publicar" (abre a lista com o nome que o aluno vai ver),
 * "Quando o aluno vê" (Agora · Agendar), "Avisar o aluno" e "Publicar alterações (N)". As capturas (390 e 1280, claro e
 * escuro: vigente com 1 rascunho e rodapé, vencida, sem alterações e sem rodapé, e o seletor do questionário fechado e
 * aberto ao lado do "Abrir atualização") saem do último bloco, na pasta
 * `E2E_CAPTURAS`. Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-000000000017';
const captura = (nome: string) => (process.env.E2E_CAPTURAS ? `${process.env.E2E_CAPTURAS}/${nome}` : test.info().outputPath(nome));

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
/** Vigente em 27/11 (o relógio fixo), com o título técnico da importação: a Folha nunca o mostra no título. */
const PASTA: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Importada da planilha (rascunho)', inicio: '2026-11-16', fim: '2026-11-30', concluidaEm: null, liberarEm: '2026-12-01' };
/** O período acabou em 11/11 e ela não foi finalizada: "Vencida há 16 dias" em 27/11. */
const VENCIDA: PastaResumo = { ...PASTA, inicio: '2026-11-01', fim: '2026-11-11', liberarEm: null };
const TITULO = 'Pasta de 16/11 a 30/11';
const DA_PASTA = 'da pasta de 16/11 a 30/11';
const ATUALIZACAO: Atualizacao = {
  id: 'e0000000-0000-4000-8000-000000000005', pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, dataAtualizacao: '2026-11-26',
  fase: 'ENVIADA', diasParaData: -1, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-11-26T12:00:00Z', feedback: null, versao: 1, resumo: null,
};
/** Capturas do seletor: a atualização ainda aberta ("Abrir atualização") e dois questionários publicados, fictícios. */
const ABERTA: Atualizacao = { ...ATUALIZACAO, dataAtualizacao: '2026-11-30', fase: 'ABERTA', diasParaData: 3, enviadaEm: null };
const OPCOES_DE_QUESTIONARIO = [
  { id: 'q0000000-0000-4000-8000-000000000001', nome: 'Padrão', padrao: true },
  { id: 'q0000000-0000-4000-8000-000000000002', nome: 'Check-in quinzenal', padrao: false },
];
const BASE: Omit<PlanoResumo, 'id' | 'titulo'> = {
  alunoId: ALUNO_ID, pastaId: PASTA_ID, inicio: PASTA.inicio, fim: PASTA.fim, ativo: false, versaoPublicada: 0,
  publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};
const TREINO: PlanoResumo = { ...BASE, id: 'b0000000-0000-4000-8000-000000000001', titulo: 'Treino do Plano 17', ativo: true, versaoPublicada: 2, publicadoEm: '2026-11-16T12:00:00Z', versao: 4 };
const RASCUNHO: PlanoResumo = { ...BASE, id: 'd0000000-0000-4000-8000-000000000001', titulo: 'Importada da planilha (rascunho)' };
const DIETA: PlanoResumo = { ...BASE, id: 'd0000000-0000-4000-8000-000000000002', titulo: 'Dieta do Plano 17', ativo: true, versaoPublicada: 1, publicadoEm: '2026-11-16T12:00:00Z', versao: 3 };
const MOBILIDADE: PlanoResumo = { ...BASE, id: 'c0000000-0000-4000-8000-000000000001', titulo: 'Mobilidade do Plano 17', versaoPublicada: 1, publicadoEm: '2026-11-26T12:00:00Z', liberarEm: '2026-12-05', versao: 2 };
/** Capturas: treino em uso, um rascunho de dieta (o do rodapé) e a mobilidade agendada. */
const COM_RASCUNHO: PlanoDaPastaFalsa[] = [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }, { tipo: 'mobilidade', plano: MOBILIDADE }];
/** Capturas: tudo publicado, sem rodapé. */
const SEM_ALTERACOES: PlanoDaPastaFalsa[] = [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: DIETA }];
const PERMISSOES = [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER'];

async function abrir(page: Page, opcoes: { tema?: 'CLARO' | 'ESCURO'; pasta?: PastaResumo; planos: PlanoDaPastaFalsa[]; enviada?: boolean; permissoes?: string[]; extras?: RespostasApi }) {
  const permissoes = opcoes.permissoes ?? PERMISSOES;
  const pasta = opcoes.pasta ?? PASTA;
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
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [pasta] },
    [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: { corpo: { pasta } },
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

    test('cabeçalho: o título é a pasta, um selo só e o período com a duração', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await expect(folha).toBeVisible();
      await expect(folha.getByText('Importada da planilha (rascunho)')).toHaveCount(0);
      await expect(folha.getByText('Vigente', { exact: true })).toBeVisible();
      await expect(folha.getByText(/^Vencida/)).toHaveCount(0);
      await expect(folha.getByText('16/11 a 30/11 · 15 dias', { exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Finalizar pasta' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Sobre esta tela' })).toBeVisible();
      await expect(folha.getByRole('button', { name: `Mais ações ${DA_PASTA}` })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('pasta vencida: "Vencida há 16 dias", sem o "Vigente"', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, pasta: VENCIDA, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: 'Pasta de 01/11 a 11/11' });
      await expect(folha.getByText('Vencida há 16 dias', { exact: true })).toBeVisible();
      await expect(folha.getByText('Vigente', { exact: true })).toHaveCount(0);
      await expect(folha.getByText('01/11 a 11/11 · 11 dias', { exact: true })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('caminho feliz: o rodapé conta, lista com o nome que o aluno vê, publica e some', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: { ...TREINO, rascunhoAlteradoDepoisDePublicar: true } }, { tipo: 'dieta', plano: RASCUNHO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      const publicar = folha.getByRole('button', { name: `Publicar alterações (2) ${DA_PASTA}` });
      await expect(publicar).toBeEnabled();
      expect(await fundo(publicar)).not.toBe(await fundo(folha.getByRole('button', { name: 'Finalizar pasta' })));
      // "Quando o aluno vê" e "Avisar o aluno" no rodapé; o padrão é agora e avisando.
      await expect(folha.getByRole('radio', { name: 'Agora' })).toBeChecked();
      await expect(folha.getByRole('switch', { name: 'Avisar o aluno' })).toBeChecked();
      // A lista do que vai sair: o rascunho técnico já com o nome que o aluno vai ver.
      await folha.getByRole('button', { name: '2 alterações para publicar: ver a lista' }).click();
      const lista = page.getByRole('dialog', { name: '2 alterações para publicar' });
      await expect(lista.getByText(`Dieta de ${ALUNO.nome}`, { exact: true })).toBeVisible();
      await expect(lista.getByText('Hoje na lista: Importada da planilha (rascunho)')).toBeVisible();
      await expect(lista.getByText('Treino do Plano 17', { exact: true })).toBeVisible();
      await lista.getByRole('button', { name: 'Fechar', exact: true }).click();
      // Abas com a contagem e o "+ Novo" na mesma linha, com o rótulo da aba.
      await expect(folha.getByRole('tab', { name: 'Treino (1)' })).toHaveAttribute('aria-selected', 'true');
      await expect(folha.getByRole('button', { name: 'Novo treino', exact: true })).toBeVisible();
      await folha.getByRole('tab', { name: 'Dieta (1)' }).click();
      await expect(folha.getByRole('button', { name: 'Nova dieta', exact: true })).toBeVisible();
      await expect(folha.getByRole('tabpanel', { name: 'Dieta (1)' }).getByText('Rascunho', { exact: true })).toBeVisible();
      await folha.getByRole('tab', { name: 'Treino (1)' }).click();
      await expect(folha.getByRole('tabpanel', { name: 'Treino (1)' }).getByText('Alterações não publicadas', { exact: true })).toBeVisible();
      await publicar.click();
      await expect(page.getByText(/^Treino e dieta publicad/)).toBeVisible();
      // Sem nada a publicar o rodapé some.
      await expect(folha.getByRole('button', { name: /^Publicar alterações/ })).toHaveCount(0);
      await expect(folha.getByRole('radio', { name: 'Agora' })).toHaveCount(0);
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/publicar'))).toHaveLength(1);
      expect(errosDaPagina).toEqual([]);
    });

    test('agendar: a data abre ao lado e vai no pedido com o aviso desligado', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await folha.getByRole('radio', { name: 'Agendar' }).click();
      await folha.getByRole('textbox', { name: 'Liberar em' }).fill('05/12/2026');
      await folha.getByRole('switch', { name: 'Avisar o aluno quando liberar' }).click();
      await folha.getByRole('button', { name: `Publicar alterações (1) ${DA_PASTA}` }).click();
      await expect(page.getByText(/^Dieta publicada/)).toBeVisible();
      const corpo = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/publicar'))?.corpo;
      expect(corpo).toMatchObject({ liberarEm: '2026-12-05', avisarAluno: false });
      expect(errosDaPagina).toEqual([]);
    });

    test('erro no plano (422): nada publicado, a lista por plano no corpo e o botão desabilitado com o motivo', async ({ page }) => {
      const planos: PlanoDaPastaFalsa[] = [{ tipo: 'treino', plano: { ...TREINO, rascunhoAlteradoDepoisDePublicar: true } }];
      const { errosDaPagina } = await abrir(page, {
        enviada: false, planos,
        extras: rotasDaPasta({ alunoId: ALUNO_ID, pastaId: PASTA_ID, planos, permissoes: PERMISSOES, erros: [{ field: 'treino.sessoes', message: 'Inclua ao menos uma sessão.' }] }),
      });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      const publicar = folha.getByRole('button', { name: `Publicar alterações (1) ${DA_PASTA}` });
      await publicar.click();
      await expect(folha.getByText('Nada foi publicado', { exact: true })).toBeVisible();
      await expect(folha.getByText('Inclua ao menos uma sessão.')).toBeVisible();
      await expect(publicar).toBeDisabled();
      await expect(folha.getByText('Corrija 1 problema no treino')).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('erro da API ao publicar (500): nada muda e a mensagem aparece na Folha', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, {
        enviada: false, planos: [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }],
        extras: { [`POST /pastas/${PASTA_ID}/publicar`]: erroApi(500, 'Falha no servidor.') },
      });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await folha.getByRole('button', { name: `Publicar alterações (1) ${DA_PASTA}` }).click();
      await expect(folha.getByText(/Falha no servidor|Não foi possível|Tente de novo/).first()).toBeVisible();
      await folha.getByRole('tab', { name: 'Dieta (1)' }).click();
      await expect(folha.getByRole('tabpanel', { name: 'Dieta (1)' }).getByText('Rascunho', { exact: true })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('atualização para revisar: "Revisar" é o primário e o Publicar vira secundário; o questionário fica na linha dela', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { planos: [{ tipo: 'treino', plano: TREINO }, { tipo: 'dieta', plano: RASCUNHO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      const revisar = folha.getByRole('button', { name: 'Revisar atualização' });
      const publicar = folha.getByRole('button', { name: `Publicar alterações (1) ${DA_PASTA}` });
      await expect(publicar).toBeEnabled();
      expect(await fundo(publicar)).toBe(await fundo(folha.getByRole('button', { name: 'Finalizar pasta' })));
      expect(await fundo(revisar)).not.toBe(await fundo(publicar));
      const questionario = folha.getByRole('button', { name: /^Questionário deste período: O mesmo do aluno/ });
      await expect(questionario).toBeVisible();
      if (largura === 1280) {
        // Na mesma linha do "Revisar atualização".
        const [a, b] = [await revisar.boundingBox(), await questionario.boundingBox()];
        expect(Math.abs((a?.y ?? 0) + (a?.height ?? 0) / 2 - ((b?.y ?? 0) + (b?.height ?? 0) / 2))).toBeLessThan(8);
      }
      expect(errosDaPagina).toEqual([]);
    });

    test('sem alterações: sem rodapé de publicação', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: SEM_ALTERACOES });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await expect(folha.getByRole('tab', { name: 'Treino (1)' })).toBeVisible();
      await expect(folha.getByText('Publicado', { exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: /^Publicar alterações/ })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /para publicar/ })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('vazio: aba sem plano diz que não há e oferece o "Novo"', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await folha.getByRole('tab', { name: 'Dieta (0)' }).click();
      const painel = folha.getByRole('tabpanel', { name: 'Dieta (0)' });
      await expect(painel.getByText('Nenhuma dieta nesta pasta')).toBeVisible();
      await expect(painel.getByRole('button', { name: 'Nova dieta' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('sem PASTA_ALTERAR: sem Finalizar no topo nem Editar e Copiar no ⋯', async ({ page }) => {
      const permissoes = PERMISSOES.filter((p) => p !== 'PASTA_ALTERAR');
      const { errosDaPagina } = await abrir(page, { enviada: false, permissoes, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      const folha = page.getByRole('dialog', { name: TITULO });
      await expect(folha.getByRole('tab', { name: 'Treino (1)' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Finalizar pasta' })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /Editar pasta|Copiar para outro período/ })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('⋯ da pasta: "Editar pasta" e "Copiar para outro período" vêm primeiro e abrem as folhas de sempre', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { enviada: false, planos: [{ tipo: 'treino', plano: TREINO }] });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      await page.getByRole('dialog', { name: TITULO }).getByRole('button', { name: `Mais ações ${DA_PASTA}` }).click();
      const menu = page.getByRole('dialog', { name: TITULO });
      const itens = menu.getByRole('button');
      await expect(itens.filter({ hasText: 'Editar pasta' })).toBeVisible();
      await expect(itens.filter({ hasText: 'Copiar para outro período' })).toBeVisible();
      await itens.filter({ hasText: 'Editar pasta' }).click();
      await expect(page.getByRole('dialog', { name: 'Editar pasta' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    for (const tema of ['CLARO', 'ESCURO'] as const) {
      test(`capturas: vigente com rascunho, vencida e sem alterações (${tema})`, async ({ page }) => {
        const sufixo = `${tema.toLowerCase()}-${largura}`;
        // Sem a entrada em cascata das linhas: a captura não pega a lista no meio da animação.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const { errosDaPagina } = await abrir(page, { tema, planos: COM_RASCUNHO });
        await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
        const folha = page.getByRole('dialog', { name: TITULO });
        await expect(folha.getByText('Treino do Plano 17')).toBeVisible();
        await expect(folha.getByRole('button', { name: `Publicar alterações (1) ${DA_PASTA}` })).toBeVisible();
        await page.screenshot({ path: captura(`pasta-vigente-rascunho-${sufixo}.png`) });
        await folha.getByRole('tab', { name: /^Dieta/ }).click();
        await page.screenshot({ path: captura(`pasta-vigente-dieta-${sufixo}.png`) });
        await folha.getByRole('radio', { name: 'Agendar' }).click();
        await page.screenshot({ path: captura(`pasta-vigente-agendar-${sufixo}.png`) });
        await folha.getByRole('button', { name: '1 alteração para publicar: ver a lista' }).click();
        await expect(page.getByRole('dialog', { name: '1 alteração para publicar' })).toBeVisible();
        await page.screenshot({ path: captura(`pasta-vigente-lista-${sufixo}.png`) });
        expect(errosDaPagina).toEqual([]);
      });

      test(`capturas: pasta vencida (${tema})`, async ({ page }) => {
        const sufixo = `${tema.toLowerCase()}-${largura}`;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const { errosDaPagina } = await abrir(page, { tema, pasta: VENCIDA, planos: COM_RASCUNHO, enviada: false });
        await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
        const folha = page.getByRole('dialog', { name: 'Pasta de 01/11 a 11/11' });
        await expect(folha.getByText('Vencida há 16 dias', { exact: true })).toBeVisible();
        await page.screenshot({ path: captura(`pasta-vencida-${sufixo}.png`) });
        expect(errosDaPagina).toEqual([]);
      });

      test(`capturas: pasta sem alterações, sem rodapé (${tema})`, async ({ page }) => {
        const sufixo = `${tema.toLowerCase()}-${largura}`;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const { errosDaPagina } = await abrir(page, { tema, planos: SEM_ALTERACOES });
        await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
        const folha = page.getByRole('dialog', { name: TITULO });
        await expect(folha.getByText('Treino do Plano 17')).toBeVisible();
        await page.screenshot({ path: captura(`pasta-sem-alteracoes-${sufixo}.png`) });
        expect(errosDaPagina).toEqual([]);
      });

      test(`capturas: seletor do questionário fechado e aberto, na linha do "Abrir atualização" (${tema})`, async ({ page }) => {
        const sufixo = `${tema.toLowerCase()}-${largura}`;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const { errosDaPagina } = await abrir(page, {
          tema, planos: SEM_ALTERACOES,
          extras: {
            'GET /questionarios/opcoes': { corpo: OPCOES_DE_QUESTIONARIO },
            [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: ABERTA },
            [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: [ABERTA] },
          },
        });
        await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
        const folha = page.getByRole('dialog', { name: TITULO });
        const abrirAtualizacao = folha.getByRole('button', { name: 'Abrir atualização', exact: true });
        const seletor = folha.getByRole('button', { name: /^Questionário deste período: O mesmo do aluno/ });
        await expect(abrirAtualizacao).toBeVisible();
        await expect(seletor).toBeVisible();
        if (largura === 1280) {
          const [a, b] = [await abrirAtualizacao.boundingBox(), await seletor.boundingBox()];
          expect(Math.abs((a?.y ?? 0) + (a?.height ?? 0) / 2 - ((b?.y ?? 0) + (b?.height ?? 0) / 2))).toBeLessThan(8);
        }
        await seletor.scrollIntoViewIfNeeded();
        await page.screenshot({ path: captura(`pasta-questionario-fechado-${sufixo}.png`) });
        await seletor.click();
        await expect(page.getByRole('option', { name: 'Check-in quinzenal', exact: true })).toBeVisible();
        await page.screenshot({ path: captura(`pasta-questionario-aberto-${sufixo}.png`) });
        expect(errosDaPagina).toEqual([]);
      });
    }
  });
}
