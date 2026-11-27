import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { AlunoDetalhe, Atualizacao, ConteudoDieta, ConteudoQuestionario, ConteudoTreino, PlanoResumo, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Revisão da atualização pelo treinador (bloco D de `docs/planos/atualizacao-pasta-e-questionarios.md`, 2.2 de
 * `orientacoes-de-design-26-11.md`): com espaço, a principal (abas Respostas | Evolução, "O que mudou" no topo do Resumo) e o
 * apoio fixo ao rolar (Feedback em cima, "O que está prescrito" embaixo, com rolagem própria); no celular, tudo empilhado
 * (Resumo, Feedback, Prescrito, Respostas). Abas do prescrito somem sem a permissão. `E2E_CAPTURAS` (ou `CAPTURAS_REVISAO`) grava as capturas
 * numa pasta de fora do repositório. Só dados fictícios.
 */

const ID = 'e0000000-0000-4000-8000-0000000000d1';
const ANTERIOR_ID = 'e0000000-0000-4000-8000-0000000000d0';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-0000000000d1';

const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: [],
  secoes: [
    { uid: 's1', titulo: 'Rotina', perguntas: [
      { id: 'peso', tipo: 'PESO', rotulo: 'Peso em jejum', obrigatoria: true },
      { id: 'sono', tipo: 'NOTA', rotulo: 'Como foi o seu sono nas últimas semanas?', rotuloCurto: 'Sono', obrigatoria: true },
      { id: 'dores', tipo: 'SIM_NAO', rotulo: 'Sentiu dores nos treinos?', obrigatoria: true },
      { id: 'obs', tipo: 'TEXTO_LONGO', rotulo: 'Quer contar mais alguma coisa ao treinador?', obrigatoria: false },
    ] },
    { uid: 's2', titulo: 'Fotos', perguntas: [{ id: 'fotos', tipo: 'FOTOS', rotulo: 'Fotos do período', obrigatoria: false, max: 4 }] },
  ],
};

const base = {
  pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, diasParaData: -2, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-0000000000d1', questionarioNome: 'Padrão', modelo: MODELO, versao: 1,
} satisfies Partial<Atualizacao>;

const ATUALIZACAO: Atualizacao = {
  ...base, id: ID, dataAtualizacao: '2026-11-20', fase: 'ENVIADA', enviadaEm: '2026-11-20T12:00:00Z', feedback: null,
  respostas: { peso: 80, sono: 4, dores: true, obs: 'Semana corrida no trabalho, treinei menos.' },
  resumo: { diasComTreino: 3, mediaDiasPorSemana: 0.8, pesoAnterior: 82 },
};
const ANTERIOR: Atualizacao = {
  ...base, id: ANTERIOR_ID, pastaId: 'f0000000-0000-4000-8000-0000000000d0', dataAtualizacao: '2026-10-23', fase: 'REVISADA', enviadaEm: '2026-10-23T12:00:00Z',
  feedback: { texto: 'Bom trabalho.', em: '2026-10-24T10:00:00Z', editadoEm: null, naoLido: false },
  respostas: { peso: 82, sono: 7, dores: false }, resumo: { diasComTreino: 9, mediaDiasPorSemana: 2.3, pesoAnterior: 83 },
};

const plano = (id: string, extra: Partial<PlanoResumo> = {}): PlanoResumo => ({
  id, alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: id === 't1' ? 'Treino de novembro' : 'Dieta de novembro', inicio: '2026-10-24', fim: '2026-11-20',
  ativo: true, versaoPublicada: 2, versaoLiberada: 2, publicadoEm: '2026-10-24T10:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 3, ...extra,
});

