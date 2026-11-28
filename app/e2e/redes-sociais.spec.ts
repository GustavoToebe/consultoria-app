import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import type {
  AlunoDetalhe, AlunoRequest, Atualizacao, ConsultoriaResponse, MeusDadosRequest, MeusDadosResponse, RedeDaConsultoria, RedesSociaisDaConsultoria,
} from '../src/api/tipos';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Redes sociais (T-107, `docs/planos/ajustes-da-tarde-25-11.md`; 26/11, peça única `ui/RedesSociais`): em leitura, a fileira
 * de botões redondos (ficha e Meus dados do aluno, Conta do aluno); em edição, uma linha por rede adicionada e o "Adicionar
 * rede" com as que faltam (cadastro e edição do aluno, Meus dados e Configurações › Contato). Aqui: o PUT/POST só leva o que
 * mudou (o aluno) ou as oito (a consultoria), o link que a API normalizou volta ao campo, o 422 cai no campo e cada botão abre
 * fora do app. Só dados fictícios; os hosts das redes são interceptados (nada sai para a rede de verdade).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const BASE: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const SEM_REDES: RedesSociaisDaConsultoria = { instagram: null, tiktok: null, youtube: null, x: null, site: null, facebook: null, linkedin: null, telegram: null };
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

/** Os hosts das redes respondem uma página vazia: o popup abre sem sair para a internet. */
async function interceptarRedes(context: BrowserContext) {
  for (const host of [
    'https://www.instagram.com/**', 'https://www.tiktok.com/**', 'https://www.youtube.com/**', 'https://www.facebook.com/**', 'https://www.linkedin.com/**',
    'https://t.me/**', 'https://x.com/**', 'https://consultoria-ficticia.test/**', 'https://wa.me/**',
  ]) {
    await context.route(host, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Rede</title>' }));
  }
}

/** O campo da peça de edição: o nome acessível é "<Rede>: @usuário ou link" ("Site: link"). */
const campo = (page: Page, rede: string) =>
  page.getByRole('textbox', { name: `${rede}: ${rede === 'Site' ? 'link' : '@usuário ou link'}`, exact: true });
const botaoAdicionar = (page: Page) => page.getByRole('button', { name: 'Adicionar rede', exact: true });
const botaoDe = (page: Page, nome: string, de?: string) => page.getByRole('button', { name: `Abrir ${nome}${de ? ` de ${de}` : ''}`, exact: true });

/** "Adicionar rede" → escolhe a rede no menu; ela entra com o foco no campo. */
async function adicionarRede(page: Page, rede: string) {
  await botaoAdicionar(page).click();
  await page.getByRole('menuitem', { name: rede, exact: true }).click();
  await expect(campo(page, rede)).toBeFocused();
}

/** O desenho mínimo de um botão de rede: alvo de 44 px. */
async function alvoDe44(botao: Locator) {
  const caixa = (await botao.boundingBox())!;
  expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
  return caixa;
}

/** O que a API devolveria para o que o app mandou: `@usuário` e link viram o link https canônico. */
const NORMALIZADA: Record<RedeDaConsultoria, string> = {
  instagram: 'https://www.instagram.com/consultoria.ficticia', tiktok: 'https://www.tiktok.com/@ficticia', youtube: 'https://www.youtube.com/@ficticia',
  facebook: 'https://www.facebook.com/ficticia', linkedin: 'https://www.linkedin.com/company/ficticia', telegram: 'https://t.me/ficticia',
  x: 'https://x.com/ficticia', site: 'https://consultoria-ficticia.test',
};

// ---- Configurações › Contato (as oito redes da consultoria) ----

async function abrirMarca(page: Page, largura: number, put: RespostasApi[string], consultoria: ConsultoriaResponse = BASE) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
    'PUT /consultoria/marca': put,
  });
  await page.goto('/treinador/configuracoes/contato');
  await expect(page.getByRole('heading', { name: 'Redes sociais' })).toBeVisible();
  return api;
}

const salvarMarca = (page: Page) => page.getByRole('button', { name: 'Salvar contato', exact: true });
const putDaMarca = (pedidos: PedidoFalso[]) => pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca');

