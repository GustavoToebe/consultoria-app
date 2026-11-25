import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Preenchimento automático do Chrome no endereço do cadastro do aluno (25/11). O Chrome preenche vários campos de uma vez e
 * dispara um `input` por campo; aqui isso é simulado com o setter nativo do `value` + `dispatchEvent('input')`, em ordens
 * diferentes, no mesmo tick e em ticks separados. Só dados fictícios.
 */
const NOVO_ID = 'a0000000-0000-4000-8000-000000000009';
const NOVO = {
  id: NOVO_ID, nome: 'Aluno Novo Fictício', email: null, telefone: null, objetivo: null, cpf: null, endereco: null, ativo: true, temAcesso: false,
  conviteExpiraEm: null, versao: 0, diasAtualizacao: null, anonimizado: false, emailDeAcesso: null, aguardandoPrimeiroAcesso: false,
};

const ROTULOS = { cep: 'CEP *', rua: 'Rua, avenida… *', numero: 'Número *', complemento: 'Complemento (opcional)', bairro: 'Bairro (opcional)', cidade: 'Cidade *' };
type Chave = keyof typeof ROTULOS;
type Preenchimento = [Chave, string];

/** O que o Chrome põe nos campos: a rua vem com o número (linha 1 do endereço salvo) e o complemento na linha 2. */
const DO_CHROME: Record<Chave, string> = {
  cep: '01310-100', rua: 'Rua Exemplo, 3420', numero: '', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo',
};

/** Um `input` real por campo, na ordem dada, todos dentro do mesmo tick (uma só chamada do navegador). */
async function autopreencherNoMesmoTick(page: Page, itens: Preenchimento[]) {
  await page.evaluate((lista) => {
    for (const [rotulo, texto] of lista) {
      const el = document.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, texto);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, itens.map(([c, t]) => [ROTULOS[c], t] as [string, string]));
}

/** O mesmo, mas cada campo num tick (um `setTimeout` de 0 entre eles). */
async function autopreencherEmTicks(page: Page, itens: Preenchimento[]) {
  await page.evaluate(async (lista) => {
    for (const [rotulo, texto] of lista) {
      const el = document.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, texto);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    }
  }, itens.map(([c, t]) => [ROTULOS[c], t] as [string, string]));
}

const ordem = (...chaves: Chave[]): Preenchimento[] => chaves.map((c) => [c, DO_CHROME[c]]);

const CEP_ACHADO = { logradouro: 'Rua Exemplo', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo', uf: 'PR' };
const FALTAS = ['Informe o CEP.', 'Informe a rua ou avenida.', 'Informe o número (ou s/n).', 'Informe a cidade.'];

async function abrir(page: Page, buscaDeCep: 'acha' | 'nao-acha') {
  await page.setViewportSize({ width: 1280, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'POST /alunos': (p, route) => json(route, { ...NOVO, ...(p.corpo as object) }),
    [`GET /alunos/${NOVO_ID}`]: { corpo: NOVO },
    'POST /enderecos/cep/consultar': buscaDeCep === 'acha' ? { corpo: CEP_ACHADO } : erroApi(404, 'CEP não encontrado.', 'CEP_NAO_ENCONTRADO'),
  });
  await page.goto('/treinador/alunos/novo');
  await expect(page.getByRole('heading', { name: 'Novo aluno', level: 1 })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Aluno Novo Fictício');
  return api;
}

async function valores(page: Page) {
  const ler = (c: Chave) => page.locator(`input[aria-label="${ROTULOS[c]}"]`).inputValue();
  return { cep: await ler('cep'), rua: await ler('rua'), numero: await ler('numero'), complemento: await ler('complemento'), bairro: await ler('bairro'), cidade: await ler('cidade') };
}

async function semFaltas(page: Page) {
  for (const falta of FALTAS) await expect(page.getByText(falta)).toHaveCount(0);
}

const ORDENS: Record<string, Chave[]> = {
  'ordem da tela': ['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade'],
  'CEP por último': ['rua', 'complemento', 'bairro', 'cidade', 'cep'],
  'cidade primeiro, CEP no meio': ['cidade', 'bairro', 'cep', 'rua', 'complemento'],
};

for (const [nome, chaves] of Object.entries(ORDENS)) {
  test(`autofill no mesmo tick (${nome}), CEP sem resultado: todos os campos no estado, número separado da rua e os erros somem`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, 'nao-acha');
    await autopreencherNoMesmoTick(page, ordem(...chaves.filter((c) => c !== 'numero')));
    // A UF o Chrome não preenche (é um botão de escolha): só o erro dela pode ficar.
    await expect(page.getByText('Escolha a UF.')).toBeVisible();
    await semFaltas(page);
    expect(await valores(page)).toEqual({
      cep: '01310-100', rua: 'Rua Exemplo', numero: '3420', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo',
    });
    // O estado (e não só o DOM): escolhendo a UF o envio leva o endereço inteiro.
    await page.getByRole('button', { name: /^UF/ }).click();
    await page.getByRole('radio', { name: 'PR', exact: true }).click();
    await expect(page.getByText('Escolha a UF.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/alunos').length).toBe(1);
    const corpo = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/alunos')!.corpo as { endereco: unknown };
    expect(corpo.endereco).toEqual({
      cep: '01310-100', logradouro: 'Rua Exemplo', numero: '3420', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo', uf: 'PR',
    });
    expect(errosDaPagina).toEqual([]);
  });

  test(`autofill no mesmo tick (${nome}), CEP achado: rua, bairro, cidade e UF da busca, número do autofill, nenhum erro`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, 'acha');
    await autopreencherNoMesmoTick(page, ordem(...chaves.filter((c) => c !== 'numero')));
    await expect(page.locator(`input[aria-label="${ROTULOS.rua}"]`)).toHaveValue('Rua Exemplo');
    await expect(page.getByRole('button', { name: /^UF/ })).toContainText('PR');
    await semFaltas(page);
    await expect(page.getByText('Escolha a UF.')).toHaveCount(0);
    expect(await valores(page)).toEqual({
      cep: '01310-100', rua: 'Rua Exemplo', numero: '3420', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo',
    });
    await expect(page.getByRole('button', { name: 'Cadastrar', exact: true })).toBeEnabled();
    expect(pedidos.filter((p) => p.caminho === '/enderecos/cep/consultar')).toHaveLength(1);
    expect(errosDaPagina).toEqual([]);
  });
}

