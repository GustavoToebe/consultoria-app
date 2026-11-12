import { expect, type Locator, test, type Page } from '@playwright/test';

import type { AgendaPessoal, Compromisso } from '../src/api/agendaTipos';
import type { AlunoResumo } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, type PedidoFalso, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';

/**
 * Composição da Agenda (F20, F12 e F13 de `docs/planos/ajustes-e-funcionalidades-12-11.md`): a lateral compacta do PC
 * (240 a 280 px, "Minhas agendas" à vista em 1280×720 com nomes longos, a grade com o espaço que sobrou), o formulário do
 * compromisso novo e o resumo junto ao compromisso. Relógio em segunda, 19/10/2026, 12:00 de Brasília. Só dados fictícios.
 * `CAPTURAS` aponta a pasta das capturas (sem ela, a pasta de resultados de cada teste).
 */

const HOJE = '2026-10-19';
/** Caminho da captura: na pasta `CAPTURAS`, se houver, senão na pasta de resultados do próprio teste. */
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const ANA: AlunoResumo = {
  id: 'a0000000-0000-4000-8000-000000000001', nome: 'Ana Fictícia', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null,
};
const NOME_LONGO: AlunoResumo = {
  ...ANA, id: 'a0000000-0000-4000-8000-000000000009', nome: 'Maria Aparecida dos Santos Albuquerque de Oliveira Fictícia',
};

const AGENDAS: AgendaPessoal[] = [
  { id: 'g1', nome: 'Pessoal', cor: 'AZUL', versao: 0 },
  { id: 'g2', nome: 'Bruno (médico/consulta)', cor: 'TURQUESA', versao: 0 },
  { id: 'g3', nome: 'Estudos e cursos de atualização profissional', cor: 'VIOLETA', versao: 0 },
];

