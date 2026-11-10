import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, AnamneseDetalhe, AnamneseResumo, Atualizacao, ConteudoQuestionario, PastaResumo } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * CPF, endereço e telefone no cadastro do aluno: ficha (leitura, edição, CPF repetido) e anamnese (pergunta de
 * endereço respondida pelo aluno e alteração proposta para a equipe). Só dados fictícios; 529.982.247-25 é um CPF de
 * teste válido, sem dono.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const ANAMNESE_ID = 'n0000000-0000-4000-8000-000000000001';
const CPF = '529.982.247-25';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: '(45) 99999-8888', objetivo: 'Objetivo fictício', cpf: CPF,
  endereco: { cep: '01310-100', logradouro: 'Rua Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'SP' },
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const ROTAS_DA_FICHA = { 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } };

/** Busca de CEP que não acha nada: nos testes que só digitam o CEP, o resto do endereço fica como foi digitado. */
const CEP_SEM_RESULTADO = { 'POST /enderecos/cep/consultar': erroApi(404, 'CEP não encontrado.', 'CEP_NAO_ENCONTRADO') };

test('ficha: telefone, CPF e endereço na leitura; edição valida, envia e mostra o CPF repetido no campo', async ({ page }) => {
  let tentativas = 0;
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    ...CEP_SEM_RESULTADO,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => {
      tentativas++;
      if (tentativas === 1) return json(route, erroApi(409, 'Este CPF já está no cadastro de outro aluno.', 'ALUNO_CPF_EM_USO').corpo, 409);
      return json(route, { ...FICHA, ...(p.corpo as object), versao: 2 });
    },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('(45) 99999-8888')).toBeVisible();
  await expect(page.getByText(CPF)).toBeVisible();
  await expect(page.getByText('Rua Exemplo, 100 - Sala 2 - Centro', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  // CPF com dígito verificador errado: o campo marca e o salvar não sai.
  const cpf = page.getByLabel('CPF (opcional)');
  await cpf.fill('52998224726');
  await expect(cpf).toHaveValue('529.982.247-26');
  await expect(page.getByText('CPF inválido.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();

  await cpf.fill('52998224725');
  await expect(page.getByText('CPF inválido.')).toHaveCount(0);
  await page.getByLabel('Cidade').fill('Outra Cidade');
  await page.getByLabel('CEP').fill('13010111');
  await expect(page.getByLabel('CEP')).toHaveValue('13010-111');

  // 409 de CPF repetido: a mensagem fica no campo, sem repetir o CPF, e o formulário continua aberto.
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Este CPF já está no cadastro de outro aluno.')).toBeVisible();
  await expect(page.getByLabel('CPF (opcional)')).toBeVisible();

  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const envios = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`);
  expect(envios).toHaveLength(2);
  expect(envios[1].corpo).toMatchObject({
    telefone: '(45) 99999-8888', cpf: CPF,
    endereco: { cep: '13010-111', logradouro: 'Rua Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Outra Cidade', uf: 'SP' },
    versao: 1,
  });
  expect(errosDaPagina).toEqual([]);
});

// Data de nascimento (V070): opcional, só na ficha; vai como AAAA-MM-DD e o 422 da API fica no próprio campo.
for (const largura of [390, 1280]) {
  test(`ficha (${largura}px): data de nascimento digitada vai como AAAA-MM-DD; o 422 da API aparece no campo`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let tentativas = 0;
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`PUT /alunos/${ALUNO_ID}`]: (p, route) => {
        tentativas++;
        if (tentativas === 1) {
          const e = erroApi(422, 'Confira os dados.', 'ALUNO_INVALIDO', [{ field: 'dataNascimento', message: 'Data de nascimento fora do intervalo permitido.' }]);
          return json(route, e.corpo, 422);
        }
        return json(route, { ...FICHA, ...(p.corpo as object), versao: 2 });
      },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const campo = page.getByLabel('Data de nascimento (opcional)');
    await campo.pressSequentially('09032001');
    await expect(campo).toHaveValue('09/03/2001');
    await expect(page.getByText('Ajuda a definir o perfil do aluno na comunidade.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Data de nascimento fora do intervalo permitido.')).toBeVisible();
    await campo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`ficha-data-nascimento-422-${largura}.png`) });
    if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/ficha-data-nascimento-422-${largura}.png` });

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Dados salvos.')).toBeVisible();
    const envios = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`);
    expect(envios.map((e) => (e.corpo as { dataNascimento?: unknown }).dataNascimento)).toEqual(['2001-03-09', '2001-03-09']);
    expect(errosDaPagina).toEqual([]);
  });
}

test('ficha: o CEP completo preenche rua, bairro, cidade e UF sem tocar no número e no complemento; CEP que não existe só avisa', async ({ page }) => {
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, endereco: null } },
    'POST /enderecos/cep/consultar': (p, route) => (p.corpo as { cep: string }).cep === '01310100'
      ? json(route, { logradouro: 'Avenida Exemplo', bairro: 'Bela Vista', cidade: 'Cidade Exemplo', uf: 'SP' })
      : json(route, erroApi(404, 'CEP não encontrado.', 'CEP_NAO_ENCONTRADO').corpo, 404),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('textbox', { name: /^Número/ }).fill('s/n');
  await page.getByLabel('Complemento').fill('Sala 2');

  await page.getByLabel('CEP').fill('01310100');
  await expect(page.getByLabel('Rua, avenida…')).toHaveValue('Avenida Exemplo');
  await expect(page.getByLabel('Bairro')).toHaveValue('Bela Vista');
  await expect(page.getByLabel('Cidade')).toHaveValue('Cidade Exemplo');
  await expect(page.getByRole('button', { name: /^UF/ })).toContainText('SP');
  await expect(page.getByRole('textbox', { name: /^Número/ })).toHaveValue('s/n');
  await expect(page.getByLabel('Complemento')).toHaveValue('Sala 2');
  // Só os dígitos saem do aparelho, numa busca só.
  const buscas = pedidos.filter((p) => p.caminho === '/enderecos/cep/consultar');
  expect(buscas).toHaveLength(1);
  expect(buscas[0].metodo).toBe('POST');
  expect(buscas[0].corpo).toEqual({ cep: '01310100' });

  // CEP que não existe: aviso no campo e o que estava na tela continua.
  await page.getByLabel('CEP').fill('99999999');
  await expect(page.getByText('CEP não encontrado.')).toBeVisible();
  await expect(page.getByLabel('Rua, avenida…')).toHaveValue('Avenida Exemplo');
  expect(errosDaPagina).toEqual([]);
});

test('ficha: endereço parcial é recusado (só a cidade), "s/n" vale e tudo em branco apaga o endereço', async ({ page }) => {
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    ...CEP_SEM_RESULTADO,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, endereco: null } },
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => json(route, { ...FICHA, ...(p.corpo as object), versao: 2 }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
  await expect(salvar).toBeEnabled();

  // Só a cidade: cada campo obrigatório que falta é marcado embaixo dele e o salvar não sai.
  await page.getByLabel('Cidade').fill('Cidade Exemplo');
  for (const falta of ['Informe o CEP.', 'Informe a rua ou avenida.', 'Informe o número (ou s/n).', 'Escolha a UF.']) {
    await expect(page.getByText(falta)).toBeVisible();
  }
  await expect(salvar).toBeDisabled();

  // Completo, com "s/n" e sem complemento nem bairro (opcionais).
  await page.getByLabel('CEP').fill('01310100');
  await page.getByLabel('Rua, avenida…').fill('Rua Exemplo');
  await page.getByRole('textbox', { name: /^Número/ }).fill('s/n');
  await page.getByRole('button', { name: /^UF/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'SP', exact: true }).click();
  await expect(page.getByText('Informe o CEP.')).toHaveCount(0);
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'PUT')?.corpo as { endereco: unknown };
  expect(envio.endereco).toEqual({
    cep: '01310-100', logradouro: 'Rua Exemplo', numero: 's/n', complemento: null, bairro: null, cidade: 'Cidade Exemplo', uf: 'SP',
  });

  // Tudo em branco: o endereço é opcional e o envio leva null.
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  for (const rotulo of ['CEP', 'Rua, avenida…', 'Número', 'Cidade']) await page.getByRole('textbox', { name: new RegExp('^' + rotulo) }).fill('');
  await page.getByRole('button', { name: /^UF/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Não informar' }).click();
  await expect(salvar).toBeEnabled();
  await salvar.click();
  // O PUT sai depois do clique: espera o segundo envio chegar antes de ler o último.
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT').length).toBe(2);
  const ultimo = pedidos.filter((p) => p.metodo === 'PUT').at(-1)?.corpo as { endereco: unknown };
  expect(ultimo.endereco).toBeNull();
  expect(errosDaPagina).toEqual([]);
});

test('ficha sem permissão de dados sensíveis: CPF e endereço não aparecem e o corpo não os leva', async ({ page }) => {
  const semSensivel = await sessao(page, TREINADOR);
  const { permissoes } = (semSensivel['GET /eu'] as { corpo: { permissoes: string[] } }).corpo;
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...semSensivel,
    'GET /eu': { corpo: { ...(semSensivel['GET /eu'] as { corpo: object }).corpo, permissoes: permissoes.filter((c) => !c.startsWith('ALUNO_SENSIVEL')) } },
    ...ROTAS_DA_FICHA,
    // A API omite o que é sensível sem a permissão.
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, objetivo: undefined, cpf: undefined, endereco: undefined } },
    [`PUT /alunos/${ALUNO_ID}`]: (p, route) => json(route, { ...FICHA, ...(p.corpo as object), versao: 2 }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('(45) 99999-8888')).toBeVisible();
  await expect(page.getByText(CPF)).toHaveCount(0);
  await expect(page.getByText('Rua Exemplo', { exact: false })).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('CPF (opcional)')).toHaveCount(0);
  await expect(page.getByLabel('CEP')).toHaveCount(0);
  await page.getByLabel('Telefone (opcional)').fill('4533334444');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Dados salvos.')).toBeVisible();
  const corpo = pedidos.find((p) => p.metodo === 'PUT')?.corpo as Record<string, unknown>;
  expect(corpo.telefone).toBe('(45) 3333-4444');
  expect(corpo).not.toHaveProperty('cpf');
  expect(corpo).not.toHaveProperty('endereco');
  expect(errosDaPagina).toEqual([]);
});

test('ficha de aluno sem acesso: telefone com a nota e campo de telefone na edição', async ({ page }) => {
  await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, telefone: undefined, temAcesso: false } },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('O aluno ainda não tem acesso: o telefone passa para o acesso quando ele entrar no app.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Telefone (opcional)')).toBeVisible();
  await expect(page.getByLabel('CPF (opcional)')).toBeVisible();
});

const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: [],
  secoes: [{
    uid: 's1', titulo: 'Contato',
    perguntas: [{ id: 'end', tipo: 'ENDERECO', rotulo: 'Onde você mora?', obrigatoria: false, destino: 'ENDERECO' }],
  }],
};

const PENDENTE: AnamneseDetalhe = {
  id: ANAMNESE_ID, alunoId: ALUNO_ID, nomeAluno: null, situacao: 'PENDENTE', questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001',
  questionarioVersaoNumero: 1, questionarioNome: null, modelo: MODELO, respostas: {}, atribuidaEm: '2026-10-18T12:00:00Z', atribuidaPorNome: null,
  enviadaEm: null, revisadaEm: null, revisadaPorNome: null, dispensadaEm: null, dispensadaPorNome: null, alteracoes: [], dispensaMotivo: null, versao: 1,
};

test('aluno responde o endereço na anamnese: só a cidade é recusada; completo, com CEP em máscara e "s/n", é enviado', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...CEP_SEM_RESULTADO,
    'GET /aluno/anamnese': { corpo: PENDENTE },
    [`POST /aluno/anamnese/${ANAMNESE_ID}/enviar`]: (p, route) => {
      const corpo = p.corpo as { respostas: AnamneseDetalhe['respostas'] };
      return json(route, { ...PENDENTE, situacao: 'ENVIADA', respostas: corpo.respostas, enviadaEm: '2026-10-19T12:00:00Z', versao: 2 });
    },
  });
  await page.goto('/aluno/anamnese');
  await expect(page.getByText('Esta resposta vai para o endereço do seu cadastro.')).toBeVisible();

  // Só a cidade: a anamnese não sai e cada campo que falta é marcado.
  await page.getByLabel('Cidade').fill('Cidade Exemplo');
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Informe o CEP.')).toBeVisible();
  await expect(page.getByText('Informe a rua ou avenida.')).toBeVisible();
  await expect(page.getByText('Informe o número (ou s/n).')).toBeVisible();
  await expect(page.getByText('Escolha a UF.')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/enviar'))).toHaveLength(0);

  await page.getByLabel('CEP').fill('01310100');
  await expect(page.getByLabel('CEP')).toHaveValue('01310-100');
  await page.getByLabel('Rua, avenida…').fill('Rua Exemplo');
  await page.getByRole('textbox', { name: /^Número/ }).fill('s/n');
  await page.getByRole('button', { name: /^UF/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'SP', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar anamnese' }).click();
  await expect(page.getByText('Anamnese enviada. Seu treinador vai ver as respostas.')).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/enviar'));
  expect(envio?.corpo).toEqual({
    questionarioVersaoId: PENDENTE.questionarioVersaoId,
    respostas: { end: { cep: '01310-100', logradouro: 'Rua Exemplo', numero: 's/n', cidade: 'Cidade Exemplo', uf: 'SP' } },
  });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('folha da anamnese: endereço diferente do cadastro fica para revisar e aplicar pede confirmação', async ({ page }) => {
  const proposto = { cep: '13010-111', logradouro: 'Rua Nova', numero: '5', complemento: null, bairro: null, cidade: 'Outra Cidade', uf: 'SP' };
  const enviada: AnamneseDetalhe = {
    ...PENDENTE, nomeAluno: ALUNO.nome, situacao: 'ENVIADA', questionarioNome: 'Anamnese inicial', atribuidaPorNome: TREINADOR.nome,
    respostas: { end: { cep: '13010-111', logradouro: 'Rua Nova', numero: '5', cidade: 'Outra Cidade', uf: 'SP' } }, enviadaEm: '2026-10-19T12:00:00Z', versao: 2,
    alteracoes: [{
      id: 'l0000000-0000-4000-8000-000000000001', destino: 'ENDERECO', perguntaId: 'end', valor: { endereco: proposto },
      valorAtual: { endereco: FICHA.endereco ?? undefined }, situacao: 'PENDENTE', automatica: false, criadaEm: '2026-10-19T12:00:00Z',
      resolvidaEm: null, resolvidaPorNome: null,
    }],
  };
  const resumo: AnamneseResumo = {
    id: ANAMNESE_ID, situacao: 'ENVIADA', questionarioNome: 'Anamnese inicial', questionarioVersaoNumero: 1, atribuidaEm: enviada.atribuidaEm,
    enviadaEm: enviada.enviadaEm, revisadaEm: null, dispensadaEm: null, dispensaMotivo: null, alteracoesParaRevisar: 1, versao: 2,
  };
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/anamneses`]: { corpo: [resumo] },
    [`GET /anamneses/${ANAMNESE_ID}`]: { corpo: enviada },
    [`POST /anamneses/${ANAMNESE_ID}/alteracoes/l0000000-0000-4000-8000-000000000001/aplicar`]: (_p, route) =>
      json(route, { ...enviada, alteracoes: [{ ...enviada.alteracoes![0], situacao: 'APLICADA', resolvidaEm: '2026-10-19T13:00:00Z' }] }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByText('Anamnese inicial').first().click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByText('Cadastro do aluno')).toBeVisible();
  await expect(folha.getByText('Endereço', { exact: true })).toBeVisible();
  await expect(folha.getByText('No cadastro: Rua Exemplo, 100', { exact: false })).toBeVisible();
  await expect(folha.getByText('Na anamnese: Rua Nova, 5', { exact: false })).toBeVisible();
  await folha.getByRole('button', { name: 'Aplicar ao cadastro' }).click();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByText('Cadastro atualizado.')).toBeVisible();
  expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/aplicar'))).toHaveLength(1);
  expect(errosDaPagina).toEqual([]);
});

