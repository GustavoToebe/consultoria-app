import { expect, test, type Page } from '@playwright/test';

import type { AceiteInscricao, InscricaoDetalhe, InscricaoResumo, PaginaInscricoes } from '../src/api/inscricoesTipos';
import { erroApi, json, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { CODIGO, contagensFalsas, detalheFalso, paginaPublica, resumoFalso, rotasDaTela } from './inscricoes-falsas';

const envios = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));

/** O que a página guardou no `sessionStorage` desta guia (`null` = nada). */
const guardado = (page: Page) => page.evaluate((c) => window.sessionStorage.getItem(`inscricao_${c}`), CODIGO);

/** Parte 1 preenchida (nome e WhatsApp) e "Continuar": a página mostra a parte 2. */
async function irParaASegundaParte(page: Page) {
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
}

/** Captura para conferir à mão (390 e 1440, claro e escuro), só com `E2E_CAPTURAS` (uma pasta fora do repositório). */
async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/inscricao-${nome}.png`, fullPage: true });
}

// "Quero ser aluno" em duas partes antes de um envio só (D6 de docs/planos/auditoria-ui-ux-lote-1.md).
for (const largura of [390, 1440]) {
  test(`inscrição pública: a parte 1 confere só o contato, a 2 exige a ciência e o envio leva tudo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica({ texto: 'Usamos seus dados só para falar com você.', textoVersao: 'versao-1' }) },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição. A equipe vai falar com você.' } },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await expect(page.getByRole('heading', { name: 'Quero ser aluno', level: 1 })).toBeVisible();
    await expect(page.getByText('Parte 1 de 2')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seu contato', level: 2 })).toBeVisible();
    // A parte 1 é só o contato: o resto e o envio ficam para a parte 2.
    await expect(page.getByLabel('Objetivo (opcional)')).toHaveCount(0);
    await expect(page.getByText('Perguntas rápidas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enviar inscrição' })).toHaveCount(0);
    await capturar(page, `parte1-${largura}`);

    // Sem nome nem WhatsApp: fica na parte 1, com o erro em cada campo e o foco no primeiro. A ciência não é cobrada aqui.
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
    await expect(page.getByText('Informe seu nome.')).toBeVisible();
    await expect(page.getByText('Informe o WhatsApp com DDD.')).toBeVisible();
    await expect(page.getByLabel('Nome')).toBeFocused();
    await expect(page.getByLabel('Nome')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Marque que você leu o texto acima.')).toHaveCount(0);
    await capturar(page, `parte1-erros-${largura}`);

    await page.getByLabel('Nome').fill('Pessoa Fictícia');
    // A máscara formata o número enquanto digita.
    await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
    await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(11) 98765-4321');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Parte 2: o topo recebe o foco, o contato aparece resumido e o texto da consultoria está antes do envio.
    await expect(page.getByText('Parte 2 de 2')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
    // O foco vai para o bloco do topo da parte (o texto é filho dele).
    await expect(page.locator(':focus')).toContainText('Parte 2 de 2');
    await expect(page.getByText('Pessoa Fictícia · (11) 98765-4321')).toBeVisible();
    await expect(page.getByText('Usamos seus dados só para falar com você.')).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveCount(0);
    await capturar(page, `parte2-${largura}`);

    await page.getByRole('button', { name: 'Enviar inscrição' }).click();
    await expect(page.getByText('Marque que você leu o texto acima.')).toBeVisible();
    expect(envios(pedidos)).toHaveLength(0);

    await page.getByLabel('Objetivo (opcional)').fill('Ganhar condicionamento.');
    await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
    // A guia guarda só o contato (decisão 4): nem o objetivo nem a ciência.
    expect(JSON.parse((await guardado(page))!)).toEqual({ nome: 'Pessoa Fictícia', whatsapp: '(11) 98765-4321', email: '' });
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();

    await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    await expect(page.getByText('Recebemos sua inscrição. A equipe vai falar com você.')).toBeVisible();
    // Enviou com sucesso: nada fica na guia.
    await expect.poll(() => guardado(page)).toBeNull();
    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).toEqual({
      nome: 'Pessoa Fictícia',
      whatsapp: '(11) 98765-4321',
      email: null,
      objetivo: 'Ganhar condicionamento.',
      interesse: null,
      modalidade: null,
      previsaoInicio: null,
      origem: null,
      indicadoPor: null,
      origemLink: null,
      cienciaPrivacidade: true,
      textoVersao: 'versao-1',
      questionarioVersaoId: null,
      respostas: null,
    });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`inscrição pública: voltar e continuar não perdem nada do que foi digitado ou escolhido (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await page.getByLabel('E-mail (opcional)').fill('pessoa@exemplo.test');
    await irParaASegundaParte(page);
    await expect(page.getByText('Pessoa Fictícia · (11) 98765-4321 · pessoa@exemplo.test')).toBeVisible();
    await page.getByLabel('Objetivo (opcional)').fill('Voltar a treinar.');
    await page.getByLabel('Tô só de passagem', { exact: true }).click();

    await page.getByRole('button', { name: 'Voltar ao contato' }).click();
    await expect(page.getByRole('heading', { name: 'Seu contato', level: 2 })).toBeVisible();
    await expect(page.locator(':focus')).toContainText('Parte 1 de 2');
    await expect(page.getByLabel('Nome')).toHaveValue('Pessoa Fictícia');
    await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(11) 98765-4321');
    await expect(page.getByLabel('E-mail (opcional)')).toHaveValue('pessoa@exemplo.test');
    await page.getByLabel('Nome').fill('Pessoa Fictícia Corrigida');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Objetivo (opcional)')).toHaveValue('Voltar a treinar.');
    await expect(page.getByRole('radiogroup', { name: 'Quando quer começar?' }).getByRole('radio', { name: 'Tô só de passagem' }))
      .toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();

    await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    expect(envios(pedidos)[0].corpo).toMatchObject({
      nome: 'Pessoa Fictícia Corrigida', email: 'pessoa@exemplo.test', objetivo: 'Voltar a treinar.', previsaoInicio: 'SO_DE_PASSAGEM',
    });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`inscrição pública: erro da API num campo do contato volta à parte 1 e foca o campo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let tentativas = 0;
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
      [`POST /publico/inscricoes/${CODIGO}`]: (_p, route) => {
        tentativas += 1;
        if (tentativas === 1) {
          const { status, corpo } = erroApi(422, 'Confira os campos.', 'INSCRICAO_INVALIDA', [
            { field: 'whatsapp', message: 'Este WhatsApp não parece válido.' },
          ]);
          return json(route, corpo, status);
        }
        return json(route, { mensagem: 'Recebemos sua inscrição.' }, 202);
      },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await irParaASegundaParte(page);
    await page.getByLabel('Objetivo (opcional)').fill('Força.');
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();

    await expect(page.getByRole('heading', { name: 'Seu contato', level: 2 })).toBeVisible();
    await expect(page.getByText('Este WhatsApp não parece válido.')).toBeVisible();
    await expect(page.getByText('Confira os campos.')).toBeVisible();
    await expect(page.getByLabel('WhatsApp com DDD')).toBeFocused();
    await expect(page.getByLabel('WhatsApp com DDD')).toHaveAttribute('aria-invalid', 'true');
    await capturar(page, `erro-da-api-${largura}`);

    await page.getByLabel('WhatsApp com DDD').fill('');
    await page.getByLabel('WhatsApp com DDD').pressSequentially('11912345678');
    await page.getByRole('button', { name: 'Continuar' }).click();
    // O que estava na parte 2 continua lá.
    await expect(page.getByLabel('Objetivo (opcional)')).toHaveValue('Força.');
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    expect(envios(pedidos).map((p) => (p.corpo as { whatsapp: string }).whatsapp)).toEqual(['(11) 98765-4321', '(11) 91234-5678']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`inscrição pública: sem nada além do contato a página fica numa parte só (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica({ campos: ['EMAIL'], texto: 'Texto fictício.', textoVersao: 'versao-1' }) },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await expect(page.getByText('Parte 1 de 2')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
    await expect(page.getByText('Texto fictício.')).toBeVisible();
    await page.getByLabel('Nome').fill('Pessoa Fictícia');
    await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
    await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
    await page.getByRole('button', { name: 'Enviar inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    expect(envios(pedidos)).toHaveLength(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('inscrição pública: tema escuro nas duas partes (390 e 1440 px)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica({ texto: 'Usamos seus dados só para falar com você.', textoVersao: 'versao-1' }) },
  });
  for (const largura of [390, 1440]) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto(`/inscricao/${CODIGO}`);
    // A tela guarda o que foi digitado no sessionStorage e repõe ao recarregar: sem limpar, a 2ª largura abriria na parte 2.
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Informe seu nome.')).toBeVisible();
    await capturar(page, `escuro-parte1-erros-${largura}`);
    await irParaASegundaParte(page);
    await capturar(page, `escuro-parte2-${largura}`);
  }
});

test('inscrição pública: origens do time, "Tô só de passagem" e o texto do link com negrito', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: {
      corpo: paginaPublica({ texto: 'Primeiro parágrafo.\n\n**Obs: não preencha se não for entrar agora.**', textoVersao: 'versao-2' }),
    },
    [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição. A equipe vai falar com você.' } },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await irParaASegundaParte(page);
  // Os asteriscos somem e o trecho fica em negrito.
  await expect(page.getByText('**', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Obs: não preencha se não for entrar agora.', { exact: true })).toHaveCSS('font-family', /Inter_700Bold/);

  // As quatro origens novas e a previsão nova estão entre as opções (as antigas continuam).
  for (const rotulo of ['Indicação', 'Instagram', 'Google', 'YouTube', 'TikTok', 'Influenciador(a) ou atleta do time', 'Aluno do time', 'Outra']) {
    await expect(page.getByLabel(rotulo, { exact: true })).toHaveCount(1);
  }
  for (const rotulo of ['Agora', 'Este mês', 'Próximo mês', 'Tô só de passagem', 'Ainda não sei']) {
    await expect(page.getByLabel(rotulo, { exact: true }).first()).toBeVisible();
  }

  await page.getByLabel('Tô só de passagem', { exact: true }).click();
  await page.getByLabel('TikTok', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();

  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));
  expect(envio?.corpo).toMatchObject({ previsaoInicio: 'SO_DE_PASSAGEM', origem: 'TIKTOK', textoVersao: 'versao-2' });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('inscrição pública: a escolha mostra o erro que a API apontou', async ({ page }) => {
  await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
    [`POST /publico/inscricoes/${CODIGO}`]: erroApi(422, 'Confira os campos.', 'INSCRICAO_INVALIDA', [
      { field: 'interesse', message: 'Escolha o que você procura.' },
    ]),
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await irParaASegundaParte(page);
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  // O campo é da parte 2: a página fica nela.
  await expect(page.getByText('Escolha o que você procura.')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'O que você procura?' }).getByRole('radio', { name: 'Não informar' })).toBeFocused();
});

test('inscrição pública: limite de envios (429) mostra o texto do formulário, não o do login', async ({ page }) => {
  await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
    [`POST /publico/inscricoes/${CODIGO}`]: erroApi(429, 'Muitas tentativas de acesso. Aguarde e tente novamente.', 'LOGIN_LIMITADO'),
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await irParaASegundaParte(page);
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByText('Recebemos muitos envios agora. Tente de novo mais tarde.')).toBeVisible();
  await expect(page.getByText(/tentativas de acesso/)).toHaveCount(0);
});

test('inscrição pública: link desligado ou inexistente mostra o erro, sem formulário', async ({ page }) => {
  await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { status: 404, corpo: { status: 404, message: 'Link de inscrição não encontrado.', codigo: 'NAO_ENCONTRADO' } },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await expect(page.getByText('Link de inscrição não encontrado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar inscrição' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
});

const INSCRICAO_ID = 'i0000000-0000-4000-8000-000000000001';
const ALUNO_NOVO = 'a0000000-0000-4000-8000-000000000099';

const resumo: InscricaoResumo = resumoFalso(1, {
  id: INSCRICAO_ID,
  nome: 'Pessoa Interessada',
  objetivo: 'Hipertrofia',
  email: 'interessada@exemplo.test',
  responsavelId: TREINADOR.id,
  responsavelNome: TREINADOR.nome,
  versao: 3,
  duplicidade: { alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 1, outrasInscricoesAnteriores: 0 },
});

const detalhe: InscricaoDetalhe = detalheFalso(resumo, {
  cienciaEm: '2026-10-18T13:00:00Z',
  cienciaTexto: 'Texto da consultoria.',
});

const Q_GERAL = 'q0000000-0000-4000-8000-000000000001';
const Q_ESPORTIVA = 'q0000000-0000-4000-8000-000000000002';

/** Painel "Aceitar inscrição?" aberto, com duas anamneses publicadas (a geral é a padrão). */
async function abrirAceite(page: Page, aceite: AceiteInscricao, extras: RespostasApi = {}) {
  const pagina: PaginaInscricoes = { itens: [resumo], total: 1 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela({ 'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) } }),
    'GET /inscricoes': (p, route) => json(route, p.busca.get('situacao') === 'ABERTAS' ? pagina : { itens: [], total: 0 }),
    [`GET /inscricoes/${INSCRICAO_ID}`]: { corpo: detalhe },
    'GET /questionarios/opcoes': (p, route) => json(route, p.busca.get('finalidade') === 'ANAMNESE'
      ? [{ id: Q_ESPORTIVA, nome: 'Anamnese esportiva', padrao: false }, { id: Q_GERAL, nome: 'Anamnese geral', padrao: true }]
      : []),
    [`POST /inscricoes/${INSCRICAO_ID}/aceitar`]: { corpo: aceite },
    ...extras,
  });
  await page.goto('/treinador/interessados');
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  await expect(page.getByText('Pessoa Interessada')).toBeVisible();
  await expect(page.getByText('Possível duplicidade')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Interessada' }).click();
  await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
  await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
  expect(api.pedidos.some((p) => p.caminho.endsWith('/aceitar'))).toBe(false);
  return api;
}

for (const largura of [390, 1280]) {
  test(`Interessados: lista as inscrições, abre a folha e o Aceitar manda a anamnese padrão e mostra o link do convite (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aceite: AceiteInscricao = {
      id: INSCRICAO_ID,
      alunoId: ALUNO_NOVO,
      convite: { codigo: 'codigo-convite', link: 'https://consultoria.exemplo.test/convite#codigo=codigo-convite', expiraEm: '2026-10-25T13:00:00Z' },
      anamneseId: 'n0000000-0000-4000-8000-000000000001',
    };
    const { pedidos, naoTratadas, errosDaPagina } = await abrirAceite(page, aceite);
    // A padrão publicada já vem marcada; com o convite marcado não há dica de acesso.
    await expect(page.getByRole('radio', { name: 'Anamnese geral (padrão)' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Não enviar agora' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('O aluno responde quando entrar no app.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('https://consultoria.exemplo.test/convite#codigo=codigo-convite')).toBeVisible();
    await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado. Anamnese enviada.')).toBeVisible();
    const aceitar = pedidos.find((p) => p.caminho.endsWith('/aceitar'));
    expect(aceitar?.corpo).toEqual({ convidar: true, anamneseQuestionarioId: Q_GERAL, versao: 3 });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Interessados: escolher "Não enviar agora" aceita com anamneseQuestionarioId nulo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aceite: AceiteInscricao = { id: INSCRICAO_ID, alunoId: ALUNO_NOVO, convite: null, anamneseId: null };
    const { pedidos, naoTratadas, errosDaPagina } = await abrirAceite(page, aceite);
    await expect(page.getByRole('radio', { name: 'Anamnese geral (padrão)' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Não enviar agora', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Não enviar agora' })).toHaveAttribute('aria-checked', 'true');
    // Sem anamnese escolhida não há dica; com ela e sem convite, a dica aparece.
    await expect(page.getByText('O aluno responde quando entrar no app.')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Enviar convite de acesso ao app' }).click();
    await page.getByRole('radio', { name: 'Anamnese esportiva', exact: true }).click();
    await expect(page.getByText('O aluno responde quando entrar no app.')).toBeVisible();
    await page.getByRole('radio', { name: 'Não enviar agora', exact: true }).click();
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado.', { exact: true })).toBeVisible();
    const aceitar = pedidos.find((p) => p.caminho.endsWith('/aceitar'));
    expect(aceitar?.corpo).toEqual({ convidar: false, anamneseQuestionarioId: null, versao: 3 });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Interessados: com muitas anamneses todas cabem no painel de aceite e a escolhida vai no corpo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aceite: AceiteInscricao = { id: INSCRICAO_ID, alunoId: ALUNO_NOVO, convite: null, anamneseId: 'n0000000-0000-4000-8000-000000000001' };
    // Oito publicadas + "Não enviar agora" = nove opções, todas como botões no painel (a folha de escolha não funciona dentro dele).
    const muitas = Array.from({ length: 8 }, (_, i) => ({ id: `q0000000-0000-4000-8000-0000000001${i}0`, nome: `Anamnese ${i + 1}`, padrao: i === 0 }));
    const { pedidos, naoTratadas, errosDaPagina } = await abrirAceite(page, aceite, {
      'GET /questionarios/opcoes': { corpo: muitas },
    });
    await expect(page.getByRole('radio', { name: 'Anamnese 1 (padrão)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Anamnese 5', exact: true }).click();
    await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Anamnese 5', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado. Anamnese enviada.')).toBeVisible();
    const aceitar = pedidos.find((p) => p.caminho.endsWith('/aceitar'));
    expect(aceitar?.corpo).toEqual({ convidar: true, anamneseQuestionarioId: muitas[4].id, versao: 3 });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Interessados: anamnese indisponível no aceite avisa, recarrega as opções e reabre o painel (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aceite: AceiteInscricao = { id: INSCRICAO_ID, alunoId: ALUNO_NOVO, convite: null, anamneseId: 'n0000000-0000-4000-8000-000000000001' };
    let tentativas = 0;
    let buscasDeOpcoes = 0;
    const { pedidos, naoTratadas, errosDaPagina } = await abrirAceite(page, aceite, {
      'GET /questionarios/opcoes': (_p, route) => {
        buscasDeOpcoes += 1;
        // Na segunda busca a esportiva (a escolhida) já não está publicada.
        return json(route, buscasDeOpcoes === 1
          ? [{ id: Q_ESPORTIVA, nome: 'Anamnese esportiva', padrao: false }, { id: Q_GERAL, nome: 'Anamnese geral', padrao: true }]
          : [{ id: Q_GERAL, nome: 'Anamnese geral', padrao: true }]);
      },
      [`POST /inscricoes/${INSCRICAO_ID}/aceitar`]: (_p, route) => {
        tentativas += 1;
        if (tentativas === 1) {
          const { status, corpo } = erroApi(409, 'Essa anamnese não está disponível.', 'QUESTIONARIO_INDISPONIVEL');
          return json(route, corpo, status);
        }
        return json(route, aceite);
      },
    });
    await page.getByRole('radio', { name: 'Anamnese esportiva', exact: true }).click();
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Essa anamnese não está mais disponível. Escolha outra.')).toBeVisible();
    await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Anamnese esportiva', exact: true })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Anamnese geral (padrão)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado. Anamnese enviada.')).toBeVisible();
    const envios = pedidos.filter((p) => p.caminho.endsWith('/aceitar'));
    expect(envios.map((p) => (p.corpo as { anamneseQuestionarioId: string | null }).anamneseQuestionarioId)).toEqual([Q_ESPORTIVA, Q_GERAL]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
