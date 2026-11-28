import { expect, test, type Page, type Route } from '@playwright/test';

import type { PreferenciasDoPerfil } from '../src/api/comunidadeTipos';
import type { FinanceiroDoAluno } from '../src/api/financeiroTipos';
import type { MeusDadosResponse } from '../src/api/tipos';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, sessao, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Conta do aluno reorganizada (23/11, `docs/planos/conta-do-aluno.md`): cabeçalho de perfil (foto, nome como os colegas veem,
 * e-mail de acesso, selo do plano), seções na ordem do pedido, os detalhes em folha (lateral no PC) e as duas colunas da
 * web com o cabeçalho fixo. Só dados fictícios; 529.982.247-25 é um CPF de teste válido, sem dono.
 */
const LINK = 'https://exemplo.test/inscricao/codigo-ficticio#indicacao=00000000-0000-4000-8000-0000000000aa';
// Títulos dos cartões na ordem de leitura (28/11); o Perfil não tem título (a foto e o nome são o topo dele).
const ORDEM = ['App', 'Meu plano', 'Convidar um amigo', 'Meus dados', 'Privacidade', 'Segurança'];
const conquista = (tipo: string, titulo: string) => ({ id: `c-${tipo}`, tipo, titulo, descricao: `Conquista fictícia: ${titulo}.`, icone: 'award', conquistadaEm: '2026-11-01T12:00:00-03:00' });
const PERFIL: PreferenciasDoPerfil = {
  perfilReservado: false, reservadoEfetivo: false, destaques: ['PRIMEIRO_TREINO', 'DEZ_TREINOS'], cor: 'ROXO', moldura: 'DUPLA', exibicaoDoNome: 'NOME_E_APELIDO',
  opcoesDeDestaque: [conquista('PRIMEIRO_TREINO', 'Primeiro treino'), conquista('DEZ_TREINOS', 'Dez treinos'), conquista('SEMANA_COMPLETA', 'Semana completa')],
};
const DADOS: MeusDadosResponse = {
  ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste da Silva', telefone: '(45) 99999-8888', cpf: '529.982.247-25', apelido: 'Testinho',
  email: 'cadastro@exemplo.test', emailDeAcesso: ALUNO.email, versao: 2,
};
const FINANCEIRO: FinanceiroDoAluno = {
  plano: { contratacaoId: 'c1', planoNome: 'Plano Trimestral', valorCentavos: 45000, periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', proximoVencimento: '2026-12-05', linkDePagamento: null },
  abertas: [{ id: 'cb1', competencia: '2026-11', vencimento: '2026-11-28', valorCentavos: 45000, situacao: 'ABERTA', vencida: false, forma: null, pagoEm: null, tipo: 'MENSALIDADE' }],
  historico: [], pagamentoOnline: false, formasDePagamento: ['MANUAL'],
};

interface Estado { perfil: PreferenciasDoPerfil; dados: MeusDadosResponse }

async function abrir(page: Page, extra: { financeiro?: FinanceiroDoAluno; dados?: Partial<MeusDadosResponse>; rotas?: RespostasApi } = {}) {
  const estado: Estado = { perfil: { ...PERFIL }, dados: { ...DADOS, ...extra.dados } };
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: '2026-11-10T12:00:00-03:00' } },
    'GET /aluno/meus-dados': (_p: PedidoFalso, route: Route) => json(route, estado.dados),
    'GET /aluno/comunidade/perfil': (_p: PedidoFalso, route: Route) => json(route, estado.perfil),
    'PUT /aluno/comunidade/perfil': (p: PedidoFalso, route: Route) => {
      estado.perfil = { ...estado.perfil, ...(p.corpo as Partial<PreferenciasDoPerfil>) };
      return json(route, estado.perfil);
    },
    'PUT /aluno/comunidade/apelido': (p: PedidoFalso, route: Route) => {
      estado.dados = { ...estado.dados, apelido: (p.corpo as { apelido: string | null }).apelido };
      return route.fulfill({ status: 204 });
    },
    'GET /aluno/indicacao': { corpo: { link: LINK } },
    'GET /aluno/financeiro': { corpo: extra.financeiro ?? FINANCEIRO },
    'GET /aluno/lembretes-de-cobranca': { corpo: { receber: true } },
    ...extra.rotas,
  });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  await expect(page.getByText('Plano Trimestral').or(page.getByText('Você ainda não tem um plano comercial contratado com o seu treinador.'))).toBeVisible();
  return { api, estado };
}