// Dados no cartão de cima (com o resumo), antes das pastas; "Editar" abre o formulário ali mesmo.
for (const { largura, altura } of [{ largura: 1280, altura: 900 }, { largura: 390, altura: 844 }]) {
  test(`ficha em ${largura} px: dados do aluno no cartão de cima e "Editar" abre o formulário ali`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: altura });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    const topo = async (alvo: ReturnType<typeof page.getByText>) => (await alvo.boundingBox())!.y;
    const passo = page.getByText('Próximo passo', { exact: true });
    const dados = page.getByRole('heading', { name: 'Dados do aluno' });
    const acesso = page.getByLabel('Acesso ao app', { exact: true });
    await expect(dados).toBeVisible();
    await expect(passo).toBeVisible();
    await expect(acesso).toBeVisible();
    expect(await topo(passo)).toBeLessThan(await topo(dados));
    expect(await topo(dados)).toBeLessThan(await topo(acesso));
    await expect(page.getByText(CPF)).toBeVisible();
    await expect(page.getByLabel('Acesso ao app: Com acesso')).toBeVisible();

    // Grade: no PC as três seções lado a lado; no celular uma embaixo da outra.
    const cadastro = await topo(page.getByText('Cadastro', { exact: true }));
    const pessoais = await topo(page.getByText('Dados pessoais', { exact: true }));
    // "Acompanhamento" também é o título de um grupo do menu lateral (aria-hidden): vale só o da ficha.
    const acompanhamento = await topo(page.getByText('Acompanhamento', { exact: true }).and(page.locator(':not([aria-hidden="true"])')));
    if (largura >= 1100) {
      expect(Math.abs(pessoais - cadastro)).toBeLessThan(2);
      expect(Math.abs(acompanhamento - cadastro)).toBeLessThan(2);
    } else {
      expect(cadastro).toBeLessThan(pessoais);
      expect(pessoais).toBeLessThan(acompanhamento);
    }
    // Nada passa da largura da tela.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);

    await page.screenshot({ path: testInfo.outputPath(`ficha-${largura}.png`), fullPage: true });

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const cpf = page.getByLabel('CPF (opcional)');
    await expect(cpf).toBeVisible();
    expect(await topo(dados)).toBeLessThan(await topo(cpf));
    expect(await topo(cpf)).toBeLessThan(await topo(acesso));
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(cpf).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Auditoria de UI/UX de 03/11, lote 1: guarda de saída no formulário do aluno (C7), um h1 só com a trilha (C1) e os
// botões de ícone com 44×44 de alvo e a moldura de 40 por dentro (C2).
// ---------------------------------------------------------------------------------------------------------------------

