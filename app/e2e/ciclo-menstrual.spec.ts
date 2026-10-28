import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe, AnamneseDetalhe, Atualizacao, CicloDaAluna, DiaDeCicloApi, EuResponse, PastaResumo, RegistroDeCicloApi, RegistroPeso } from '../src/api/tipos';
import { ALUNO, erroApi, json, MARCA, sessao, simularApi, TREINADOR } from './api-falsa';
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

async function rotasDaAluna(page: Page, sexo: 'FEMININO' | 'MASCULINO', ligado = true) {
  const rotas = await sessaoDeAluno(page);
  const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
  rotas['GET /eu'] = { corpo: { ...eu, cicloHabilitado: ligado, aluno: { id: ALUNO_ID, nome: ALUNO.nome, sexo } } };
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
    'PUT /aluno/ciclo/configuracao': (p: { corpo: unknown }, route: Route) => {
      const config = p.corpo as { duracaoHabitual: number | null; mostrarFases: boolean };
      ciclo.atual = { ...ciclo.atual, duracaoHabitual: config.duracaoHabitual, mostrarFases: config.mostrarFases };
      return json(route, ciclo.atual);
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

// Padrão de produção desde 27/10: módulo desligado na plataforma. Nada do ciclo aparece nem é consultado.
for (const largura of [390, 1280]) {
  test(`ciclo desligado na plataforma: sem cartão, sem consulta e o endereço volta para a Conta (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await simularApi(page, { ...(await rotasDaAluna(page, 'FEMININO', false)) });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect(page.getByText('Ativar acompanhamento')).toHaveCount(0);
    await page.goto('/aluno/ciclo');
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ciclo menstrual', level: 1 })).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho.includes('/ciclo'))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const MENSAGEM_DESLIGADO = 'O acompanhamento do ciclo não está disponível.';

/** Rotas da Conta do aluno que não são do ciclo, para `naoTratadas` ficar vazio. */
const ROTAS_DA_CONTA = {
  'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
};

for (const largura of [390, 1280]) {
  test(`aluno masculino com o ciclo desligado: a Conta não mostra o ciclo nem erro (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, { ...ROTAS_DA_CONTA, ...(await rotasDaAluna(page, 'MASCULINO', false)) });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect(page.getByText('Ciclo menstrual', { exact: true })).toHaveCount(0);
    await expect(page.getByText(MENSAGEM_DESLIGADO)).toHaveCount(0);
    await expect(page.getByText('Tentar de novo')).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho.includes('/ciclo'))).toEqual([]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  // Causa de 28/10: o perfil dizia "ligado" (ligado em 26/10, desligado por chave em 27/10) e a rota respondia 503.
  test(`/eu diz ligado mas o ciclo responde 503 de módulo desligado: sem cartão vermelho e a tela volta para a Conta (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
      ...ROTAS_DA_CONTA,
      ...(await rotasDaAluna(page, 'MASCULINO', true)),
      'GET /aluno/ciclo': erroApi(503, MENSAGEM_DESLIGADO, 'CICLO_INDISPONIVEL_NO_APP'),
    });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect.poll(() => pedidos.filter((p) => p.caminho === '/aluno/ciclo').length).toBeGreaterThan(0);
    // O 503 desligou a chave também no perfil salvo (o salvo não pode manter o ciclo ligado). Esperar isso garante que a
    // resposta já foi processada antes das conferências de "não aparece".
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('treinos:perfil') ?? '{}').cicloHabilitado)).toBe(false);
    await expect(page.getByText(MENSAGEM_DESLIGADO)).toHaveCount(0);
    await expect(page.getByText('Tentar de novo')).toHaveCount(0);
    await expect(page.getByText('Ciclo menstrual', { exact: true })).toHaveCount(0);

    // Endereço digitado: o 503 desliga a chave e a tela volta para a Conta, sem mostrar o erro.
    await page.goto('/aluno/ciclo');
    await expect(page).toHaveURL(/\/aluno\/conta$/);
    await expect(page.getByText('Meus dados')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ciclo menstrual', level: 1 })).toHaveCount(0);
    await expect(page.getByText(MENSAGEM_DESLIGADO)).toHaveCount(0);
    await expect(page.getByText('Tentar de novo')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
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
      ...(await sessao(page, TREINADOR, { cicloHabilitado: true })),
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
    const rotas = await sessao(page, TREINADOR, { cicloHabilitado: true });
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
    ...(await sessao(page, TREINADOR, { cicloHabilitado: true })),
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

// ---- Correções de 26/10: limite da menstruação em andamento, faixa, dia futuro, aviso e interruptor ----

const NOMES_DOS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Nome acessível da célula do calendário: "05 de outubro de 2026" (com `^`, para não casar "15 de…"). */
function celulaDoDia(page: Page, iso: string) {
  const [ano, mes, dia] = iso.split('-');
  return page.getByRole('button', { name: new RegExp(`^${dia} de ${NOMES_DOS_MESES[Number(mes) - 1]} de ${ano}`) });
}

function cicloAberto(inicio: string): { atual: CicloDaAluna } {
  return {
    atual: {
      disponivel: true, ativo: true, consentimentoVersaoAtual: 1, duracaoHabitual: 28, mostrarFases: true,
      registros: [{ id: 'r1', inicio, fim: null }], dias: [], textosDasFases: null,
    },
  };
}

for (const [dias, aindaPodeTerminar] of [[15, true], [16, false]] as const) {
  test(`menstruação em andamento há ${dias} dias: ${aindaPodeTerminar ? 'ainda oferece "terminou hoje"' : 'pede o fim pela edição do período'}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const ciclo = cicloAberto(deslocar(hoje(), -dias));
    const { errosDaPagina, pedidos } = await simularApi(page, { ...(await rotasDaAluna(page, 'FEMININO')), ...rotasDoCiclo(ciclo) });
    await page.goto('/aluno/ciclo');
    await expect(page.getByRole('heading', { name: 'Ciclo menstrual', level: 1 })).toBeVisible();
    const alteracoes = () => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.startsWith('/aluno/ciclo/registros/'));
    if (aindaPodeTerminar) {
      await expect(page.getByText(`Dia ${dias + 1} do ciclo · Menstrual`)).toBeVisible();
      await page.getByRole('button', { name: 'Minha menstruação terminou hoje' }).click();
      await expect.poll(() => alteracoes().length).toBe(1);
      return;
    }
    // Passou do limite da API: a menstruação não segue pintada nem o botão manda um fim que seria recusado (422).
    await expect(page.getByText(`Dia ${dias + 1} do ciclo`).first()).toBeVisible();
    await expect(page.getByText(`Dia ${dias + 1} do ciclo · Menstrual`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Minha menstruação terminou hoje' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Informar quando terminou' }).click();
    await expect(page.getByText('Editar ciclo', { exact: true })).toBeVisible();
    await page.getByLabel('Fim (opcional)').fill(deslocar(hoje(), -dias + 4).split('-').reverse().join(''));
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(() => alteracoes().length).toBe(1);
    expect(alteracoes()[0].corpo).toMatchObject({ inicio: deslocar(hoje(), -dias), fim: deslocar(hoje(), -dias + 4) });
    expect(errosDaPagina).toEqual([]);
  });
}