test('autofill um campo por tick: os mesmos resultados', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 'nao-acha');
  await autopreencherEmTicks(page, ordem('cep', 'rua', 'complemento', 'bairro', 'cidade'));
  await semFaltas(page);
  expect(await valores(page)).toEqual({
    cep: '01310-100', rua: 'Rua Exemplo', numero: '3420', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo',
  });
  expect(errosDaPagina).toEqual([]);
});

test('o erro de um campo some assim que ele recebe valor; o número já digitado não é trocado pelo da rua', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 'nao-acha');
  await page.getByLabel('Cidade').fill('Cidade Exemplo');
  for (const falta of ['Informe o CEP.', 'Informe a rua ou avenida.', 'Informe o número (ou s/n).']) await expect(page.getByText(falta)).toBeVisible();
  await page.getByRole('textbox', { name: /^Número/ }).fill('88');
  await expect(page.getByText('Informe o número (ou s/n).')).toHaveCount(0);
  await expect(page.getByText('Informe a rua ou avenida.')).toBeVisible();
  await autopreencherNoMesmoTick(page, [['rua', 'Rua Exemplo, 3420']]);
  await expect(page.getByText('Informe a rua ou avenida.')).toHaveCount(0);
  expect(await valores(page)).toMatchObject({ rua: 'Rua Exemplo, 3420', numero: '88', cidade: 'Cidade Exemplo' });
  expect(errosDaPagina).toEqual([]);
});

test('digitar a rua com número tecla a tecla não mexe no texto; ao sair do campo o número vai para o campo Número', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 'nao-acha');
  const rua = page.getByLabel('Rua, avenida…');
  await rua.click();
  await page.keyboard.type('Rua Exemplo, 123', { delay: 10 });
  await expect(rua).toHaveValue('Rua Exemplo, 123');
  await expect(page.getByRole('textbox', { name: /^Número/ })).toHaveValue('');
  await page.getByLabel('Cidade').click();
  await expect(rua).toHaveValue('Rua Exemplo');
  await expect(page.getByRole('textbox', { name: /^Número/ })).toHaveValue('123');
  expect(errosDaPagina).toEqual([]);
});

test('a rua "Avenida 9 de Julho" não é separada', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 'nao-acha');
  await autopreencherNoMesmoTick(page, [['rua', 'Avenida 9 de Julho']]);
  await page.getByLabel('Cidade').click();
  expect(await valores(page)).toMatchObject({ rua: 'Avenida 9 de Julho', numero: '' });
  expect(errosDaPagina).toEqual([]);
});

test('os campos levam os tokens de autocomplete do endereço', async ({ page }) => {
  await abrir(page, 'nao-acha');
  const token = (c: Chave) => page.locator(`input[aria-label="${ROTULOS[c]}"]`).getAttribute('autocomplete');
  expect(await token('cep')).toBe('postal-code');
  expect(await token('rua')).toBe('address-line1');
  expect(await token('complemento')).toBe('address-line2');
  expect(await token('bairro')).toBe('address-level3');
  expect(await token('cidade')).toBe('address-level2');
});
