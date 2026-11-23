import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import type { ResponsavelFinanceiro } from '../src/api/financeiroResponsavel';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import {
  ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel, type EstadoDoResponsavel,
} from './financeiro-falso';

/**
 * Responsável financeiro (D15) no cartão "Plano contratado" da ficha: sem responsável, adicionar (com erro local e foco),
 * editar com 409 (outra pessoa mudou), 422 por campo, remover com confirmação, só leitura, CPF escondido sem
 * `ALUNO_SENSIVEL_LER` e a linha "Os lembretes vão ao responsável." na folha da cobrança. 390 e 1280 px, claro e escuro nas
 * capturas. Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-responsavel';
// Os textos de `dominio/responsavelFinanceiro` (o domínio puxa o Expo, que o Playwright não carrega): mudou lá, mude aqui.
// ficha do aluno: dados (23/11): a linha própria do responsável, com Editar e Remover no ⋯.
const SEM_RESPONSAVEL = 'Os lembretes de pagamento vão ao próprio aluno.';
const LINHA_DOS_LEMBRETES = 'Os lembretes vão ao responsável.';
const MENSAGEM_CONFLITO = 'O responsável financeiro foi alterado em outro lugar. Recarregamos para você conferir.';

const FICHA: AlunoDetalhe = {
  id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const GRAVADO: ResponsavelFinanceiro = {
  nome: 'Responsável Teste', parentesco: 'Mãe', cpf: '529.982.247-25', telefone: '(45) 99999-8888', email: 'responsavel@exemplo.invalid',
  versao: 3, atualizadoEm: '2026-10-18T12:00:00Z',
};

const COBRANCA = { ...COBRANCA_ATRASADA, alunoId: ALUNO_FINANCEIRO_ID, alunoNome: ALUNO.nome };

const MAIS_ACOES = 'Mais ações do responsável financeiro';
/** Editar e Remover moram no ⋯ da linha do responsável. */
async function noMenu(page: Page, acao: 'Editar responsável' | 'Remover responsável') {
  await page.getByRole('button', { name: MAIS_ACOES }).click();
  await page.getByRole('dialog', { name: 'Responsável financeiro' }).getByRole('button', { name: acao }).click();
}