const DIGITADO: Record<string, string> = {
  Instagram: '@consultoria.ficticia', TikTok: '@ficticia', YouTube: '@ficticia', Facebook: 'facebook.com/ficticia',
  LinkedIn: 'linkedin.com/company/ficticia', Telegram: '@ficticia', X: '@ficticia', Site: 'consultoria-ficticia.test',
};
const CHAVE_DA_REDE: Record<string, RedeDaConsultoria> = {
  Instagram: 'instagram', TikTok: 'tiktok', YouTube: 'youtube', Facebook: 'facebook', LinkedIn: 'linkedin', Telegram: 'telegram', X: 'x', Site: 'site',
};

for (const largura of [390, 1280]) {
  test(`Configurações › Contato (${largura}): sem rede só o "Adicionar rede"; as oito entram, vão no PUT e voltam normalizadas`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrirMarca(page, largura, (p, route) => {
      const enviado = (p.corpo as { redesSociais: Record<RedeDaConsultoria, string> }).redesSociais;
      return json(route, { ...BASE, versao: 4, redesSociais: Object.fromEntries(Object.entries(enviado).map(([r, v]) => [r, v ? NORMALIZADA[r as RedeDaConsultoria] : null])) });
    });
    // Nenhuma gravada: nenhuma linha de rede, só o botão.
    await expect(page.getByRole('textbox', { name: /: (@usuário ou )?link$/ })).toHaveCount(0);
    await expect(botaoAdicionar(page)).toBeVisible();
    await expect(salvarMarca(page)).toHaveCount(0);

    // O menu oferece as oito, na ordem fixa; Esc fecha e o foco volta ao botão.
    await botaoAdicionar(page).click();
    await expect(page.getByRole('menuitem')).toHaveText(Object.keys(DIGITADO));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(botaoAdicionar(page)).toBeFocused();

    for (const [rede, texto] of Object.entries(DIGITADO)) {
      await adicionarRede(page, rede);
      await campo(page, rede).fill(texto);
    }
    // Com as oito na tela, o botão some.
    await expect(botaoAdicionar(page)).toHaveCount(0);
    await salvarMarca(page).click();
    await expect(page.getByText('Contato salvo.', { exact: true })).toBeVisible();
    expect(putDaMarca(pedidos)?.corpo).toMatchObject({ redesSociais: Object.fromEntries(Object.entries(DIGITADO).map(([r, v]) => [CHAVE_DA_REDE[r], v])) });
    // Cada campo passa a mostrar o link gravado, e nada fica por salvar.
    for (const rede of Object.keys(DIGITADO)) await expect(campo(page, rede)).toHaveValue(NORMALIZADA[CHAVE_DA_REDE[rede]!]);
    await expect(salvarMarca(page)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Configurações › Contato (${largura}): remover uma rede manda ela em branco e as outras como estão`, async ({ page }) => {
    const gravadas = { ...SEM_REDES, instagram: NORMALIZADA.instagram, site: NORMALIZADA.site, telegram: NORMALIZADA.telegram };
    const { pedidos, errosDaPagina } = await abrirMarca(page, largura,
      (_p, route) => json(route, { ...BASE, versao: 4, redesSociais: { ...gravadas, instagram: null } }), { ...BASE, redesSociais: gravadas });
    await expect(campo(page, 'Instagram')).toHaveValue(NORMALIZADA.instagram);
    await expect(campo(page, 'Telegram')).toHaveValue(NORMALIZADA.telegram);
    await expect(campo(page, 'Site')).toHaveValue(NORMALIZADA.site);
    await page.getByRole('button', { name: 'Remover Instagram', exact: true }).click();
    await expect(campo(page, 'Instagram')).toHaveCount(0);
    await salvarMarca(page).click();
    await expect(page.getByText('Contato salvo.', { exact: true })).toBeVisible();
    expect((putDaMarca(pedidos)?.corpo as { redesSociais: unknown }).redesSociais).toEqual({
      instagram: '', tiktok: '', youtube: '', facebook: '', linkedin: '', telegram: NORMALIZADA.telegram, x: '', site: NORMALIZADA.site,
    });
    await expect(campo(page, 'Instagram')).toHaveCount(0);
    await expect(campo(page, 'Site')).toHaveValue(NORMALIZADA.site);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Configurações › Contato (${largura}): o 422 MARCA_INVALIDA de uma rede cai no campo dela`, async ({ page }) => {
    const { errosDaPagina } = await abrirMarca(page, largura,
      erroApi(422, 'Marca inválida.', 'MARCA_INVALIDA', [{ field: 'redesSociais.x', message: 'Use @usuário ou o link do perfil no X.' }]));
    await adicionarRede(page, 'X');
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
      ...(await sessao(page, ALUNO, { redesSociaisDaConsultoria: { instagram: NORMALIZADA.instagram, youtube: 'https://www.youtube.com/@ficticia', site: NORMALIZADA.site } })),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    const instagram = botaoDe(page, 'Instagram');
    await expect(instagram).toBeVisible();
    await expect(botaoDe(page, 'YouTube')).toBeVisible();
    await expect(botaoDe(page, 'site')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir (TikTok|X|Facebook|LinkedIn|Telegram)$/ })).toHaveCount(0);
    await alvoDe44(instagram);
    await instagram.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([page.waitForEvent('popup'), instagram.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(NORMALIZADA.instagram);
    // Pelo teclado também: foco no botão e Enter abre o mesmo link.
    const youtube = botaoDe(page, 'YouTube');
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

  test(`Conta do aluno (${largura}): as oito redes da consultoria, na ordem, cada uma num alvo de 44 px`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await interceptarRedes(context);
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      ...(await sessao(page, ALUNO, { redesSociaisDaConsultoria: NORMALIZADA })),
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    });
    await page.goto('/aluno/conta');
    await expect(page.getByRole('heading', { level: 2, name: 'Sua consultoria' })).toBeVisible();
    const nomes = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Telegram', 'X', 'site'];
    await expect(page.getByRole('button', { name: /^Abrir (Instagram|TikTok|YouTube|Facebook|LinkedIn|Telegram|X|site)$/ })).toHaveCount(8);
    let anterior = -1;
    for (const nome of nomes) {
      const botao = botaoDe(page, nome);
      await botao.scrollIntoViewIfNeeded();
      const caixa = await alvoDe44(botao);
      // Ordem de leitura: a linha de baixo vem depois da de cima, e na mesma linha da esquerda para a direita.
      const ordem = caixa.y * 10000 + caixa.x;
      expect(ordem).toBeGreaterThan(anterior);
      anterior = ordem;
      // Cabe na janela: nada cortado pela borda.
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);
    }
    const [popup] = await Promise.all([page.waitForEvent('popup'), botaoDe(page, 'Telegram').click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://t.me/ficticia');
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
    // Sem WhatsApp nem redes, o cartão "Sua consultoria" não existe (nem vazio).
    await expect(page.getByTestId('secao-consultoria')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Abrir / })).toHaveCount(0);
  });
}

