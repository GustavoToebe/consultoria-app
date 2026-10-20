import { expect, test } from '@playwright/test';

import type { AlunoDetalhe, AnamneseDetalhe, AnamneseResumo, ConteudoQuestionario } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, TREINADOR } from './api-falsa';
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
};

const ROTAS_DA_FICHA = { 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } };

test('ficha: telefone, CPF e endereço na leitura; edição valida, envia e mostra o CPF repetido no campo', async ({ page }) => {
  let tentativas = 0;
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
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

test('ficha: endereço parcial é recusado (só a cidade), "s/n" vale e tudo em branco apaga o endereço', async ({ page }) => {
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
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

test('ficha de aluno sem acesso: telefone com a nota e sem campo de telefone na edição', async ({ page }) => {
  await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, telefone: undefined, temAcesso: false } },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('O telefone entra depois que o aluno criar o acesso.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Telefone (opcional)')).toHaveCount(0);
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