const NOVO_ID = 'a0000000-0000-4000-8000-000000000009';
const ATUALIZACAO_ID = 'e0000000-0000-4000-8000-000000000005';
const PASTA: PastaResumo = {
  id: 'f0000000-0000-4000-8000-000000000017', alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-06', fim: '2026-10-20', concluidaEm: null,
};
const ATUALIZACAO_ENVIADA: Atualizacao = {
  id: ATUALIZACAO_ID, pastaId: 'f0000000-0000-4000-8000-000000000017', alunoId: ALUNO_ID, nomeAluno: ALUNO.nome,
  dataAtualizacao: '2026-10-20', fase: 'ENVIADA', diasParaData: -11, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-10-20T12:00:00Z', feedback: null, versao: 1, resumo: null,
};
const NOVO: AlunoDetalhe = { ...FICHA, id: NOVO_ID, nome: 'Aluno Novo Fictício', telefone: null, objetivo: null, cpf: null, endereco: null, versao: 0 };
const titulosDeNivel1 = (page: Page) => page.locator('h1, [role="heading"][aria-level="1"]');
const sairSemSalvar = (page: Page) => page.getByText('Sair sem salvar?', { exact: true });

/** Alvo do botão de ícone (o `Pressable`) e o desenho dentro dele, arredondados. */
async function medidas(botao: Locator) {
  const alvo = (await botao.boundingBox())!;
  const desenho = (await botao.locator(':scope > div').first().boundingBox())!;
  return { alvo: [Math.round(alvo.width), Math.round(alvo.height)], desenho: [Math.round(desenho.width), Math.round(desenho.height)] };
}