const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`);
const horaDe = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(11, 16);

function compromisso(id: string, alunos: AlunoResumo[], data: string, hora: string, extra: Partial<Compromisso> = {}): Compromisso {
  const inicio = instante(data, hora);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return {
    id, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    participantes: alunos.map((a) => ({ id: a.id, nome: a.nome, situacao: 'AGENDADO' })), cancelado: false,
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data, hora, horaFim: horaDe(fim), duracaoMinutos: 60, local: 'Sala 2',
    observacao: 'Observação fictícia', versao: 0, ...extra,
  };
}

async function abrir(page: Page, opcoes: { compromissos?: Compromisso[]; permissoes?: string[]; extra?: RespostasApi; recolhido?: boolean; escuro?: boolean } = {}) {
  await fixarHoje(page);
  if (opcoes.recolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
  if (opcoes.escuro) await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  const compromissos = opcoes.compromissos ?? [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: [...PERMISSOES_TREINADOR, ...(opcoes.permissoes ?? ['AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR'])],
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 2, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens: [ANA, NOME_LONGO], total: 2 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [] },
    'GET /agenda/compromissos': (p, route) => json(route, compromissos.filter((c) => c.data >= (p.busca.get('de') ?? '') && c.data <= (p.busca.get('ate') ?? ''))),
    'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
    'GET /agenda/agendas': { corpo: AGENDAS },
    'GET /agenda/eventos': { corpo: [] },
    'GET /agenda/resumo': { corpo: { dias: [] } },
    ...opcoes.extra,
  });
  await page.goto('/treinador/agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  return api;
}

const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

/**
 * Largura da semana na grade (do 1º ao 7º "Abrir o dia") antes da F20, medida neste mesmo teste com a lateral de 310 px
 * (12/11/2026): a lateral compacta devolve o espaço à grade, que precisa ficar maior que isto.
 */
const GRADE_ANTES: Record<string, number> = { '1280': 609, '1280-recolhido': 777, '1440': 769, '1440-recolhido': 937, '1920': 1249, '1920-recolhido': 1411 };

test.describe('F20: lateral compacta no PC', () => {
  for (const [largura, recolhido] of [[1280, false], [1280, true], [1440, false], [1440, true], [1920, false], [1920, true]] as const) {
    test(`${largura}×720 menu ${recolhido ? 'recolhido' : 'aberto'}: lateral de 240 a 280 px, agendas à vista e a grade com o resto`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 720 });
      const { errosDaPagina } = await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')], recolhido });
      const lateral = page.getByTestId('lateral-da-agenda');
      await expect(lateral).toBeVisible();
      const caixa = (await lateral.boundingBox())!;
      const dias = page.getByRole('button', { name: /^Abrir o dia / });
      await expect(dias).toHaveCount(7);
      const grade = Math.round((await dias.last().boundingBox())!.x + (await dias.last().boundingBox())!.width - (await dias.first().boundingBox())!.x);
      const ultimaAgenda = page.getByRole('checkbox', { name: /^Estudos e cursos de atualização profissional, cor / });
      const fimDasAgendas = (await ultimaAgenda.boundingBox())!;
      console.log(`F20 ${largura}${recolhido ? ' recolhido' : ''}: lateral ${Math.round(caixa.width)} px; grade ${grade} px; última agenda termina em ${Math.round(fimDasAgendas.y + fimDasAgendas.height)} px`);
      await page.screenshot({ path: captura(`f20-lateral-${largura}${recolhido ? '-recolhido' : ''}.png`) });

      expect(grade).toBeGreaterThan(GRADE_ANTES[`${largura}${recolhido ? '-recolhido' : ''}`]);
      expect(caixa.width).toBeGreaterThanOrEqual(240);
      expect(caixa.width).toBeLessThanOrEqual(280);
      // "Minhas agendas" e todas as agendas cabem na primeira tela, sem rolar.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(fimDasAgendas.y + fimDasAgendas.height).toBeLessThanOrEqual(720);
      // Nome longo: uma linha com reticências, e o nome inteiro no nome acessível.
      expect(fimDasAgendas.height).toBeLessThanOrEqual(44);
      // Os dias do mini calendário: alvo de pelo menos 32 px.
      const dia = (await page.getByRole('button', { name: /^terça-feira, 20 de outubro de 2026$/i }).boundingBox())!;
      expect(dia.width).toBeGreaterThanOrEqual(32);
      expect(dia.height).toBeGreaterThanOrEqual(32);
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test('390 px: sem a lateral (agendas e filtros na folha) e sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { errosDaPagina } = await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] });
    await expect(page.getByRole('button', { name: 'Agendas e filtros', exact: true })).toBeVisible();
    await expect(page.getByTestId('lateral-da-agenda')).toHaveCount(0);
    await page.screenshot({ path: captura('f20-celular-390.png') });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
});

const corposDe = (pedidos: PedidoFalso[], metodo: string, caminho: string) =>
  pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho).map((p) => p.corpo);
const topo = async (l: Locator) => (await l.boundingBox())!.y;

/** O POST do compromisso novo: devolve o compromisso e o põe na lista (a agenda recarrega). */
const criarNaLista = (lista: Compromisso[]): RespostasApi => ({
  'POST /agenda/compromissos': (p, route) => {
    const corpo = p.corpo as { data: string; hora: string };
    const novo = compromisso(`n${lista.length}`, [NOME_LONGO], corpo.data, corpo.hora);
    lista.push(novo);
    return json(route, novo);
  },
});

async function escolherNaLista(page: Page, onde: Locator, rotulo: string, opcao: string, titulo = rotulo) {
  await onde.getByRole('button', { name: new RegExp(`^${rotulo}: .*\\. Escolher\\.$`) }).click();
  const lista = page.getByRole('dialog', { name: titulo, exact: true });
  await lista.getByRole('radio', { name: opcao, exact: true }).click();
  await expect(lista).toBeHidden();
}

test.describe('F12: formulário do compromisso novo', () => {
  for (const [largura, altura] of [[1280, 720], [390, 844]] as const) {
    test(`${largura} px: ordem natural, padrões, erros por campo e salvar`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      const lista: Compromisso[] = [];
      const { pedidos, errosDaPagina } = await abrir(page, { compromissos: lista, extra: criarNaLista(lista) });
      await page.getByRole('button', { name: 'Criar', exact: true }).click();
      await page.getByRole('menuitem', { name: /^Compromisso com aluno/ }).click();
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await expect(folha).toBeVisible();

      // Padrões: o dia da agenda, quem marca como responsável, sem repetição.
      const data = folha.getByLabel('Data', { exact: true });
      await expect(data).toHaveValue('19/10/2026');
      await expect(folha.getByRole('button', { name: /^Responsável: Treinadora Teste/ })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Repetição: Não se repete. Escolher.', exact: true })).toBeVisible();
      // Ordem natural: alunos, quando (data, repetição), detalhes (responsável, local, observação).
      const ordem = [
        folha.getByRole('button', { name: /^Aluno: Adicionar/ }), data, folha.getByRole('button', { name: /^Repetição: / }),
        folha.getByRole('button', { name: /^Responsável: / }), folha.getByRole('textbox', { name: /^Local/ }), folha.getByRole('textbox', { name: /^Observação/ }),
      ];
      const ys = [];
      for (const l of ordem) ys.push(await topo(l));
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
      // Rótulos sempre visíveis, opcionais marcados; o rodapé fica fixo à vista.
      await expect(folha.getByText('Local (opcional)')).toBeVisible();
      await expect(folha.getByText('Observação (opcional)')).toBeVisible();
      const marcar = folha.getByRole('button', { name: 'Marcar compromisso', exact: true });
      await expect(folha.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport();
      await expect(marcar).toBeInViewport();
      // Data e Início na mesma linha (PC): a base do botão alinha com a do campo, embora só a data tenha rótulo em cima.
      const campo = (await data.boundingBox())!;
      const inicio = (await folha.getByRole('button', { name: /^Início: / }).boundingBox())!;
      if (Math.abs(inicio.y - campo.y) < campo.height) expect(Math.abs(inicio.y + inicio.height - (campo.y + campo.height))).toBeLessThanOrEqual(2);

      // Erros por campo, sem chamar a API.
      await marcar.click();
      await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
      await expect(folha.getByText('Escolha ao menos um aluno.')).toBeVisible();
      await expect(folha.getByText('Início: Informe a hora.')).toBeVisible();
      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([]);
      await page.screenshot({ path: captura(`f12-erros-${largura}.png`) });

      // Nome longo cabe; o fim começa em 1 hora depois do início.
      await folha.getByRole('button', { name: /^Aluno: Adicionar/ }).click();
      const busca = page.getByRole('dialog', { name: 'Adicionar aluno' });
      await busca.getByRole('radio', { name: NOME_LONGO.nome }).click();
      await expect(busca).toBeHidden();
      await escolherNaLista(page, folha, 'Início', '09:30', 'Início (Brasília)');
      await expect(folha.getByRole('button', { name: 'Fim: 10:30 (1 h). Escolher.', exact: true })).toBeVisible();
      const chip = (await folha.getByRole('button', { name: `Remover ${NOME_LONGO.nome}`, exact: true }).boundingBox())!;
      const caixa = (await folha.boundingBox())!;
      expect(chip.x + chip.width).toBeLessThanOrEqual(caixa.x + caixa.width);
      await semRolagemHorizontal(page);
      await page.screenshot({ path: captura(`f12-preenchido-${largura}.png`) });

      await marcar.click();
      await expect(folha).toBeHidden();
      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([
        { alunoIds: [NOME_LONGO.id], responsavelId: TREINADOR.id, data: HOJE, hora: '09:30', duracaoMinutos: 60, local: null, observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test('Cancelar fecha sem salvar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const { pedidos } = await abrir(page);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Compromisso com aluno/ }).click();
    const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
    await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(folha).toBeHidden();
    expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([]);
  });
});

test.describe('F13: resumo ao tocar no compromisso', () => {
  const BLOCO = 'Abrir compromisso de Ana Fictícia, das 9h às 10h';

  test('PC: resumo ao lado do bloco; Esc e clique fora fecham e o foco volta ao bloco', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { errosDaPagina } = await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] });
    const bloco = page.getByRole('button', { name: BLOCO, exact: true });
    await bloco.click();
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await expect(resumo).toBeVisible();
    await expect(resumo.getByRole('heading', { name: 'Ana Fictícia' })).toBeVisible();
    await expect(resumo.getByText(/09:00–10:00/)).toBeVisible();
    for (const t of ['Compromissos com alunos', 'Sala 2', 'Observação fictícia', 'Treinadora Teste']) await expect(resumo.getByText(t, { exact: true })).toBeVisible();
    // Ao lado do bloco, na altura dele.
    const b = (await bloco.boundingBox())!;
    const r = (await resumo.boundingBox())!;
    expect(r.x >= b.x + b.width || r.x + r.width <= b.x).toBe(true);
    expect(r.y < b.y + b.height && r.y + r.height > b.y).toBe(true);
    await page.screenshot({ path: captura('f13-resumo-1280.png') });

    await page.keyboard.press('Escape');
    await expect(resumo).toBeHidden();
    await expect(bloco).toBeFocused();

    await bloco.click();
    await expect(resumo).toBeVisible();
    await page.mouse.click(1270, 890);
    await expect(resumo).toBeHidden();
    await expect(bloco).toBeFocused();
    expect(errosDaPagina).toEqual([]);
  });

  test('PC: Abrir detalhes, Editar e Cancelar compromisso', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const lista = [compromisso('k1', [ANA], HOJE, '09:00')];
    const { pedidos, errosDaPagina } = await abrir(page, {
      compromissos: lista,
      extra: {
        'POST /agenda/compromissos/{id}/situacao': (p, route) => {
          lista[0] = { ...lista[0], cancelado: true, participantes: lista[0].participantes.map((a) => ({ ...a, situacao: 'CANCELADO' })), versao: 1 };
          return json(route, lista[0]);
        },
      },
    });
    const bloco = page.getByRole('button', { name: BLOCO, exact: true });
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });

    await bloco.click();
    await resumo.getByRole('button', { name: 'Abrir detalhes', exact: true }).click();
    const detalhe = page.getByRole('dialog', { name: 'Compromisso' });
    await expect(detalhe).toBeVisible();
    await expect(resumo).toBeHidden();
    await detalhe.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(detalhe).toBeHidden();
    await expect(bloco).toBeFocused();

    await bloco.click();
    await resumo.getByRole('button', { name: 'Editar', exact: true }).click();
    const editar = page.getByRole('dialog', { name: 'Editar compromisso' });
    await expect(editar).toBeVisible();
    // Vindo do resumo, desistir fecha a folha (sem cair num detalhe que a pessoa não abriu) e o foco volta ao bloco.
    await editar.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(editar).toBeHidden();
    await expect(detalhe).toBeHidden();
    await expect(bloco).toBeFocused();

    await bloco.click();
    await resumo.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
    const painel = page.getByRole('alertdialog', { name: 'Cancelar este compromisso?' });
    await expect(painel).toBeVisible();
    await page.screenshot({ path: captura('f13-cancelar-1280.png') });
    await painel.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(painel).toBeHidden();
    await expect(detalhe).toBeHidden();

    await bloco.click();
    await resumo.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
    await painel.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
    await expect(painel).toBeHidden();
    await expect(detalhe.getByText('Cancelado', { exact: true }).first()).toBeVisible();
    expect(corposDe(pedidos, 'POST', '/agenda/compromissos/k1/situacao')).toEqual([{ cancelado: true, versao: 0 }]);
    expect(errosDaPagina).toEqual([]);
  });

  test('PC, teclado: Enter no bloco abre o resumo ao lado; Esc devolve o foco', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] });
    const bloco = page.getByRole('button', { name: BLOCO, exact: true });
    await bloco.focus();
    await page.keyboard.press('Enter');
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await expect(resumo).toBeVisible();
    const b = (await bloco.boundingBox())!;
    const r = (await resumo.boundingBox())!;
    expect(r.x >= b.x + b.width).toBe(true);
    // O Tab anda dentro do resumo (fechar e as ações).
    await page.keyboard.press('Tab');
    await expect(resumo.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(resumo).toBeHidden();
    await expect(bloco).toBeFocused();
  });

  test('tema escuro: resumo no PC e no celular e o formulário (capturas)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { errosDaPagina } = await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')], escuro: true });
    await page.getByRole('button', { name: BLOCO, exact: true }).click();
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await expect(resumo).toBeVisible();
    await page.screenshot({ path: captura('f13-resumo-1280-escuro.png') });
    await page.keyboard.press('Escape');
    await expect(resumo).toBeHidden();
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Compromisso com aluno/ }).click();
    const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
    await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
    await expect(folha.getByText('Escolha ao menos um aluno.')).toBeVisible();
    await page.screenshot({ path: captura('f12-erros-1280-escuro.png') });
    await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(folha).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /^Abrir compromisso de Ana Fictícia/ }).first().click();
    await expect(resumo.getByText('Sala 2', { exact: true })).toBeVisible();
    await page.screenshot({ path: captura('f13-resumo-390-escuro.png') });
    expect(errosDaPagina).toEqual([]);
  });

  test('sem AGENDA_ALTERAR: só "Abrir detalhes"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')], permissoes: ['AGENDA_LER', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER'] });
    await page.getByRole('button', { name: BLOCO, exact: true }).click();
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await expect(resumo.getByRole('button', { name: 'Abrir detalhes', exact: true })).toBeVisible();
    await expect(resumo.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(resumo.getByRole('button', { name: /^Cancelar compromisso/ })).toHaveCount(0);
  });

  test('390 px: o resumo abre numa folha, sem rolagem horizontal; Esc devolve o foco', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { errosDaPagina } = await abrir(page, { compromissos: [compromisso('k1', [NOME_LONGO], HOJE, '09:00')] });
    const item = page.getByRole('button', { name: /^Abrir compromisso de Maria Aparecida/ }).first();
    await item.click();
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await expect(resumo.getByText('Sala 2', { exact: true })).toBeVisible();
    await expect(resumo.getByRole('button', { name: 'Abrir detalhes', exact: true })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: captura('f13-resumo-390.png') });
    await page.keyboard.press('Escape');
    await expect(resumo).toBeHidden();
    await expect(item).toBeFocused();
    expect(errosDaPagina).toEqual([]);
  });

  test('PC: clicar num horário vazio abre o compromisso novo com o dia e a hora', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page);
    const dia = (await page.getByRole('button', { name: /^Abrir o dia quarta-feira, 21 de outubro de 2026/ }).boundingBox())!;
    const hora = (await page.getByText('14:00', { exact: true }).first().boundingBox())!;
    await page.mouse.click(dia.x + dia.width / 2, hora.y + hora.height / 2 + 12);
    const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
    await expect(folha).toBeVisible();
    await expect(folha.getByLabel('Data', { exact: true })).toHaveValue('21/10/2026');
    await expect(folha.getByRole('button', { name: 'Início: 14:00. Escolher.', exact: true })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Fim: 15:00 (1 h). Escolher.', exact: true })).toBeVisible();
    await page.screenshot({ path: captura('f13-horario-vazio-1280.png') });
  });

  // No Mês a célula inteira abre o Dia (os itens não são botões à parte); o resumo vale na grade do Dia e da Semana.
  test('PC, Dia: bloco largo; o resumo fica ao lado, sem cobri-lo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, { compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] });
    const resumo = page.getByRole('dialog', { name: 'Resumo do compromisso' });
    await page.locator('body').press('d');
    const item = page.getByRole('button', { name: BLOCO, exact: true });
    await item.click();
    await expect(resumo).toBeVisible();
    const b = (await item.boundingBox())!;
    const r = (await resumo.boundingBox())!;
    expect(r.x >= b.x + b.width - 1 || r.x + r.width <= b.x + 1).toBe(true);
    await page.screenshot({ path: captura('f13-resumo-dia-1280.png') });
    await page.keyboard.press('Escape');
    await expect(item).toBeFocused();
  });

  test('sem AGENDA_ALTERAR: o horário vazio não abre nada', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, { permissoes: ['AGENDA_LER', 'ATUALIZACAO_LER'] });
    const dia = (await page.getByRole('button', { name: /^Abrir o dia quarta-feira, 21 de outubro de 2026/ }).boundingBox())!;
    const hora = (await page.getByText('14:00', { exact: true }).first().boundingBox())!;
    await page.mouse.click(dia.x + dia.width / 2, hora.y + hora.height / 2 + 12);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