test('calendário: o dia de amanhã fica desabilitado e o de hoje abre', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const ciclo = cicloAberto(deslocar(hoje(), -3));
  await simularApi(page, { ...(await rotasDaAluna(page, 'FEMININO')), ...rotasDoCiclo(ciclo) });
  await page.goto('/aluno/ciclo');
  await expect(celulaDoDia(page, hoje())).toBeEnabled();
  const amanha = deslocar(hoje(), 1);
  const virouOMes = amanha.slice(0, 7) !== hoje().slice(0, 7);
  if (virouOMes) await page.getByRole('button', { name: 'Próximo mês' }).click();
  const futuro = celulaDoDia(page, amanha);
  await expect(futuro).toBeDisabled();
  await expect(futuro).toHaveAttribute('aria-label', /ainda não chegou/);
  await futuro.click({ force: true });
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  if (virouOMes) await page.getByRole('button', { name: 'Mês anterior' }).click();
  await celulaDoDia(page, hoje()).click();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
});

test('interruptor "Mostrar fases estimadas" grava a duração já salva, não a que está só no campo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const ciclo = cicloAberto(deslocar(hoje(), -3));
  const { pedidos } = await simularApi(page, { ...(await rotasDaAluna(page, 'FEMININO')), ...rotasDoCiclo(ciclo) });
  await page.goto('/aluno/ciclo');
  await page.getByText('Configurações', { exact: true }).click();
  const gravacoes = () => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/ciclo/configuracao');
  await page.getByLabel('Duração habitual do ciclo (opcional)').fill('35');
  await page.getByRole('switch', { name: 'Mostrar fases estimadas' }).click();
  await expect.poll(() => gravacoes().length).toBe(1);
  expect(gravacoes()[0].corpo).toEqual({ duracaoHabitual: 28, mostrarFases: false });
  // "Salvar duração" continua gravando o que foi digitado.
  await page.getByLabel('Duração habitual do ciclo (opcional)').fill('35');
  await page.getByRole('button', { name: 'Salvar duração' }).click();
  await expect.poll(() => gravacoes().length).toBe(2);
  expect(gravacoes()[1].corpo).toEqual({ duracaoHabitual: 35, mostrarFases: false });
});

