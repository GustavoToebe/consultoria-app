import { expect, test } from '@playwright/test';

import type { ConfiguracaoInscricao, InscricaoPublica } from '../src/api/inscricoesTipos';
import type { ConteudoQuestionario, QuestionarioDetalhe, QuestionarioResumo } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { CAMPOS_FIXOS, CODIGO, contagensFalsas, detalheFalso, paginaPublica, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * "Quero ser aluno" com as perguntas do treinador (docs/planos/inscricao-com-perguntas-proprias.md): a página pública
 * mostra só os campos fixos visíveis e as perguntas do padrão de inscrição no formulário da anamnese, confere a
 * obrigatória, esconde pela condição, manda a versão e as respostas e, com as perguntas trocadas no meio, recarrega e
 * avisa. No Planejamento, a aba Inscrição mostra os campos fixos (esconder vai na hora à API), a lista e o editor com o
 * aviso de saúde e sem os tipos de fora. Só dados fictícios.
 */
const VERSAO_1 = 'v0000000-0000-4000-8000-000000000001';
const VERSAO_2 = 'v0000000-0000-4000-8000-000000000002';
const QUESTIONARIO_ID = 'q0000000-0000-4000-8000-000000000009';

const PERGUNTAS: ConteudoQuestionario = {
  formato: 2, instrucoes: [],
  secoes: [{ uid: 's1', titulo: 'Sua rotina', perguntas: [
    { id: 'treina', tipo: 'SIM_NAO', rotulo: 'Já treina?', obrigatoria: true },
    { id: 'onde', tipo: 'TEXTO', rotulo: 'Onde treina?', obrigatoria: true, mostrarSe: { perguntaId: 'treina', valores: ['sim'] } },
    { id: 'horario', tipo: 'ESCOLHA_UNICA', rotulo: 'Melhor horário', obrigatoria: false,
      opcoes: [{ id: 'manha', rotulo: 'Manhã' }, { id: 'noite', rotulo: 'Noite' }] },
  ] }],
};

const PAGINA: InscricaoPublica = paginaPublica({
  campos: CAMPOS_FIXOS.filter((c) => c !== 'EMAIL' && c !== 'ORIGEM'),
  perguntas: { versaoId: VERSAO_1, conteudo: PERGUNTAS },
});

const envios = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));