for (const largura of [390, 1280]) {
  test(`novo aluno (${largura}px): um h1 só; sem alteração sai direto; com o nome digitado pergunta; cadastrar vai à ficha sem perguntar`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina, pedidos } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      'GET /alunos': { corpo: { itens: [], total: 0 } },
      'POST /alunos': { corpo: NOVO },
      [`GET /alunos/${NOVO_ID}`]: { corpo: NOVO },
    });
    await page.goto('/treinador/alunos/novo');
    await expect(page.getByRole('heading', { name: 'Novo aluno', level: 1 })).toBeVisible();
    // C1: a trilha (só com o menu lateral) é navegação, não título.
    await expect(page.getByRole('navigation', { name: 'Trilha' })).toHaveCount(largura >= 768 ? 1 : 0);
    await expect(titulosDeNivel1(page)).toHaveCount(1);
    // C2: a seta de voltar tem 44×44 de alvo, com a moldura de 40 centrada.
    expect(await medidas(page.getByRole('button', { name: 'Voltar', exact: true }))).toEqual({ alvo: [44, 44], desenho: [40, 40] });

    // Sem alteração: sai direto.
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(sairSemSalvar(page)).toHaveCount(0);

    // Com o nome digitado: o Voltar abre o painel na tela; "Continuar editando" fica com o que foi digitado.
    await page.goto('/treinador/alunos/novo');
    await page.getByLabel('Nome', { exact: true }).fill('Aluno Novo Fictício');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`novo-aluno-guarda-${largura}.png`) });
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/treinador\/alunos\/novo$/);
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Aluno Novo Fictício');

    // Cadastrar: vai à ficha sem perguntar, e o voltar do navegador não cai de novo no formulário.
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${NOVO_ID}$`));
    await expect(page.getByRole('heading', { name: 'Aluno Novo Fictício', level: 1 })).toBeVisible();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/alunos')).toHaveLength(1);
    await page.goBack();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    expect(errosDaPagina).toEqual([]);
  });

  test(`novo aluno aberto direto (${largura}px): Cancelar vai à lista; com o nome digitado pergunta antes`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      'GET /alunos': { corpo: { itens: [], total: 0 } },
    });
    await page.goto('/treinador/alunos/novo');
    await expect(page.getByRole('heading', { name: 'Novo aluno', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(sairSemSalvar(page)).toHaveCount(0);

    await page.goto('/treinador/alunos/novo');
    await page.getByLabel('Nome', { exact: true }).fill('Aluno Novo Fictício');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    expect(errosDaPagina).toEqual([]);
  });

  test(`ficha (${largura}px): editar e sair pergunta; salvar e sair não; o ⋯ tem 44×44 com a moldura de 40`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      'GET /alunos': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`PUT /alunos/${ALUNO_ID}`]: (p, route) => json(route, { ...FICHA, ...(p.corpo as object), versao: 2 }),
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await expect(page.getByRole('heading', { name: ALUNO.nome, level: 1 })).toBeVisible();
    await expect(titulosDeNivel1(page)).toHaveCount(1);
    expect(await medidas(page.getByRole('button', { name: 'Mais ações do aluno', exact: true }))).toEqual({ alvo: [44, 44], desenho: [40, 40] });

    // Abrir a edição sem mexer não deixa nada pendente.
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(ALUNO.nome);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(sairSemSalvar(page)).toHaveCount(0);

    // Com alteração: o Voltar pergunta; depois de salvar, a saída volta a ser direta.
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Cidade').fill('Outra Cidade');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Dados salvos.')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(sairSemSalvar(page)).toHaveCount(0);

    // E o "Sair sem salvar" de fato sai.
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Cidade').fill('Mais Uma Cidade');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    expect(errosDaPagina).toEqual([]);
  });
  // D7: navegar de dentro da ficha com a edição aberta passa pela mesma pergunta (o layout é Slot: sem isto o push
  // desmontava o formulário sem perguntar).
  test(`ficha (${largura}px): "Revisar atualização" com a edição alterada pergunta; sem alteração vai direto`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: ATUALIZACAO_ENVIADA },
      [`GET /atualizacoes/${ATUALIZACAO_ID}`]: { corpo: ATUALIZACAO_ENVIADA },
    });
    const revisar = page.getByRole('button', { name: 'Revisar atualização', exact: true });
    const destino = new RegExp(`/treinador/atualizacoes/${ATUALIZACAO_ID}`);

    // Com o nome mudado: pergunta; "Continuar editando" fica na ficha com o que foi digitado.
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Nome Trocado Fictício');
    await revisar.click();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ficha-revisar-guarda-${largura}.png`) });
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Nome Trocado Fictício');

    // "Sair sem salvar" segue para a revisão.
    await revisar.click();
    await page.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(page).toHaveURL(destino);

    // Sem alteração (edição aberta e intacta): vai direto, sem painel.
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(ALUNO.nome);
    await revisar.click();
    await expect(page).toHaveURL(destino);
    await expect(sairSemSalvar(page)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  // D7 de dentro de uma Folha: a pergunta aparece na própria Folha; "Continuar editando" deixa a Folha aberta e o nome
  // como estava; "Sair sem salvar" fecha a Folha e vai à revisão, e o voltar do navegador cai na ficha limpa.
  test(`ficha (${largura}px): sair pela Folha da pasta com a edição alterada pergunta ali e o voltar cai na ficha`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'PASTA_ALTERAR'] })),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: ATUALIZACAO_ENVIADA },
      [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: [ATUALIZACAO_ENVIADA] },
      [`GET /atualizacoes/${ATUALIZACAO_ID}`]: { corpo: ATUALIZACAO_ENVIADA },
    });
    const folha = page.getByRole('dialog');
    // A pergunta é um `alertdialog` por cima da Folha; o `dialog` é só o painel dela (C3, um diálogo por vez para o leitor de tela).
    const pergunta = page.getByRole('alertdialog');
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Nome Trocado Fictício');
    await page.getByRole('button', { name: /^Pasta Plano 17, aberta/ }).click();
    const revisarNaFolha = folha.getByRole('button', { name: 'Revisar atualização', exact: true });
    await revisarNaFolha.click();
    await expect(pergunta.getByText('Sair sem salvar?', { exact: true })).toBeVisible();
    // O foco está na pergunta e, ao "Continuar editando", volta para dentro da Folha (não para a página atrás dela).
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'))).toBe(true);
    await pergunta.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await expect(revisarNaFolha).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));

    await revisarNaFolha.click();
    await pergunta.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/atualizacoes/${ATUALIZACAO_ID}`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    await expect(page.getByRole('heading', { name: ALUNO.nome, level: 1 })).toBeVisible();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await expect(folha).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  // Revisão do PR B (1.2): "Criar e abrir" de dentro da Folha da pasta com a ficha alterada pergunta depois que a Folha
  // fecha (antes a pergunta ia para a Folha que estava saindo e sumia com ela, sem perguntar).
  test(`ficha (${largura}px): "Criar e abrir" um treino com a edição alterada pergunta antes de abrir o editor`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const PLANO_ID = 'b0000000-0000-4000-8000-000000000031';
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR'] })),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      [`POST /alunos/${ALUNO_ID}/planos-treino`]: { corpo: { plano: { id: PLANO_ID } } },
    });
    const criarEAbrir = async () => {
      await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Novo treino', exact: true }).click();
      await page.getByRole('dialog', { name: /^Novo treino em/ }).getByRole('button', { name: 'Criar e abrir', exact: true }).click();
    };
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Nome Trocado Fictício');
    await page.getByRole('button', { name: /^Pasta Plano 17, aberta/ }).click();

    await criarEAbrir();
    await expect(sairSemSalvar(page)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Nome Trocado Fictício');

    // "Continuar editando" volta para a Folha da pasta, que segue aberta.
    await criarEAbrir();
    await page.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/treinos/${PLANO_ID}`));
    expect(errosDaPagina).toEqual([]);
  });

  // D8: o "Cancelar" da edição só pergunta quando algum campo mudou. A pergunta é descartar a edição, não sair da ficha.
  test(`ficha (${largura}px): "Cancelar" sem alteração fecha direto; com alteração pergunta "Descartar alterações?"`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina, pedidos } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      ...CEP_SEM_RESULTADO,
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    });
    const nome = page.getByLabel('Nome', { exact: true });
    const cancelar = page.getByRole('button', { name: 'Cancelar', exact: true });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await cancelar.click();
    await expect(nome).toHaveCount(0);
    await expect(sairSemSalvar(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await nome.fill('Nome Trocado Fictício');
    await cancelar.click();
    await expect(page.getByText('Descartar alterações?', { exact: true })).toBeVisible();
    await expect(sairSemSalvar(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await expect(nome).toHaveValue('Nome Trocado Fictício');
    await cancelar.click();
    await page.getByRole('button', { name: 'Descartar', exact: true }).click();
    await expect(nome).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
    await expect(page.getByText(ALUNO.nome).first()).toBeVisible();
    // Descartar não grava nada, e a saída volta a ser direta.
    expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(sairSemSalvar(page)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
