import { expect, test, type Locator, type Page } from '@playwright/test';

import { erroApi, json, MARCA, simularApi, type Resposta as RespostaFalsa } from './api-falsa';

/*
 * Auditoria de UI/UX de 03/11, lote 1 (C6): nas telas públicas o erro de validação (o local e o `fieldErrors` da API)
 * aparece junto do campo, com `aria-invalid`, e o alerta do topo fica só para o erro do servidor (rede, 5xx, 401/409
 * sem campo, ou campo que a tela não mostra). Só dados fictícios.
 */

type Resposta = { status: number; corpo: unknown };

/** Rota cuja resposta o teste troca no meio (`atual.valor = ...`), contando quantas vezes foi chamada. */
function rotaTrocavel(inicial: Resposta) {
  const estado = { valor: inicial, chamadas: 0 };
  const rota: RespostaFalsa = (_p, route) => {
    estado.chamadas += 1;
    return json(route, estado.valor.corpo, estado.valor.status);
  };
  return { estado, rota };
}

const alerta = (page: Page) => page.getByRole('alert');

async function erroNoCampo(page: Page, campo: Locator, texto: string) {
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(texto, { exact: true })).toBeVisible();
  await expect(alerta(page)).toHaveCount(0);
}

async function erroNoTopo(page: Page, texto: string, campos: Locator[]) {
  await expect(alerta(page)).toContainText(texto);
  for (const campo of campos) await expect(campo).toHaveAttribute('aria-invalid', 'false');
}