async function abrir(page: Page, responsavel: EstadoDoResponsavel, o: { largura?: number; tema?: 'CLARO' | 'ESCURO'; permissoes?: string[]; paraResponsavel?: boolean } = {}) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 900 });
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema] as const);
  await fixarHoje(page);
  const financeiro = estadoFinanceiro({
    cobrancas: o.paraResponsavel === undefined ? [] : [{ ...COBRANCA }],
    lembretesDasCobrancas: o.paraResponsavel === undefined ? {} : {
      [COBRANCA.id]: { itens: [], whatsapp: { telefone: '(45) 99999-8888', mensagem: 'Olá.' }, motivoSemWhatsapp: null, alunoDesligou: false, paraResponsavel: o.paraResponsavel },
    },
  });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: o.permissoes ?? [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'] })),
    ...rotasDoFinanceiro(financeiro), ...rotasDoResponsavel(responsavel),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Responsável financeiro' })).toBeVisible();
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

const capturarSecao = async (page: Page, nome: string) => {
  await page.getByRole('heading', { name: 'Responsável financeiro' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
};

for (const largura of [1280, 390]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`${largura}px ${tema.toLowerCase()}: sem responsável, adicionar com erro no campo e salvar`, async ({ page }) => {
      const estado = estadoDoResponsavel();
      const { errosDaPagina } = await abrir(page, estado, { largura, tema });
      await expect(page.getByText(SEM_RESPONSAVEL)).toBeVisible();
      await semRolagemHorizontal(page);
      await capturarSecao(page, `vazio-${largura}-${tema}`);

      await page.getByRole('button', { name: 'Adicionar responsável' }).click();
      const folha = page.getByRole('dialog', { name: 'Adicionar responsável financeiro' });
      await expect(folha.getByText(/É dado de outra pessoa/)).toBeVisible();
      // Salvar sem o nome: erro no campo, o foco vai a ele e nada é enviado.
      await folha.getByRole('button', { name: 'Salvar responsável' }).click();
      await expect(folha.getByText('Informe o nome do responsável.')).toBeVisible();
      await expect(folha.getByLabel('Nome', { exact: true })).toBeFocused();
      expect(estado.puts).toEqual([]);
      await page.screenshot({ path: `${CAPTURAS}/folha-erro-${largura}-${tema}.png` });

      await folha.getByLabel('Nome', { exact: true }).fill('  Responsável Teste ');
      await folha.getByLabel('Parentesco (opcional)').fill('Mãe');
      await folha.getByLabel('Telefone (opcional)').pressSequentially('45999998888');
      await expect(folha.getByLabel('Telefone (opcional)')).toHaveValue('(45) 99999-8888');
      await folha.getByLabel('E-mail (opcional)').fill('responsavel@exemplo.invalid');
      await folha.getByLabel('CPF (opcional)').pressSequentially('52998224725');
      await expect(folha.getByLabel('CPF (opcional)')).toHaveValue('529.982.247-25');
      await page.screenshot({ path: `${CAPTURAS}/folha-${largura}-${tema}.png` });
      await folha.getByRole('button', { name: 'Salvar responsável' }).click();

      await expect(page.getByText('Responsável financeiro salvo.')).toBeVisible();
      await expect(folha).toHaveCount(0);
      expect(estado.puts).toEqual([{ nome: 'Responsável Teste', parentesco: 'Mãe', cpf: '529.982.247-25', telefone: '(45) 99999-8888', email: 'responsavel@exemplo.invalid', versao: null }]);
      await expect(page.getByText('responsavel@exemplo.invalid')).toBeVisible();
      await expect(page.getByRole('button', { name: MAIS_ACOES })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Adicionar responsável' })).toHaveCount(0);
      await semRolagemHorizontal(page);
      await capturarSecao(page, `com-responsavel-${largura}-${tema}`);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`${largura}px: editar com 409 recarrega com aviso e mostra o que a outra pessoa gravou`, async ({ page }) => {
    const estado = estadoDoResponsavel({ responsavel: { ...GRAVADO } });
    const { errosDaPagina } = await abrir(page, estado, { largura });
    await noMenu(page, 'Editar responsável');
    const folha = page.getByRole('dialog', { name: 'Editar responsável financeiro' });
    // Nasce com tudo o que o GET trouxe, inclusive o CPF (o PUT substitui tudo).
    await expect(folha.getByLabel('CPF (opcional)')).toHaveValue('529.982.247-25');
    await expect(folha.getByRole('button', { name: 'Salvar responsável' })).toBeDisabled();
    await folha.getByLabel('Parentesco (opcional)').fill('Tia');
    // Outra pessoa grava enquanto a folha está aberta.
    estado.responsavel = { ...GRAVADO, parentesco: 'Pai', versao: 4 };
    await folha.getByRole('button', { name: 'Salvar responsável' }).click();
    await expect(page.getByText(MENSAGEM_CONFLITO)).toBeVisible();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Responsável Teste · Pai', { exact: true })).toBeVisible();
    expect(estado.puts.at(-1)).toMatchObject({ parentesco: 'Tia', versao: 3 });
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: 422 do servidor cai em cada campo e o foco vai ao primeiro`, async ({ page }) => {
    const estado = estadoDoResponsavel({
      responsavel: { ...GRAVADO },
      recusa: { status: 422, codigo: 'RESPONSAVEL_INVALIDO', fieldErrors: [{ field: 'telefone', message: 'Telefone inválido. Informe o DDD e o número.' }, { field: 'email', message: 'E-mail inválido.' }] },
    });
    const { errosDaPagina } = await abrir(page, estado, { largura });
    await noMenu(page, 'Editar responsável');
    const folha = page.getByRole('dialog', { name: 'Editar responsável financeiro' });
    await folha.getByLabel('E-mail (opcional)').fill('outro@exemplo.invalid');
    await folha.getByRole('button', { name: 'Salvar responsável' }).click();
    await expect(folha.getByText('Telefone inválido. Informe o DDD e o número.')).toBeVisible();
    await expect(folha.getByText('E-mail inválido.')).toBeVisible();
    await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
    await expect(folha.getByLabel('Telefone (opcional)')).toBeFocused();
    // A mensagem é fixa: nunca repete o que foi digitado.
    await expect(folha.getByText(/outro@exemplo/)).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURAS}/folha-422-${largura}.png` });
    // Mexer no campo tira o erro do servidor daquele campo.
    await folha.getByLabel('E-mail (opcional)').fill('outro2@exemplo.invalid');
    await expect(folha.getByText('E-mail inválido.')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: remover pede confirmação e manda a versão vista`, async ({ page }) => {
    const estado = estadoDoResponsavel({ responsavel: { ...GRAVADO } });
    const { errosDaPagina } = await abrir(page, estado, { largura });
    await noMenu(page, 'Remover responsável');
    const painel = page.getByRole('alertdialog', { name: 'Remover o responsável financeiro?' });
    await expect(painel.getByText(/voltam a ir ao próprio aluno/)).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/remover-${largura}.png` });
    await painel.getByRole('button', { name: 'Remover responsável' }).click();
    await expect(page.getByText('Responsável financeiro removido.')).toBeVisible();
    expect(estado.deletes).toEqual(['3']);
    await expect(page.getByText(SEM_RESPONSAVEL)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar responsável' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('só leitura: sem FINANCEIRO_ALTERAR mostra os dados e nenhuma ação', async ({ page }) => {
  const estado = estadoDoResponsavel({ responsavel: { ...GRAVADO, parentesco: null } });
  const { errosDaPagina } = await abrir(page, estado, { permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER'] });
  // Sem parentesco, a linha diz só o nome (nada de "Não informado"); sem a permissão, nem ⋯ nem Adicionar.
  await expect(page.getByText('Responsável Teste', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /responsável( financeiro)?$/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`${largura}px: sem ALUNO_SENSIVEL_LER o CPF não aparece (nem na leitura nem na folha) e o PUT não o leva`, async ({ page }) => {
    const estado = estadoDoResponsavel({ responsavel: { ...GRAVADO }, veCpf: false });
    const { errosDaPagina } = await abrir(page, estado, {
      largura, permissoes: [...PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_SENSIVEL_LER'), 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'],
    });
    await expect(page.getByText('(45) 99999-8888')).toBeVisible();
    await expect(page.getByLabel(/^CPF:/)).toHaveCount(0);
    await expect(page.getByText('529.982.247-25')).toHaveCount(0);
    await noMenu(page, 'Editar responsável');
    const folha = page.getByRole('dialog', { name: 'Editar responsável financeiro' });
    await expect(folha.getByLabel('CPF (opcional)')).toHaveCount(0);
    await folha.getByLabel('Parentesco (opcional)').fill('Avó');
    await folha.getByRole('button', { name: 'Salvar responsável' }).click();
    await expect(page.getByText('Responsável financeiro salvo.')).toBeVisible();
    expect(estado.puts.at(-1)).toMatchObject({ parentesco: 'Avó', cpf: null, versao: 3 });
    // O gravado fica (a API ignora o CPF sem a permissão).
    expect(estado.responsavel.cpf).toBe('529.982.247-25');
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: a folha da cobrança diz "Os lembretes vão ao responsável." só quando a API diz`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, estadoDoResponsavel({ responsavel: { ...GRAVADO } }), { largura, paraResponsavel: true });
    await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText(LINHA_DOS_LEMBRETES)).toBeVisible();
    // Sem o nome do responsável na folha da cobrança.
    await expect(folha.getByText('Responsável Teste')).toHaveCount(0);
    await folha.getByText(LINHA_DOS_LEMBRETES).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/cobranca-lembretes-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem responsável com contato, a linha dos lembretes não aparece', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, estadoDoResponsavel(), { paraResponsavel: false });
  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Abrir WhatsApp com a mensagem' })).toBeVisible();
  await expect(page.getByText(LINHA_DOS_LEMBRETES)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
