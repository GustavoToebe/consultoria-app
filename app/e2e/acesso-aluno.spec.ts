import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';

/** Cartão "Acesso ao app": o treinador define e-mail e senha provisória. Só dados fictícios. */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const EMAIL_LOGIN = 'login-do-aluno@exemplo.test';

const SEM_CONTA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, ativo: true, temAcesso: false, conviteExpiraEm: null,
  versao: 1, diasAtualizacao: null, anonimizado: false, emailDeAcesso: null, aguardandoPrimeiroAcesso: false,
};
const COM_CONTA: AlunoDetalhe = { ...SEM_CONTA, temAcesso: true, emailDeAcesso: ALUNO.email };

const ROTAS_DA_FICHA = { 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } };
/** O acesso tem bloco próprio na aba Ficha do aluno, logo depois de Dados do aluno. */
const acessoDoAluno = (page: Page) => page.getByLabel('Acesso ao app', { exact: true });

test('Resumo de quem não entra no app: "Abrir acesso ao app" leva ao bloco do acesso, sem gerar convite nem senha', async ({ page }) => {
  const pasta = { id: 'f0000000-0000-4000-8000-0000000000a1', alunoId: ALUNO_ID, titulo: 'Pasta fictícia', inicio: null, fim: null, concluidaEm: null };
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: SEM_CONTA },
    // Com pasta, o passo de cima ("crie a primeira pasta") não vale e sobra o do acesso.
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [pasta] },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('O aluno ainda não entra no app. Abra o acesso e escolha como convidar.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir acesso ao app', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Ficha do aluno', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]aba=ficha/);
  await expect(page).not.toHaveURL(/secao=/);
  const acesso = acessoDoAluno(page);
  await expect(acesso).toBeInViewport();
  // ficha: acesso ao app (24/11): o convite na linha Convite e o e-mail e senha na linha Senha; nada foi enviado.
  await expect(acesso.getByLabel('Convite: —')).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Gerar convite' })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Definir e-mail e senha' })).toBeVisible();
  expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh')).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

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
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText('Sem acesso', { exact: true })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Gerar convite' })).toBeVisible();
  await acesso.getByRole('button', { name: 'Definir e-mail e senha' }).click();

  // O e-mail começa com o do cadastro; senha curta não sai.
  const email = page.getByRole('textbox', { name: 'E-mail de acesso' });
  await expect(email).toHaveValue(ALUNO.email);
  await page.getByLabel('Senha provisória').fill('curta');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);

  await page.getByRole('button', { name: 'Gerar senha' }).click();
  const senha = await page.getByLabel('Senha provisória').inputValue();
  expect(senha).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{10}$/);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  // 25/11: o 409 EMAIL_EM_USO vira o texto do app no campo (pelo código, não pelo texto da API).
  await expect(page.getByText('Este e-mail já é usado por outra conta.')).toBeVisible();

  await email.fill(EMAIL_LOGIN);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Passe ao aluno o e-mail e esta senha. Ela não aparece de novo.')).toBeVisible();
  await expect(acesso.getByText(senha, { exact: true })).toBeVisible();
  // ficha: acesso ao app (24/11): o e-mail na linha "E-mail de acesso" e no destaque da senha; o "Usuário no app" saiu.
  await expect(acesso.getByText(EMAIL_LOGIN, { exact: true })).toHaveCount(2);
  await expect(acesso.getByLabel(`E-mail de acesso: ${EMAIL_LOGIN}`)).toBeVisible();
  await expect(acesso.getByText('Usuário no app')).toHaveCount(0);
  await expect(acesso.getByText('Aguardando primeiro acesso', { exact: true })).toBeVisible();
  await expect(acesso.getByLabel('Situação: Aguardando primeiro acesso')).toBeVisible();
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
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText('Com acesso', { exact: true })).toBeVisible();
  // ficha: acesso ao app (24/11): sem a frase "Entra com"; o e-mail na própria linha, com o copiar.
  await expect(acesso.getByText(/Entra com/)).toHaveCount(0);
  await expect(acesso.getByLabel(`E-mail de acesso: ${ALUNO.email}`)).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Copiar e-mail de acesso' })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Gerar convite' })).toHaveCount(0);
  await acesso.getByRole('button', { name: 'Definir nova senha' }).click();
  await page.getByLabel('Senha provisória').fill('provisoria-123');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  const dialogo = page.getByRole('alertdialog', { name: 'Definir nova senha?' });
  await expect(dialogo.getByText('As sessões abertas do aluno serão encerradas e ele vai precisar da senha nova.')).toBeVisible();
  // O véu atrás do painel é o `VEU` dos tokens (o mesmo da Folha), não uma cor fixa.
  await expect(dialogo.locator('xpath=..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.55)');
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
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const cartaoDe = (nome: string) => page.getByRole('heading', { name: nome }).locator('xpath=ancestor::div[3]');
  const lesoes = cartaoDe('Histórico de lesões');
  // ficha: o histórico fica embaixo das duas colunas (24/11), na largura delas somadas: começa onde o Contato começa e é mais largo.
  const peso = cartaoDe('Contato e endereço');
  // ficha do aluno: dados (23/11): sem a descrição fixa; a contagem só existe com lesões.
  await expect(lesoes.getByText('Nenhuma lesão registrada.')).toBeVisible();
  await expect(lesoes.getByRole('button', { name: 'Registrar lesão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Histórico de lesões, (recolhido|expandido)/ })).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Carregando lesões' })).toHaveCount(0);
  const lesoesBox = await lesoes.boundingBox();
  const pesoBox = await peso.boundingBox();
  expect(lesoesBox && pesoBox).toBeTruthy();
  expect(Math.abs(lesoesBox!.x - pesoBox!.x)).toBeLessThan(2);
  expect(lesoesBox!.width).toBeGreaterThan(pesoBox!.width * 1.4);
  expect(errosDaPagina).toEqual([]);
});

