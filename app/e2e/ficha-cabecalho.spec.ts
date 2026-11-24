import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR as BASE, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Cabeçalho do aluno (18/11, `docs/planos/ficha-do-aluno-cabecalho.md`): a seta "Voltar para Alunos" e a trilha numa linha;
 * foto, nome e só as datas que existem na seguinte; o selo da situação e o ⋯ à direita (embaixo do nome no celular); as
 * abas na mesma borda esquerda da foto. Contato nos Dados do aluno (copiar e WhatsApp fora do app) e o voltar da edição
 * (D3). Dados fictícios; capturas em `CAPTURAS_FICHA` quando a variável existe (fora do repositório).
 */
const PERMISSOES = [...BASE, 'REGISTRO_LER', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER'];
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const CEP = { 'POST /enderecos/cep/consultar': { status: 404, corpo: { codigo: 'CEP_NAO_ENCONTRADO', mensagem: 'CEP não encontrado.' } } };

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: '(45) 99999-8888', objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
  cadastroAlteradoEm: '2026-11-18T17:32:00Z',
  ultimoAcesso: { tipo: 'ACESSO', em: '2026-11-18T12:05:00Z' },
  ultimoPlanoPublicado: { em: '2026-11-15T13:00:00Z', porNome: 'Treinador Fictício' },
};
// Só parte das datas: login (não acesso), plano sem autor e cadastro sem data.
const PARCIAL: AlunoDetalhe = { ...FICHA, cadastroAlteradoEm: null, ultimoAcesso: { tipo: 'LOGIN', em: '2026-11-10T22:00:00Z' }, ultimoPlanoPublicado: { em: '2026-11-01T15:00:00Z', porNome: null } };

const SEM_ATUALIZACAO: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
};

