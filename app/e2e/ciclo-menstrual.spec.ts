import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe, AnamneseDetalhe, CicloDaAluna, DiaDeCicloApi, EuResponse, PastaResumo, RegistroDeCicloApi, RegistroPeso } from '../src/api/tipos';
import { ALUNO, json, MARCA, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const ANAMNESE_ID = 'n0000000-0000-4000-8000-000000000001';

function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function cicloInicial(): CicloDaAluna {
  return {
    disponivel: true, ativo: false, consentimentoVersaoAtual: 1,
    duracaoHabitual: null, mostrarFases: true, registros: [], dias: [], textosDasFases: null,
  };
}

async function rotasDaAluna(page: Page, sexo: 'FEMININO' | 'MASCULINO') {
  const rotas = await sessaoDeAluno(page);
  const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
  rotas['GET /eu'] = { corpo: { ...eu, aluno: { id: ALUNO_ID, nome: ALUNO.nome, sexo } } };
  return rotas;
}

/** Rotas do ciclo da aluna, com o estado guardado no teste. */
function rotasDoCiclo(ciclo: { atual: CicloDaAluna }) {
  const responder = (_pedido: unknown, route: Route) => json(route, ciclo.atual);
  return {
    'GET /aluno/ciclo': responder,
    'POST /aluno/ciclo/ativar': (p: { corpo: unknown }, route: Route) => {
      ciclo.atual = { ...ciclo.atual, ativo: true, duracaoHabitual: (p.corpo as { duracaoHabitual: number | null }).duracaoHabitual };
      return json(route, ciclo.atual);
    },
    'POST /aluno/ciclo/registros': (p: { corpo: unknown }, route: Route) => {
      const registro = p.corpo as RegistroDeCicloApi;
      ciclo.atual = { ...ciclo.atual, registros: [registro, ...(ciclo.atual.registros ?? [])] };
      return json(route, registro);
    },
    'PUT /aluno/ciclo/registros/{id}': (p: { corpo: unknown; caminho: string }, route: Route) => {
      const id = p.caminho.split('/').pop();
      const registro = p.corpo as RegistroDeCicloApi;
      ciclo.atual = { ...ciclo.atual, registros: (ciclo.atual.registros ?? []).map((r) => r.id === id ? { ...r, ...registro } : r) };
      return json(route, registro);
    },
    'PUT /aluno/ciclo/dias/{data}': (p: { corpo: unknown; caminho: string }, route: Route) => {
      const data = p.caminho.split('/').pop() ?? hoje();
      const dia: DiaDeCicloApi = { ...(p.corpo as DiaDeCicloApi), id: 'dia', data };
      ciclo.atual = { ...ciclo.atual, dias: [...(ciclo.atual.dias ?? []).filter((d) => d.data !== data), dia] };
      return json(route, dia);
    },
    'DELETE /aluno/ciclo/dias/{data}': (p: { caminho: string }, route: Route) => {
      const data = p.caminho.split('/').pop();
      ciclo.atual = { ...ciclo.atual, dias: (ciclo.atual.dias ?? []).filter((d) => d.data !== data) };
      return route.fulfill({ status: 204 });
    },
  };
}

for (const largura of [390, 1280]) {
  test(`aluna liga o acompanhamento, registra a menstruação e um sintoma (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const ciclo = { atual: cicloInicial() };
    const { errosDaPagina } = await simularApi(page, {
      ...(await rotasDaAluna(page, 'FEMININO')),
      ...rotasDoCiclo(ciclo),
    });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Ciclo menstrual', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Ativar acompanhamento' }).click();
    await page.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abrir' })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir' }).click();
    await expect(page.getByRole('heading', { name: 'Ciclo menstrual', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Minha menstruação começou hoje' }).click();
    await expect(page.getByText('Dia 1 do ciclo · Menstrual')).toBeVisible();
    await page.getByRole('button', { name: 'Minha menstruação terminou hoje' }).click();
    await expect(page.getByText('Dia 1 do ciclo · Menstrual')).toBeVisible();

    await page.getByRole('button', { name: 'Como estou hoje' }).click();
    await page.getByRole('button', { name: 'Inchaço', exact: true }).click();
    const recarregou = page.waitForResponse((r) => r.url().includes('/aluno/ciclo') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await recarregou;
    await page.getByRole('button', { name: 'Como estou hoje' }).click();
    await expect(page.getByRole('button', { name: 'Limpar dia' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar dia' }).click();
    const limpou = page.waitForResponse((r) => r.url().includes('/aluno/ciclo') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await limpou;
    await expect(page.getByText('Dia limpo.')).toBeVisible();
    await page.getByRole('button', { name: 'Como estou hoje' }).click();
    await expect(page.getByRole('button', { name: 'Limpar dia' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno do sexo masculino não vê o cartão (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await simularApi(page, {
      ...(await rotasDaAluna(page, 'MASCULINO')),
      'GET /aluno/ciclo': { corpo: { disponivel: false } },
    });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect(page.getByText('Ativar acompanhamento')).toHaveCount(0);
  });
}

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null,
  endereco: null, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null,
  anonimizado: false, emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, sexo: 'FEMININO',
};

function deslocar(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

const HOJE = hoje();
const INICIO_ATUAL = deslocar(HOJE, -10);
const INICIO_ANTERIOR = deslocar(INICIO_ATUAL, -28);
const DIA_LUTEO = deslocar(INICIO_ATUAL, -6);
const DIA_SINTOMA = deslocar(INICIO_ATUAL, 2);

const PASTA: PastaResumo = {
  id: 'p0000000-0000-4000-8000-000000000001', alunoId: ALUNO_ID, titulo: 'Pasta de janeiro',
  inicio: INICIO_ANTERIOR, fim: HOJE, concluidaEm: null,
};

const PESOS: RegistroPeso[] = [
  { id: 'w1', data: deslocar(INICIO_ANTERIOR, 2), pesoKg: 70, variacao: null, observacao: null },
  { id: 'w2', data: DIA_LUTEO, pesoKg: 69.5, variacao: -0.5, observacao: null },
];

const CICLO_LIGADO = {
  ativo: true, duracaoHabitual: 28, mostrarFases: true,
  registros: [
    { id: 'r1', inicio: INICIO_ANTERIOR, fim: deslocar(INICIO_ANTERIOR, 4) },
    { id: 'r2', inicio: INICIO_ATUAL, fim: deslocar(INICIO_ATUAL, 4) },
  ],
  dias: [{ id: 'd1', data: DIA_SINTOMA, fluxo: 'LEVE', colica: null, sintomas: ['INCHACO'], observacao: 'Dia fictício' }],
};

for (const largura of [390, 1280]) {
  test(`treinador vê a faixa, o gráfico e o dia só para ler (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /consultoria': { corpo: { ...MARCA, textosFasesCiclo: { menstrual: 'Texto fictício da fase.', folicular: null, ovulatoria: null, lutea: null } } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/ciclo`]: { corpo: CICLO_LIGADO },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: PESOS },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await expect(page.getByText('Ciclo menstrual: acompanhamento ligado pela aluna')).toBeVisible();
    await page.getByRole('button', { name: 'Ver ciclo' }).click();
    const [ano, mes] = DIA_SINTOMA.split('-');
    const nomeDoMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(mes) - 1];
    await page.getByRole('button', { name: `${DIA_SINTOMA.slice(8)} de ${nomeDoMes} de ${ano}` }).click();
    await expect(page.getByText('Dia fictício')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await expect(page.getByText('Lútea · dia 23')).toBeVisible();
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(page.getByText('Menstrual').first()).toBeVisible();

    await page.getByText('Pasta de janeiro').click();
    await expect(page.getByText('Ciclo no período da pasta')).toBeVisible();
  });

  test(`sem dados sensíveis o ciclo não aparece (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const rotas = await sessao(page, TREINADOR);
    const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
    rotas['GET /eu'] = { corpo: { ...eu, permissoes: (eu.permissoes ?? []).filter((p) => p !== 'ALUNO_SENSIVEL_LER') } };
    await simularApi(page, {
      ...rotas,
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/ciclo`]: { status: 403, corpo: { status: 403, message: 'Sem acesso.', codigo: 'PERMISSAO_NEGADA' } },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await expect(page.getByRole('heading', { name: ALUNO.nome, exact: true })).toBeVisible();
    await expect(page.getByText('acompanhamento ligado pela aluna')).toHaveCount(0);
  });
}