test('aluno aguardando o primeiro acesso: "Definir outra senha"; inativo não mostra as ações', async ({ page }) => {
  let ficha: AlunoDetalhe = { ...COM_CONTA, aguardandoPrimeiroAcesso: true };
  await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByText('Provisória: o aluno cria a dele no primeiro login.', { exact: true })).toBeVisible();
  await expect(acesso.getByLabel('Senha: provisória')).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Definir outra senha' })).toBeVisible();

  ficha = { ...SEM_CONTA, ativo: false };
  await page.reload();
  await expect(acessoDoAluno(page).getByText('Sem acesso', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Definir e-mail e senha' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gerar convite' })).toHaveCount(0);
});

// revisão 24/11: aluno inativo com conta mostra a situação dele, não "Com acesso".
test('aluno inativo com conta: a situação é "Inativo" e não "Com acesso"', async ({ page }) => {
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...COM_CONTA, ativo: false } },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByLabel('Situação: Inativo', { exact: true })).toBeVisible();
  await expect(acesso.getByText('Inativo', { exact: true })).toBeVisible();
  await expect(acesso.getByText('Com acesso', { exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ficha: acesso ao app (24/11): lista de dados com o cabeçalho só com o título, o último login relativo em Brasília e "—"
// para quem nunca entrou; sem conta, o convite e o e-mail e senha ficam nas linhas Convite e Senha.
for (const largura of [390, 1280]) {
  test(`${largura}px: acesso em lista: "Ontem, 18:38" com a data completa, "—" sem login e as ações nas linhas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await fixarHoje(page);
    let ficha: AlunoDetalhe = { ...COM_CONTA, ultimoAcesso: { tipo: 'LOGIN', em: '2026-10-18T21:38:00Z' } };
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
    const acesso = acessoDoAluno(page);
    await expect(acesso.getByLabel('Último login: Ontem, 18:38 (18/10/2026 às 18:38)', { exact: true })).toBeVisible();
    await expect(acesso.getByText('Ontem, ', { exact: false })).toBeVisible();
    // O cabeçalho do cartão só tem o título: a única ação de senha é a da linha Senha.
    await expect(acesso.getByRole('button', { name: 'Definir nova senha' })).toHaveCount(1);
    const senha = (await acesso.getByLabel('Senha: definida', { exact: true }).boundingBox())!;
    const botao = (await acesso.getByRole('button', { name: 'Definir nova senha' }).boundingBox())!;
    expect(Math.abs((senha.y + senha.height / 2) - (botao.y + botao.height / 2))).toBeLessThan(24);
    expect(botao.x).toBeGreaterThan(senha.x);

    ficha = { ...SEM_CONTA, conviteExpiraEm: '2026-10-25T15:00:00Z' };
    await page.reload();
    await expect(acesso.getByLabel('Situação: Sem acesso', { exact: true })).toBeVisible();
    await expect(acesso.getByLabel('Último login: —', { exact: true })).toBeVisible();
    await expect(acesso.getByLabel('E-mail de acesso: —', { exact: true })).toBeVisible();
    await expect(acesso.getByLabel('Convite: Válido até 25/10/2026 12:00', { exact: true })).toBeVisible();
    await expect(acesso.getByRole('button', { name: 'Gerar outro convite' })).toBeVisible();
    await expect(acesso.getByRole('button', { name: 'Definir e-mail e senha' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

// Acesso ao app (25/11, D3 de `docs/planos/ajustes-da-tarde-25-11.md`): alterar e-mail, desativar e reativar.
const EMAIL_NOVO = 'novo-login@exemplo.test';

for (const largura of [390, 1280]) {
  test(`${largura}px: "Alterar e-mail" confere formato, igualdade e o atual; o 409 fica no campo e o sucesso troca a linha`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    let tentativas = 0;
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      [`GET /alunos/${ALUNO_ID}`]: { corpo: COM_CONTA },
      [`PUT /alunos/${ALUNO_ID}/acesso/email`]: (p, route) => {
        tentativas++;
        if (tentativas === 1) return json(route, erroApi(409, 'Conflito.', 'EMAIL_EM_USO').corpo, 409);
        return json(route, { aluno: { ...COM_CONTA, emailDeAcesso: (p.corpo as { email: string }).email }, emailEnviado: true });
      },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
    const acesso = acessoDoAluno(page);
    await acesso.getByRole('button', { name: 'Alterar e-mail de acesso' }).click();
    const folha = page.getByRole('dialog', { name: 'Alterar e-mail de acesso' });
    await expect(folha.getByLabel(`E-mail atual: ${ALUNO.email}`)).toBeVisible();
    await expect(folha.getByText(/as sessões abertas do aluno são encerradas/)).toBeVisible();
    const novo = folha.getByRole('textbox', { name: 'Novo e-mail', exact: true });
    const confirmacao = folha.getByRole('textbox', { name: 'Confirme o novo e-mail' });
    const alterar = folha.getByRole('button', { name: 'Alterar e-mail', exact: true });

    await alterar.click();
    await expect(folha.getByText('Informe o novo e-mail.')).toBeVisible();
    await expect(folha.getByText('Repita o novo e-mail.')).toBeVisible();
    await expect(novo).toBeFocused();
    await novo.fill('sem-arroba');
    await novo.blur();
    await expect(folha.getByText('Informe um e-mail válido, como nome@exemplo.com.')).toBeVisible();
    await novo.fill(ALUNO.email.toUpperCase());
    await confirmacao.fill(ALUNO.email);
    await alterar.click();
    await expect(folha.getByText('Este já é o e-mail de acesso do aluno. Informe outro.')).toBeVisible();
    await novo.fill(EMAIL_NOVO);
    await confirmacao.fill('outro@exemplo.test');
    await alterar.click();
    await expect(folha.getByText('Os dois e-mails não são iguais.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);

    await confirmacao.fill(EMAIL_NOVO);
    await alterar.click();
    await expect(folha.getByText('Este e-mail já é usado por outra conta.')).toBeVisible();
    await alterar.click();
    await expect(folha).toHaveCount(0);
    await expect(acesso.getByLabel(`E-mail de acesso: ${EMAIL_NOVO}`)).toBeVisible();
    await expect(page.getByText('E-mail de acesso alterado. As sessões do aluno foram encerradas. Avisamos o aluno no e-mail novo.')).toBeVisible();
    const envios = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}/acesso/email`);
    expect(envios.map((p) => p.corpo)).toEqual([{ email: EMAIL_NOVO }, { email: EMAIL_NOVO }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('"Alterar e-mail" com o envio de e-mails desligado diz para avisar o aluno', async ({ page }) => {
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: COM_CONTA },
    [`PUT /alunos/${ALUNO_ID}/acesso/email`]: (p, route) => json(route, { aluno: { ...COM_CONTA, emailDeAcesso: (p.corpo as { email: string }).email }, emailEnviado: false }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await acesso.getByRole('button', { name: 'Alterar e-mail de acesso' }).click();
  const folha = page.getByRole('dialog', { name: 'Alterar e-mail de acesso' });
  await folha.getByRole('textbox', { name: 'Novo e-mail', exact: true }).fill(EMAIL_NOVO);
  await folha.getByRole('textbox', { name: 'Confirme o novo e-mail' }).fill(EMAIL_NOVO);
  await folha.getByRole('button', { name: 'Alterar e-mail', exact: true }).click();
  await expect(folha).toHaveCount(0);
  await expect(acesso.getByLabel(`E-mail de acesso: ${EMAIL_NOVO}`)).toBeVisible();
  await expect(page.getByText('E-mail de acesso alterado. As sessões do aluno foram encerradas. O envio de e-mails está desligado; avise o aluno.')).toBeVisible();
  await expect(page.getByText(/Avisamos o aluno/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('"Desativar acesso" pede confirmação; desativado mostra a data e só "Reativar acesso", que volta ao normal', async ({ page }) => {
  await fixarHoje(page);
  const DESATIVADO: AlunoDetalhe = { ...COM_CONTA, acessoDesativadoEm: '2026-10-17T15:00:00Z', acessoDesativadoMotivo: 'MANUAL' };
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: COM_CONTA },
    [`POST /alunos/${ALUNO_ID}/acesso/desativar`]: { corpo: DESATIVADO },
    [`POST /alunos/${ALUNO_ID}/acesso/reativar`]: { corpo: COM_CONTA },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  const posts = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho.includes('/acesso/'));

  // Cancelar não envia nada.
  await acesso.getByRole('button', { name: 'Desativar acesso' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Desativar acesso ao app?' });
  await expect(dialogo.getByText(/Nada é apagado/)).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);
  expect(posts()).toHaveLength(0);

  await acesso.getByRole('button', { name: 'Desativar acesso' }).click();
  await dialogo.getByRole('button', { name: 'Desativar acesso' }).click();
  const situacao = acesso.getByLabel('Situação: Sem acesso (desativado em 17/10)', { exact: true });
  await expect(situacao).toBeVisible();
  // T-202: o selo do desativado tem o "●" (6 x 6 px, só desenho) como os outros selos de situação.
  expect(await situacao.locator('[aria-hidden="true"]').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetWidth === 6 && (e as HTMLElement).offsetHeight === 6).length)).toBe(1);
  await expect(acesso.getByText('O aluno não entra até o acesso ser reativado. Nada foi apagado.')).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Definir nova senha' })).toHaveCount(0);
  await expect(acesso.getByRole('button', { name: 'Alterar e-mail de acesso' })).toHaveCount(0);
  await expect(acesso.getByRole('button', { name: 'Desativar acesso' })).toHaveCount(0);
  // O e-mail continua à vista e copiável.
  await expect(acesso.getByRole('button', { name: 'Copiar e-mail de acesso' })).toBeVisible();
  expect(posts().map((p) => [p.caminho, p.corpo])).toEqual([[`/alunos/${ALUNO_ID}/acesso/desativar`, { motivo: 'MANUAL' }]]);

  await acesso.getByRole('button', { name: 'Reativar acesso' }).click();
  await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Definir nova senha' })).toBeVisible();
  await expect(page.getByText('Acesso reativado.')).toBeVisible();
  expect(posts()).toHaveLength(2);
  expect(errosDaPagina).toEqual([]);
});

test('acesso desativado de aluno inativo: "Inativo" sem a data e sem "Reativar acesso"; ativo de novo, o botão volta', async ({ page }) => {
  let ficha: AlunoDetalhe = { ...COM_CONTA, ativo: false, acessoDesativadoEm: '2026-10-17T15:00:00Z', acessoDesativadoMotivo: 'MANUAL' };
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, ficha),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const acesso = acessoDoAluno(page);
  await expect(acesso.getByLabel('Situação: Inativo', { exact: true })).toBeVisible();
  await expect(acesso.getByRole('button', { name: 'Reativar acesso' })).toHaveCount(0);
  ficha = { ...ficha, ativo: true };
  await page.reload();
  await expect(acesso.getByRole('button', { name: 'Reativar acesso' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
