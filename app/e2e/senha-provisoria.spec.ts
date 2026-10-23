import { expect, test } from '@playwright/test';

import type { LoginResponse } from '../src/api/tipos';
import { ALUNO, erroApi, json, MARCA, sessao, simularApi } from './api-falsa';

const PROVISORIA = 'provisoria-123';
const NOVA = 'senha-nova-456';

test('senha provisória: o login pede a senha nova, confere as duas e entra depois de salvar', async ({ page }) => {
  const depois = await sessao(page, ALUNO);
  const login: LoginResponse = { accessToken: 'token-falso', expiresIn: 900, usuario: ALUNO, marca: MARCA };
  const { pedidos, errosDaPagina } = await simularApi(page, {
    'GET /eu': depois['GET /eu'],
    'POST /auth/login': (pedido, route) => {
      const corpo = pedido.corpo as { senha: string; novaSenha?: string };
      if (!corpo.novaSenha) return json(route, erroApi(401, 'Crie a sua senha para entrar.', 'TROCA_DE_SENHA_NECESSARIA').corpo, 401);
      if (corpo.novaSenha === corpo.senha) {
        return json(route, erroApi(400, 'A nova senha precisa ser diferente da que o treinador passou.').corpo, 400);
      }
      return json(route, login);
    },
  });
  const logins = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/auth/login');

  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(ALUNO.email);
  await page.getByLabel('Senha', { exact: true }).fill(PROVISORIA);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
  await expect(page.getByText('Seu treinador criou uma senha provisória. Escolha agora a sua senha para entrar.')).toBeVisible();
  expect(logins()).toHaveLength(1);

  // Conferência local: nada vai para a API.
  await page.getByLabel('Nova senha', { exact: true }).fill('curta');
  await page.getByLabel('Repita a nova senha').fill('curta');
  await page.getByRole('button', { name: 'Salvar e entrar' }).click();
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
  await page.getByLabel('Nova senha', { exact: true }).fill(NOVA);
  await page.getByLabel('Repita a nova senha').fill('outra-senha-789');
  await page.getByRole('button', { name: 'Salvar e entrar' }).click();
  await expect(page.getByText('As senhas não conferem.')).toBeVisible();
  expect(logins()).toHaveLength(1);

  // A regra do servidor aparece embaixo do campo.
  await page.getByLabel('Nova senha', { exact: true }).fill(PROVISORIA);
  await page.getByLabel('Repita a nova senha').fill(PROVISORIA);
  await page.getByRole('button', { name: 'Salvar e entrar' }).click();
  await expect(page.getByText('A nova senha precisa ser diferente da que o treinador passou.')).toBeVisible();

  await page.getByLabel('Nova senha', { exact: true }).fill(NOVA);
  await page.getByLabel('Repita a nova senha').fill(NOVA);
  await page.getByRole('button', { name: 'Salvar e entrar' }).click();
  await expect(page).not.toHaveURL(/entrar/);
  expect(logins().at(-1)?.corpo).toMatchObject({ email: ALUNO.email, senha: PROVISORIA, novaSenha: NOVA });
  // A senha não fica guardada no navegador.
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(guardado).not.toContain(PROVISORIA);
  expect(guardado).not.toContain(NOVA);
  expect(errosDaPagina).toEqual([]);
});

test('senha provisória: "Voltar" limpa o passo e volta para o login', async ({ page }) => {
  await simularApi(page, {
    'POST /auth/login': erroApi(401, 'Crie a sua senha para entrar.', 'TROCA_DE_SENHA_NECESSARIA'),
  });
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(ALUNO.email);
  await page.getByLabel('Senha', { exact: true }).fill(PROVISORIA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByLabel('Nova senha', { exact: true }).fill(NOVA);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('E-mail')).toHaveValue(ALUNO.email);
});
