import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, ConsultoriaResponse, MeusDadosRequest, MeusDadosResponse } from '../src/api/tipos';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Redes sociais (T-107, `docs/planos/ajustes-da-tarde-25-11.md`): Marca › Contato manda as cinco redes e mostra o link que a
 * API normalizou; o 422 cai no campo; a Conta do aluno mostra só as preenchidas e abre fora do app; Meus dados e o cadastro
 * mandam Instagram e TikTok; a ficha mostra a linha "Redes sociais" só com dado. Só dados fictícios; os hosts das redes são
 * interceptados (nada sai para a rede de verdade).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const BASE: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const SEM_REDES = { instagram: null, tiktok: null, youtube: null, x: null, site: null };
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

/** Os hosts das redes respondem uma página vazia: o popup abre sem sair para a internet. */
async function interceptarRedes(context: BrowserContext) {
  for (const host of ['https://www.instagram.com/**', 'https://www.tiktok.com/**', 'https://www.youtube.com/**', 'https://x.com/**', 'https://consultoria-ficticia.test/**']) {
    await context.route(host, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Rede</title>' }));
  }
}

async function abrirMarca(page: Page, largura: number, put: RespostasApi[string], consultoria: ConsultoriaResponse = BASE) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
    'PUT /consultoria/marca': put,
  });
  await page.goto('/treinador/marca');
  await expect(page.getByRole('heading', { name: 'Redes sociais' })).toBeVisible();
  return api;
}

const campo = (page: Page, nome: string) => page.getByRole('textbox', { name: nome, exact: true });
const salvarMarca = (page: Page) => page.getByRole('button', { name: 'Salvar marca', exact: true });

for (const largura of [390, 1280]) {
  test(`Marca (${largura}): o Contato manda as cinco redes e mostra o link que a API normalizou`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirMarca(page, largura, (_p, route) => json(route, {
      ...BASE, versao: 4, redesSociais: { ...SEM_REDES, instagram: 'https://www.instagram.com/consultoria.ficticia', site: 'https://consultoria-ficticia.test' },
    }));
    await campo(page, 'Instagram').fill('@consultoria.ficticia');
    await campo(page, 'Site').fill('consultoria-ficticia.test');
    await salvarMarca(page).click();
    await expect(page.getByText('Marca salva. Os alunos veem a nova marca ao abrir o app.')).toBeVisible();
    const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca');
    expect((put?.corpo as { redesSociais: unknown }).redesSociais).toEqual({ instagram: '@consultoria.ficticia', tiktok: '', youtube: '', x: '', site: 'consultoria-ficticia.test' });
    // O campo passa a mostrar o link gravado, e nada fica por salvar.
    await expect(campo(page, 'Instagram')).toHaveValue('https://www.instagram.com/consultoria.ficticia');
    await expect(campo(page, 'Site')).toHaveValue('https://consultoria-ficticia.test');
    await expect(salvarMarca(page)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Marca (${largura}): o 422 MARCA_INVALIDA de uma rede cai no campo dela`, async ({ page }) => {
    const { errosDaPagina } = await abrirMarca(page, largura,
      erroApi(422, 'Marca inválida.', 'MARCA_INVALIDA', [{ field: 'redesSociais.x', message: 'Use @usuário ou o link do perfil no X.' }]));
    await campo(page, 'X').fill('nome com espaço');
    await salvarMarca(page).click();
    await expect(page.getByText('Use @usuário ou o link do perfil no X.')).toBeVisible();
    await expect(campo(page, 'X')).toHaveAttribute('aria-invalid', 'true');
    expect(errosDaPagina).toEqual([]);
  });

  test(`Conta do aluno (${largura}): só as redes preenchidas, e cada uma abre fora do app`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await interceptarRedes(context);
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      ...(await sessao(page, ALUNO, { redesSociaisDaConsultoria: { instagram: 'https://www.instagram.com/consultoria.ficticia', youtube: 'https://www.youtube.com/@ficticia', site: 'https://consultoria-ficticia.test' } })),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    const instagram = page.getByRole('button', { name: 'Abrir Instagram', exact: true });
    await expect(instagram).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir YouTube', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir site', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir (TikTok|X)$/ })).toHaveCount(0);
    // Alvo de 44 px.
    const caixa = (await instagram.boundingBox())!;
    expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
    await instagram.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([page.waitForEvent('popup'), instagram.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://www.instagram.com/consultoria.ficticia');
    // Pelo teclado também: foco no botão e Enter abre o mesmo link.
    const youtube = page.getByRole('button', { name: 'Abrir YouTube', exact: true });
    // Chega pelo Tab (o foco de teclado acende o anel do `:focus-visible`).
    await youtube.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(youtube).toBeFocused();
    if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/redes-foco-${largura}.png` });
    const [pelaTecla] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
    await pelaTecla.waitForLoadState();
    expect(pelaTecla.url()).toBe('https://www.youtube.com/@ficticia');
    expect(errosDaPagina).toEqual([]);
  });

  test(`Conta do aluno (${largura}): sem redes, nenhum bloco`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    await expect(page.getByRole('link', { name: /^Ajuda/ })).toBeVisible();
    await expect(page.getByText('Redes da consultoria')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Abrir / })).toHaveCount(0);
  });
}

