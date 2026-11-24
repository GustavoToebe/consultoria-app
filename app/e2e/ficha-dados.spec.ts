import { expect, test, type Page } from '@playwright/test';

import type { ContratacaoResponse, CobrancaResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, Lesao } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel } from './financeiro-falso';

/**
 * Ficha do aluno › Dados (23/11, `docs/planos/ficha-do-aluno-dados.md`): duas colunas a partir da faixa normal (Plano à
 * esquerda; Acesso e Anamnese à direita) e uma coluna na ordem Lesões ativas › Plano › Acesso › Anamnese › Histórico;
 * acesso compacto com o último login; vigência com o texto equivalente, âmbar a 15 dias e "Encerrado em" na parcela única passada do término; as últimas 3
 * cobranças com "Ver todas no Financeiro"; lesões com as ativas tingidas primeiro, "Desde"/"a", ⋯ com Editar e Excluir
 * (confirmação), 5 recuperadas + "Ver todas" e a observação com rótulo; e o vazio. Relógio em 19/10/2026; só dados
 * fictícios, API simulada. ficha do aluno: dados (23/11)
 */

const ID = ALUNO_FINANCEIRO_ID;

const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, ultimoAcesso: { tipo: 'LOGIN', em: '2026-10-17T15:30:00Z' },
};

const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000d1', alunoId: ID, planoComercialId: 'b0000000-0000-4000-8000-0000000000d1',
  planoNome: 'Trimestral', periodicidade: 'TRIMESTRAL', valorCentavos: 99_700, motivoValor: null, inicio: '2026-10-19', diaVencimento: 19,
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-10-19T12:00:00Z', versao: 0, minimoAte: null,
  terminoVigencia: '2027-01-19', diasRestantesVigencia: 92, alertaRenovacao: 'EM_DIA',
};

