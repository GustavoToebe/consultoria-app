import { expect, test, type Page } from '@playwright/test';

import type { ContratacaoResponse, CobrancaResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, Lesao } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel } from './financeiro-falso';

/**
 * Ficha do aluno › Dados (23/11, `docs/planos/ficha-do-aluno-dados.md`): duas colunas independentes (3:2) a partir da faixa
 * normal da `Tela` (24/11, `docs/planos/ficha-dados-colunas-independentes.md`: Identificação › Contato › Plano à
 * esquerda; Acompanhamento › Objetivo › Acesso › Anamnese à direita; o Histórico de lesões embaixo das duas, na largura
 * delas; nas três colunas de 2560 e 3440, na pilha do meio, também no `tela-larga-ficha.spec.ts`; na edição sem o financeiro,
 * uma coluna só na largura da esquerda, com o Histórico) e, no celular, uma coluna na ordem Lesões ativas ›
 * Plano › Acesso › Anamnese › Histórico;
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
  /** Perfil sem o financeiro (sem o Plano contratado) e, com `semSensivel`, sem `ALUNO_SENSIVEL_LER`/`_ALTERAR`. */
  semFinanceiro?: boolean;
  semSensivel?: boolean;
}

async function abrir(page: Page, o: Opcoes) {
  await page.setViewportSize({ width: o.largura, height: 1000 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema ?? 'CLARO'] as const);
  await fixarHoje(page);
  let lesoes = [...(o.lesoes ?? [])];
  const financeiro = estadoFinanceiro({ contratacoes: o.contratacoes ?? [], cobrancas: o.cobrancas ?? [] });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      pagamentosHabilitados: !o.semFinanceiro, recebimentoOnlineHabilitado: false,
      permissoes: [...PERMISSOES_TREINADOR.filter((p) => !o.semSensivel || !p.startsWith('ALUNO_SENSIVEL_')), ...(o.semFinanceiro ? [] : ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'])],
    })),
    ...rotasDoFinanceiro(financeiro), ...rotasDoResponsavel(estadoDoResponsavel()),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
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

const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

// ficha: colunas independentes (24/11). Medido no contorno do cartão (o título do Plano tem a descrição embaixo).
// O Histórico de lesões fica abaixo das duas colunas, na largura delas somada (ficha: histórico embaixo, 24/11).
const ESQUERDA = ['Identificação', 'Contato e endereço', 'Plano contratado'];
const DIREITA = ['Configuração do acompanhamento', 'Objetivo e observações', 'Acesso ao app', 'Anamnese'];
const caixaDoCartao = async (page: Page, titulo: string) =>
  (await page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) }).first().boundingBox())!;
const vaos = (caixas: { y: number; height: number }[]) => caixas.slice(1).map((c, i) => Math.round(c.y - (caixas[i].y + caixas[i].height)));

for (const largura of [1280, 1920]) {
  test(`${largura}px: duas colunas independentes (3:2), mesmo topo, ordem de cada coluna e o mesmo vão entre os cartões`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, { largura, contratacoes: [CONTRATACAO], cobrancas: [cobranca(1, '2026-10-19', 'ABERTA')], lesoes: [ATIVA, RECUPERADA] });
    await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anamnese', exact: true })).toBeVisible();
    await expect(page.getByLabel('Valor: R$ 997,00 por trimestre')).toBeVisible();
    const esquerda = await Promise.all(ESQUERDA.map((t) => caixaDoCartao(page, t)));
    const direita = await Promise.all(DIREITA.map((t) => caixaDoCartao(page, t)));
    // As duas colunas começam no mesmo topo e a direita vem depois da esquerda.
    expect(Math.abs(esquerda[0].y - direita[0].y)).toBeLessThanOrEqual(1);
    expect(direita[0].x).toBeGreaterThan(esquerda[0].x + esquerda[0].width);
    for (const coluna of [esquerda, direita]) {
      // Uma pilha: mesma borda esquerda, na ordem, e o mesmo vão (24 px) entre cada par, sem alinhar com a outra coluna.
      for (const c of coluna) expect(Math.abs(c.x - coluna[0].x)).toBeLessThanOrEqual(1);
      for (const v of vaos(coluna)) expect(Math.abs(v - 24)).toBeLessThanOrEqual(1);
    }
    // Uma proporção para a página toda: 3 para 2.
    expect(esquerda[0].width / direita[0].width).toBeGreaterThan(1.45);
    expect(esquerda[0].width / direita[0].width).toBeLessThan(1.55);
    // Em duas colunas não há o cartão "Lesões ativas" separado: as ativas ficam no topo do histórico.
    await expect(page.getByRole('heading', { name: 'Lesões ativas' })).toHaveCount(0);
    // O Histórico embaixo das duas: 24 px abaixo da coluna mais alta, da borda esquerda da 1ª à direita da 2ª, e em tabela.
    const historico = await caixaDoCartao(page, 'Histórico de lesões');
    const fundo = Math.max(...[esquerda.at(-1)!, direita.at(-1)!].map((c) => c.y + c.height));
    expect(Math.abs(historico.y - fundo - 24)).toBeLessThanOrEqual(1);
    expect(Math.abs(historico.x - esquerda[0].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(historico.x + historico.width - (direita[0].x + direita[0].width))).toBeLessThanOrEqual(1);
    expect(historico.width).toBeLessThanOrEqual(1401);
    await expect(page.getByRole('table', { name: 'Lesões' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lesões' })).toHaveCount(0);
    // Montou uma vez só, já no arranjo certo (sem montar numa coluna e remontar em duas).
    expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `/alunos/${ID}/anamneses`)).toHaveLength(1);
    expect(errosDaPagina).toEqual([]);
  });
}