const serie = (uid: string, tipo: string | null, min: number, max: number) => ({ uid, tipo, repsMin: min, repsMax: max, carga: null, esforco: null, descansoSegundos: 90 });
const exercicio = (uid: string, nome: string, series: ReturnType<typeof serie>[]) => ({
  uid, exercicioId: null, nome, modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg' as const, series,
});
const TREINO: ConteudoTreino = {
  objetivo: null, orientacoes: null,
  sessoes: [
    { uid: 'sa', nome: 'Treino A', diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [], exercicios: [
      exercicio('e1', 'Supino reto', [serie('1', null, 6, 8), serie('2', null, 6, 8), serie('3', null, 6, 8)]),
      exercicio('e2', 'Remada curvada', [serie('4', null, 8, 10), serie('5', null, 8, 10)]),
    ] },
    { uid: 'sb', nome: 'Treino B', diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [], exercicios: [
      exercicio('e3', 'Agachamento livre', [serie('6', null, 5, 5), serie('7', null, 5, 5), serie('8', null, 5, 5)]),
    ] },
  ],
};
const item = (uid: string, nome: string, quantidade: number, kcal: number) => ({ uid, alimentoId: null, nome, quantidade, unidade: 'g' as const, kcal, proteina: 10, carboidrato: 20, gordura: 5, manual: true });
const DIETA: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: 3, variacoes: [],
  refeicoes: [
    { uid: 'r1', nome: 'Café da manhã', horario: '07:00', observacao: null, opcoes: [{ uid: 'o1', rotulo: 'A', itens: [item('i1', 'Pão integral', 50, 120), item('i2', 'Ovo cozido', 100, 150)] }] },
    { uid: 'r2', nome: 'Almoço', horario: '12:30', observacao: null, opcoes: [
      { uid: 'o2', rotulo: 'A', itens: [item('i3', 'Arroz branco', 120, 160), item('i4', 'Frango grelhado', 150, 240)] },
      { uid: 'o3', rotulo: 'B', itens: [item('i5', 'Batata-doce', 200, 170)] }] },
  ],
  suplementacao: [{ uid: 's1', nome: 'Creatina fictícia', dose: '5 g', horario: 'Depois do treino', observacao: '', link: null }],
  ergogenicos: [{ uid: 'g1', nome: 'Item fictício', principioAtivo: '', concentracao: '10 mg', dose: '1 comprimido', horario: 'Manhã', observacao: '', prescricao: '' }],
};
const versao = <C,>(planoId: string, conteudo: C, titulo: string): VersaoDetalhe<C> => ({
  id: `v-${planoId}`, planoId, numero: 2, titulo, inicio: '2026-10-24', fim: '2026-11-20', publicadoEm: '2026-10-24T10:00:00Z', conteudo,
});

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'TREINO_LER', 'DIETA_LER', 'ERGOGENICO_LER'];

function rotas(o: { atual?: Atualizacao; historico?: Atualizacao[]; extra?: RespostasApi } = {}): RespostasApi {
  const atual = o.atual ?? ATUALIZACAO;
  return {
    // O menu do treinador pergunta isto (contagens dos pontos); nada a mostrar aqui.
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /atualizacoes/${atual.id}`]: { corpo: atual },
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: o.historico ?? [atual, ANTERIOR] },
    [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [plano('t1'), plano('t0', { pastaId: 'outra', ativo: false })] },
    [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [plano('d1')] },
    'GET /planos-treino/t1/versoes/2': { corpo: versao('t1', TREINO, 'Treino de novembro') },
    'GET /planos-dieta/d1/versoes/2': { corpo: versao('d1', DIETA, 'Dieta de novembro') },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/atualizacoes/evolucao`]: { corpo: { limite: 6, atualizacoes: 2, series: [] } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: { corpo: [] },
    ...o.extra,
  };
}

async function abrir(page: Page, largura: number, altura: number, o: { escuro?: boolean; permissoes?: string[]; atual?: Atualizacao; historico?: Atualizacao[]; extra?: RespostasApi; caminho?: string } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  if (o.escuro) await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  const api = await simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? TODAS })), ...rotas(o) });
  await page.goto(o.caminho ?? `/treinador/atualizacoes/${(o.atual ?? ATUALIZACAO).id}`);
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(`${ALUNO.nome} · Atualização`) })).toBeVisible();
  return api;
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS_REVISAO;
  if (!pasta) return;
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: join(pasta, `${nome}.png`) });
}

const apoio = (page: Page) => page.getByTestId('apoio-da-revisao');
const prescrito = (page: Page) => page.getByTestId('cartao').filter({ has: page.getByText(/^Prescrição atual/) });

/** Largura do apoio pela faixa da área (360, 400, 440); `null` = empilhado (390). */
const APOIO: Record<number, number | null> = { 390: null, 1280: 360, 1920: 400, 3440: 440 };

