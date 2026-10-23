import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, TREINADOR } from './api-falsa';

/** Cartão "Acesso ao app": o treinador define e-mail e senha provisória. Só dados fictícios. */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const EMAIL_LOGIN = 'login-do-aluno@exemplo.test';

const SEM_CONTA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, ativo: true, temAcesso: false, conviteExpiraEm: null,
  versao: 1, diasAtualizacao: null, anonimizado: false, emailDeAcesso: null, aguardandoPrimeiroAcesso: false,
};
const COM_CONTA: AlunoDetalhe = { ...SEM_CONTA, temAcesso: true, emailDeAcesso: ALUNO.email };

const ROTAS_DA_FICHA = { 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } };
/** O acesso fica dentro de Dados do aluno. */
const acessoDoAluno = (page: Page) => page.getByLabel('Acesso ao app', { exact: true });

test('aluno sem conta: define e-mail e senha gerada, mostra o e-mail em uso no campo e a senha uma vez', async ({ page }) => {
  let tentativas = 0;
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: SEM_CONTA },
    [`PUT /alunos/${ALUNO_ID}/acesso`]: (p, route) => {
      tentativas++;
      if (tentativas === 1) return json(route, erroApi(409, 'Este e-mail já tem uma conta.', 'EMAIL_EM_USO').corpo, 409);
      const { email } = p.corpo as { email: string };
      return json(route, { ...SEM_CONTA, temAcesso: true, aguardandoPrimeiroAcesso: true, emailDeAcesso: email });
    },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText('Sem acesso', { exact: true })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Gerar convite' })).toBeVisible();
  await acesso.getByRole('button', { name: 'Definir e-mail e senha' }).click();

  // O e-mail começa com o do cadastro; senha curta não sai.
  const email = page.getByLabel('E-mail de acesso');
  await expect(email).toHaveValue(ALUNO.email);
  await page.getByLabel('Senha provisória').fill('curta');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);

  await page.getByRole('button', { name: 'Gerar senha' }).click();
  const senha = await page.getByLabel('Senha provisória').inputValue();
  expect(senha).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{10}$/);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Este e-mail já tem uma conta.')).toBeVisible();

  await email.fill(EMAIL_LOGIN);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Passe ao aluno o e-mail e esta senha. Ela não aparece de novo.')).toBeVisible();
  await expect(acesso.getByText(senha, { exact: true })).toBeVisible();
  await expect(acesso.getByLabel(`Usuário no app: ${EMAIL_LOGIN}`)).toBeVisible();
  await expect(acesso.getByText('Aguardando primeiro acesso', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Acesso ao app: Aguardando primeiro acesso')).toBeVisible();
  const envios = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}/acesso`);
  expect(envios).toHaveLength(2);
  expect(envios[1].corpo).toEqual({ email: EMAIL_LOGIN, senha });
  // A senha fica só na tela, nunca no armazenamento do navegador.
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(guardado).not.toContain(senha);
  expect(errosDaPagina).toEqual([]);
});

test('aluno com conta: "Definir nova senha" confirma que as sessões serão encerradas', async ({ page }) => {
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: COM_CONTA },
    [`PUT /alunos/${ALUNO_ID}/acesso`]: { corpo: { ...COM_CONTA, aguardandoPrimeiroAcesso: true } },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText('Com acesso', { exact: true })).toBeVisible();
  await expect(acesso.getByText(`Entra com ${ALUNO.email}.`)).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Gerar convite' })).toHaveCount(0);
  await acesso.getByRole('button', { name: 'Definir nova senha' }).click();
  await page.getByLabel('Senha provisória').fill('provisoria-123');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  const dialogo = page.getByRole('alertdialog', { name: 'Definir nova senha?' });
  await expect(dialogo.getByText('As sessões abertas do aluno serão encerradas e ele vai precisar da senha nova.')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
  await dialogo.getByRole('button', { name: 'Definir senha' }).click();
  await expect(acesso.getByText('provisoria-123', { exact: true })).toBeVisible();
  await expect(acesso.getByText('Aguardando primeiro acesso', { exact: true })).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(1);
  expect(errosDaPagina).toEqual([]);
});

test('cartão de lesões vazio segue o formato dos outros cartões da ficha', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: SEM_CONTA },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const cartaoDe = (nome: string) => page.getByRole('heading', { name: nome }).locator('xpath=ancestor::div[3]');
  const lesoes = cartaoDe('Histórico de lesões');
  const peso = cartaoDe('Peso');
  await expect(lesoes.getByText('Lesões registradas na ficha do aluno.')).toBeVisible();
  await expect(lesoes.getByText('Nenhuma lesão registrada.')).toBeVisible();
  await expect(lesoes.getByRole('button', { name: 'Registrar lesão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Histórico de lesões, (recolhido|expandido)/ })).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Carregando lesões' })).toHaveCount(0);
  const lesoesBox = await lesoes.boundingBox();
  const pesoBox = await peso.boundingBox();
  expect(lesoesBox && pesoBox).toBeTruthy();
  expect(Math.abs(lesoesBox!.width - pesoBox!.width)).toBeLessThan(8);
  expect(errosDaPagina).toEqual([]);
});

test('aluno aguardando o primeiro acesso: "Definir outra senha"; inativo não mostra as ações', async ({ page }) => {
  let ficha: AlunoDetalhe = { ...COM_CONTA, aguardandoPrimeiroAcesso: true };
  await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText(`O aluno entra com ${ALUNO.email} e a senha provisória e cria a senha dele.`)).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Definir outra senha' })).toBeVisible();

  ficha = { ...SEM_CONTA, ativo: false };
  await page.reload();
  await expect(acessoDoAluno(page).getByText('Sem acesso', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Definir e-mail e senha' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gerar convite' })).toHaveCount(0);
});