const cobranca = (n: number, competencia: string, situacao: CobrancaResponse['situacao']): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-0000000000e${n}`, contratacaoId: CONTRATACAO.id, alunoId: ID, alunoNome: ALUNO.nome,
  planoNome: 'Trimestral', competencia, vencimento: competencia, valorCentavos: 99_700, situacao, vencida: false, diasDeAtraso: null,
  pagoEm: situacao === 'PAGA' ? competencia : null, forma: situacao === 'PAGA' ? 'PIX_DIRETO' : null,
});

const OBSERVACAO_LONGA = 'Evitar desenvolvimento acima da cabeça e supino com pegada aberta até a liberação do fisioterapeuta. '
  + 'Reavaliar a amplitude a cada duas semanas e registrar a dor relatada pelo aluno.';
const lesao = (id: string, regiao: string, p: Partial<Lesao> = {}): Lesao => ({
  id, regiao, descricao: null, dataInicio: null, dataFim: null, situacao: 'RECUPERADA', observacao: null, ...p,
});
const ATIVA = lesao('l-ativa', 'Ombro direito', { descricao: 'Tendinite', situacao: 'ATIVA', dataInicio: '2026-10-01', observacao: OBSERVACAO_LONGA });
const RECUPERADA = lesao('l-rec', 'Joelho esquerdo', { descricao: 'Entorse leve', dataInicio: '2026-03-01', dataFim: '2026-05-15' });

interface Opcoes {
  largura: number;
  tema?: 'CLARO' | 'ESCURO';
  contratacoes?: ContratacaoResponse[];
  cobrancas?: CobrancaResponse[];
  lesoes?: Lesao[];
}

async function abrir(page: Page, o: Opcoes) {
  await page.setViewportSize({ width: o.largura, height: 1000 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema ?? 'CLARO'] as const);
  await fixarHoje(page);
  let lesoes = [...(o.lesoes ?? [])];
  const financeiro = estadoFinanceiro({ contratacoes: o.contratacoes ?? [], cobrancas: o.cobrancas ?? [] });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'] })),
    ...rotasDoFinanceiro(financeiro), ...rotasDoResponsavel(estadoDoResponsavel()),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: (_p, route) => route.fulfill({ json: lesoes }),
    [`DELETE /alunos/${ID}/lesoes/{id}`]: (p, route) => {
      lesoes = lesoes.filter((l) => l.id !== p.caminho.split('/').at(-1));
      return route.fulfill({ status: 204 });
    },
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Dados do aluno' })).toBeVisible();
  return api;
}

const caixa = async (page: Page, titulo: string) => (await page.getByRole('heading', { name: titulo, exact: true }).boundingBox())!;
const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

test('1920px: duas colunas (Plano à esquerda; Acesso e Anamnese à direita) e o histórico de lesões na largura toda, abaixo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, { largura: 1920, contratacoes: [CONTRATACAO], cobrancas: [cobranca(1, '2026-10-19', 'ABERTA')], lesoes: [ATIVA, RECUPERADA] });
  await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
  const plano = await caixa(page, 'Plano contratado');
  const acesso = await caixa(page, 'Acesso ao app');
  const anamnese = await caixa(page, 'Anamnese');
  const historico = await caixa(page, 'Histórico de lesões');
  // Mesma faixa de topo (o título do Plano tem a descrição embaixo, então não alinha ao pixel).
  expect(Math.abs(plano.y - acesso.y)).toBeLessThan(24);
  expect(acesso.x).toBeGreaterThan(plano.x + 200);
  expect(Math.abs(anamnese.x - acesso.x)).toBeLessThan(4);
  expect(anamnese.y).toBeGreaterThan(acesso.y);
  expect(historico.y).toBeGreaterThan(anamnese.y);
  expect(Math.abs(historico.x - plano.x)).toBeLessThan(4);
  // Em duas colunas não há o cartão "Lesões ativas" separado: as ativas ficam no topo do histórico.
  await expect(page.getByRole('heading', { name: 'Lesões ativas' })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`${largura}px: uma coluna na ordem Lesões ativas › Plano › Acesso › Anamnese › Histórico, sem repetir a lesão`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [CONTRATACAO], lesoes: [ATIVA, RECUPERADA] });
    await expect(page.getByRole('heading', { name: 'Lesões ativas' })).toBeVisible();
    const ordem = await Promise.all(['Lesões ativas', 'Plano contratado', 'Acesso ao app', 'Anamnese', 'Histórico de lesões'].map((t) => caixa(page, t)));
    for (let i = 1; i < ordem.length; i++) expect(ordem[i].y).toBeGreaterThan(ordem[i - 1].y);
    await expect(page.getByText('Ombro direito', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Joelho esquerdo', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: acesso compacto com "Entra com" uma vez e o último login relativo, com a data exata`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura });
    const acesso = page.getByLabel('Acesso ao app', { exact: true });
    await expect(acesso.getByText('Com acesso', { exact: true })).toBeVisible();
    await expect(acesso.getByText(`Entra com ${ALUNO.email}.`)).toBeVisible();
    await expect(acesso.getByText(ALUNO.email)).toHaveCount(1);
    await expect(acesso.getByText('Último login: há 2 dias', { exact: true })).toBeVisible();
    await expect(acesso.getByLabel('Último login: há 2 dias (17/10/2026 às 12:30)')).toBeVisible();
    await expect(acesso.getByRole('button', { name: 'Definir nova senha' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: plano com valor em destaque, vigência com texto equivalente e as últimas 3 cobranças`, async ({ page }) => {
    const cobrancas = [cobranca(1, '2026-07-19', 'PAGA'), cobranca(2, '2026-08-19', 'PAGA'), cobranca(3, '2026-09-19', 'PAGA'), cobranca(4, '2026-10-19', 'ABERTA')];
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [CONTRATACAO], cobrancas });
    await expect(page.getByLabel('Valor: R$ 997,00 por trimestre')).toBeVisible();
    await expect(page.getByText('R$ 997,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Vigência de 19/10/2026 a 19/01/2027: 92 dias restantes')).toBeVisible();
    await expect(page.getByText('92 dias restantes', { exact: true })).toBeVisible();
    await expect(page.getByText('Vence todo dia 19', { exact: true })).toBeVisible();
    // O nome do plano já é a periodicidade: a linha "Periodicidade" some.
    await expect(page.getByText('Periodicidade: Trimestral')).toHaveCount(0);
    for (const nome of ['Alterar', 'Pausar', 'Encerrar']) await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    // As 3 mais recentes por vencimento; a de julho fica no Financeiro.
    const linhas = page.getByRole('button', { name: /^Abrir cobrança de/ });
    await expect(linhas).toHaveCount(3);
    await expect(linhas.first()).toHaveAccessibleName('Abrir cobrança de 10/2026, Em aberto');
    await expect(page.getByRole('button', { name: /^Abrir cobrança de 07\/2026/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver todas no Financeiro' })).toHaveAttribute('href', `/treinador/financeiro?aba=cobrancas&alunoId=${ID}`);
    await linhas.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('vigência (plano trimestral): com 15 dias, texto e barra em âmbar; com 16, neutra', async ({ page }) => {
  const atencao = rgb(PALETAS.CLARO.cores.atencao);
  const { errosDaPagina } = await abrir(page, { largura: 1280, contratacoes: [{ ...CONTRATACAO, diasRestantesVigencia: 15 }] });
  await expect(page.getByText('15 dias restantes', { exact: true })).toHaveCSS('color', atencao);
  expect(errosDaPagina).toEqual([]);

  const folgada = await page.context().newPage();
  const daFolgada = await abrir(folgada, { largura: 1280, contratacoes: [{ ...CONTRATACAO, diasRestantesVigencia: 16 }] });
  await expect(folgada.getByText('16 dias restantes', { exact: true })).not.toHaveCSS('color', atencao);
  expect(daFolgada.errosDaPagina).toEqual([]);
});

/** Parcela única que terminou em 16/10/2026 (3 dias antes de "hoje"): a API não alerta, e a ficha diz "Encerrado em". */
const PARCELA_UNICA_ENCERRADA: ContratacaoResponse = {
  ...CONTRATACAO, planoNome: 'Parcela única', periodicidade: 'PARCELA_UNICA', valorCentavos: 70_000, inicio: '2026-09-16',
  terminoVigencia: '2026-10-16', diasRestantesVigencia: -3, alertaRenovacao: null,
};

for (const [largura, tema] of [[1280, 'CLARO'], [1280, 'ESCURO'], [390, 'CLARO'], [390, 'ESCURO']] as const) {
  test(`${largura}px (${tema.toLowerCase()}): parcela única passada do término mostra "Encerrado em" em âmbar, nunca "Vencida"`, async ({ page }) => {
    const atencao = rgb(PALETAS[tema].cores.atencao);
    const { errosDaPagina } = await abrir(page, { largura, tema, contratacoes: [PARCELA_UNICA_ENCERRADA] });
    const texto = page.getByText('Encerrado em 16/10/2026', { exact: true });
    await expect(texto).toBeVisible();
    await expect(texto).toHaveCSS('color', atencao);
    await expect(page.getByLabel('Vigência de 16/09/2026 a 16/10/2026: encerrado em 16/10/2026')).toBeVisible();
    await expect(page.getByText(/Vencida há|dias? restantes?/)).toHaveCount(0);
    // Sem alerta de renovação não há "Avisar no WhatsApp".
    await expect(page.getByRole('button', { name: /WhatsApp/ })).toHaveCount(0);
    if (process.env.CAPTURAS) {
      await texto.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.CAPTURAS}/ficha-encerrado-${largura}-${tema.toLowerCase()}.png` });
    }
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`${largura}px: plano mensal sem barra de vigência, nem dias restantes nem a cor (Gustavo, 23/11); o resto fica`, async ({ page }) => {
    const mensal: ContratacaoResponse = {
      ...CONTRATACAO, planoNome: 'Consultoria mensal', periodicidade: 'MENSAL', valorCentavos: 15_000, inicio: '2026-08-05', diaVencimento: 5,
      terminoVigencia: '2026-09-05', diasRestantesVigencia: -44, alertaRenovacao: null,
    };
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [mensal], cobrancas: [cobranca(1, '2026-10-05', 'ABERTA')] });
    await expect(page.getByText('Consultoria mensal', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Valor: R$ 150,00 por mês')).toBeVisible();
    await expect(page.getByText('Vence todo dia 5', { exact: true })).toBeVisible();
    await expect(page.getByText('Periodicidade: Mensal', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Vigência de/)).toHaveCount(0);
    await expect(page.getByText(/dias restantes|Vencida há|Encerrado em|^Término /)).toHaveCount(0);
    for (const nome of ['Alterar', 'Pausar', 'Encerrar']) await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir cobrança de/ })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Responsável financeiro' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: plano pausado ou encerrado sem barra de vigência (Gustavo, 23/11); a pausada mantém nome, selo, valor e o resto`, async ({ page }) => {
    const pausada: ContratacaoResponse = { ...CONTRATACAO, situacao: 'PAUSADA', diasRestantesVigencia: 10 };
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [pausada], cobrancas: [cobranca(1, '2026-10-19', 'ABERTA')] });
    await expect(page.getByText('Trimestral', { exact: true })).toBeVisible();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Valor: R$ 997,00 por trimestre')).toBeVisible();
    await expect(page.getByText('Vence todo dia 19', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Vigência de/)).toHaveCount(0);
    await expect(page.getByText(/dias? restantes?|Vencida há|Encerrado em|^Término /)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retomar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir cobrança de/ })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Responsável financeiro' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);

    const outra = await page.context().newPage();
    const encerrada: ContratacaoResponse = { ...CONTRATACAO, situacao: 'ENCERRADA', encerradaEm: '2026-10-19T12:00:00Z', diasRestantesVigencia: 10 };
    const daOutra = await abrir(outra, { largura, contratacoes: [encerrada], cobrancas: [cobranca(1, '2026-10-19', 'PAGA')] });
    await expect(outra.getByText('Nenhum plano comercial contratado. 1 contratação encerrada.')).toBeVisible();
    await expect(outra.getByLabel(/^Vigência de/)).toHaveCount(0);
    await expect(outra.getByText(/dias? restantes?|Vencida há|Encerrado em|^Término /)).toHaveCount(0);
    await expect(outra.getByRole('button', { name: /^Abrir cobrança de/ })).toHaveCount(1);
    await expect(outra.getByRole('heading', { name: 'Responsável financeiro' })).toBeVisible();
    expect(daOutra.errosDaPagina).toEqual([]);
  });

  test(`${largura}px: lesões — ativa tingida e primeiro, "Desde" e "a", observação com rótulo, ⋯ com Editar e Excluir`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, { largura, lesoes: [RECUPERADA, ATIVA] });
    await expect(page.getByText('1 ativa · 2 no total', { exact: true })).toBeVisible();
    await expect(page.getByText('Desde 01/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByText('01/03/2026 a 15/05/2026', { exact: true })).toBeVisible();
    await expect(page.getByText(/a em aberto/)).toHaveCount(0);
    // Sem os ícones soltos de lápis e lixeira: só o ⋯.
    await expect(page.getByRole('button', { name: /^(Editar|Excluir) lesão em/ })).toHaveCount(0);
    // A ativa tem fundo tingido; a recuperada, não.
    const item = (regiao: string) => page.getByRole(largura >= 1024 ? 'row' : 'listitem').filter({ hasText: regiao });
    const fundo = (regiao: string) => item(regiao).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fundo('Ombro direito')).not.toBe('rgba(0, 0, 0, 0)');
    if (largura >= 1024) expect(await fundo('Joelho esquerdo')).toBe('rgba(0, 0, 0, 0)');
    // A ativa vem antes da recuperada (no celular, no cartão do topo).
    const ativa = (await page.getByText('Ombro direito', { exact: true }).boundingBox())!;
    const recuperada = (await page.getByText('Joelho esquerdo', { exact: true }).boundingBox())!;
    expect(ativa.y).toBeLessThan(recuperada.y);
    // Observação com rótulo, em duas linhas, e o texto inteiro ao pedir.
    const observacao = page.getByLabel(`Observação: ${OBSERVACAO_LONGA}`);
    await expect(observacao).toBeVisible();
    await expect(observacao).toContainText('Observação:');
    const fechada = (await observacao.boundingBox())!.height;
    expect(fechada).toBeLessThanOrEqual(40);
    await page.getByRole('button', { name: 'Ver observação inteira' }).click();
    expect((await observacao.boundingBox())!.height).toBeGreaterThan(fechada);
    await expect(page.getByRole('button', { name: 'Ver menos' })).toBeVisible();

    // ⋯ › Editar abre a folha; ⋯ › Excluir lesão pede confirmação e só então apaga.
    await page.getByRole('button', { name: 'Mais ações da lesão em Ombro direito' }).click();
    await page.getByRole('dialog', { name: 'Ombro direito' }).getByRole('button', { name: 'Editar' }).click();
    const folha = page.getByRole('dialog', { name: 'Editar lesão' });
    await expect(folha.getByLabel('Região do corpo')).toHaveValue('Ombro direito');
    await folha.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Mais ações da lesão em Joelho esquerdo' }).click();
    await page.getByRole('dialog', { name: 'Joelho esquerdo' }).getByRole('button', { name: 'Excluir lesão' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Excluir este registro de lesão?' });
    await expect(painel).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'DELETE')).toEqual([]);
    await painel.getByRole('button', { name: 'Excluir lesão' }).click();
    await expect(page.getByText('Joelho esquerdo', { exact: true })).toHaveCount(0);
    expect(pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual([`/alunos/${ID}/lesoes/l-rec`]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: mais de 5 recuperadas mostra 5 e "Ver todas"`, async ({ page }) => {
    const recuperadas = Array.from({ length: 7 }, (_, i) => lesao(`r${i}`, `Região recuperada ${i + 1}`, { dataInicio: `2026-0${i + 1}-01`, dataFim: `2026-0${i + 1}-10` }));
    const { errosDaPagina } = await abrir(page, { largura, lesoes: recuperadas });
    await expect(page.getByText('Nenhuma ativa · 7 no total', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Região recuperada \d$/)).toHaveCount(5);
    // As mais recentes primeiro: a 7 (julho) aparece, a 1 (janeiro) não.
    await expect(page.getByText('Região recuperada 7', { exact: true })).toBeVisible();
    await expect(page.getByText('Região recuperada 1', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver todas as recuperadas (7)' }).click();
    await expect(page.getByText(/^Região recuperada \d$/)).toHaveCount(7);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: vazio — sem plano e sem lesões`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura });
    await expect(page.getByText('Nenhum plano comercial contratado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contratar plano' })).toBeVisible();
    await expect(page.getByText('Nenhuma lesão registrada.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar lesão' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lesões ativas' })).toHaveCount(0);
    await expect(page.getByText(/no total/)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
