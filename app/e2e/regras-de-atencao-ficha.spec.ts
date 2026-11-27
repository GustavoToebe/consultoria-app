import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, RegrasDoAlunoResposta, SalvarRegraDoAluno } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { REGRA_CAIU, resposta } from './regras-de-atencao-falsas';

/**
 * Regras de atenção, etapa 2 (`docs/planos/regras-de-atencao.md`, C8): na ficha do aluno, a linha "Regras de atenção" em
 * Configuração do acompanhamento e a folha de ajustes (regra geral, outro número, desligada; salvar por regra; 409 e 422);
 * em Configurações › Regras de atenção, o cartão "Exceções por aluno" com a contagem. API simulada, só dados fictícios.
 * Capturas em `E2E_CAPTURAS` quando a variável existe.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ID = 'a0000000-0000-4000-8000-0000000000f1';
const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const REGRA_SONO = 'r0000000-0000-4000-8000-000000000002';
const REGRA_DORES = 'r0000000-0000-4000-8000-000000000003';
const DO_ALUNO: RegrasDoAlunoResposta = {
  regras: [
    { regraId: REGRA_CAIU.id, tipo: 'NOTA_CAIU', perguntaId: null, limite: 2, excecao: null },
    { regraId: REGRA_SONO, tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 4, excecao: { ativa: true, limite: 3, versao: 2 } },
    { regraId: REGRA_DORES, tipo: 'SIM', perguntaId: 'dores', limite: null, excecao: null },
  ],
};
const LER = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'];
const ALTERAR = [...LER, 'REGRA_ATENCAO_ALTERAR'];

async function capturar(page: Page, nome: string) {
  const pasta = process.env.E2E_CAPTURAS;
  if (!pasta) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

interface Opcoes {
  largura: number;
  tema?: 'CLARO' | 'ESCURO';
  permissoes?: string[];
  chave?: boolean;
  ficha?: Partial<AlunoDetalhe>;
  rotas?: RespostasApi;
}

async function abrirFicha(page: Page, o: Opcoes) {
  await page.setViewportSize({ width: o.largura, height: 1000 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema ?? 'CLARO'] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? ALTERAR, regrasAtencaoHabilitada: o.chave ?? true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ID}`]: { corpo: { ...FICHA, ...o.ficha } },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: { corpo: [] },
    'GET /regras-de-atencao': { corpo: resposta() },
    [`GET /alunos/${ID}/regras-de-atencao`]: { corpo: DO_ALUNO },
    ...o.rotas,
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Dados do aluno' })).toBeVisible();
  return api;
}

const linha = (page: Page) => page.getByText('Regras de atenção', { exact: true });
const ajustar = (page: Page) => page.getByRole('button', { name: `Ajustar: regras de atenção de ${ALUNO.nome}` });
const folha = (page: Page) => page.getByRole('dialog');
const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test.describe(`Exceção por aluno na ficha em ${largura} px`, () => {
    test('resumo, folha, outro número validado e salvo por regra, desligar e voltar à regra geral', async ({ page }) => {
      const api = await abrirFicha(page, {
        largura,
        rotas: {
          [`PUT /alunos/${ID}/regras-de-atencao/{id}`]: (p, r) => {
            const regraId = p.caminho.split('/').at(-1);
            const c = p.corpo as SalvarRegraDoAluno;
            return json(r, { regras: DO_ALUNO.regras.map((x) => (x.regraId === regraId ? { ...x, excecao: { ativa: c.ativa, limite: c.limite, versao: (c.versao ?? -1) + 1 } } : x)) });
          },
          [`DELETE /alunos/${ID}/regras-de-atencao/{id}`]: { status: 204 },
        },
      });
      await expect(linha(page)).toBeVisible();
      await expect(page.getByText('1 regra ajustada')).toBeVisible();
      await ajustar(page).click();
      const f = folha(page);
      await expect(f.getByText('Vale a partir do próximo envio. Atualizações já enviadas não mudam.')).toBeVisible();
      await expect(f.getByText('Sono 4 ou menos', { exact: true })).toBeVisible();
      await expect(f.getByText('Sono 3 ou menos para este aluno')).toBeVisible();
      await capturar(page, `ficha-excecoes-${largura}`);

      // Outro número: nasce vazio (nada sugerido), a faixa é a da escala da pergunta e o Salvar é da linha.
      const caiu = f.getByRole('radiogroup', { name: 'Para este aluno: Nota caiu 2 pontos ou mais' });
      await caiu.getByRole('radio', { name: 'Outro número' }).click();
      const numero = f.getByLabel('Caiu pelo menos (pontos)');
      await expect(numero).toHaveValue('');
      await numero.fill('12');
      await numero.blur();
      await expect(f.getByText('Use um número de 1 a 10.')).toBeVisible();
      await numero.fill('3');
      await f.getByRole('button', { name: 'Salvar: Nota caiu 2 pontos ou mais' }).click();
      await expect(page.getByText('Exceção salva.')).toBeVisible();
      await expect(f.getByText('Nota caiu 3 pontos ou mais para este aluno')).toBeVisible();

      // Sim só desliga (sem "Outro número").
      const dores = f.getByRole('radiogroup', { name: 'Para este aluno: Resposta Sim em Sentiu dores' });
      await expect(dores.getByRole('radio', { name: 'Outro número' })).toHaveCount(0);
      await dores.getByRole('radio', { name: 'Desligada' }).click();
      await f.getByRole('button', { name: 'Salvar: Resposta Sim em Sentiu dores' }).click();
      await expect(f.getByText('Desligada para este aluno')).toBeVisible();

      // Voltar à regra geral apaga a exceção (DELETE) e recarrega.
      const sono = f.getByRole('radiogroup', { name: 'Para este aluno: Sono 4 ou menos' });
      await sono.getByRole('radio', { name: 'Regra geral' }).click();
      await f.getByRole('button', { name: 'Salvar: Sono 4 ou menos' }).click();
      await expect(page.getByText('Voltou à regra geral.')).toBeVisible();

      const puts = api.pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.startsWith(`/alunos/${ID}/regras-de-atencao/`));
      expect(puts.map((p) => [p.caminho.split('/').at(-1), p.corpo])).toEqual([
        [REGRA_CAIU.id, { ativa: true, limite: 3, versao: null }],
        [REGRA_DORES, { ativa: false, limite: null, versao: null }],
      ]);
      expect(api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual([`/alunos/${ID}/regras-de-atencao/${REGRA_SONO}`]);
      await semRolagemHorizontal(page);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('409 recarrega e avisa; 422 vai para o campo', async ({ page }) => {
      let leituras = 0;
      let conflito = true;
      await abrirFicha(page, {
        largura,
        rotas: {
          [`GET /alunos/${ID}/regras-de-atencao`]: (_p, r) => { leituras += 1; return json(r, DO_ALUNO); },
          [`PUT /alunos/${ID}/regras-de-atencao/{id}`]: (_p, r) => {
            const e = conflito ? erroApi(409, 'Conflito.', 'CONFLITO_EDICAO')
              : erroApi(422, 'Confira a exceção.', 'REGRA_INVALIDA', [{ field: 'limite', message: 'Mensagem fixa da API para o número.' }]);
            conflito = false;
            return json(r, e.corpo, e.status);
          },
        },
      });
      await ajustar(page).click();
      const f = folha(page);
      const sono = f.getByRole('radiogroup', { name: 'Para este aluno: Sono 4 ou menos' });
      await sono.getByRole('radio', { name: 'Desligada' }).click();
      await f.getByRole('button', { name: 'Salvar: Sono 4 ou menos' }).click();
      await expect(page.getByText('Esta exceção foi alterada por outra pessoa. Carregamos a versão atual; confira e salve de novo.')).toBeVisible();
      await expect.poll(() => leituras).toBe(2);

      await sono.getByRole('radio', { name: 'Outro número' }).click();
      await f.getByLabel('Nota igual ou menor que').fill('2');
      await f.getByRole('button', { name: 'Salvar: Sono 4 ou menos' }).click();
      await expect(f.getByText('Mensagem fixa da API para o número.')).toBeVisible();
      await capturar(page, `ficha-excecoes-422-${largura}`);
    });

    test('só leitura sem REGRA_ATENCAO_ALTERAR; anonimizado desabilita com o motivo', async ({ page }) => {
      await abrirFicha(page, { largura, permissoes: LER });
      await page.getByRole('button', { name: `Ver regras: regras de atenção de ${ALUNO.nome}` }).click();
      const f = folha(page);
      await expect(f.getByText('Para ajustar, peça a quem pode alterar as regras de atenção e o aluno.')).toBeVisible();
      await expect(f.getByRole('radiogroup')).toHaveCount(0);
      await expect(f.getByText('Sono 3 ou menos para este aluno')).toBeVisible();
    });

    test('anonimizado: Ajustar desabilitado', async ({ page }) => {
      await abrirFicha(page, { largura, ficha: { anonimizado: true, ativo: false } });
      await expect(ajustar(page)).toBeDisabled();
    });

    test('sem regra ligada, erro com "Tentar de novo" e chave desligada', async ({ page }) => {
      let leituras = 0;
      await abrirFicha(page, {
        largura,
        rotas: {
          [`GET /alunos/${ID}/regras-de-atencao`]: (_p, r) => (++leituras === 1 ? json(r, { status: 500, message: 'Falha fictícia.' }, 500) : json(r, { regras: [] })),
        },
      });
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByText('Nenhuma regra ligada na consultoria')).toBeVisible();
      await expect(ajustar(page)).toHaveCount(0);
    });

    test('chave desligada ou sem ALUNO_SENSIVEL_LER: a linha some e não consulta', async ({ page }) => {
      const api = await abrirFicha(page, { largura, chave: false });
      await expect(page.getByText('Treinador responsável')).toBeVisible();
      await expect(linha(page)).toHaveCount(0);
      expect(api.pedidos.filter((p) => p.caminho.includes('regras-de-atencao'))).toEqual([]);
    });
  });
}

test('sem ALUNO_SENSIVEL_LER a linha some', async ({ page }) => {
  const api = await abrirFicha(page, { largura: 1280, permissoes: ALTERAR.filter((p) => !p.startsWith('ALUNO_SENSIVEL_')) });
  await expect(page.getByText('Treinador responsável')).toBeVisible();
  await expect(linha(page)).toHaveCount(0);
  expect(api.pedidos.filter((p) => p.caminho.includes('regras-de-atencao'))).toEqual([]);
});

// ---------------------------------------------------------------- Configurações › Regras de atenção: Exceções por aluno

async function abrirRegras(page: Page, largura: number, tema: 'CLARO' | 'ESCURO', comExcecao: boolean) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: ALTERAR, regrasAtencaoHabilitada: true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /regras-de-atencao': {
      corpo: resposta({
        regras: [
          { ...REGRA_CAIU, alunosComExcecao: comExcecao ? 3 : 0 },
          { id: REGRA_SONO, tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 4, ativa: true, alunosComExcecao: comExcecao ? 1 : 0 },
        ],
      }),
    },
  });
  await page.goto('/treinador/regras-de-atencao');
  await expect(page.getByRole('heading', { name: 'Exceções por aluno' })).toBeVisible();
}

for (const largura of [390, 1280]) for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`Exceções por aluno na tela de regras e na ficha, ${largura} px ${tema.toLowerCase()}`, async ({ page }) => {
    await abrirRegras(page, largura, tema, true);
    await expect(page.getByText('Nota caiu 2 pontos ou mais', { exact: true })).toBeVisible();
    await expect(page.getByText('3 alunos com exceção')).toBeVisible();
    await expect(page.getByText('1 aluno com exceção')).toBeVisible();
    await expect(page.getByText('Ajuste na ficha do aluno, em Configuração do acompanhamento.')).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByRole('heading', { name: 'Exceções por aluno' }).scrollIntoViewIfNeeded();
    await capturar(page, `regras-excecoes-${largura}-${tema.toLowerCase()}`);

    await abrirFicha(page, { largura, tema });
    await page.getByText('1 regra ajustada').scrollIntoViewIfNeeded();
    await capturar(page, `ficha-linha-${largura}-${tema.toLowerCase()}`);
    await ajustar(page).click();
    await folha(page).getByRole('radiogroup', { name: 'Para este aluno: Nota caiu 2 pontos ou mais' }).getByRole('radio', { name: 'Outro número' }).click();
    await capturar(page, `ficha-folha-${largura}-${tema.toLowerCase()}`);
  });
}

test('Exceções por aluno: nenhuma', async ({ page }) => {
  await abrirRegras(page, 1280, 'CLARO', false);
  await expect(page.getByText('Nenhum aluno com exceção.')).toBeVisible();
});