// Coluna única (24/11): na edição sem o financeiro a coluna da esquerda fica vazia (as seções saem e não há Plano contratado);
// a aba fica numa coluna só, na largura que a esquerda tem nas duas colunas com os mesmos dados (3/5 da aba, ~580 px em 1280
// e ~826 em 1920), e o Histórico de lesões a acompanha. Na leitura a esquerda tem Identificação e Contato: duas colunas.
for (const semSensivel of [false, true]) {
  for (const [largura, tema] of [[1280, 'CLARO'], [1280, 'ESCURO'], [1920, 'ESCURO']] as const) {
    const perfil = semSensivel ? 'sem financeiro e sem sensível' : 'sem financeiro';
    test(`${largura}px (${tema.toLowerCase()}), ${perfil}: na edição uma coluna só, na largura da esquerda, e o Histórico junto`, async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, { largura, tema, semFinanceiro: true, semSensivel, lesoes: [ATIVA, RECUPERADA] });
      await expect(page.getByRole('heading', { name: 'Acesso ao app', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Plano contratado', exact: true })).toHaveCount(0);
      if (!semSensivel) await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
      // Leitura: as mesmas duas colunas 3:2; a largura da esquerda é o teto da coluna única.
      const ident = await caixaDoCartao(page, 'Identificação');
      const config = await caixaDoCartao(page, 'Configuração do acompanhamento');
      expect(Math.abs(ident.y - config.y)).toBeLessThanOrEqual(1);
      expect(ident.width / config.width).toBeGreaterThan(1.45);
      expect(ident.width / config.width).toBeLessThan(1.55);
      if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/leitura-${semSensivel ? 'sem-sensivel' : 'com-sensivel'}-${largura}-${tema.toLowerCase()}.png` });

      await page.getByRole('button', { name: 'Editar dados' }).click();
      await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
      await expect(async () => {
        const acesso = await caixaDoCartao(page, 'Acesso ao app');
        // A coluna única começa na borda da aba e para na largura da esquerda (nunca até 1400).
        expect(Math.abs(acesso.x - ident.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(acesso.width - ident.width)).toBeLessThanOrEqual(1);
        if (semSensivel) return;
        const anamnese = await caixaDoCartao(page, 'Anamnese');
        const historico = await caixaDoCartao(page, 'Histórico de lesões');
        for (const c of [anamnese, historico]) {
          expect(Math.abs(c.x - acesso.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(c.width - acesso.width)).toBeLessThanOrEqual(1);
        }
        expect(Math.abs(historico.y - (anamnese.y + anamnese.height) - 24)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 10_000 });
      if (semSensivel) {
        await expect(page.getByRole('heading', { name: 'Anamnese', exact: true })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toHaveCount(0);
      } else {
        // Na largura da coluna única: em 1280 (~580 px) a tabela das lesões não cabe (760) e vira cartões; em 1920, tabela.
        await expect(page.getByRole(largura >= 1920 ? 'table' : 'list', { name: 'Lesões' }).first()).toBeVisible();
        // Entrar na edição não remonta os blocos (não buscam de novo).
        expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `/alunos/${ID}/anamneses`)).toHaveLength(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // Captura com a coluna única no meio da tela (o formulário em cima é alto; a página rola por dentro).
      if (process.env.CAPTURAS) await page.getByRole('heading', { name: semSensivel ? 'Acesso ao app' : 'Anamnese', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/edicao-${semSensivel ? 'sem-sensivel' : 'com-sensivel'}-${largura}-${tema.toLowerCase()}.png`, });
      expect(errosDaPagina).toEqual([]);
    });
  }
}