// ---- Meus dados do aluno ----

/** O que a API grava do aluno: Instagram e TikTok só o usuário; as outras, o link https. */
const usuarioDe = (t: string | null | undefined, host: RegExp) => (t ? t.replace(host, '').replace(/^@/, '').replace(/\/$/, '') : null);
const linkDe = (t: string | null | undefined) => (t ? (/^https?:\/\//.test(t) ? t : `https://www.${t}`) : null);

function rotasDeMeusDados(estado: { atual: MeusDadosResponse }): RespostasApi {
  return {
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    'GET /aluno/meus-dados': (_p, route) => json(route, estado.atual),
    'PUT /aluno/meus-dados': (p, route) => {
      const c = p.corpo as MeusDadosRequest;
      estado.atual = {
        ...estado.atual, instagram: usuarioDe(c.instagram, /^https:\/\/www\.instagram\.com\//), tiktok: usuarioDe(c.tiktok, /^https:\/\/www\.tiktok\.com\/@?/),
        youtube: linkDe(c.youtube), facebook: linkDe(c.facebook), linkedin: linkDe(c.linkedin), telegram: linkDe(c.telegram), versao: estado.atual.versao + 1,
      };
      return json(route, estado.atual);
    },
  };
}

for (const largura of [390, 1280]) {
  test(`Meus dados (${largura}): a leitura mostra as redes como botões; a edição adiciona o TikTok e manda as seis`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await interceptarRedes(context);
    const estado = { atual: { ...MEUS_DADOS_VAZIOS, instagram: 'aluno.ficticio', youtube: 'https://www.youtube.com/@aluno', versao: 2 } as MeusDadosResponse };
    const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoDeAluno(page)), ...rotasDeMeusDados(estado) });
    await page.goto('/aluno/conta');
    await page.getByRole('button', { name: /^Meus dados/ }).click();
    const folha = page.getByRole('dialog', { name: 'Meus dados' });
    // Leitura: título, a dica de privacidade (uma só) e os botões das redes que existem, sem o "de <nome>".
    await expect(folha.getByRole('heading', { name: 'Redes sociais', exact: true })).toBeVisible();
    await expect(folha.getByText('Só a sua consultoria vê.')).toHaveCount(1);
    await expect(botaoDe(page, 'Instagram')).toBeVisible();
    await expect(botaoDe(page, 'YouTube')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir (TikTok|Facebook|LinkedIn|Telegram)/ })).toHaveCount(0);
    await alvoDe44(botaoDe(page, 'Instagram'));
    const [popup] = await Promise.all([page.waitForEvent('popup'), botaoDe(page, 'Instagram').click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://www.instagram.com/aluno.ficticio');

    // Edição: Instagram com o @ na frente, YouTube com o link; o TikTok entra pelo menu.
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(campo(page, 'Instagram')).toHaveValue('@aluno.ficticio');
    await expect(campo(page, 'YouTube')).toHaveValue('https://www.youtube.com/@aluno');
    await expect(campo(page, 'Site')).toHaveCount(0);
    await botaoAdicionar(page).click();
    await expect(page.getByRole('menuitem')).toHaveText(['TikTok', 'Facebook', 'LinkedIn', 'Telegram']);
    await page.getByRole('menuitem', { name: 'TikTok', exact: true }).click();
    await expect(campo(page, 'TikTok')).toBeFocused();
    await campo(page, 'TikTok').fill('nome com espaço');
    await expect(page.getByText('Use @usuario ou o link do perfil no TikTok.')).toBeVisible();
    await campo(page, 'TikTok').fill('https://www.tiktok.com/@aluno.tt');
    await expect(page.getByText('Use @usuario ou o link do perfil no TikTok.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
    const corpo = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/meus-dados').at(-1)?.corpo as MeusDadosRequest;
    expect(corpo).toMatchObject({
      instagram: '@aluno.ficticio', tiktok: 'https://www.tiktok.com/@aluno.tt', youtube: 'https://www.youtube.com/@aluno', facebook: '', linkedin: '', telegram: '', versao: 2,
    });
    // De volta à leitura, o TikTok virou botão.
    await expect(botaoDe(page, 'TikTok')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`Meus dados (${largura}): sem rede, a leitura não tem a seção e a edição oferece o "Adicionar rede"`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = { atual: { ...MEUS_DADOS_VAZIOS, versao: 1 } as MeusDadosResponse };
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoDeAluno(page)), ...rotasDeMeusDados(estado) });
    await page.goto('/aluno/conta');
    await page.getByRole('button', { name: /^Meus dados/ }).click();
    const folha = page.getByRole('dialog', { name: 'Meus dados' });
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(folha.getByRole('heading', { name: 'Redes sociais', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(folha.getByRole('heading', { name: 'Redes sociais', exact: true })).toBeVisible();
    await expect(botaoAdicionar(page)).toBeVisible();
    await expect(page.getByRole('textbox', { name: /: @usuário ou link$/ })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- Ficha do aluno (treinador) ----

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: '(45) 99999-8888', objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const COM_TRES_REDES: AlunoDetalhe = { ...FICHA, instagram: 'aluno.ficticio', tiktok: 'aluno.tt', youtube: 'https://www.youtube.com/@aluno' };
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

/** O servidor falso do `PUT /alunos/{id}`: ausente não mexe, em branco apaga, o resto grava (Instagram e TikTok só o usuário). */
function gravarAluno(anterior: AlunoDetalhe, c: AlunoRequest): AlunoDetalhe {
  const campo = (rede: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'telegram') => {
    const v = c[rede];
    if (v === undefined || v === null) return anterior[rede] ?? null;
    if (v === '') return null;
    return rede === 'instagram' || rede === 'tiktok' ? usuarioDe(v, /^(https:\/\/)?(www\.)?(instagram|tiktok)\.com\/@?/) : linkDe(v);
  };
  return {
    ...anterior, versao: anterior.versao + 1, instagram: campo('instagram'), tiktok: campo('tiktok'), youtube: campo('youtube'),
    facebook: campo('facebook'), linkedin: campo('linkedin'), telegram: campo('telegram'),
  };
}

for (const largura of [390, 1280]) {
  test(`ficha (${largura}): cartão "Redes sociais" com 3 redes e o WhatsApp na fileira, logo abaixo do Contato`, async ({ page, context }) => {
    await interceptarRedes(context);
    const { errosDaPagina } = await abrirFicha(page, COM_TRES_REDES, largura);
    const titulo = page.getByRole('heading', { name: 'Redes sociais', exact: true });
    await expect(titulo).toBeVisible();
    const contato = (await page.getByRole('heading', { name: 'Contato e endereço', exact: true }).boundingBox())!;
    const redes = (await titulo.boundingBox())!;
    // Na mesma coluna (mesma borda esquerda) e depois do Contato.
    expect(Math.abs(redes.x - contato.x)).toBeLessThanOrEqual(1);
    expect(redes.y).toBeGreaterThan(contato.y);

    // WhatsApp primeiro, depois Instagram, TikTok e YouTube: quatro botões de 44 px, numa fileira só, da esquerda para a direita.
    const nome = ALUNO.nome;
    const caixas = [];
    for (const rede of ['WhatsApp', 'Instagram', 'TikTok', 'YouTube']) caixas.push(await alvoDe44(botaoDe(page, rede, nome)));
    for (let i = 1; i < caixas.length; i++) {
      expect(Math.abs(caixas[i]!.y - caixas[0]!.y)).toBeLessThanOrEqual(1);
      expect(caixas[i]!.x).toBeGreaterThan(caixas[i - 1]!.x + caixas[i - 1]!.width - 1);
    }
    // Os botões ficam abaixo do título do cartão, dentro da janela.
    expect(caixas[0]!.y).toBeGreaterThan(redes.y);
    expect(caixas[3]!.x + caixas[3]!.width).toBeLessThanOrEqual(largura);
    // O WhatsApp saiu da linha do telefone: um só na ficha. Copiar telefone e e-mail seguem lá.
    await expect(page.getByRole('button', { name: `Abrir WhatsApp de ${nome}` })).toHaveCount(1);
    await expect(page.getByRole('button', { name: `Copiar telefone de ${nome}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir (Facebook|LinkedIn|Telegram|X|site)/ })).toHaveCount(0);

    // Cada botão abre o perfil certo fora do app.
    const destinos: Record<string, string> = {
      WhatsApp: 'https://wa.me/5545999998888', Instagram: 'https://www.instagram.com/aluno.ficticio',
      TikTok: 'https://www.tiktok.com/@aluno.tt', YouTube: 'https://www.youtube.com/@aluno',
    };
    for (const [rede, url] of Object.entries(destinos)) {
      const [popup] = await Promise.all([page.waitForEvent('popup'), botaoDe(page, rede, nome).click()]);
      await popup.waitForLoadState();
      expect(popup.url()).toBe(url);
      await popup.close();
    }
    expect(errosDaPagina).toEqual([]);
  });

  test(`ficha (${largura}): a dica com o @ aparece no foco e no mouse, dentro da janela, e Esc a dispensa`, async ({ page }) => {
    const { errosDaPagina } = await abrirFicha(page, COM_TRES_REDES, largura);
    const instagram = botaoDe(page, 'Instagram', ALUNO.nome);
    await expect(page.getByText('@aluno.ficticio', { exact: true })).toHaveCount(0);
    await instagram.hover();
    const dica = page.getByText('@aluno.ficticio', { exact: true });
    await expect(dica).toBeVisible();
    const caixa = (await dica.boundingBox())!;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);
    await page.mouse.move(2, 2);
    await expect(dica).toHaveCount(0);
    // Pelo foco do teclado: a dica abre e Esc a fecha sem tirar o foco do botão.
    await instagram.focus();
    await expect(dica).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dica).toHaveCount(0);
    await expect(instagram).toBeFocused();
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  // A dica do primeiro botão (o telefone do WhatsApp, a mais larga) nasce na borda dele e a do último na de trás
  // (`ui/RedesSociais.tsx`, `ancora`): o cartão (`overflow: hidden`) não a corta mais.
  test(`ficha (${largura}): a dica do WhatsApp cabe inteira dentro do cartão "Redes sociais"`, async ({ page }) => {
    await abrirFicha(page, COM_TRES_REDES, largura);
    const titulo = (await page.getByRole('heading', { name: 'Redes sociais', exact: true }).boundingBox())!;
    await botaoDe(page, 'WhatsApp', ALUNO.nome).hover();
    const dica = page.getByText('(45) 99999-8888', { exact: true }).last();
    await expect(dica).toBeVisible();
    const caixa = (await dica.boundingBox())!;
    // O cartão começa 20 px antes do título (o respiro interno).
    expect(caixa.x).toBeGreaterThanOrEqual(titulo.x - 20);
  });
}

test('ficha: sem rede (ou sem a permissão de contato, quando a API não manda), o cartão não aparece e o WhatsApp fica na linha do telefone', async ({ page }) => {
  await abrirFicha(page, FICHA);
  await expect(page.getByRole('heading', { name: 'Redes sociais', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Abrir WhatsApp de ${ALUNO.nome}`, exact: true })).toHaveCount(1);
});

test('ficha: com rede e sem telefone, a fileira não tem WhatsApp', async ({ page }) => {
  await abrirFicha(page, { ...COM_TRES_REDES, telefone: null });
  await expect(page.getByRole('heading', { name: 'Redes sociais', exact: true })).toBeVisible();
  await expect(botaoDe(page, 'Instagram', ALUNO.nome)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Abrir WhatsApp/ })).toHaveCount(0);
});

test('edição da ficha com 3 redes: remover uma e adicionar outra; só essas duas vão no PUT (a mexida; as intactas ficam ausentes)', async ({ page, context }) => {
  await interceptarRedes(context);
  const estado: { atual: AlunoDetalhe } = { atual: COM_TRES_REDES };
  const { pedidos, errosDaPagina } = await abrirFicha(page, COM_TRES_REDES, 1280, {
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => {
      estado.atual = gravarAluno(estado.atual, p.corpo as AlunoRequest);
      return json(route, estado.atual);
    },
  });
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Redes sociais', exact: true })).toBeVisible();
  // As três gravadas, cada uma no seu campo (Instagram e TikTok com o @, YouTube com o link).
  await expect(campo(page, 'Instagram')).toHaveValue('@aluno.ficticio');
  await expect(campo(page, 'TikTok')).toHaveValue('@aluno.tt');
  await expect(campo(page, 'YouTube')).toHaveValue('https://www.youtube.com/@aluno');
  // O menu oferece só as que faltam; Esc fecha.
  await botaoAdicionar(page).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Facebook', 'LinkedIn', 'Telegram']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // Remove o TikTok: a linha some e ele volta ao menu.
  await page.getByRole('button', { name: 'Remover TikTok', exact: true }).click();
  await expect(campo(page, 'TikTok')).toHaveCount(0);
  await botaoAdicionar(page).click();
  await expect(page.getByRole('menuitem')).toHaveText(['TikTok', 'Facebook', 'LinkedIn', 'Telegram']);
  await page.getByRole('menuitem', { name: 'Facebook', exact: true }).click();
  await expect(campo(page, 'Facebook')).toBeFocused();
  await campo(page, 'Facebook').fill('facebook.com/aluno.ficticio');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`)?.corpo as Record<string, unknown>;
  expect(corpo.tiktok).toBe('');
  expect(corpo.facebook).toBe('facebook.com/aluno.ficticio');
  for (const intacta of ['instagram', 'youtube', 'linkedin', 'telegram']) expect(intacta in corpo).toBe(false);

  // De volta à leitura: o TikTok saiu da fileira e o Facebook entrou.
  await expect(botaoDe(page, 'Facebook', ALUNO.nome)).toBeVisible();
  await expect(botaoDe(page, 'Instagram', ALUNO.nome)).toBeVisible();
  await expect(botaoDe(page, 'YouTube', ALUNO.nome)).toBeVisible();
  await expect(botaoDe(page, 'TikTok', ALUNO.nome)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('edição da ficha: só a rede mexida vai no PUT (a outra fica ausente); em branco apaga e o erro de uma rede cai na linha dela', async ({ page }) => {
  const estado: { atual: AlunoDetalhe } = { atual: { ...FICHA, instagram: 'aluno.ficticio', tiktok: 'aluno.tt' } };
  const { pedidos } = await abrirFicha(page, estado.atual, 1280, {
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => {
      estado.atual = gravarAluno(estado.atual, p.corpo as AlunoRequest);
      return json(route, estado.atual);
    },
  });
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await expect(campo(page, 'Instagram')).toHaveValue('@aluno.ficticio');
  await campo(page, 'TikTok').fill('nome com espaço');
  await expect(page.getByText('Use @usuario ou o link do perfil no TikTok.')).toBeVisible();
  await expect(campo(page, 'TikTok')).toHaveAttribute('aria-invalid', 'true');
  await campo(page, 'TikTok').fill('@aluno.tt');
  await campo(page, 'Instagram').fill('');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`)?.corpo as Record<string, unknown>;
  expect(corpo.instagram).toBe('');
  expect('tiktok' in corpo).toBe(false);
});

// ---- Cadastro de aluno novo ----

async function abrirCadastro(page: Page, largura: number) {
  const NOVO_ID = 'a0000000-0000-4000-8000-000000000009';
  const NOVO: AlunoDetalhe = { ...FICHA, id: NOVO_ID, nome: 'Aluno Novo Fictício', telefone: null, versao: 0 };
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'POST /alunos': { corpo: NOVO },
    [`GET /alunos/${NOVO_ID}`]: { corpo: NOVO },
  });
  await page.goto('/treinador/alunos/novo');
  await expect(page.getByRole('heading', { name: 'Redes sociais', exact: true })).toBeVisible();
  return { ...api, NOVO_ID };
}

test('cadastro: o cartão nasce só com o "Adicionar rede"; o Instagram digitado vai no POST e o TikTok vazio não vai', async ({ page }) => {
  const { pedidos, errosDaPagina, NOVO_ID } = await abrirCadastro(page, 1280);
  await expect(page.getByRole('textbox', { name: /: @usuário ou link$/ })).toHaveCount(0);
  await page.getByLabel('Nome', { exact: true }).fill('Aluno Novo Fictício');
  await adicionarRede(page, 'Instagram');
  await campo(page, 'Instagram').fill('https://www.instagram.com/aluno.novo/');
  await adicionarRede(page, 'TikTok');
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${NOVO_ID}$`));
  const corpo = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/alunos')?.corpo as Record<string, unknown>;
  expect(corpo.instagram).toBe('https://www.instagram.com/aluno.novo/');
  expect('tiktok' in corpo).toBe(false);
  expect(errosDaPagina).toEqual([]);
});

test('cadastro (390): as seis redes entram uma a uma, o "Adicionar rede" some e remover devolve a rede ao menu', async ({ page }) => {
  const { errosDaPagina } = await abrirCadastro(page, 390);
  const seis = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Telegram'];
  for (const rede of seis) await adicionarRede(page, rede);
  await expect(botaoAdicionar(page)).toHaveCount(0);
  // Cada campo cabe na janela, sem rolagem lateral.
  for (const rede of seis) {
    const caixa = (await campo(page, rede).boundingBox())!;
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Remover YouTube', exact: true }).click();
  await expect(botaoAdicionar(page)).toBeVisible();
  await botaoAdicionar(page).click();
  await expect(page.getByRole('menuitem')).toHaveText(['YouTube']);
  expect(errosDaPagina).toEqual([]);
});