function atualizacaoDoCiclo(fase: 'ABERTA' | 'ENVIADA'): Atualizacao {
  return {
    id: 'z0000000-0000-4000-8000-000000000001', pastaId: 'p0000000-0000-4000-8000-000000000001', alunoId: ALUNO_ID, nomeAluno: null,
    dataAtualizacao: hoje(), fase, diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
    questionarioVersaoNumero: 1, questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001', questionarioNome: null,
    modelo: { formato: 2, instrucoes: [], secoes: [] }, respostas: fase === 'ENVIADA' ? {} : null,
    enviadaEm: fase === 'ENVIADA' ? `${hoje()}T12:00:00Z` : null, feedback: null, versao: 1, resumo: null,
  };
}

for (const [fase, aparece] of [['ABERTA', true], ['ENVIADA', false]] as const) {
  test(`aviso da última menstruação na atualização ${fase === 'ABERTA' ? 'em aberto' : 'já enviada'}: ${aparece ? 'aparece' : 'não aparece'}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const ciclo = cicloAberto(deslocar(hoje(), -50));
    ciclo.atual = { ...ciclo.atual, registros: [{ id: 'r1', inicio: deslocar(hoje(), -50), fim: deslocar(hoje(), -46) }] };
    const { errosDaPagina } = await simularApi(page, {
      ...(await rotasDaAluna(page, 'FEMININO')), ...rotasDoCiclo(ciclo),
      'GET /aluno/atualizacao': { corpo: atualizacaoDoCiclo(fase) },
    });
    await page.goto('/aluno/atualizacao');
    await expect(page.getByText('Instruções', { exact: true })).toBeVisible();
    await expect(page.getByText('Confira se sua última menstruação está registrada')).toHaveCount(aparece ? 1 : 0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('faixa do ciclo na pasta: a menstruação fica na data certa, depois dos dias sem fase', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const pasta: PastaResumo = { ...PASTA, inicio: deslocar(INICIO_ANTERIOR, -10), fim: HOJE };
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { cicloHabilitado: true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /consultoria': { corpo: MARCA },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/ciclo`]: { corpo: CICLO_LIGADO },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [pasta] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: PESOS },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByText('Pasta de janeiro').click();
  await expect(page.getByText('Ciclo no período da pasta')).toBeVisible();
  const menstrual = page.getByRole('button', { name: 'Menstrual', exact: true }).first();
  await expect(menstrual).toBeVisible();
  const trilho = menstrual.locator('xpath=..');
  const [caixa, moldura] = [await menstrual.boundingBox(), await trilho.boundingBox()];
  // O período tem 49 dias e a menstruação começa no 11º: cerca de 20% da largura, não colada à esquerda.
  const deslocamento = ((caixa?.x ?? 0) - (moldura?.x ?? 0)) / (moldura?.width ?? 1);
  expect(deslocamento).toBeGreaterThan(0.18);
  expect(deslocamento).toBeLessThan(0.23);
});