// 2560 e 3440 (três pilhas, inalterado): o Histórico segue na pilha do meio, logo abaixo do Plano, e nada fica embaixo.
for (const largura of [2560, 3440]) {
  test(`${largura}px: três pilhas, o Histórico de lesões na do meio, 24 px abaixo do Plano`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [CONTRATACAO], lesoes: [ATIVA, RECUPERADA] });
    await expect(page.getByRole('heading', { name: 'Histórico de lesões' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anamnese', exact: true })).toBeVisible();
    await expect(async () => {
      const [ident, plano, historico, config] = await Promise.all(['Identificação', 'Plano contratado', 'Histórico de lesões', 'Configuração do acompanhamento'].map((t) => caixaDoCartao(page, t)));
      expect(Math.abs(historico.x - plano.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(historico.width - plano.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(historico.y - (plano.y + plano.height) - 24)).toBeLessThanOrEqual(1);
      expect(plano.x).toBeGreaterThan(ident.x + ident.width);
      expect(config.x).toBeGreaterThan(historico.x + historico.width);
    }).toPass({ timeout: 10_000 });
    await expect(page.getByRole('table', { name: 'Lesões' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

// 1200: a faixa compacta com a aba ainda larga (~928 px): os Dados também numa coluna, sem vão ao lado.
for (const largura of [390, 1200]) {
  test(`${largura}px: uma coluna, os Dados e depois Lesões ativas › Plano › Acesso › Anamnese › Histórico, sem repetir a lesão`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, contratacoes: [CONTRATACAO], lesoes: [ATIVA, RECUPERADA] });
    await expect(page.getByRole('heading', { name: 'Lesões ativas' })).toBeVisible();
    const ordem = await Promise.all([...ESQUERDA.slice(0, 2), ...DIREITA.slice(0, 2), 'Lesões ativas', 'Plano contratado', 'Acesso ao app', 'Anamnese', 'Histórico de lesões'].map((t) => caixaDoCartao(page, t)));
    for (let i = 1; i < ordem.length; i++) expect(ordem[i].y).toBeGreaterThan(ordem[i - 1].y);
    for (const c of ordem) expect(Math.abs(c.x - ordem[0].x)).toBeLessThanOrEqual(1);
    await expect(page.getByText('Ombro direito', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Joelho esquerdo', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  // ficha: acesso ao app (24/11): lista de dados (Situação, E-mail de acesso, Último login, Senha), ações na coluna da direita.
  test(`${largura}px: acesso em lista, o e-mail uma vez com o copiar e o último login em Brasília, com a data exata`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura });
    const acesso = page.getByLabel('Acesso ao app', { exact: true });
    await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();
    await expect(acesso.getByText(/Entra com/)).toHaveCount(0);
    await expect(acesso.getByText(ALUNO.email)).toHaveCount(1);
    await expect(acesso.getByRole('button', { name: 'Copiar e-mail de acesso' })).toBeVisible();
    await expect(acesso.getByLabel('Último login: 17/10 12:30 (17/10/2026 às 12:30)', { exact: true })).toBeVisible();
    await expect(acesso.getByLabel('Senha: definida', { exact: true })).toBeVisible();
    await expect(acesso.getByText('••••••', { exact: true })).toBeVisible();
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
    await expect(page.getByLabel('Vencimento: Todo dia 19', { exact: true })).toBeVisible();
    // O nome do plano já é a periodicidade: a linha "Periodicidade" some.
    await expect(page.getByLabel('Periodicidade: Trimestral')).toHaveCount(0);
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
    await expect(page.getByLabel('Vencimento: Todo dia 5', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Periodicidade: Mensal', { exact: true })).toBeVisible();
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
    await expect(page.getByLabel('Vencimento: Todo dia 19', { exact: true })).toBeVisible();
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
    // Na tabela, a linha (`row`); empilhado (`ui/Tabela`), o cartão filho direto da lista "Lesões".
    // Em colunas a partir de 760 px: em 1280 o Histórico tem a largura das duas colunas (~928 px), então é tabela.
    const emTabela = largura >= 1280;
    // No celular são duas listas (as ativas no topo e as recuperadas no fim).
    await expect(page.getByRole(emTabela ? 'table' : 'list', { name: 'Lesões' }).first()).toBeVisible();
    const item = (regiao: string) => (emTabela ? page.getByRole('row') : page.getByRole('list', { name: 'Lesões' }).locator('xpath=./div')).filter({ hasText: regiao });
    const fundo = (regiao: string) => item(regiao).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fundo('Ombro direito')).not.toBe('rgba(0, 0, 0, 0)');
    if (emTabela) expect(await fundo('Joelho esquerdo')).toBe('rgba(0, 0, 0, 0)');
    // A ativa vem antes da recuperada (no celular, no cartão do topo).
    const ativa = (await page.getByText('Ombro direito', { exact: true }).boundingBox())!;
    const recuperada = (await page.getByText('Joelho esquerdo', { exact: true }).boundingBox())!;
    expect(ativa.y).toBeLessThan(recuperada.y);
    // Observação com rótulo, em duas linhas, e o texto inteiro ao pedir.
    const observacao = page.getByLabel(`Cuidados no treino: ${OBSERVACAO_LONGA}`);
    await expect(observacao).toBeVisible();
    await expect(observacao).toContainText('Cuidados no treino:');
    const fechada = (await observacao.boundingBox())!.height;
    expect(fechada).toBeLessThanOrEqual(40);
    await page.getByRole('button', { name: 'Ver cuidados inteiros' }).click();
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