test('inscrição envia o sexo quando a pessoa escolhe', async ({ page }) => {
  const codigo = 'codigo-de-teste-abcdefghijk';
  const { pedidos } = await simularApi(page, {
    [`GET /publico/inscricoes/${codigo}`]: { corpo: { consultoria: MARCA, texto: null, aberta: true } },
    [`POST /publico/inscricoes/${codigo}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição. A equipe vai falar com você.' } },
  });
  await page.goto(`/inscricao/${codigo}`);
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('radiogroup', { name: 'Sexo (opcional)' }).getByRole('button', { name: 'Feminino', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));
  expect(envio?.corpo).toMatchObject({ sexo: 'FEMININO' });
});

test('anamnese mostra o sexo trazido para o cadastro', async ({ page }) => {
  const detalhe: AnamneseDetalhe = {
    id: ANAMNESE_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, situacao: 'ENVIADA',
    questionarioVersaoId: 'v1', questionarioVersaoNumero: 1, questionarioNome: 'Anamnese inicial',
    modelo: { formato: 2, instrucoes: [], secoes: [{ uid: 's', titulo: 'Cadastro', perguntas: [
      { id: 'sexo', tipo: 'ESCOLHA_UNICA', rotulo: 'Sexo', obrigatoria: false, destino: 'SEXO', opcoes: [
        { id: 'f', rotulo: 'Feminino', valorNoCadastro: 'FEMININO' },
      ] },
    ] }] },
    respostas: { sexo: 'f' }, atribuidaEm: '2026-01-02T12:00:00Z', atribuidaPorNome: null,
    enviadaEm: '2026-01-03T12:00:00Z', revisadaEm: null, revisadaPorNome: null, dispensadaEm: null,
    dispensadaPorNome: null, dispensaMotivo: null, versao: 1,
    alteracoes: [{
      id: 'c1', destino: 'SEXO', perguntaId: 'sexo', valor: { texto: 'FEMININO' }, valorAtual: { texto: 'MASCULINO' },
      situacao: 'PENDENTE', automatica: false, criadaEm: '2026-01-03T12:00:00Z', resolvidaEm: null, resolvidaPorNome: null,
    }],
  };
  await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/anamneses`]: { corpo: [{ id: ANAMNESE_ID, situacao: 'ENVIADA', atribuidaEm: detalhe.atribuidaEm, enviadaEm: detalhe.enviadaEm, revisadaEm: null, dispensadaEm: null, dispensaMotivo: null, versao: 1, questionarioNome: 'Anamnese inicial', questionarioVersaoNumero: 1, alteracoesParaRevisar: 1 }] },
    [`GET /anamneses/${ANAMNESE_ID}`]: { corpo: detalhe },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByText('Anamnese inicial').click();
  await expect(page.getByText('Cadastro do aluno')).toBeVisible();
  await expect(page.getByText('Na anamnese: Feminino')).toBeVisible();
  await expect(page.getByText('No cadastro: Masculino')).toBeVisible();
});
