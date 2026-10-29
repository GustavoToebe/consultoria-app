import { expect, test, type Page } from '@playwright/test';

import type { AceiteInscricao, InscricaoDetalhe, InscricaoResumo, PaginaInscricoes } from '../src/api/inscricoesTipos';
import { erroApi, json, MARCA, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';

const CODIGO = 'codigo-de-teste-abcdefghijk';

test('inscrição pública: confere os campos, exige a ciência do texto e mostra a mensagem neutra depois do envio', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo: { consultoria: MARCA, texto: 'Usamos seus dados só para falar com você.', textoVersao: 'versao-1', aberta: true } },
    [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição. A equipe vai falar com você.' } },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await expect(page.getByRole('heading', { name: 'Quero ser aluno' })).toBeVisible();
  await expect(page.getByText('Usamos seus dados só para falar com você.')).toBeVisible();

  // Sem nome, WhatsApp nem ciência: nada vai para a API.
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
  await expect(page.getByText('Informe seu nome.')).toBeVisible();
  await expect(page.getByText('Marque que você leu o texto acima.')).toBeVisible();
  const envios = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));
  expect(envios()).toHaveLength(0);

  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  // A máscara formata o número enquanto digita.
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(11) 98765-4321');
  await page.getByLabel('Objetivo (opcional)').fill('Ganhar condicionamento.');
  await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();

  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
  await expect(page.getByText('Recebemos sua inscrição. A equipe vai falar com você.')).toBeVisible();
  expect(envios()).toHaveLength(1);
  expect(envios()[0].corpo).toEqual({
    nome: 'Pessoa Fictícia',
    whatsapp: '(11) 98765-4321',
    email: null,
    objetivo: 'Ganhar condicionamento.',
    observacao: null,
    cienciaPrivacidade: true,
    textoVersao: 'versao-1',
  });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('inscrição pública: link desligado ou inexistente mostra o erro, sem formulário', async ({ page }) => {
  await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { status: 404, corpo: { status: 404, message: 'Link de inscrição não encontrado.', codigo: 'NAO_ENCONTRADO' } },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await expect(page.getByText('Link de inscrição não encontrado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar inscrição' })).toHaveCount(0);
});

const INSCRICAO_ID = 'i0000000-0000-4000-8000-000000000001';
const ALUNO_NOVO = 'a0000000-0000-4000-8000-000000000099';

const resumo: InscricaoResumo = {
  id: INSCRICAO_ID,
  nome: 'Pessoa Interessada',
  objetivo: 'Hipertrofia',
  whatsapp: '(11) 98765-4321',
  email: 'interessada@exemplo.test',
  situacao: 'NOVA',
  pagamento: 'NAO_CONTROLADO',
  responsavelId: TREINADOR.id,
  responsavelNome: TREINADOR.nome,
  alunoId: null,
  criadaEm: '2026-10-18T13:00:00Z',
  duplicidade: { alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 1 },
};

const detalhe: InscricaoDetalhe = {
  ...resumo,
  observacao: null,
  cienciaEm: '2026-10-18T13:00:00Z',
  cienciaTexto: 'Texto da consultoria.',
  pagamentoConfirmadoPorNome: null,
  pagamentoConfirmadoEm: null,
  atualizadaEm: '2026-10-18T13:00:00Z',
  versao: 3,
  notas: [],
};

const Q_GERAL = 'q0000000-0000-4000-8000-000000000001';
const Q_ESPORTIVA = 'q0000000-0000-4000-8000-000000000002';

/** Painel "Aceitar inscrição?" aberto, com duas anamneses publicadas (a geral é a padrão). */
async function abrirAceite(page: Page, aceite: AceiteInscricao, extras: RespostasApi = {}) {
  const pagina: PaginaInscricoes = { itens: [resumo], total: 1 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /inscricoes/configuracao': {
      corpo: { aberta: true, codigo: CODIGO, link: `https://consultoria.exemplo.test/inscricao/${CODIGO}`, responsavelId: TREINADOR.id, texto: null, versao: 2 },
    },
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
    await expect(page.getByRole('button', { name: 'Anamnese geral (padrão)' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Não enviar agora' })).toHaveAttribute('aria-checked', 'false');
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
    await expect(page.getByRole('button', { name: 'Anamnese geral (padrão)' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Não enviar agora', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Não enviar agora' })).toHaveAttribute('aria-checked', 'true');
    // Sem anamnese escolhida não há dica; com ela e sem convite, a dica aparece.
    await expect(page.getByText('O aluno responde quando entrar no app.')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Enviar convite de acesso ao app' }).click();
    await page.getByRole('button', { name: 'Anamnese esportiva', exact: true }).click();
    await expect(page.getByText('O aluno responde quando entrar no app.')).toBeVisible();
    await page.getByRole('button', { name: 'Não enviar agora', exact: true }).click();
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
    await expect(page.getByRole('button', { name: 'Anamnese 1 (padrão)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Anamnese 5', exact: true }).click();
    await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anamnese 5', exact: true })).toHaveAttribute('aria-checked', 'true');
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
    await page.getByRole('button', { name: 'Anamnese esportiva', exact: true }).click();
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Essa anamnese não está mais disponível. Escolha outra.')).toBeVisible();
    await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anamnese esportiva', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anamnese geral (padrão)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Aceitar e cadastrar' }).click();

    await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado. Anamnese enviada.')).toBeVisible();
    const envios = pedidos.filter((p) => p.caminho.endsWith('/aceitar'));
    expect(envios.map((p) => (p.corpo as { anamneseQuestionarioId: string | null }).anamneseQuestionarioId)).toEqual([Q_ESPORTIVA, Q_GERAL]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
