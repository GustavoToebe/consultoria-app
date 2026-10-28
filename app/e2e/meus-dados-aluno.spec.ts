import { expect, test, type Page, type Route } from '@playwright/test';

import type { CicloDaAluna, EuResponse, MeusDadosRequest, MeusDadosResponse } from '../src/api/tipos';
import { ALUNO, erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';

/**
 * "Meus dados" na Conta do aluno (`aluno/CartaoMeusDados`): leitura primeiro, "Editar" com telefone, sexo, CPF (só se
 * vazio) e endereço com a busca de CEP; 409 de versão recarrega com aviso neutro; 422 marca o campo; o cartão não depende
 * do ciclo e o ciclo reflete o sexo salvo. Só dados fictícios; 529.982.247-25 é um CPF de teste válido, sem dono.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const CPF = '529.982.247-25';
const SO_LEITURA = 'Para mudar, fale com o seu treinador.';
const CONFLITO = 'Seus dados foram atualizados por outra pessoa. Mostramos os dados mais recentes.';

/** As outras rotas da Conta, para `naoTratadas` ficar vazio. */
const ROTAS_DA_CONTA: RespostasApi = {
  'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
  'POST /enderecos/cep/consultar': (p, route) => (p.corpo as { cep: string }).cep === '01310100'
    ? json(route, { logradouro: 'Avenida Exemplo', bairro: 'Bela Vista', cidade: 'Cidade Exemplo', uf: 'SP' })
    : json(route, erroApi(404, 'CEP não encontrado.', 'CEP_NAO_ENCONTRADO').corpo, 404),
};

async function rotasDaConta(page: Page, cicloHabilitado: boolean): Promise<RespostasApi> {
  const rotas = await sessaoDeAluno(page);
  const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
  rotas['GET /eu'] = { corpo: { ...eu, cicloHabilitado, aluno: { id: ALUNO_ID, nome: ALUNO.nome } } };
  return { ...rotas, ...ROTAS_DA_CONTA };
}

/** Servidor falso de "Meus dados": guarda o cadastro e sobe a versão a cada PUT aceito. */
function rotasDosMeusDados(estado: { atual: MeusDadosResponse }): RespostasApi {
  return {
    'GET /aluno/meus-dados': (_p: PedidoFalso, route: Route) => json(route, estado.atual),
    'PUT /aluno/meus-dados': (p: PedidoFalso, route: Route) => {
      const corpo = p.corpo as MeusDadosRequest;
      estado.atual = {
        ...estado.atual, telefone: corpo.telefone, endereco: corpo.endereco, sexo: corpo.sexo,
        cpf: estado.atual.cpf ?? corpo.cpf, versao: estado.atual.versao + 1,
      };
      return json(route, estado.atual);
    },
  };
}

const cartao = (page: Page) => page.getByRole('heading', { name: 'Meus dados', level: 2 });
const envios = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/meus-dados');

async function semRolagemHorizontal(page: Page) {
  const { rolagem, janela } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth }));
  expect(rolagem).toBeLessThanOrEqual(janela);
}

