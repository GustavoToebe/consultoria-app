import { expect, test, type Page, type Route } from '@playwright/test';

import type { LoginResponse, UsuarioResumo } from '../src/api/tipos';
import { ALUNO, erroApi, json, MARCA, sessao, simularApi, TREINADOR, type Resposta } from './api-falsa';

/*
 * Entrada por público (plano docs/planos/entrada-por-publico.md): `/aluno/entrar` e `/treinador/entrar` abrem o
 * formulário sem login e sem a escolha "Sou aluno/Sou treinador"; `/entrar` tem as duas opções. A URL só diz a área
 * desejada: depois do login a área abre pelo papel da conta, com aviso se a entrada era a do outro público. API
 * simulada, só dados fictícios, sem capturas salvas.
 */

const ENTRADAS = [
  { caminho: '/aluno/entrar', titulo: 'Entre na sua área de aluno', subtitulo: 'Acesse seus treinos, alimentação e acompanhamento.',
    convite: '/convite', outra: 'É treinador? Acessar painel da consultoria', outraHref: '/treinador/entrar' },
  { caminho: '/treinador/entrar', titulo: 'Acesse sua consultoria', subtitulo: 'Organize planejamentos e acompanhe seus alunos.',
    convite: '/convite-equipe', outra: 'É aluno? Acessar minha área', outraHref: '/aluno/entrar' },
] as const;

const EMAIL = 'pessoa.ficticia@exemplo.com';
const SENHA = 'senha-ficticia-1';

const campoEmail = (page: Page) => page.getByLabel('E-mail', { exact: true });
const campoSenha = (page: Page) => page.getByLabel('Senha', { exact: true });
const botaoEntrar = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true });

function login(usuario: UsuarioResumo): Resposta {
  const corpo: LoginResponse = { accessToken: 'token-falso', expiresIn: 900, usuario, marca: MARCA };
  return { corpo };
}

/** Nenhum elemento passa da largura da janela (a rolagem da web é a do contêiner do React Native Web, não só a do documento). */
async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    let maior = document.documentElement.scrollWidth - largura;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const caixa = el.getBoundingClientRect();
      if (caixa.width > 0) maior = Math.max(maior, Math.round(caixa.right - largura));
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && getComputedStyle(el).overflowX !== 'visible') {
        maior = Math.max(maior, el.scrollWidth - el.clientWidth);
      }
    }
    return maior;
  });
  expect(sobra).toBeLessThanOrEqual(0);
}

async function topo(page: Page, alvo: ReturnType<Page['getByRole']>) {
  const caixa = await alvo.boundingBox();
  expect(caixa).not.toBeNull();
  return caixa!.y;
}