for (const largura of [390, 1280]) {
  test.describe(`telas públicas (${largura}px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
    });

    test('entrar: vazio marca o campo; 401 vai ao topo; o fieldErrors da API vai ao campo', async ({ page }, testInfo) => {
      const login = rotaTrocavel(erroApi(401, 'E-mail ou senha incorretos.'));
      const { errosDaPagina } = await simularApi(page, { 'POST /auth/login': login.rota });
      const email = page.getByLabel('E-mail', { exact: true });
      const senha = page.getByLabel('Senha', { exact: true });
      const entrar = page.getByRole('button', { name: 'Entrar', exact: true });
      await page.goto('/entrar');

      await entrar.click();
      await erroNoCampo(page, email, 'Informe o e-mail.');
      await expect(email).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`entrar-erro-no-campo-${largura}.png`) });
      await email.fill('pessoa.ficticia@exemplo.com');
      await entrar.click();
      await erroNoCampo(page, senha, 'Informe a senha.');
      await expect(email).toHaveAttribute('aria-invalid', 'false');
      expect(login.estado.chamadas).toBe(0);

      await senha.fill('senha-ficticia-1');
      await entrar.click();
      await erroNoTopo(page, 'E-mail ou senha incorretos.', [email, senha]);
      await page.screenshot({ path: testInfo.outputPath(`entrar-erro-no-topo-${largura}.png`) });

      login.estado.valor = erroApi(422, 'Dados inválidos.', 'VALIDACAO', [{ field: 'email', message: 'E-mail em formato inválido.' }]);
      await entrar.click();
      await erroNoCampo(page, email, 'E-mail em formato inválido.');
      expect(errosDaPagina).toEqual([]);
    });

    test('convite do aluno: código vazio e campos do acesso no campo; 404 e 409 no topo; 422 no campo', async ({ page }) => {
      const consulta = rotaTrocavel(erroApi(404, 'Convite não encontrado ou vencido.'));
      const aceite = rotaTrocavel(erroApi(422, 'Dados inválidos.', 'VALIDACAO', [{ field: 'email', message: 'E-mail em formato inválido.' }]));
      const { errosDaPagina } = await simularApi(page, {
        'POST /publico/convites/consultar': consulta.rota,
        'POST /publico/convites/aceitar': aceite.rota,
      });
      const codigo = page.getByLabel('Código do convite', { exact: true });
      const continuar = page.getByRole('button', { name: 'Continuar', exact: true });
      await page.goto('/convite');

      await continuar.click();
      await erroNoCampo(page, codigo, 'Digite o código do convite.');
      expect(consulta.estado.chamadas).toBe(0);
      await codigo.fill('CODIGO-FICTICIO');
      await continuar.click();
      await erroNoTopo(page, 'Convite não encontrado ou vencido.', [codigo]);

      consulta.estado.valor = { status: 200, corpo: { consultoria: MARCA, primeiroNomeAluno: 'Fictício' } };
      await continuar.click();
      await expect(page.getByRole('heading', { name: 'Olá, Fictício!' })).toBeVisible();
      const email = page.getByLabel('Seu e-mail', { exact: true });
      const senha = page.getByLabel('Crie uma senha', { exact: true });
      const confirmar = page.getByLabel('Confirmar senha', { exact: true });
      const criar = page.getByRole('button', { name: 'Criar meu acesso', exact: true });

      // Os dois problemas de uma vez, cada um no seu campo; o foco vai ao primeiro.
      await criar.click();
      await erroNoCampo(page, email, 'Informe seu e-mail.');
      await erroNoCampo(page, senha, 'A senha precisa ter pelo menos 8 caracteres.');
      await expect(email).toBeFocused();
      await email.fill('pessoa.ficticia@exemplo.com');
      await senha.fill('senha-ficticia-1');
      await confirmar.fill('outra-senha-2');
      await criar.click();
      await erroNoCampo(page, confirmar, 'As senhas não conferem.');
      expect(aceite.estado.chamadas).toBe(0);

      await confirmar.fill('senha-ficticia-1');
      await criar.click();
      await erroNoCampo(page, email, 'E-mail em formato inválido.');

      aceite.estado.valor = erroApi(409, 'Este convite já foi usado.');
      await criar.click();
      await erroNoTopo(page, 'Este convite já foi usado.', [email, senha, confirmar]);
      expect(errosDaPagina).toEqual([]);
    });

    test('convite de equipe: vazio marca código e senha; 404 no topo; 422 da senha no campo', async ({ page }) => {
      const aceite = rotaTrocavel(erroApi(404, 'Convite não encontrado ou vencido.'));
      const { errosDaPagina } = await simularApi(page, { 'POST /publico/convites-equipe/aceitar': aceite.rota });
      const codigo = page.getByLabel('Código do convite de equipe', { exact: true });
      const senha = page.getByLabel('Crie uma senha', { exact: true });
      const confirmacao = page.getByLabel('Confirmar senha', { exact: true });
      const criar = page.getByRole('button', { name: 'Criar meu acesso à equipe', exact: true });
      await page.goto('/convite-equipe');

      await criar.click();
      await erroNoCampo(page, codigo, 'Informe o código do convite.');
      await erroNoCampo(page, senha, 'A senha precisa ter pelo menos 8 caracteres.');
      await expect(codigo).toBeFocused();
      expect(aceite.estado.chamadas).toBe(0);

      await codigo.fill('codigo-ficticio');
      await senha.fill('senha-ficticia-1');
      await confirmacao.fill('senha-ficticia-1');
      await criar.click();
      await erroNoTopo(page, 'Convite não encontrado ou vencido.', [codigo, senha, confirmacao]);

      aceite.estado.valor = erroApi(400, 'Senha fraca demais.', null, [{ field: 'senha', message: 'Escolha uma senha menos comum.' }]);
      await criar.click();
      await erroNoCampo(page, senha, 'Escolha uma senha menos comum.');
      expect(errosDaPagina).toEqual([]);
    });

    test('esqueci a senha: vazio no campo; 503 no topo; 422 do e-mail no campo', async ({ page }) => {
      const pedido = rotaTrocavel(erroApi(503, 'O envio de e-mail está fora do ar. Tente mais tarde.', 'REDEFINICAO_INDISPONIVEL'));
      const { errosDaPagina } = await simularApi(page, { 'POST /auth/esqueci-senha': pedido.rota });
      const email = page.getByLabel('E-mail da sua conta', { exact: true });
      const enviar = page.getByRole('button', { name: 'Enviar link', exact: true });
      await page.goto('/esqueci-senha');

      await enviar.click();
      await erroNoCampo(page, email, 'Informe o e-mail.');
      expect(pedido.estado.chamadas).toBe(0);

      await email.fill('pessoa.ficticia@exemplo.com');
      await enviar.click();
      await erroNoTopo(page, 'O envio de e-mail está fora do ar. Tente mais tarde.', [email]);

      pedido.estado.valor = erroApi(422, 'Dados inválidos.', 'VALIDACAO', [{ field: 'email', message: 'E-mail em formato inválido.' }]);
      await enviar.click();
      await erroNoCampo(page, email, 'E-mail em formato inválido.');
      expect(errosDaPagina).toEqual([]);
    });

    test('redefinir a senha: senha e confirmação no campo; 400 da senha no campo; token e 503 no topo; link vencido', async ({ page }) => {
      const redefinir = rotaTrocavel(erroApi(400, 'Senha inválida.', null, [{ field: 'novaSenha', message: 'Escolha uma senha menos comum.' }]));
      const { errosDaPagina } = await simularApi(page, { 'POST /auth/redefinir-senha': redefinir.rota });
      const senha = page.getByLabel('Senha nova', { exact: true });
      const confirmacao = page.getByLabel('Confirmar senha', { exact: true });
      const salvar = page.getByRole('button', { name: 'Salvar senha nova', exact: true });
      await page.goto('/redefinir-senha#token=token-ficticio');

      await salvar.click();
      await expect(senha).toHaveAttribute('aria-invalid', 'true');
      await expect(confirmacao).toHaveAttribute('aria-invalid', 'false');
      await expect(alerta(page)).toHaveCount(0);
      await senha.fill('senha-ficticia-1');
      await confirmacao.fill('outra-senha-2');
      await salvar.click();
      await expect(senha).toHaveAttribute('aria-invalid', 'false');
      await expect(confirmacao).toHaveAttribute('aria-invalid', 'true');
      await expect(alerta(page)).toHaveCount(0);
      expect(redefinir.estado.chamadas).toBe(0);

      await confirmacao.fill('senha-ficticia-1');
      await salvar.click();
      await erroNoCampo(page, senha, 'Escolha uma senha menos comum.');

      // O token não é campo da tela: o erro dele vai ao topo, junto com o do campo que a tela mostra.
      redefinir.estado.valor = erroApi(422, 'Dados inválidos.', 'VALIDACAO', [{ field: 'token', message: 'Obrigatório.' }]);
      await salvar.click();
      await erroNoTopo(page, 'Dados inválidos.', [senha, confirmacao]);

      redefinir.estado.valor = erroApi(503, 'O envio de e-mail está fora do ar. Tente mais tarde.', 'REDEFINICAO_INDISPONIVEL');
      await salvar.click();
      await erroNoTopo(page, 'O envio de e-mail está fora do ar. Tente mais tarde.', [senha, confirmacao]);

      redefinir.estado.valor = erroApi(400, 'Este link não funciona mais.', 'LINK_INVALIDO');
      await salvar.click();
      await expect(page.getByRole('heading', { name: 'Link inválido ou vencido' })).toBeVisible();
      await page.getByRole('button', { name: 'Pedir um link novo', exact: true }).click();
      await expect(page).toHaveURL(/\/esqueci-senha$/);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