for (const largura of [390, 1280]) {
  test(`ciclo desligado: lê, edita telefone, endereço pelo CEP e sexo, e salva (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = { atual: { ...MEUS_DADOS_VAZIOS, telefone: '(45) 99999-8888', cpf: CPF, sexo: 'MASCULINO', versao: 3 } };
    const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, { ...(await rotasDaConta(page, false)), ...rotasDosMeusDados(estado) });
    await page.goto('/aluno/conta');

    // Leitura: nome e e-mails só leitura com a frase; nada do ciclo aparece nem é consultado.
    await expect(cartao(page)).toBeVisible();
    await expect(page.getByLabel(`Nome: ${ALUNO.nome}`)).toBeVisible();
    await expect(page.getByLabel(`E-mail de acesso: ${ALUNO.email}`)).toBeVisible();
    await expect(page.getByText(SO_LEITURA)).toBeVisible();
    await expect(page.getByLabel('Telefone: (45) 99999-8888')).toBeVisible();
    await expect(page.getByLabel('Sexo: Masculino')).toBeVisible();
    await expect(page.getByLabel(`CPF: ${CPF}`)).toBeVisible();
    await expect(page.getByLabel('Endereço: —')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ciclo menstrual' })).toHaveCount(0);
    await semRolagemHorizontal(page);

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
    await expect(salvar).toBeDisabled();
    // CPF preenchido: só leitura, sem campo, com a mesma frase.
    await expect(page.getByLabel('CPF (opcional)')).toHaveCount(0);
    await expect(page.getByText(SO_LEITURA)).toHaveCount(2);

    await page.getByLabel('Telefone (opcional)').fill('45988887777');
    await expect(page.getByLabel('Telefone (opcional)')).toHaveValue('(45) 98888-7777');
    await page.getByLabel('CEP').fill('01310100');
    await expect(page.getByLabel('Rua, avenida…')).toHaveValue('Avenida Exemplo');
    await expect(page.getByRole('textbox', { name: /^Cidade/ })).toHaveValue('Cidade Exemplo');
    // Sem número o endereço está incompleto: o campo marca e o Salvar não sai.
    await expect(page.getByText('Informe o número (ou s/n).')).toBeVisible();
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: /^Número/ }).fill('100');
    await page.getByRole('radiogroup', { name: 'Sexo' }).getByRole('button', { name: 'Feminino', exact: true }).click();
    await semRolagemHorizontal(page);

    await expect(salvar).toBeEnabled();
    await salvar.click();
    await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
    await expect(salvar).toHaveCount(0);
    await expect(page.getByLabel('Telefone: (45) 98888-7777')).toBeVisible();
    await expect(page.getByLabel('Sexo: Feminino')).toBeVisible();
    await expect(page.getByText('Avenida Exemplo, 100', { exact: false })).toBeVisible();

    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).toEqual({
      telefone: '(45) 98888-7777', cpf: null, sexo: 'FEMININO', versao: 3,
      endereco: { cep: '01310-100', logradouro: 'Avenida Exemplo', numero: '100', complemento: null, bairro: 'Bela Vista', cidade: 'Cidade Exemplo', uf: 'SP' },
    });
    // A versão nova vale para a próxima edição.
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByLabel('Telefone: (45) 98888-7777')).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.includes('/ciclo'))).toEqual([]);
    await semRolagemHorizontal(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('CPF vazio é editável, confere os dígitos e, salvo, fica só leitura', async ({ page }) => {
  const estado = { atual: { ...MEUS_DADOS_VAZIOS, versao: 1 } };
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, { ...(await rotasDaConta(page, false)), ...rotasDosMeusDados(estado) });
  await page.goto('/aluno/conta');
  await expect(page.getByLabel('CPF: Não informado')).toBeVisible();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const cpf = page.getByLabel('CPF (opcional)');
  const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
  await cpf.fill('52998224726');
  await expect(cpf).toHaveValue('529.982.247-26');
  await expect(page.getByText('CPF inválido.')).toBeVisible();
  await expect(salvar).toBeDisabled();

  await cpf.fill('52998224725');
  await expect(page.getByText('CPF inválido.')).toHaveCount(0);
  await salvar.click();
  await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
  expect(envios(pedidos)[0].corpo).toEqual({ telefone: null, cpf: CPF, endereco: null, sexo: null, versao: 1 });
  await expect(page.getByLabel(`CPF: ${CPF}`)).toBeVisible();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('CPF (opcional)')).toHaveCount(0);
  await expect(page.getByLabel(`CPF: ${CPF}`)).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('409 de versão recarrega com aviso neutro; 422 marca o campo e some ao corrigir', async ({ page }) => {
  let putsRecebidos = 0;
  const estado = { atual: { ...MEUS_DADOS_VAZIOS, telefone: '(45) 99999-8888', versao: 2 } };
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await rotasDaConta(page, false)),
    'GET /aluno/meus-dados': (_p, route) => json(route, estado.atual),
    'PUT /aluno/meus-dados': (_p, route) => {
      putsRecebidos++;
      if (putsRecebidos === 1) {
        // O treinador salvou antes: o servidor já tem outro telefone e outra versão.
        estado.atual = { ...estado.atual, telefone: '(11) 97777-6666', versao: 3 };
        return json(route, erroApi(409, 'Os dados mudaram.', 'CONFLITO_EDICAO').corpo, 409);
      }
      return json(route, {
        status: 422, message: 'Dados inválidos.', codigo: 'ALUNO_INVALIDO',
        fieldErrors: [{ field: 'telefone', message: 'Confira o telefone.' }],
      }, 422);
    },
  });
  await page.goto('/aluno/conta');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Telefone (opcional)').fill('45988887777');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  await expect(page.getByText(CONFLITO)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Telefone: (11) 97777-6666')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/meus-dados')).toHaveLength(2);

  // A edição seguinte leva a versão recarregada; o servidor recusa o telefone: erro no campo e aviso geral.
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Telefone (opcional)').fill('45988887777');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Confira o telefone.')).toBeVisible();
  await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
  expect((envios(pedidos).at(-1)?.corpo as MeusDadosRequest).versao).toBe(3);
  await page.getByLabel('Telefone (opcional)').fill('45988887776');
  await expect(page.getByText('Confira o telefone.')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('ciclo ligado e sexo Feminino mantém o cartão do ciclo; salvar Masculino faz o ciclo sumir', async ({ page }) => {
  const estado = { atual: { ...MEUS_DADOS_VAZIOS, sexo: 'FEMININO', versao: 1 } };
  const ciclo = (): CicloDaAluna => estado.atual.sexo === 'FEMININO'
    ? { disponivel: true, ativo: false, consentimentoVersaoAtual: 1, duracaoHabitual: null, mostrarFases: true, registros: [], dias: [], textosDasFases: null }
    : ({ disponivel: false } as CicloDaAluna);
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await rotasDaConta(page, true)),
    ...rotasDosMeusDados(estado),
    'GET /aluno/ciclo': (_p, route) => json(route, ciclo()),
  });
  await page.goto('/aluno/conta');
  await expect(cartao(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ciclo menstrual' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar acompanhamento' })).toBeVisible();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Sexo' }).getByRole('button', { name: 'Masculino', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ciclo menstrual' })).toHaveCount(0);
  expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/ciclo').length).toBeGreaterThanOrEqual(2);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