for (const largura of [390, 768, 1280, 1920]) {
  for (const tema of ['light', 'dark'] as const) {
    test(`composição das duas entradas e da escolha em ${largura} px, ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.emulateMedia({ colorScheme: tema });
      const { errosDaPagina } = await simularApi(page);
      for (const e of ENTRADAS) {
        await page.goto(e.caminho);
        const titulo = page.getByRole('heading', { level: 1, name: e.titulo });
        await expect(titulo).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${e.caminho}$`));
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page.getByText(e.subtitulo, { exact: true })).toBeVisible();
        // Sem a escolha antiga e sem a frase da senha enviada pelo treinador.
        await expect(page.getByRole('radiogroup')).toHaveCount(0);
        await expect(page.getByText('Sou aluno', { exact: true })).toHaveCount(0);
        await expect(page.getByText(/senha que seu treinador enviou/)).toHaveCount(0);

        // Ordem: marca, título, e-mail, senha, "Esqueci", Entrar, convite, outra entrada, termos.
        const ordem = [
          page.getByRole('img', { name: 'Overtraining' }),
          titulo,
          campoEmail(page),
          campoSenha(page),
          page.getByRole('link', { name: 'Esqueci minha senha' }),
          botaoEntrar(page),
          page.getByRole('link', { name: 'Primeiro acesso? Ativar convite' }),
          page.getByRole('link', { name: e.outra }),
          page.getByRole('link', { name: 'Privacidade', exact: true }),
        ];
        const ys: number[] = [];
        for (const alvo of ordem) ys.push(await topo(page, alvo as ReturnType<Page['getByRole']>));
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        // "Esqueci" logo abaixo da senha, antes do botão.
        const senha = (await campoSenha(page).boundingBox())!;
        const esqueci = (await page.getByRole('link', { name: 'Esqueci minha senha' }).boundingBox())!;
        expect(esqueci.y - (senha.y + senha.height)).toBeLessThan(40);
        // Largura controlada: o formulário não estica além da coluna pública.
        expect(senha.width).toBeLessThanOrEqual(440);
        await semRolagemHorizontal(page);
      }

      await page.goto('/entrar');
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Área do aluno' })).toHaveAttribute('href', '/aluno/entrar');
      await expect(page.getByRole('link', { name: 'Painel da consultoria' })).toHaveAttribute('href', '/treinador/entrar');
      await expect(campoEmail(page)).toHaveCount(0);
      await semRolagemHorizontal(page);

      const fundo = await page.getByTestId('raiz-do-tema').evaluate((el) => getComputedStyle(el).backgroundColor);
      const soma = (fundo.match(/\d+/g) ?? []).slice(0, 3).reduce((s, n) => s + Number(n), 0);
      if (tema === 'dark') expect(soma).toBeLessThan(200);
      else expect(soma).toBeGreaterThan(600);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('390 x 600: começo e fim das entradas alcançáveis pela rolagem, sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await simularApi(page);
  for (const e of ENTRADAS) {
    await page.goto(e.caminho);
    const marca = page.getByRole('img', { name: 'Overtraining' });
    await expect(marca).toBeInViewport();
    const fim = page.getByRole('link', { name: 'Termos de uso', exact: true });
    await fim.scrollIntoViewIfNeeded();
    await expect(fim).toBeInViewport();
    await expect(page.getByRole('link', { name: e.outra })).toBeVisible();
    await marca.scrollIntoViewIfNeeded();
    await expect(marca).toBeInViewport();
    await semRolagemHorizontal(page);
  }
});

test('/entrar: as duas opções abrem cada formulário; os links trocam de entrada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina, naoTratadas } = await simularApi(page, {
    'GET /publico/configuracao': { corpo: { verificacaoHumana: false, siteKey: '', cadastroAberto: true } },
  });
  const naEntrada = async (i: 0 | 1) => {
    await expect(page).toHaveURL(new RegExp(`${ENTRADAS[i].caminho}$`));
    await expect(page.getByRole('heading', { level: 1, name: ENTRADAS[i].titulo })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  };
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Área do aluno' }).click();
  await naEntrada(0);
  await expect(page.getByRole('link', { name: 'Primeiro acesso? Ativar convite' })).toHaveAttribute('href', '/convite');
  // Criar conta de treinador só na entrada do treinador, e só com o cadastro aberto.
  await expect(page.getByRole('link', { name: 'Criar conta de treinador' })).toHaveCount(0);

  await page.getByRole('link', { name: ENTRADAS[0].outra }).click();
  await naEntrada(1);
  await expect(page.getByRole('link', { name: 'Primeiro acesso? Ativar convite' })).toHaveAttribute('href', '/convite-equipe');
  await expect(page.getByRole('link', { name: 'Criar conta de treinador' })).toHaveAttribute('href', '/cadastro');

  await page.getByRole('link', { name: ENTRADAS[1].outra }).click();
  await naEntrada(0);
  // O voltar do navegador percorre as entradas sem quebrar a tela.
  await page.goBack();
  await naEntrada(1);
  await page.goBack();
  await naEntrada(0);
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Painel da consultoria' }).click();
  await naEntrada(1);
  expect(naoTratadas).toEqual([]);
});