for (const largura of [390, 1280]) {
  test(`inscrição pública: campos escondidos somem, as perguntas conferem a obrigatória e a condição, e o envio leva a versão (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: PAGINA },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await expect(page.getByRole('heading', { name: 'Quero ser aluno' })).toBeVisible();
    // E-mail e "Como conheceu" escondidos pelo treinador; os outros fixos e as perguntas dele aparecem.
    await expect(page.getByLabel('E-mail (opcional)')).toHaveCount(0);
    await expect(page.getByText('Como conheceu a consultoria?')).toHaveCount(0);
    await expect(page.getByLabel('Objetivo (opcional)')).toBeVisible();
    await expect(page.getByText('Sua rotina')).toBeVisible();
    // A pergunta com condição só aparece com "Sim".
    await expect(page.getByLabel('Onde treina? *')).toHaveCount(0);

    await page.getByLabel('Nome').fill('Pessoa Fictícia');
    await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();
    await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
    await expect(page.getByText('Preencha este campo.')).toBeVisible();
    expect(envios(pedidos)).toHaveLength(0);

    await page.getByRole('radiogroup', { name: 'Já treina? *' }).getByRole('button', { name: 'Sim', exact: true }).click();
    await expect(page.getByLabel('Onde treina? *')).toBeVisible();
    await page.getByLabel('Onde treina? *').fill('Academia do bairro');
    // Mudou de ideia: a condição esconde de novo e a resposta escondida não vai.
    await page.getByRole('radiogroup', { name: 'Já treina? *' }).getByRole('button', { name: 'Não', exact: true }).click();
    await expect(page.getByLabel('Onde treina? *')).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Melhor horário' }).getByRole('button', { name: 'Noite', exact: true }).click();
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();

    await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).toMatchObject({
      nome: 'Pessoa Fictícia', email: null, origem: null, questionarioVersaoId: VERSAO_1,
      respostas: { treina: false, horario: 'noite' },
    });
    expect((envios(pedidos)[0].corpo as { respostas: Record<string, unknown> }).respostas).not.toHaveProperty('onde');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('inscrição pública: perguntas trocadas no meio do preenchimento recarregam a página e a pessoa envia a versão nova', async ({ page }) => {
  let leituras = 0;
  let tentativas = 0;
  const novas: ConteudoQuestionario = { formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'Perguntas novas', perguntas: [
    { id: 'horario', tipo: 'ESCOLHA_UNICA', rotulo: 'Melhor horário', obrigatoria: false,
      opcoes: [{ id: 'manha', rotulo: 'Manhã' }, { id: 'noite', rotulo: 'Noite' }] },
  ] }] };
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: (_p, route) => {
      leituras += 1;
      return json(route, leituras === 1 ? PAGINA : { ...PAGINA, perguntas: { versaoId: VERSAO_2, conteudo: novas } });
    },
    [`POST /publico/inscricoes/${CODIGO}`]: (_p, route) => {
      tentativas += 1;
      if (tentativas === 1) {
        const { status, corpo } = erroApi(409, 'A consultoria mudou as perguntas.', 'PERGUNTAS_ALTERADAS');
        return json(route, corpo, status);
      }
      return json(route, { mensagem: 'Recebemos sua inscrição.' }, 202);
    },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('radiogroup', { name: 'Já treina? *' }).getByRole('button', { name: 'Não', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Melhor horário' }).getByRole('button', { name: 'Manhã', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();

  await expect(page.getByText('As perguntas da consultoria mudaram. Confira as perguntas e envie de novo.')).toBeVisible();
  await expect(page.getByText('Perguntas novas')).toBeVisible();
  await expect(page.getByLabel('Nome')).toHaveValue('Pessoa Fictícia');
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
  const corpos = envios(pedidos).map((p) => p.corpo as { questionarioVersaoId: string; respostas: Record<string, unknown> });
  expect(corpos.map((c) => c.questionarioVersaoId)).toEqual([VERSAO_1, VERSAO_2]);
  // A pergunta que saiu não vai na versão nova; a que continua guarda a resposta.
  expect(corpos[1].respostas).toEqual({ horario: 'manha' });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

const PADRAO: QuestionarioResumo = {
  id: QUESTIONARIO_ID, nome: 'Inscrição', descricao: 'Perguntas da página "Quero ser aluno", embaixo dos campos fixos.',
  finalidade: 'INSCRICAO', padrao: true, arquivado: false, versaoPublicada: 1, publicadoEm: '2026-10-31T12:00:00Z',
  alteradoDesdePublicacao: false, rascunhoAlteradoEm: '2026-10-31T12:00:00Z', uso: { alunos: 0, pastas: 0, envios: 2 },
};

const CONFIG: ConfiguracaoInscricao = {
  aberta: true, codigo: CODIGO, link: `https://consultoria.exemplo.test/inscricao/${CODIGO}`, responsavelId: null, texto: null,
  camposOcultos: [], versao: 4,
};

for (const largura of [390, 1280]) {
  test(`Planejamento › Inscrição: esconder um campo fixo vai na hora à API e o editor avisa sobre saúde e não oferece foto (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const detalhe: QuestionarioDetalhe = { ...PADRAO, versao: 3, rascunho: PERGUNTAS, versoes: [{ numero: 1, publicadoEm: '2026-10-31T12:00:00Z' }] };
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'QUESTIONARIO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /inscricoes/configuracao': { corpo: CONFIG },
      'PUT /inscricoes/configuracao/campos-ocultos': (p, route) =>
        json(route, { ...CONFIG, camposOcultos: (p.corpo as { camposOcultos: string[] }).camposOcultos, versao: 5 }),
      'GET /questionarios': (p, route) => json(route, p.busca.get('finalidade') === 'INSCRICAO' ? [PADRAO] : []),
      [`GET /questionarios/${QUESTIONARIO_ID}`]: { corpo: detalhe },
    });
    await page.goto('/treinador/planejamento?aba=inscricao');
    await expect(page.getByText('Campos fixos da página')).toBeVisible();
    await expect(page.getByText('Perguntas da inscrição')).toBeVisible();
    await expect(page.getByText('Inscrição', { exact: true }).first()).toBeVisible();

    await page.getByRole('switch', { name: 'Mostrar "E-mail"' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/inscricoes/configuracao/campos-ocultos').length).toBe(1);
    expect(pedidos.find((p) => p.metodo === 'PUT')?.corpo).toEqual({ camposOcultos: ['EMAIL'], versao: 4 });
    await expect(page.getByRole('switch', { name: 'Mostrar "E-mail"' })).not.toBeChecked();

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Perguntas da inscrição', level: 1 })).toBeVisible();
    await expect(page.getByText('Não peça informação de saúde aqui; ela fica para a anamnese, depois do aceite.')).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar pergunta' }).first().click();
    await expect(page.getByText('Texto curto', { exact: true })).toBeVisible();
    await expect(page.getByText('Fotos', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Endereço', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Peso', { exact: true })).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`Interessados: a inscrição mostra as respostas às perguntas da página, na versão respondida (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const resumo = resumoFalso(1);
    const detalhe = detalheFalso(resumo, {
      respostas: { questionarioVersaoId: VERSAO_1, questionarioVersaoNumero: 3, modelo: PERGUNTAS, respostas: { treina: false, horario: 'noite' } },
    });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...rotasDaTela({ 'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) } }),
      'GET /inscricoes': { corpo: { itens: [resumo], total: 1 } },
      [`GET /inscricoes/${resumo.id}`]: { corpo: detalhe },
    });
    await page.goto('/treinador/interessados');
    await page.getByRole('button', { name: `Abrir inscrição de ${resumo.nome}` }).click();
    await expect(page.getByText('Respostas às perguntas da página')).toBeVisible();
    await expect(page.getByText('Versão 3 das perguntas. Não vão para o cadastro do aluno no aceite.')).toBeVisible();
    await expect(page.getByText('Já treina?')).toBeVisible();
    await expect(page.getByText('Noite', { exact: true })).toBeVisible();
    // A pergunta escondida pela condição aparece como "Não se aplica" na leitura.
    await expect(page.getByText('Não se aplica').first()).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