test('Meus dados: lê com o @, edita Instagram e TikTok e manda os dois', async ({ page }) => {
  const estado = { atual: { ...MEUS_DADOS_VAZIOS, instagram: 'aluno.ficticio', tiktok: null, versao: 2 } as MeusDadosResponse };
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    'GET /aluno/meus-dados': (_p, route) => json(route, estado.atual),
    'PUT /aluno/meus-dados': (p, route) => {
      const c = p.corpo as MeusDadosRequest;
      const usuario = (t: string | null) => (t ? t.replace(/^@/, '').replace(/^https:\/\/www\.tiktok\.com\/@/, '') : null);
      estado.atual = { ...estado.atual, instagram: usuario(c.instagram), tiktok: usuario(c.tiktok), versao: estado.atual.versao + 1 };
      return json(route, estado.atual);
    },
  });
  await page.goto('/aluno/conta');
  await page.getByRole('button', { name: /^Meus dados/ }).click();
  await expect(page.getByLabel('Instagram: @aluno.ficticio')).toBeVisible();
  await expect(page.getByLabel('TikTok: Não informado')).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Instagram (opcional)')).toHaveValue('@aluno.ficticio');
  await page.getByLabel('TikTok (opcional)').fill('nome com espaço');
  await expect(page.getByText('Use @usuario ou o link do perfil no TikTok.')).toBeVisible();
  await page.getByLabel('TikTok (opcional)').fill('https://www.tiktok.com/@aluno.tt');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
  const corpo = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/meus-dados').at(-1)?.corpo as MeusDadosRequest;
  expect(corpo).toMatchObject({ instagram: '@aluno.ficticio', tiktok: 'https://www.tiktok.com/@aluno.tt', versao: 2 });
  await expect(page.getByLabel('TikTok: @aluno.tt')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: '(45) 99999-8888', objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const SEM_ATUALIZACAO: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
};

async function abrirFicha(page: Page, ficha: AlunoDetalhe, largura = 1280, extra: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER'] })),
    'POST /enderecos/cep/consultar': erroApi(404, 'CEP não encontrado.', 'CEP_NAO_ENCONTRADO'),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: ficha },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: [] } },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    ...extra,
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Contato e endereço', exact: true })).toBeVisible();
  return api;
}

for (const largura of [390, 1280]) {
  test(`ficha (${largura}): linha "Redes sociais" com o texto e os botões, que abrem o perfil fora do app`, async ({ page, context }) => {
    await interceptarRedes(context);
    const { errosDaPagina } = await abrirFicha(page, { ...FICHA, instagram: 'aluno.ficticio', tiktok: 'aluno.tt' }, largura);
    await expect(page.getByLabel('Redes sociais: @aluno.ficticio (Instagram) · @aluno.tt (TikTok)')).toBeVisible();
    const tiktok = page.getByRole('button', { name: `Abrir TikTok de ${ALUNO.nome}`, exact: true });
    const caixa = (await tiktok.boundingBox())!;
    expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
    const [popup] = await Promise.all([page.waitForEvent('popup'), tiktok.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://www.tiktok.com/@aluno.tt');
    expect(errosDaPagina).toEqual([]);
  });
}

test('ficha: sem Instagram nem TikTok (ou sem a permissão de contato, quando a API não manda), a linha não aparece', async ({ page }) => {
  await abrirFicha(page, FICHA);
  await expect(page.getByText('Redes sociais')).toHaveCount(0);
});

test('edição da ficha: só a rede mexida vai no PUT (a outra fica ausente); em branco apaga', async ({ page }) => {
  const { pedidos } = await abrirFicha(page, { ...FICHA, instagram: 'aluno.ficticio', tiktok: 'aluno.tt' }, 1280, {
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => json(route, { ...FICHA, ...(p.corpo as object), instagram: null, tiktok: 'aluno.tt' }),
  });
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await expect(page.getByLabel('Instagram (opcional)')).toHaveValue('@aluno.ficticio');
  await page.getByLabel('Instagram (opcional)').fill('');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`)?.corpo as Record<string, unknown>;
  expect(corpo.instagram).toBe('');
  expect('tiktok' in corpo).toBe(false);
});

test('cadastro: o Instagram digitado vai no POST; o TikTok vazio não vai', async ({ page }) => {
  const NOVO_ID = 'a0000000-0000-4000-8000-000000000009';
  const NOVO: AlunoDetalhe = { ...FICHA, id: NOVO_ID, nome: 'Aluno Novo Fictício', telefone: null, versao: 0 };
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'POST /alunos': { corpo: NOVO },
    [`GET /alunos/${NOVO_ID}`]: { corpo: NOVO },
  });
  await page.goto('/treinador/alunos/novo');
  await page.getByLabel('Nome', { exact: true }).fill('Aluno Novo Fictício');
  await page.getByLabel('Instagram (opcional)').fill('https://www.instagram.com/aluno.novo/');
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${NOVO_ID}$`));
  const corpo = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/alunos')?.corpo as Record<string, unknown>;
  expect(corpo.instagram).toBe('https://www.instagram.com/aluno.novo/');
  expect('tiktok' in corpo).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