test('"Sair" do aluno volta à entrada do aluno', async ({ page }) => {
  const { errosDaPagina } = await simularApi(page, { ...(await sessao(page, ALUNO)), 'POST /auth/logout': { status: 204 } });
  await page.goto('/aluno/conta');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/aluno\/entrar$/);
  await expect(page.getByRole('heading', { level: 1, name: ENTRADAS[0].titulo })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('sem cadastro aberto, a entrada do treinador não oferece criar conta', async ({ page }) => {
  await simularApi(page);
  await page.goto('/treinador/entrar');
  await expect(page.getByRole('heading', { level: 1, name: ENTRADAS[1].titulo })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta de treinador' })).toHaveCount(0);
});

test('área protegida sem login leva à entrada do público dela', async ({ page }) => {
  await simularApi(page);
  await page.goto('/aluno/historico');
  await expect(page).toHaveURL(/\/aluno\/entrar$/);
  await page.goto('/treinador/alunos');
  await expect(page).toHaveURL(/\/treinador\/entrar$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('link', { name: 'Área do aluno' })).toBeVisible();
});

test('envio: Enter e clique não duplicam o login; erro de credencial genérico e falha de conexão preservam o e-mail', async ({ page }) => {
  let soltar: (() => void) | null = null;
  let modo: 'segurar' | 'rede' = 'segurar';
  const { pedidos, errosDaPagina } = await simularApi(page, {
    'POST /auth/login': async (_p, route: Route) => {
      if (modo === 'rede') return route.abort('internetdisconnected');
      await new Promise<void>((r) => { soltar = r; });
      return json(route, erroApi(401, 'E-mail ou senha incorretos.').corpo, 401);
    },
  });
  const logins = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/auth/login');
  await page.goto('/aluno/entrar');
  await campoEmail(page).fill(EMAIL);
  await campoSenha(page).fill(SENHA);
  await campoSenha(page).press('Enter');
  await campoSenha(page).press('Enter');
  await botaoEntrar(page).click({ force: true });
  await expect(botaoEntrar(page)).toBeDisabled();
  await expect.poll(() => logins().length).toBe(1);
  await page.waitForTimeout(300);
  expect(logins()).toHaveLength(1);
  soltar!();

  // A mensagem é a do servidor, igual nas duas entradas: nada diz se o e-mail existe nem o papel dele.
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
  await expect(botaoEntrar(page)).toBeEnabled();
  await expect(campoEmail(page)).toHaveValue(EMAIL);

  modo = 'rede';
  await botaoEntrar(page).click();
  await expect(page.getByRole('alert')).toContainText('Sem conexão com o servidor. Confira a internet e tente de novo.');
  await expect(campoEmail(page)).toHaveValue(EMAIL);
  await expect(botaoEntrar(page)).toBeEnabled();
  expect(logins()).toHaveLength(2);
  expect(errosDaPagina).toEqual([]);
});

test('verificação de segurança que não carrega: botão espera com o motivo, Enter não envia e "Tentar de novo" solta', async ({ page }) => {
  let ligada = true;
  let consultas = 0;
  const { pedidos, errosDaPagina } = await simularApi(page, {
    'GET /publico/configuracao': (_p, route) => {
      consultas += 1;
      return json(route, { verificacaoHumana: ligada, siteKey: 'chave-ficticia-0000', cadastroAberto: false });
    },
  });
  await page.goto('/treinador/entrar');
  // O script da Cloudflare não carrega (o teste bloqueia hosts externos): o widget avisa e oferece tentar de novo.
  await expect(page.getByText('Não foi possível carregar a verificação de segurança.')).toBeVisible();
  const verificando = page.getByRole('button', { name: 'Verificando…' });
  await expect(verificando).toBeDisabled();
  await expect(page.getByText('Confirmando que você é uma pessoa.')).toBeVisible();
  await campoEmail(page).fill(EMAIL);
  await campoSenha(page).fill(SENHA);
  await campoSenha(page).press('Enter');
  await expect.poll(() => consultas).toBeGreaterThanOrEqual(2);
  expect(pedidos.filter((p) => p.caminho === '/auth/login')).toHaveLength(0);

  // A verificação foi desligada no servidor: tentar de novo confere a configuração e solta o botão.
  ligada = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(botaoEntrar(page)).toBeEnabled();
  await expect(page.getByText('Não foi possível carregar a verificação de segurança.')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('mostrar senha: nome fixo, estado em aria-pressed e preenchimento automático nos campos', async ({ page }) => {
  await simularApi(page);
  await page.goto('/aluno/entrar');
  await expect(campoEmail(page)).toHaveAttribute('autocomplete', 'email');
  await expect(campoEmail(page)).toHaveAttribute('inputmode', 'email');
  await expect(campoSenha(page)).toHaveAttribute('autocomplete', 'current-password');
  await expect(campoSenha(page)).toHaveJSProperty('type', 'password');
  const olho = page.getByRole('button', { name: 'Mostrar senha' });
  await expect(olho).toHaveAttribute('aria-pressed', 'false');
  await campoSenha(page).fill(SENHA);
  await olho.click();
  await expect(olho).toHaveAttribute('aria-pressed', 'true');
  await expect(campoSenha(page)).toHaveJSProperty('type', 'text');
  await expect(campoSenha(page)).toHaveValue(SENHA);
  // Teclado: o olho é alcançável e alterna com Enter.
  await olho.focus();
  await page.keyboard.press('Enter');
  await expect(olho).toHaveAttribute('aria-pressed', 'false');
  await expect(campoSenha(page)).toHaveJSProperty('type', 'password');
});

for (const caso of [
  { entrada: '/aluno/entrar', conta: TREINADOR, area: /\/treinador$/, aviso: 'Sua conta é do painel da consultoria. Abrimos a área certa.' },
  { entrada: '/treinador/entrar', conta: ALUNO, area: /\/aluno$/, aviso: 'Sua conta é da área do aluno. Abrimos a área certa.' },
  { entrada: '/aluno/entrar', conta: ALUNO, area: /\/aluno$/, aviso: null },
  { entrada: '/treinador/entrar', conta: TREINADOR, area: /\/treinador$/, aviso: null },
]) {
  test(`login de ${caso.conta.papel} por ${caso.entrada}: abre a área do papel da conta${caso.aviso ? ', com aviso' : ''}`, async ({ page }) => {
    const depois = await sessao(page, caso.conta);
    const { pedidos } = await simularApi(page, {
      ...depois,
      // Abre anônimo (refresh recusado); o papel chega só na resposta do login.
      'POST /auth/refresh': erroApi(401, 'Sessão expirada.'),
      'POST /auth/login': login(caso.conta),
    });
    await page.goto(caso.entrada);
    await campoEmail(page).fill(EMAIL);
    await campoSenha(page).fill(SENHA);
    await botaoEntrar(page).click();
    await expect(page).toHaveURL(caso.area);
    if (caso.aviso) await expect(page.getByText(caso.aviso, { exact: true })).toBeVisible();
    else await expect(page.getByText(/Abrimos a área certa/)).toHaveCount(0);
    // A entrada não vai à API: o corpo do login é o de sempre.
    const corpo = pedidos.find((p) => p.caminho === '/auth/login')?.corpo as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(['email', 'senha']);
  });
}

test('já logado, a entrada do outro público abre a área da conta sem formulário', async ({ page }) => {
  await simularApi(page, await sessao(page, ALUNO));
  await page.goto('/treinador/entrar');
  await expect(page).toHaveURL(/\/aluno$/);
  await expect(campoEmail(page)).toHaveCount(0);
});