const cabecalho = (page: Page) => page.getByTestId('cabecalho-do-perfil');
const pedidosDe = (pedidos: PedidoFalso[], metodo: string, caminho: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho);

async function semRolagemHorizontal(page: Page) {
  const { rolagem, janela } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth }));
  expect(rolagem).toBeLessThanOrEqual(janela);
}

// Conta do aluno reorganizada (23/11).
for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('cabeçalho de perfil, seções na ordem e o "Meu plano" visível sem abrir', async ({ page }) => {
      const { api } = await abrir(page);
      await expect(cabecalho(page).getByLabel('Nome para os colegas: Aluno (Testinho)')).toBeVisible();
      await expect(cabecalho(page).getByText(ALUNO.email, { exact: true })).toBeVisible();
      await expect(cabecalho(page).getByText('Trimestral · Ativo')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Trocar foto' })).toBeEnabled();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      const titulos = await page.getByRole('heading', { level: 2 }).allTextContents();
      expect(titulos.filter((t) => ORDEM.includes(t))).toEqual(ORDEM);

      // a) Meu plano: plano, valor, próximo vencimento, a cobrança em aberto e o interruptor dos lembretes.
      const plano = page.getByTestId('secao-plano');
      await expect(plano.getByText('Plano Trimestral')).toBeVisible();
      await expect(plano.getByLabel('Próximo vencimento: 05/12/2026')).toBeVisible();
      await expect(plano.getByText('Vence em 28/11/2026')).toBeVisible();
      await expect(plano.getByRole('switch', { name: 'Receber lembretes de pagamento por e-mail' })).toBeChecked();

      // d) Convite: o link não aparece; só copiar e compartilhar.
      await expect(page.getByText(LINK)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Copiar link de convite' })).toBeVisible();

      // e) Privacidade: uso das fotos com o estado e os termos.
      await expect(page.getByRole('switch', { name: /^Autorizo a consultoria/ })).toBeChecked();
      await expect(page.getByText('Autorizado em 10/11/2026')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Termos e privacidade' })).toBeVisible();

      // g) App: sincronização com o selo e o botão à direita; Ajuda.
      const app = page.getByTestId('secao-app');
      await expect(app.getByText('Sincronizado', { exact: true })).toBeVisible();
      await expect(app.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible();
      await expect(app.getByRole('link', { name: /^Ajuda/ })).toBeVisible();

      // Perfil num cartão só: a linha "Perfil na comunidade" com o apelido, sem o resumo antigo dos destaques.
      await expect(page.getByRole('button', { name: 'Perfil na comunidade, Testinho' })).toBeVisible();
      await expect(page.getByText(/Apelido: /)).toHaveCount(0);

      // h) Excluir minha conta: a última linha de Segurança, com a descrição, e a mesma confirmação.
      const seguranca = page.getByTestId('secao-seguranca');
      const excluir = seguranca.getByRole('button', { name: 'Excluir minha conta, Apaga os seus dados pessoais desta consultoria. Não tem volta.' });
      await expect(excluir).toBeVisible();
      const linhas = await seguranca.getByRole('button').allTextContents();
      expect(linhas.at(-1)).toContain('Excluir minha conta');
      await excluir.click();
      await expect(page.getByRole('alertdialog', { name: 'Excluir a sua conta?' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();

      // Meus dados é lido uma vez para o cabeçalho, as linhas e as folhas.
      expect(pedidosDe(api.pedidos, 'GET', '/aluno/meus-dados')).toHaveLength(1);
      await semRolagemHorizontal(page);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('sem apelido, a linha do perfil diz "Sem apelido"', async ({ page }) => {
      await abrir(page, { dados: { apelido: null } });
      await expect(page.getByRole('button', { name: 'Perfil na comunidade, Sem apelido' })).toBeVisible();
    });

    test('sem plano contratado, o cabeçalho não tem selo', async ({ page }) => {
      await abrir(page, { financeiro: { ...FINANCEIRO, plano: null, abertas: [] } });
      await expect(cabecalho(page).getByText(/ · /)).toHaveCount(0);
      await expect(cabecalho(page).getByLabel('Nome para os colegas: Aluno (Testinho)')).toBeVisible();
    });

    test('Meu perfil: uma barra de salvar só, "Sair sem salvar?" e o apelido no mesmo Salvar', async ({ page }) => {
      const { api } = await abrir(page);
      await page.getByRole('button', { name: 'Perfil na comunidade, Testinho' }).click();
      const folha = page.getByRole('dialog', { name: 'Meu perfil' });
      await expect(folha.getByText('Tudo salvo')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Salvar apelido' })).toHaveCount(0);
      await expect(page.getByText(/cartão Comunidade/)).toHaveCount(0);

      await folha.getByRole('radio', { name: 'Laranja' }).click();
      await expect(folha.getByRole('radio', { name: 'Laranja' })).toBeChecked();
      await expect(folha.getByText('Alterações não salvas')).toBeVisible();
      await folha.getByRole('button', { name: 'Fechar' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Sair sem salvar?' })).toBeVisible();
      await page.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(folha.getByRole('radio', { name: 'Laranja' })).toBeChecked();

      await folha.getByRole('textbox', { name: 'Apelido (opcional)' }).fill('Testão');
      await expect(folha.getByText('Aluno (Testão)').first()).toBeVisible();
      await folha.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(page.getByText('Perfil salvo.')).toBeVisible();
      await expect(folha.getByText('Tudo salvo')).toBeVisible();
      expect(pedidosDe(api.pedidos, 'PUT', '/aluno/comunidade/apelido').map((p) => p.corpo)).toEqual([{ apelido: 'Testão' }]);
      expect(pedidosDe(api.pedidos, 'PUT', '/aluno/comunidade/perfil').map((p) => p.corpo)).toEqual([
        { perfilReservado: false, destaques: ['PRIMEIRO_TREINO', 'DEZ_TREINOS'], cor: 'LARANJA', moldura: 'DUPLA', exibicaoDoNome: 'NOME_E_APELIDO' },
      ]);
      await folha.getByRole('button', { name: 'Fechar' }).click();
      await expect(folha).toHaveCount(0);
      // O cabeçalho e a linha já mostram o apelido novo, sem ler de novo.
      await expect(cabecalho(page).getByLabel('Nome para os colegas: Aluno (Testão)')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Perfil na comunidade, Testão' })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('Meus dados: CPF mascarado com "Mostrar CPF" e o aviso do e-mail do cadastro', async ({ page }) => {
      await abrir(page);
      await page.getByRole('button', { name: /^Meus dados, Aluno Teste da Silva · \(45\) 99999-8888/ }).click();
      const folha = page.getByRole('dialog', { name: 'Meus dados' });
      await expect(folha.getByLabel('CPF: ***.982.247-**')).toBeVisible();
      await expect(folha.getByText('529.982.247-25')).toHaveCount(0);
      await folha.getByRole('button', { name: 'Mostrar CPF' }).click();
      await expect(folha.getByLabel('CPF: 529.982.247-25')).toBeVisible();
      await expect(folha.getByText('E-mail no cadastro do seu treinador: cadastro@exemplo.test. Para mudar, fale com ele.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Editar' })).toBeVisible();
    });

    test('Meus dados: sem o aviso quando o e-mail do cadastro é o de acesso', async ({ page }) => {
      await abrir(page, { dados: { email: ALUNO.email } });
      await page.getByRole('button', { name: /^Meus dados/ }).click();
      const folha = page.getByRole('dialog', { name: 'Meus dados' });
      await expect(folha.getByLabel(`E-mail de acesso: ${ALUNO.email}`)).toBeVisible();
      await expect(folha.getByText(/E-mail no cadastro do seu treinador/)).toHaveCount(0);
    });

    test('Segurança: "Trocar senha" abre a folha com as regras; "Sair" confirma', async ({ page }) => {
      await abrir(page);
      await page.getByRole('button', { name: /^Trocar senha/ }).click();
      const folha = page.getByRole('dialog', { name: 'Trocar senha' });
      await expect(folha.getByLabel('Senha atual')).toBeVisible();
      await expect(folha.getByText('Mínimo de 8 caracteres.')).toBeVisible();
      await expect(folha.getByText('Ao trocar, as outras sessões são encerradas.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Trocar senha' })).toBeDisabled();
      await folha.getByLabel('Senha atual').fill('senha-ficticia-1');
      await folha.getByLabel('Nova senha').fill('curta');
      // 28/11: com a nova curta o botão nem habilita; o indicador de força diz o que falta.
      await expect(folha.getByText('Força da senha: curta. Use pelo menos 8 caracteres.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Trocar senha' })).toBeDisabled();
      await folha.getByLabel('Nova senha').fill('Abcdefgh123!');
      await expect(folha.getByText('Força da senha: forte.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Trocar senha' })).toBeEnabled();
      await folha.getByRole('button', { name: 'Fechar' }).click();

      await page.getByRole('button', { name: 'Sair', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    });

    test('App: "Aparência e preferências" abre a folha', async ({ page }) => {
      await abrir(page);
      await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
      await expect(page.getByRole('dialog', { name: 'Aparência e preferências' })).toBeVisible();
    });
  });
}

test('1280 px: duas colunas empilhadas e os detalhes abrem em folha lateral', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrir(page);
  // Colunas empilhadas (27/11): o perfil no topo da primeira coluna; a coluna de cada seção sai das alturas medidas
  // (`ColunasMedidas`, com o teto de `dominio/colunasDaConta`), então só se confere que há duas colunas da mesma largura.
  await expect(async () => {
    const topo = (await cabecalho(page).boundingBox())!;
    const secoes = await Promise.all(['secao-plano', 'secao-dados', 'secao-convite', 'secao-privacidade', 'secao-seguranca', 'secao-app']
      .map(async (id) => (await page.getByTestId(id).boundingBox())!));
    const xs = [...new Set(secoes.map((s) => Math.round(s.x / 10)))];
    expect(xs).toHaveLength(2);
    expect(Math.max(...secoes.map((s) => s.x))).toBeGreaterThan(topo.x + topo.width);
    // A segunda coluna começa no topo, na altura do cartão do perfil (o `cabecalho-do-perfil` fica dentro dele, com o recuo).
    expect(Math.abs(Math.min(...secoes.map((s) => s.y)) - topo.y)).toBeLessThan(40);
  }).toPass();
  // Com tudo à vista nas colunas, não há mais índice das seções.
  await expect(page.getByRole('navigation', { name: 'Seções da conta' })).toHaveCount(0);

  await page.getByRole('button', { name: /^Meus dados/ }).click();
  // Folha lateral: encostada à direita (depois da entrada de 180 ms), com 460 px.
  const folha = page.getByRole('dialog', { name: 'Meus dados' });
  await expect.poll(async () => { const c = (await folha.boundingBox())!; return Math.round(c.x + c.width); }).toBe(1280);
  expect(Math.round((await folha.boundingBox())!.width)).toBe(460);
});

// Contrato fechado no "Meu plano": "Valor do contrato" sem periodicidade, cobranças pela descrição, sem selo "Avulsa"/"Acordo"
// e sem saldo (D12). Sem "Pagar" (só Manual), como o resto da Conta.
const CONTRATO: FinanceiroDoAluno = {
  plano: {
    contratacaoId: 'c1', planoNome: 'Plano Trimestral', valorCentavos: 300_000, periodicidade: 'TRIMESTRAL', situacao: 'ATIVA',
    proximoVencimento: '2026-11-24', linkDePagamento: null, contratoFechado: true,
  },
  abertas: [
    { id: 'p2', competencia: null, descricao: 'Parcela 2/3', vencimento: '2026-09-24', valorCentavos: 80_000, situacao: 'ABERTA', vencida: true, forma: null, pagoEm: null, tipo: 'RENEGOCIACAO', doContrato: true },
    { id: 'p3', competencia: null, descricao: 'Parcela 3/3', vencimento: '2026-11-24', valorCentavos: 80_000, situacao: 'ABERTA', vencida: false, forma: null, pagoEm: null, tipo: 'RENEGOCIACAO', doContrato: true },
  ],
  historico: [
    { id: 'en', competencia: null, descricao: 'Entrada', vencimento: '2026-08-24', valorCentavos: 60_000, situacao: 'PAGA', vencida: false, forma: 'PIX_DIRETO', pagoEm: '2026-08-24', tipo: 'AVULSA', doContrato: true },
    { id: 'p1', competencia: null, descricao: 'Parcela 1/3', vencimento: '2026-09-01', valorCentavos: 80_000, situacao: 'PAGA', vencida: false, forma: 'PIX_DIRETO', pagoEm: '2026-09-01', tipo: 'RENEGOCIACAO', doContrato: true },
  ],
  pagamentoOnline: false, formasDePagamento: ['MANUAL'],
};

for (const largura of [390, 1280]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`Meu plano com contrato fechado em ${largura} ${tema.toLowerCase()}: valor do contrato, sem periodicidade nem selo de tipo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
      await abrir(page, { financeiro: CONTRATO });
      const plano = page.getByTestId('secao-plano');
      await expect(plano.getByText('Plano Trimestral')).toBeVisible();
      await expect(cabecalho(page).getByText('Contrato · Ativo')).toBeVisible();
      await expect(plano.getByLabel('Valor do contrato: R$ 3.000,00')).toBeVisible();
      await expect(plano.getByLabel('Próximo vencimento: 24/11/2026')).toBeVisible();
      await expect(plano.getByText('Periodicidade')).toHaveCount(0);
      for (const descricao of ['Parcela 2/3', 'Parcela 3/3', 'Entrada', 'Parcela 1/3']) await expect(plano.getByText(descricao, { exact: true })).toBeVisible();
      await expect(plano.getByText('Avulsa', { exact: true })).toHaveCount(0);
      await expect(plano.getByText('Acordo', { exact: true })).toHaveCount(0);
      await expect(plano.getByText(/saldo/i)).toHaveCount(0);
      await expect(plano.getByText('Vencida', { exact: true })).toBeVisible();
      await semRolagemHorizontal(page);
      await plano.screenshot({ path: `test-results/contrato-fechado/meu-plano-${largura}-${tema.toLowerCase()}.png` });
    });
  }
}

test('390 px: uma coluna, sem índice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page);
  await expect(async () => {
    const topo = (await cabecalho(page).boundingBox())!;
    const secoes = (await page.getByTestId('secao-plano').boundingBox())!;
    expect(secoes.y).toBeGreaterThan(topo.y + topo.height);
  }).toPass();
  await expect(page.getByRole('navigation', { name: 'Seções da conta' })).toHaveCount(0);
});