for (const largura of [390, 1280, 1920, 3440]) {
  for (const escuro of [false, true]) {
    const tema = escuro ? 'escuro' : 'claro';
    test(`revisão: resumo com o que mudou, feedback, prescrito e respostas (${largura}px, ${tema})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, largura === 1280 ? 720 : 900, { escuro });
      // "O que mudou": só fatos, anterior → atual, desde a atualização anterior.
      const mudou = page.getByRole('list').filter({ has: page.getByText('Sono', { exact: true }) });
      await expect(page.getByText('desde a atualização de 23/10', { exact: true })).toBeVisible();
      for (const [rotulo, antes, agora] of [['Peso em jejum', '82,0 kg', '80,0 kg'], ['Sono', '7', '4'], ['Sentiu dores nos treinos?', 'Não', 'Sim'], ['Dias com treino registrado', '9', '3']]) {
        const linha = mudou.getByRole('listitem').filter({ has: page.getByText(rotulo, { exact: true }) });
        await expect(linha).toContainText(antes);
        await expect(linha).toContainText(agora);
      }
      // Sem fotos: "Não respondeu", nunca "—" solto; a variação com a unidade no rótulo.
      await expect(page.getByText('Variação (kg)', { exact: true })).toBeVisible();
      // Prescrito: abas, a primeira (Treino) aberta com uma linha por exercício e o link do editor.
      const p = prescrito(page);
      await expect(p.getByRole('tab', { name: 'Treino' })).toHaveAttribute('aria-selected', 'true');
      await expect(p.getByText(/^Supino reto/)).toBeVisible();
      await expect(p.getByText(/3x6 a 8/)).toBeVisible();
      await expect(p.getByRole('link', { name: 'Abrir no editor' })).toHaveAttribute('href', '/treinador/treinos/t1');
      // Respostas: a leitura do bloco B.
      await expect(page.getByText('Quer contar mais alguma coisa ao treinador?', { exact: true })).toBeAttached();
      const esperado = APOIO[largura];
      if (esperado === null) {
        // Celular: Resumo → Feedback → Prescrito → Respostas, sem vazar na horizontal.
        const ys = await Promise.all([
          page.getByText('Resumo do período', { exact: true }),
          page.getByLabel('Seu feedback para o aluno', { exact: true }),
          p,
          page.getByText('Quer contar mais alguma coisa ao treinador?', { exact: true }),
        ].map(async (l) => (await l.boundingBox())?.y ?? -1));
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      } else {
        // Lado a lado: o apoio à direita da principal, com a largura da faixa.
        const caixa = await apoio(page).boundingBox();
        const resumo = await page.getByText('Resumo do período', { exact: true }).boundingBox();
        expect(Math.round(caixa?.width ?? 0)).toBe(esperado);
        expect(caixa!.x).toBeGreaterThan(resumo!.x + 400);
        await expect(apoio(page)).toHaveAttribute('role', 'complementary');
      }
      await page.waitForTimeout(300);
      await capturar(page, `revisao-${largura}-${tema}`);
      if (esperado !== null && largura === 1280) {
        // Fixo ao rolar (1280 × 720): depois de descer a página, o apoio continua à vista e o campo do feedback também.
        await page.getByText('Quer contar mais alguma coisa ao treinador?', { exact: true }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const caixa = await apoio(page).boundingBox();
        expect(caixa!.y).toBeGreaterThanOrEqual(0);
        expect(caixa!.y).toBeLessThan(120);
        expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(720 + 1);
        await expect(page.getByLabel('Seu feedback para o aluno', { exact: true })).toBeInViewport();
        await capturar(page, `revisao-${largura}-${tema}-rolada`);
      }
      // Dieta, Suplementos e Outros leem a mesma dieta (uma busca só).
      await p.getByRole('tab', { name: 'Dieta' }).click();
      await expect(p.getByText(/^Frango grelhado/)).toBeVisible();
      await expect(p.getByText('Mais 1 opção para o aluno escolher.', { exact: true })).toBeVisible();
      await expect(p.getByText(/^Água: 3 L por dia/)).toBeVisible();
      if (largura === 1920) await capturar(page, `revisao-${largura}-${tema}-dieta`);
      await p.getByRole('tab', { name: 'Suplementos' }).click();
      await expect(p.getByText(/^Creatina fictícia/)).toBeVisible();
      await p.getByRole('tab', { name: 'Outros' }).click();
      await expect(p.getByText(/^Item fictício/)).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`revisão: sem permissão a aba do prescrito some; uma só vira título (${largura}px)`, async ({ page }) => {
    const semTreino = TODAS.filter((c) => c !== 'TREINO_LER' && c !== 'ERGOGENICO_LER');
    const { errosDaPagina } = await abrir(page, largura, 900, { permissoes: semTreino });
    const p = prescrito(page);
    await expect(p.getByRole('tab', { name: 'Dieta' })).toBeVisible();
    await expect(p.getByRole('tab')).toHaveCount(2);
    await expect(p.getByRole('tab', { name: 'Treino' })).toHaveCount(0);
    await expect(p.getByRole('tab', { name: 'Outros' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`revisão: só treino vira título, sem barra de abas (${largura}px)`, async ({ page }) => {
    const soTreino = TODAS.filter((c) => c !== 'DIETA_LER' && c !== 'ERGOGENICO_LER');
    await abrir(page, largura, 900, { permissoes: soTreino });
    const p = prescrito(page);
    await expect(p.getByText('Prescrição atual: Treino', { exact: true })).toBeVisible();
    await expect(p.getByRole('tablist')).toHaveCount(0);
    await expect(p.getByText(/^Agachamento livre/)).toBeVisible();
  });

  test(`revisão: erro do prescrito fica no cartão e a tela segue (${largura}px)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, 900, { extra: { [`GET /alunos/${ALUNO_ID}/planos-treino`]: erroApi(500, 'Erro interno.') } });
    const p = prescrito(page);
    await expect(p.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await expect(page.getByText('Resumo do período', { exact: true })).toBeVisible();
    await expect(page.getByText('Quer contar mais alguma coisa ao treinador?', { exact: true })).toBeAttached();
    await capturar(page, `revisao-${largura}-erro-do-prescrito`);
    expect(errosDaPagina).toEqual([]);
  });

  test(`revisão: primeira atualização e pasta sem plano publicado (${largura}px)`, async ({ page }) => {
    const { naoTratadas } = await abrir(page, largura, 900, {
      historico: [ATUALIZACAO],
      extra: { [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [plano('t1', { versaoPublicada: 0, versaoLiberada: 0, publicadoEm: null })] } },
    });
    await expect(page.getByText('Primeira atualização deste aluno.', { exact: true })).toBeVisible();
    await expect(prescrito(page).getByText('A pasta desta atualização não tem treino publicado.', { exact: true })).toBeVisible();
    await capturar(page, `revisao-${largura}-primeira-sem-prescrito`);
    expect(naoTratadas).toEqual([]);
  });

  test(`revisão: aguardando envio e já revisada (${largura}px)`, async ({ page }) => {
    const aberta: Atualizacao = { ...ATUALIZACAO, fase: 'ABERTA', enviadaEm: null, respostas: null, diasParaData: 3 };
    await abrir(page, largura, 900, { atual: aberta });
    await expect(page.getByText('Aguardando envio', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Seu feedback para o aluno', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^O que mudou/)).toHaveCount(0);
    await capturar(page, `revisao-${largura}-aguardando`);

    const revisada: Atualizacao = { ...ATUALIZACAO, fase: 'REVISADA', feedback: { texto: 'Ótima semana, siga assim.', em: '2026-11-21T10:00:00Z', editadoEm: null, naoLido: true } };
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: TODAS })), ...rotas({ atual: revisada }) });
    await page.reload();
    await expect(page.getByText('Ótima semana, siga assim.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar feedback' })).toBeVisible();
    await expect(page.getByText('Revisada', { exact: true }).first()).toBeVisible();
    await capturar(page, `revisao-${largura}-revisada`);
  });
}

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);