async function abrir(page: Page, o: { largura?: number; ficha?: AlunoDetalhe; url?: string; tema?: string } = {}) {
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema]);
  await page.setViewportSize({ width: o.largura ?? 1280, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    ...CEP,
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: o.ficha ?? FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: [] } },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
  });
  await page.goto(o.url ?? `/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: ALUNO.nome })).toBeVisible();
  return api;
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_FICHA;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

const voltar = (page: Page) => page.getByRole('button', { name: 'Voltar para Alunos', exact: true });
const editarDados = (page: Page) => page.getByRole('button', { name: 'Editar dados', exact: true });
const sairSemSalvar = (page: Page) => page.getByText('Sair sem salvar?', { exact: true });

for (const largura of [1280, 390]) {
  test(`${largura}px: cabeçalho com as três datas, selo, ⋯ e a borda esquerda única`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, { largura });
    await expect(page.getByText('Cadastro alterado em 18/11/2026 14:32')).toBeVisible();
    await expect(page.getByText('Último acesso ao app em 18/11/2026 09:05')).toBeVisible();
    await expect(page.getByText('Último plano publicado em 15/11/2026 por Treinador Fictício', { exact: true })).toBeVisible();
    await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
    // A trilha é navegação e a seta tem 44 px de alvo; um h1 só.
    const trilha = page.getByRole('navigation', { name: 'Trilha' });
    await expect(trilha.getByRole('link', { name: 'Alunos' })).toBeVisible();
    await expect(page.locator('h1, [role="heading"][aria-level="1"]')).toHaveCount(1);
    const seta = (await voltar(page).boundingBox())!;
    expect([Math.round(seta.width), Math.round(seta.height)]).toEqual([44, 44]);

    // D5: a seta (o desenho), a foto e as abas partem da mesma borda esquerda.
    const foto = (await page.getByRole('button', { name: 'Trocar foto', exact: true }).boundingBox())!;
    const abas = (await page.getByRole('tablist').boundingBox())!;
    const desenhoDaSeta = (await voltar(page).locator('svg').boundingBox())!;
    expect(Math.abs(foto.x - abas.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(desenhoDaSeta.x - foto.x)).toBeLessThanOrEqual(1);
    expect(Math.round(foto.width)).toBe(56);
    // 20 px do fim da linha do nome até as abas.
    const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const menu = (await page.getByRole('button', { name: 'Mais ações do aluno', exact: true }).boundingBox())!;
    if (largura >= 600) {
      // Selo e ⋯ à direita, na linha do nome.
      expect(menu.x).toBeGreaterThan(h1.x + h1.width);
    } else {
      // No celular descem para baixo do nome e das datas.
      expect(menu.y).toBeGreaterThan(h1.y + h1.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas.filter((c) => c.startsWith(`GET /alunos/${ALUNO_ID}`) && !c.includes('foto-perfil'))).toEqual([]);
  });

  test(`${largura}px: só parte das datas, e login nunca vira acesso`, async ({ page }) => {
    await abrir(page, { largura, ficha: PARCIAL });
    await expect(page.getByText('Último login em 10/11/2026 19:00')).toBeVisible();
    await expect(page.getByText('Último plano publicado em 01/11/2026', { exact: true })).toBeVisible();
    await expect(page.getByText(/Cadastro alterado|Último acesso/)).toHaveCount(0);
    await capturar(page, `datas-parciais-${largura}-escuro`);
  });

  test(`${largura}px: só parte das datas no tema claro (captura)`, async ({ page }) => {
    await abrir(page, { largura, ficha: PARCIAL, tema: 'CLARO' });
    await expect(page.getByText('Último login em 10/11/2026 19:00')).toBeVisible();
    await capturar(page, `datas-parciais-${largura}-claro`);
  });
}

test('sem nenhuma data e inativo: a linha some e o selo diz Inativo, em texto neutro', async ({ page }) => {
  await abrir(page, { ficha: { ...FICHA, ativo: false, cadastroAlteradoEm: null, ultimoAcesso: null, ultimoPlanoPublicado: null } });
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible();
  await expect(page.getByText(/Cadastro alterado|Último /)).toHaveCount(0);
  // O Resumo não repete a situação (ela já está no cabeçalho).
  await expect(page.getByText('Inativo', { exact: true })).toHaveCount(1);
});

for (const [tema, rotulo] of [['ESCURO', 'escuro'], ['CLARO', 'claro'], ['AREIA', 'areia']] as const) {
  for (const largura of [1280, 390]) {
    test(`capturas: ${rotulo} em ${largura}px, cabeçalho e Dados do aluno`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, { largura, tema });
      await capturar(page, `cabecalho-${largura}-${rotulo}`);
      await page.getByRole('button', { name: 'Trocar foto', exact: true }).hover();
      await capturar(page, `foto-hover-${largura}-${rotulo}`);
      await page.getByRole('tab', { name: 'Ficha do aluno', exact: true }).click();
      await expect(page.getByRole('button', { name: `Copiar telefone de ${ALUNO.nome}`, exact: true })).toBeVisible();
      await page.getByRole('heading', { name: 'Contato e endereço', exact: true }).scrollIntoViewIfNeeded();
      await capturar(page, `dados-contato-${largura}-${rotulo}`);
      await editarDados(page).click();
      await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
      await capturar(page, `edicao-${largura}-${rotulo}`);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`${largura}px: copiar telefone e e-mail avisa, e o WhatsApp abre fora do app com o número certo`, async ({ page, context }) => {
    // O navegador de teste não deixa ler a área de transferência: um substituto guarda o que foi copiado.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
      });
    });
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }));
    const { errosDaPagina } = await abrir(page, { largura, url: `/treinador/alunos/${ALUNO_ID}?aba=ficha` });
    const copiado = () => page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado);

    const copiarTelefone = page.getByRole('button', { name: `Copiar telefone de ${ALUNO.nome}`, exact: true });
    const caixa = (await copiarTelefone.boundingBox())!;
    expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
    await copiarTelefone.click();
    await expect(page.getByText('Telefone copiado.')).toBeVisible();
    expect(await copiado()).toBe('(45) 99999-8888');
    await page.getByRole('button', { name: `Copiar e-mail de ${ALUNO.nome}`, exact: true }).click();
    await expect(page.getByText('E-mail copiado.')).toBeVisible();
    expect(await copiado()).toBe(ALUNO.email);

    const [popup] = await Promise.all([page.waitForEvent('popup'),
      page.getByRole('button', { name: `Abrir WhatsApp de ${ALUNO.nome}`, exact: true }).click()]);
    await popup.waitForLoadState();
    // Sem texto pronto e sem nada da sessão no endereço: só o número com o 55.
    expect(popup.url()).toBe('https://wa.me/5545999998888');
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem telefone nem e-mail, os botões de contato não aparecem', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=ficha`, ficha: { ...FICHA, telefone: null, email: null } });
  await expect(page.getByRole('heading', { name: 'Contato e endereço', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^(Copiar (telefone|e-mail) de ${ALUNO.nome}|Abrir WhatsApp)`) })).toHaveCount(0);
});

for (const largura of [390, 1280]) {
  test(`${largura}px: editar cria um passo no histórico; o voltar do navegador sai para a leitura, na mesma aba`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, url: `/treinador/alunos/${ALUNO_ID}?aba=ficha` });
    // Sem alteração: o voltar só fecha a edição.
    await editarDados(page).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(ALUNO.nome);
    await page.goBack();
    await expect(editarDados(page)).toBeVisible();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Ficha do aluno', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}\\?aba=ficha$`));
    await expect(sairSemSalvar(page)).toHaveCount(0);

    // Com alteração: o voltar pergunta; "Continuar editando" fica com o que foi digitado.
    await editarDados(page).click();
    await page.getByLabel('Nome', { exact: true }).fill('Nome Trocado Fictício');
    await page.goBack();
    await expect(sairSemSalvar(page)).toBeVisible();
    await capturar(page, `sair-sem-salvar-${largura}`);
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Nome Trocado Fictício');
    // A entrada da edição voltou: o voltar seguinte pergunta de novo, e "Sair sem salvar" fica na leitura da ficha.
    await page.goBack();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(editarDados(page)).toBeVisible();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}\\?aba=ficha$`));
    await expect(page.getByRole('heading', { level: 1, name: ALUNO.nome })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('editando, trocar de aba sem alteração sai da edição e a aba nova fica (a volta da entrada não a desfaz)', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=ficha` });
  await editarDados(page).click();
  await page.getByRole('tab', { name: 'Resumo', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]aba=resumo/);
  await page.getByRole('tab', { name: 'Ficha do aluno', exact: true }).click();
  await expect(editarDados(page)).toBeVisible();
});