for (const largura of [390, 1280]) {
  for (const escuro of [false, true]) {
    const tema = escuro ? 'escuro' : 'claro';
    test(`revisão: leitura dos itens do plano com Sim/Não, motivo e fotos do aparelho (${largura}px, ${tema})`, async ({ page }) => {
      // A pergunta 12 do Saraiva: Sim/Não; se Sim, os exercícios (motivo com o rótulo da pergunta) e até 2 fotos do aparelho.
      const se = { perguntaId: 'substituiu', valores: ['sim'] };
      const modelo: ConteudoQuestionario = { ...MODELO, secoes: [...MODELO.secoes, { uid: 's3', titulo: 'Treino', perguntas: [
        { id: 'substituiu', tipo: 'SIM_NAO', rotulo: 'Teve algum exercício que substituiu por não ter o maquinário?', obrigatoria: false },
        { id: 'quais', tipo: 'ITENS_DO_PLANO', rotulo: 'Quais?', obrigatoria: false, fonte: 'EXERCICIOS_DO_TREINO', motivo: 'OBRIGATORIO', rotuloMotivo: 'O que usou no lugar?', mostrarSe: se },
        { id: 'aparelho', tipo: 'FOTOS', rotulo: 'Foto do aparelho que você usou', obrigatoria: false, max: 2, mostrarSe: se },
        { id: 'semMotivo', tipo: 'ITENS_DO_PLANO', rotulo: 'Quer trocar algum alimento?', obrigatoria: false, fonte: 'ALIMENTOS_DA_DIETA' },
      ] }] };
      const fotos = ['b0000000-0000-4000-8000-0000000000f1', 'b0000000-0000-4000-8000-0000000000f2'];
      const respostas = {
        ...ATUALIZACAO.respostas, substituiu: true, aparelho: fotos,
        quais: [{ id: 'e1', nome: 'Supino reto', motivo: 'Supino com halteres.' }, { id: 'e3', nome: 'Agachamento livre', motivo: 'Leg press.' }],
        semMotivo: [{ id: 'i5', nome: 'Batata-doce' }],
      } as unknown as Atualizacao['respostas'];
      const atual: Atualizacao = { ...ATUALIZACAO, modelo, respostas };
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, 900, { escuro, atual, historico: [atual, ANTERIOR], extra: {
        'GET /atualizacoes/{id}/fotos/{fotoId}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG }),
      } });
      // O cartão da seção (o Resumo também mostra as fotos): o da pergunta Sim/Não, que só a leitura tem.
      const secao = page.getByTestId('cartao').filter({ has: page.getByText('Teve algum exercício que substituiu por não ter o maquinário?', { exact: true }) });
      await expect(secao.getByText('Sim', { exact: true })).toBeVisible();
      // Um item por linha, com o motivo atrás do rótulo do motivo da pergunta; só leitura.
      await expect(secao.getByText('Supino reto — O que usou no lugar? Supino com halteres.', { exact: false })).toBeVisible();
      await expect(secao.getByText(/Agachamento livre — O que usou no lugar\? Leg press\./)).toBeVisible();
      // Sem motivo na pergunta, só o nome (a busca fica na linha da leitura: o item pode aparecer em outro bloco).
      await expect(page.getByLabel('Quer trocar algum alimento?:').getByText('Batata-doce', { exact: true })).toBeVisible();
      await expect(secao.getByRole('textbox')).toHaveCount(0);
      await expect(secao.getByText('Foto do aparelho que você usou', { exact: true })).toBeVisible();
      await expect(secao.getByRole('img')).toHaveCount(2);
      await secao.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await capturar(page, `revisao-${largura}-${tema}-itens-do-plano`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('revisão: aba Evolução com os cartões da ficha, no endereço (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, 900);
  await page.getByRole('tab', { name: 'Evolução', exact: true }).click();
  await expect(page).toHaveURL(/[?&]aba=evolucao/);
  await expect(page.getByText('Avaliação física', { exact: true }).first()).toBeVisible();
  // O apoio continua: o treinador escreve o feedback olhando a evolução.
  await expect(page.getByLabel('Seu feedback para o aluno', { exact: true })).toBeVisible();
  await capturar(page, 'revisao-1280-evolucao');
  await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
  await expect(page).not.toHaveURL(/aba=evolucao/);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('revisão: o feedback digitado sobrevive ao cruzar a largura do apoio', async ({ page }) => {
  await abrir(page, 1280, 900);
  await page.getByLabel('Seu feedback para o aluno', { exact: true }).fill('Texto fictício de feedback.');
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(apoio(page)).toHaveCount(0);
  await expect(page.getByLabel('Seu feedback para o aluno', { exact: true })).toHaveValue('Texto fictício de feedback.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(apoio(page)).toBeVisible();
  await expect(page.getByLabel('Seu feedback para o aluno', { exact: true })).toHaveValue('Texto fictício de feedback.');
});
