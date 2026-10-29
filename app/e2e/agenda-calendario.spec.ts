import { expect, test, type Locator, type Page } from '@playwright/test';

import type {
  AgendaPessoal, AgendaPessoalRequest, Compromisso, CorDaAgenda, EventoDetalhe, EventoRequest, OcorrenciaDeEvento, RepeticaoDeEvento,
} from '../src/api/agendaTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';

/**
 * Agenda em calendário (passo 14 de `docs/planos/agenda-calendario.md`): as visões Dia, Semana, Mês e Ano no endereço
 * (`?visao=&data=`), setas, "Hoje", atalhos D/W/M/Y e o voltar do navegador; a grade de horários, o mini calendário e o
 * painel "Minhas agendas" no PC; a lista por dia, o Mês compacto e o Ano no celular; esconder uma agenda (preferência do
 * aparelho, sobrevive ao recarregar); o evento pessoal (a "Pessoal" nasce no primeiro evento, repetição, privacidade,
 * escopo da série, 409); o filtro de responsável; as permissões; e o Ano, que só lê o resumo e as atualizações.
 * O relógio fica em segunda-feira, 19/10/2026, 12:00 de Brasília (semana de 19 a 25/10). Só dados fictícios.
 */

const HOJE = '2026-10-19';

const ANA: AlunoResumo = {
  id: 'a0000000-0000-4000-8000-000000000001', nome: 'Ana Fictícia', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null,
};
const OUTRO_MEMBRO = { id: 'u0000000-0000-4000-8000-000000000003', nome: 'Bruno Equipe' };

const ATUALIZACAO: AtualizacaoDaLista = {
  id: null as unknown as string, pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: 'a0000000-0000-4000-8000-000000000002',
  nomeAluno: 'Bruno Exemplo', dataAtualizacao: HOJE, fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null,
};

const PAINEL = { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 1, alunosAtivos: 1, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] };

/** Cores da paleta clara (a marca de teste nasce no tema claro): o marcador da grade é a borda esquerda do bloco. */
const RGB_AZUL = 'rgb(27, 111, 214)';
const RGB_INDIGO = 'rgb(75, 63, 191)';

const PRIVACIDADE = 'O evento é só seu e não faz parte do cadastro do aluno. Evite nome de aluno e dado de saúde no título e na descrição: a anonimização do aluno não apaga o que você escrever aqui.';

/** Brasília = UTC−3 (sem horário de verão em 2026). */
const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`);
const horaDe = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(11, 16);
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** 1 = segunda ... 7 = domingo. */
const diaDaSemana = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

function compromisso(id: string, alunos: AlunoResumo[], data: string, hora: string): Compromisso {
  const inicio = instante(data, hora);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return {
    id, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    participantes: alunos.map((a) => ({ id: a.id, nome: a.nome, situacao: 'AGENDADO' })), cancelado: false,
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data, hora, horaFim: horaDe(fim), duracaoMinutos: 60, local: 'Sala 2',
    observacao: null, versao: 0,
  };
}

const agenda = (id: string, nome: string, cor: CorDaAgenda): AgendaPessoal => ({ id, nome, cor, versao: 0 });

/** Um evento da API falsa: a regra e as datas já expandidas (quem expande de verdade é a API). */
interface EventoFalso {
  id: string;
  agendaId: string;
  titulo: string;
  hora: string;
  datas: string[];
  repeticao: RepeticaoDeEvento | null;
  versao: number;
}

function ocorrenciaDe(e: EventoFalso, data: string): OcorrenciaDeEvento {
  const inicio = instante(data, e.hora);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return {
    eventoId: e.id, agendaId: e.agendaId, dataOriginal: data, data, hora: e.hora, horaFim: horaDe(fim), inicio: inicio.toISOString(),
    fim: fim.toISOString(), diaInteiro: false, titulo: e.titulo, local: null, descricao: null, recorrente: !!e.repeticao,
  };
}

function detalheDe(e: EventoFalso, ocorrencia?: string | null): EventoDetalhe {
  const data = ocorrencia && e.datas.includes(ocorrencia) ? ocorrencia : e.datas[0];
  return {
    id: e.id, agendaId: e.agendaId, titulo: e.titulo, local: null, descricao: null, data: e.datas[0], diaInteiro: false, hora: e.hora,
    duracaoMinutos: 60, repeticao: e.repeticao, versao: e.versao, ocorrencia: data ? ocorrenciaDe(e, data) : null,
  };
}

/** As datas de uma regra simples a partir de `data`, em 5 semanas (o bastante para os períodos testados). */
function expandir(data: string, r: RepeticaoDeEvento | null): string[] {
  if (!r || r.tipo === 'NENHUMA') return [data];
  return Array.from({ length: 35 }, (_, i) => somarDias(data, i)).filter((d) => {
    if (r.tipo === 'DIAS_UTEIS') return diaDaSemana(d) <= 5;
    if (r.tipo === 'DIARIA') return true;
    return d === data;
  });
}

interface Estado {
  agendas: AgendaPessoal[];
  eventos: EventoFalso[];
  compromissos: Compromisso[];
}

/**
 * Treinador na Agenda com a API falsa de agendas, eventos, compromissos, resumo do Ano e atualizações. O `estado` muda
 * com os POST/PUT/DELETE, como no servidor. `extra` troca qualquer rota.
 */
async function abrirAgenda(page: Page, estado: Estado, opcoes: { permissoes?: string[]; extra?: RespostasApi } = {}) {
  await fixarHoje(page);
  const eventosNoPeriodo = (p: PedidoFalso) => {
    const de = p.busca.get('de') ?? '';
    const ate = p.busca.get('ate') ?? '';
    const filtro = p.busca.getAll('agendas');
    return estado.eventos.filter((e) => !filtro.length || filtro.includes(e.agendaId))
      .flatMap((e) => e.datas.filter((d) => d >= de && d <= ate).map((d) => ocorrenciaDe(e, d)));
  };
  const achar = (p: PedidoFalso) => estado.eventos.find((e) => e.id === p.caminho.split('/')[3]);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: [...PERMISSOES_TREINADOR, ...(opcoes.permissoes ?? ['AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER'])],
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': { corpo: { itens: [ANA], total: 1 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRO_MEMBRO] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
    'GET /agenda/compromissos': (p, route) => json(route, estado.compromissos.filter((c) => c.data >= (p.busca.get('de') ?? '') && c.data <= (p.busca.get('ate') ?? ''))),
    'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
    'GET /agenda/agendas': (_p, route) => json(route, estado.agendas),
    'POST /agenda/agendas': (p, route) => {
      const corpo = p.corpo as AgendaPessoalRequest;
      const nova = agenda(`g-${estado.agendas.length + 1}`, corpo.nome, corpo.cor);
      estado.agendas.push(nova);
      return json(route, nova);
    },
    'GET /agenda/eventos': (p, route) => json(route, eventosNoPeriodo(p)),
    'GET /agenda/eventos/{id}': (p, route) => {
      const e = achar(p);
      return e ? json(route, detalheDe(e, p.busca.get('ocorrencia'))) : json(route, erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
    },
    'POST /agenda/eventos': (p, route) => {
      const corpo = p.corpo as EventoRequest;
      const novo: EventoFalso = {
        id: `ev-${estado.eventos.length + 1}`, agendaId: corpo.agendaId, titulo: corpo.titulo, hora: corpo.hora ?? '00:00',
        datas: expandir(corpo.data, corpo.repeticao), repeticao: corpo.repeticao, versao: 0,
      };
      estado.eventos.push(novo);
      return json(route, detalheDe(novo));
    },
    'PUT /agenda/eventos/{id}': (p, route) => {
      const e = achar(p);
      if (!e) return json(route, erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      e.titulo = (p.corpo as EventoRequest).titulo;
      e.versao += 1;
      return json(route, detalheDe(e, p.busca.get('ocorrencia')));
    },
    'DELETE /agenda/eventos/{id}': (p, route) => {
      const e = achar(p);
      const escopo = p.busca.get('escopo') ?? 'ESTA';
      const ocorrencia = p.busca.get('ocorrencia');
      if (e && escopo === 'TODAS') estado.eventos.splice(estado.eventos.indexOf(e), 1);
      else if (e && escopo === 'SEGUINTES') e.datas = e.datas.filter((d) => !ocorrencia || d < ocorrencia);
      else if (e && e.repeticao) e.datas = e.datas.filter((d) => d !== ocorrencia);
      else if (e) estado.eventos.splice(estado.eventos.indexOf(e), 1);
      return route.fulfill({ status: 204 });
    },
    // Resumo do Ano: só contagens por dia, dos compromissos e dos eventos das agendas pedidas.
    'GET /agenda/resumo': (p, route) => {
      const de = p.busca.get('de') ?? '';
      const ate = p.busca.get('ate') ?? '';
      const dias = new Map<string, { data: string; compromissos: number; eventos: number }>();
      const dia = (d: string) => dias.get(d) ?? dias.set(d, { data: d, compromissos: 0, eventos: 0 }).get(d)!;
      for (const c of estado.compromissos) if (c.data >= de && c.data <= ate) dia(c.data).compromissos += 1;
      for (const o of eventosNoPeriodo(p)) dia(o.data).eventos += 1;
      return json(route, { dias: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)) });
    },
    ...opcoes.extra,
  });
}

/** Uma opção de `Escolha` (grupo com o rótulo dado). */
const opcao = (onde: Locator | Page, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });
const visao = (page: Page, rotulo: string) => opcao(page, 'Visão do calendário', rotulo);

const doCaminho = (pedidos: PedidoFalso[], metodo: string, caminho: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho);
const ultimo = (pedidos: PedidoFalso[], caminho: string) => doCaminho(pedidos, 'GET', caminho).at(-1);
/** O endereço da agenda sem a origem: `/treinador/agenda?visao=mes&data=2026-10-26`. */
const endereco = (page: Page) => { const u = new URL(page.url()); return `${u.pathname}${u.search}`; };

const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    const celular = largura < 760;

    /** Onde ficam o painel de agendas e os filtros: a coluna da esquerda no PC, a folha "Agendas e filtros" no celular. */
    async function painel(page: Page): Promise<Locator> {
      if (!celular) return page.locator('body');
      const folha = page.getByRole('dialog', { name: 'Agendas e filtros', exact: true });
      if (!(await folha.isVisible())) await page.getByRole('button', { name: 'Agendas e filtros', exact: true }).click();
      await expect(folha).toBeVisible();
      return folha;
    }
    async function fecharPainel(page: Page) {
      if (!celular) return;
      const folha = page.getByRole('dialog', { name: 'Agendas e filtros', exact: true });
      if (await folha.isVisible()) await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toBeHidden();
    }

    test('visões pela barra, setas e Hoje no endereço; o voltar desfaz a troca de visão', async ({ page }) => {
      const estado: Estado = { agendas: [], eventos: [], compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      await page.goto('/treinador/agenda');

      // Um h1 só; a Semana de hoje (o padrão) com o "Hoje" desabilitado e o motivo.
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda');
      await expect(page.getByRole('heading', { name: '19 – 25 de out. de 2026', exact: true })).toBeVisible();
      await expect(visao(page, 'Semana')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeDisabled();
      await expect(page.getByText('Hoje já está na tela.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00', exact: true })).toBeVisible();
      expect([ultimo(pedidos, '/agenda/compromissos')?.busca.get('de'), ultimo(pedidos, '/agenda/compromissos')?.busca.get('ate')]).toEqual(['2026-10-19', '2026-10-25']);

      // Seta: troca a data sem empilhar; "Hoje" volta a valer.
      await page.getByRole('button', { name: 'Próxima semana', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?data=2026-10-26');
      await expect(page.getByRole('heading', { name: '26 de out. – 1 de nov. de 2026', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeEnabled();

      // Mês pela barra (empilha) e o voltar do navegador volta à Semana na mesma data.
      await visao(page, 'Mês').click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes&data=2026-10-26');
      await expect.poll(() => ultimo(pedidos, '/agenda/compromissos')?.busca.get('de')).toBe('2026-09-28');
      expect(ultimo(pedidos, '/agenda/compromissos')?.busca.get('ate')).toBe('2026-11-08');
      await page.goBack();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?data=2026-10-26');
      await expect(visao(page, 'Semana')).toHaveAttribute('aria-checked', 'true');

      // "Hoje" tira a data do endereço.
      await page.getByRole('button', { name: 'Hoje', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda');
      await expect(page.getByRole('heading', { name: '19 – 25 de out. de 2026', exact: true })).toBeVisible();

      // Ano: as setas andam um ano; voltar ao ano de hoje tira a data.
      await visao(page, 'Ano').click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');
      await page.getByRole('button', { name: 'Próximo ano', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano&data=2027-10-19');
      await expect(page.getByRole('heading', { name: '2027', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ano anterior', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');

      // Dia: a seta anda um dia; o voltar desfaz a troca de visão (volta ao Ano).
      await visao(page, 'Dia').click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=dia');
      await page.getByRole('button', { name: 'Dia anterior', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=dia&data=2026-10-18');
      await expect(page.getByRole('heading', { name: '18 de outubro de 2026', exact: true })).toBeVisible();
      await page.goBack();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');
      await expect(visao(page, 'Ano')).toHaveAttribute('aria-checked', 'true');

      if (!celular) {
        // Atalhos de teclado (web): D, W, M e Y trocam a visão e empilham como a barra.
        await page.keyboard.press('d');
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=dia');
        await page.keyboard.press('w');
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda');
        await page.keyboard.press('m');
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes');
        await page.keyboard.press('Y');
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');
        // Com Ctrl o atalho é do navegador, não da agenda.
        await page.keyboard.press('Control+d').catch(() => undefined);
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');
        await page.goBack();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes');
        await expect(visao(page, 'Mês')).toHaveAttribute('aria-checked', 'true');
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(celular ? 'celular: lista por dia, Mês compacto com pontos e Ano rolável, sem rolagem horizontal'
      : 'PC: grade de horários com a cor da agenda, mini calendário e Minhas agendas', async ({ page }) => {
      const estado: Estado = {
        agendas: [agenda('g1', 'Pessoal', 'AZUL')],
        eventos: [{ id: 'ev1', agendaId: 'g1', titulo: 'Consulta pessoal', hora: '10:00', datas: [HOJE], repeticao: null, versao: 0 }],
        compromissos: [compromisso('k1', [ANA], HOJE, '09:00')],
      };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      await page.goto('/treinador/agenda');
      const doCompromisso = page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00', exact: true });
      const doEvento = page.getByRole('button', { name: 'Abrir evento Consulta pessoal, 10:00', exact: true });
      await expect(doCompromisso).toBeVisible();
      await expect(doEvento).toBeVisible();
      await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo/ })).toBeVisible();

      if (!celular) {
        // Grade: um cabeçalho por dia (abre o Dia) e o bloco com a borda na cor da agenda.
        await expect(page.getByRole('button', { name: /^Abrir o dia / })).toHaveCount(7);
        await expect(page.getByRole('button', { name: 'Abrir o dia segunda-feira, 19 de outubro de 2026, hoje', exact: true })).toBeVisible();
        await expect(doCompromisso).toHaveCSS('border-left-color', RGB_INDIGO);
        await expect(doEvento).toHaveCSS('border-left-color', RGB_AZUL);
        // Sem a lista do celular (os metadados por extenso ficam só nela).
        await expect(page.getByText('Hoje, 19/10')).toHaveCount(0);

        // Painel: as duas agendas fixas e a pessoal, cada uma com a caixa marcada.
        await expect(page.getByRole('heading', { name: 'Minhas agendas', exact: true })).toBeVisible();
        const agendas = page.getByRole('group', { name: 'Agendas visíveis' }).getByRole('checkbox');
        await expect(agendas).toHaveCount(3);
        await expect(page.getByRole('checkbox', { name: 'Compromissos com alunos, cor Índigo. Mostrar na agenda', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Atualizações, cor Ardósia. Mostrar na agenda', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Pessoal, cor Azul. Mostrar na agenda', exact: true })).toBeChecked();
        await expect(page.getByRole('button', { name: 'Editar a agenda Pessoal', exact: true })).toBeVisible();

        // Mini calendário: as setas trocam só o mês dele; o dia tocado leva a Semana para lá (sem trocar de visão).
        await expect(page.getByRole('heading', { name: 'Outubro de 2026', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'segunda-feira, 19 de outubro de 2026, hoje', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Próximo mês no mini calendário', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Novembro de 2026', exact: true })).toBeVisible();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda');
        await page.getByRole('button', { name: 'quinta-feira, 5 de novembro de 2026', exact: true }).click();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?data=2026-11-05');
        await expect(page.getByRole('heading', { name: '2 – 8 de nov. de 2026', exact: true })).toBeVisible();
        await expect.poll(() => ultimo(pedidos, '/agenda/compromissos')?.busca.get('de')).toBe('2026-11-02');

        // Mês no PC: célula com os itens do dia; o toque abre o Dia.
        await page.getByRole('button', { name: 'Hoje', exact: true }).click();
        await visao(page, 'Mês').click();
        const celula = page.getByRole('button', { name: 'segunda-feira, 19 de outubro de 2026, hoje, 3 itens. Abrir o dia', exact: true });
        await expect(celula).toBeVisible();
        await expect(celula.getByText('09:00 Ana Fictícia')).toBeVisible();
        await celula.click();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=dia');
        await expect(page.getByRole('button', { name: /^Abrir o dia / })).toHaveCount(0);
        await expect(doEvento).toBeVisible();
        await semRolagemHorizontal(page);
      } else {
        // Lista por dia: um cartão por dia da semana, com o resumo; dia vazio só com a faixa.
        await expect(page.getByText('Hoje, 19/10', { exact: true })).toBeVisible();
        await expect(page.getByText('1 compromisso · 1 evento · 1 atualização', { exact: true })).toBeVisible();
        await expect(page.getByText('Amanhã, 20/10', { exact: true })).toBeVisible();
        await expect(page.getByText('Nada marcado', { exact: true })).toHaveCount(6);
        await expect(page.getByText('Evento · 10:00–11:00 · Pessoal', { exact: true })).toBeVisible();
        // Sem grade nem mini calendário no celular; o painel abre numa folha.
        await expect(page.getByRole('button', { name: /^Abrir o dia / })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Minhas agendas', exact: true })).toHaveCount(0);
        await semRolagemHorizontal(page);

        // Mês compacto: pontos (decorativos) e o nome diz quantos itens; a lista embaixo é a do dia escolhido.
        await visao(page, 'Mês').click();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes');
        const dia19 = page.getByRole('button', { name: 'segunda-feira, 19 de outubro de 2026, hoje, 3 itens', exact: true });
        await expect(dia19).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText('Hoje, 19/10', { exact: true })).toBeVisible();
        await expect(doEvento).toBeVisible();
        await semRolagemHorizontal(page);
        await page.getByRole('button', { name: 'quarta-feira, 21 de outubro de 2026, nada marcado', exact: true }).click();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes&data=2026-10-21');
        await expect(page.getByRole('button', { name: 'quarta-feira, 21 de outubro de 2026, nada marcado', exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(doEvento).toHaveCount(0);
        await expect(page.getByText('Nada marcado', { exact: true })).toBeVisible();

        // Ano: um mês por linha, rolando com a tela.
        await visao(page, 'Ano').click();
        await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano&data=2026-10-21');
        const dezembro = page.getByRole('button', { name: 'Abrir dezembro de 2026', exact: true });
        await expect(page.getByRole('button', { name: 'Abrir janeiro de 2026', exact: true })).toBeVisible();
        await expect(dezembro).not.toBeInViewport();
        await dezembro.scrollIntoViewIfNeeded();
        await expect(dezembro).toBeInViewport();
        await semRolagemHorizontal(page);
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('esconder e mostrar uma agenda some e volta com os itens; a escolha fica no aparelho ao recarregar', async ({ page }) => {
      const estado: Estado = {
        agendas: [agenda('g1', 'Pessoal', 'AZUL'), agenda('g2', 'Estudos', 'VIOLETA')],
        eventos: [
          { id: 'ev1', agendaId: 'g1', titulo: 'Consulta pessoal', hora: '10:00', datas: ['2026-10-20'], repeticao: null, versao: 0 },
          { id: 'ev2', agendaId: 'g2', titulo: 'Leitura de teste', hora: '16:00', datas: ['2026-10-22'], repeticao: null, versao: 0 },
        ],
        compromissos: [compromisso('k1', [ANA], HOJE, '09:00')],
      };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      await page.goto('/treinador/agenda');
      const leitura = page.getByRole('button', { name: 'Abrir evento Leitura de teste, 16:00', exact: true });
      const consulta = page.getByRole('button', { name: 'Abrir evento Consulta pessoal, 10:00', exact: true });
      const doCompromisso = page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00', exact: true });
      await expect(leitura).toBeVisible();
      await expect(consulta).toBeVisible();
      await expect(doCompromisso).toBeVisible();
      // Nada escondido: os eventos vêm sem filtro de agenda (vazio = todas as minhas).
      expect(ultimo(pedidos, '/agenda/eventos')?.busca.getAll('agendas')).toEqual([]);

      // Esconde "Estudos" e os compromissos.
      let onde = await painel(page);
      const estudos = onde.getByRole('checkbox', { name: 'Estudos, cor Violeta. Mostrar na agenda', exact: true });
      const compromissos = onde.getByRole('checkbox', { name: 'Compromissos com alunos, cor Índigo. Mostrar na agenda', exact: true });
      await estudos.click();
      await expect(estudos).not.toBeChecked();
      await compromissos.click();
      await expect(compromissos).not.toBeChecked();
      await fecharPainel(page);
      await expect(leitura).toHaveCount(0);
      await expect(doCompromisso).toHaveCount(0);
      await expect(consulta).toBeVisible();
      await expect.poll(() => ultimo(pedidos, '/agenda/eventos')?.busca.getAll('agendas')).toEqual(['g1']);

      // A preferência é do aparelho (sem dado pessoal): grava e sobrevive ao recarregar, sem pedir o que está escondido.
      await expect.poll(() => page.evaluate((id) => {
        const salvo = JSON.parse(localStorage.getItem(`treinos:${id}:preferencias`) ?? '{}') as { agendasOcultas?: string[] };
        return [...(salvo.agendasOcultas ?? [])].sort();
      }, TREINADOR.id)).toEqual(['compromissos', 'g2']);
      const antes = pedidos.length;
      await page.reload();
      await expect(consulta).toBeVisible();
      await expect(leitura).toHaveCount(0);
      await expect(doCompromisso).toHaveCount(0);
      const depois = pedidos.slice(antes);
      expect(depois.filter((p) => p.caminho === '/agenda/eventos').map((p) => p.busca.getAll('agendas'))).toEqual([['g1']]);

      // Mostrar de novo traz os itens de volta.
      onde = await painel(page);
      await expect(onde.getByRole('checkbox', { name: 'Estudos, cor Violeta. Mostrar na agenda', exact: true })).not.toBeChecked();
      await onde.getByRole('checkbox', { name: 'Estudos, cor Violeta. Mostrar na agenda', exact: true }).click();
      await onde.getByRole('checkbox', { name: 'Compromissos com alunos, cor Índigo. Mostrar na agenda', exact: true }).click();
      await fecharPainel(page);
      await expect(leitura).toBeVisible();
      await expect(doCompromisso).toBeVisible();
      await expect.poll(() => ultimo(pedidos, '/agenda/eventos')?.busca.getAll('agendas')).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('criar evento pelo "Criar": sem agenda nasce a "Pessoal" (azul) antes do evento; dias úteis e privacidade', async ({ page }) => {
      const estado: Estado = { agendas: [], eventos: [], compromissos: [] };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      await page.goto('/treinador/agenda');
      await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo/ })).toBeVisible();
      // Sem agenda pessoal, os eventos nem são pedidos.
      expect(pedidos.some((p) => p.caminho === '/agenda/eventos')).toBe(false);

      await page.getByRole('button', { name: 'Criar', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: /^Compromisso com aluno/ })).toBeVisible();
      await page.getByRole('menuitem', { name: /^Evento\./ }).click();
      const folha = page.getByRole('dialog', { name: 'Novo evento', exact: true });
      await expect(folha).toBeVisible();
      await expect(folha.getByText('Pessoal (criada ao salvar)', { exact: true })).toBeVisible();
      await expect(folha.getByText(PRIVACIDADE, { exact: true })).toBeVisible();
      await expect(folha.getByLabel('Data', { exact: true })).toHaveValue('19/10/2026');

      // Sem título e hora: o erro fica junto do campo e nada vai à API.
      await folha.getByRole('button', { name: 'Criar evento', exact: true }).click();
      await expect(folha.getByText('Informe o título.')).toBeVisible();
      await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
      expect(doCaminho(pedidos, 'POST', '/agenda/agendas')).toEqual([]);

      await folha.getByLabel('Título', { exact: true }).fill('Estudo de teste');
      await folha.getByLabel('Hora (Brasília)').fill('0900');
      await expect(folha.getByLabel('Hora (Brasília)')).toHaveValue('09:00');
      await opcao(folha, 'Repetição', 'Dias úteis (segunda a sexta)').click();
      await expect(folha.getByText('Feriados não são pulados: cancele só a ocorrência do feriado.', { exact: true })).toBeVisible();
      await expect(opcao(folha, 'Termina', 'Nunca')).toHaveAttribute('aria-checked', 'true');
      // A ajuda dos dias úteis some nos outros tipos.
      await opcao(folha, 'Repetição', 'Todo dia').click();
      await expect(folha.getByText('Feriados não são pulados: cancele só a ocorrência do feriado.')).toHaveCount(0);
      await opcao(folha, 'Repetição', 'Dias úteis (segunda a sexta)').click();
      await folha.getByRole('button', { name: 'Criar evento', exact: true }).click();
      await expect(folha).toBeHidden();

      // A "Pessoal" vai antes, e o evento leva o id que a API devolveu.
      const indice = (metodo: string, caminho: string) => pedidos.findIndex((p) => p.metodo === metodo && p.caminho === caminho);
      expect(indice('POST', '/agenda/agendas')).toBeGreaterThanOrEqual(0);
      expect(indice('POST', '/agenda/agendas')).toBeLessThan(indice('POST', '/agenda/eventos'));
      expect(doCaminho(pedidos, 'POST', '/agenda/agendas').map((p) => p.corpo)).toEqual([{ nome: 'Pessoal', cor: 'AZUL' }]);
      expect(doCaminho(pedidos, 'POST', '/agenda/eventos').map((p) => p.corpo)).toEqual([{
        agendaId: 'g-1', titulo: 'Estudo de teste', local: null, descricao: null, data: '2026-10-19', diaInteiro: false, hora: '09:00',
        duracaoMinutos: 60, repeticao: { tipo: 'DIAS_UTEIS' },
      }]);

      // A tela relê as agendas e os eventos: um por dia útil da semana, na cor da "Pessoal".
      const novos = page.getByRole('button', { name: 'Abrir evento Estudo de teste, 09:00', exact: true });
      await expect(novos).toHaveCount(5);
      if (!celular) await expect(novos.first()).toHaveCSS('border-left-color', RGB_AZUL);
      const onde = await painel(page);
      await expect(onde.getByRole('checkbox', { name: 'Pessoal, cor Azul. Mostrar na agenda', exact: true })).toBeChecked();
      await fecharPainel(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('evento de série pergunta o escopo e manda escopo e ocorrência; avulso não pergunta; 409 recarrega e avisa', async ({ page }) => {
      // Série semanal às quartas (uma só ocorrência na semana: 21/10) e um avulso na quinta.
      const serie: EventoFalso = {
        id: 'ev-serie', agendaId: 'g1', titulo: 'Estudo de teste', hora: '09:00',
        datas: ['2026-10-21', '2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25'],
        repeticao: { tipo: 'SEMANAL', diasDaSemana: ['WEDNESDAY'], ate: '2026-11-25' }, versao: 0,
      };
      const avulso: EventoFalso = { id: 'ev-avulso', agendaId: 'g1', titulo: 'Reunião de teste', hora: '14:00', datas: ['2026-10-22'], repeticao: null, versao: 0 };
      const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [serie, avulso], compromissos: [] };
      let conflito = true;
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado, {
        extra: {
          // O avulso mudou em outra aba: o primeiro PUT dá 409 e a API já tem o título novo.
          'PUT /agenda/eventos/ev-avulso': (_p, route) => {
            if (!conflito) return json(route, detalheDe(avulso));
            conflito = false;
            avulso.titulo = 'Reunião mudada';
            avulso.versao = 1;
            return json(route, erroApi(409, 'O evento mudou.', 'CONFLITO_EDICAO').corpo, 409);
          },
        },
      });
      await page.goto('/treinador/agenda');

      // Série, "Somente este evento": sem `escopo` na rota (é o padrão), com a ocorrência aberta.
      const abrirSerie = async () => {
        await page.getByRole('button', { name: /^Abrir evento Estudo/ }).click();
        const detalhe = page.getByRole('dialog', { name: 'Evento', exact: true });
        await expect(detalhe.getByText('Toda semana: quarta, até 25/11', { exact: true })).toBeVisible();
        return detalhe;
      };
      let detalhe = await abrirSerie();
      expect(ultimo(pedidos, '/agenda/eventos/ev-serie')?.busca.get('ocorrencia')).toBe('2026-10-21');
      await detalhe.getByRole('button', { name: 'Editar', exact: true }).click();
      const editar = page.getByRole('dialog', { name: 'Editar evento', exact: true });
      await expect(editar.getByText(/Este evento faz parte de uma série\. Ao salvar, você escolhe/)).toBeVisible();
      await editar.getByLabel('Título', { exact: true }).fill('Estudo só nesta');
      await editar.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      let pergunta = page.getByRole('alertdialog', { name: 'Salvar em quais eventos da série?' });
      await expect(pergunta).toBeVisible();
      await expect(pergunta.getByRole('radiogroup', { name: 'Aplicar a' }).getByRole('button')).toHaveText(['Somente este evento', 'Este e os seguintes', 'Todos os eventos da série']);
      await expect(pergunta.getByText('Só o evento de 21/10. A repetição da série não muda por aqui.', { exact: true })).toBeVisible();
      await pergunta.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(editar).toBeHidden();

      // Série, "Este e os seguintes": escopo e ocorrência; a data do corpo é a da ocorrência.
      detalhe = await abrirSerie();
      await detalhe.getByRole('button', { name: 'Editar', exact: true }).click();
      await editar.getByLabel('Título', { exact: true }).fill('Estudo daqui em diante');
      await editar.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      pergunta = page.getByRole('alertdialog', { name: 'Salvar em quais eventos da série?' });
      await opcao(pergunta, 'Aplicar a', 'Este e os seguintes').click();
      await expect(pergunta.getByText('O de 21/10 e todos os seguintes. Os anteriores não mudam.', { exact: true })).toBeVisible();
      await pergunta.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(editar).toBeHidden();

      // Série, excluir "Todos": escopo sem ocorrência, com a versão.
      detalhe = await abrirSerie();
      await detalhe.getByRole('button', { name: 'Excluir', exact: true }).click();
      const excluir = page.getByRole('alertdialog', { name: 'Excluir quais eventos da série?' });
      await expect(excluir.getByText('Excluir só este evento? Os outros da série continuam.', { exact: true })).toBeVisible();
      await opcao(excluir, 'Aplicar a', 'Todos os eventos da série').click();
      await expect(excluir.getByText('Excluir a série inteira? Não dá para desfazer.', { exact: true })).toBeVisible();
      await excluir.getByRole('button', { name: 'Excluir', exact: true }).click();
      await expect(detalhe).toBeHidden();
      await expect(page.getByRole('button', { name: /^Abrir evento Estudo/ })).toHaveCount(0);

      const puts = doCaminho(pedidos, 'PUT', '/agenda/eventos/ev-serie');
      expect(puts.map((p) => [p.busca.get('escopo'), p.busca.get('ocorrencia')])).toEqual([[null, '2026-10-21'], ['SEGUINTES', '2026-10-21']]);
      expect(puts[0].corpo).toEqual({
        agendaId: 'g1', titulo: 'Estudo só nesta', local: null, descricao: null, data: '2026-10-21', diaInteiro: false, hora: '09:00',
        duracaoMinutos: 60, repeticao: null, versao: 0,
      });
      expect(puts[1].corpo).toMatchObject({
        titulo: 'Estudo daqui em diante', data: '2026-10-21', versao: 1,
        repeticao: { tipo: 'SEMANAL', diasDaSemana: ['WEDNESDAY'], ate: '2026-11-25' },
      });
      const apagou = doCaminho(pedidos, 'DELETE', '/agenda/eventos/ev-serie');
      expect(apagou.map((p) => [p.busca.get('escopo'), p.busca.get('ocorrencia'), p.busca.get('versao')])).toEqual([['TODAS', null, '2']]);

      // Avulso: sem a repetição no formulário e sem a pergunta do escopo; o 409 relê o evento e avisa.
      await page.getByRole('button', { name: 'Abrir evento Reunião de teste, 14:00', exact: true }).click();
      const doAvulso = page.getByRole('dialog', { name: 'Evento', exact: true });
      await expect(doAvulso.getByText('Não se repete', { exact: true })).toBeVisible();
      await doAvulso.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(editar.getByRole('radiogroup', { name: 'Repetição' })).toHaveCount(0);
      await expect(editar.getByText(/faz parte de uma série/)).toHaveCount(0);
      await editar.getByLabel('Título', { exact: true }).fill('Reunião alterada');
      const leiturasAntes = doCaminho(pedidos, 'GET', '/agenda/eventos/ev-avulso').length;
      await editar.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(doAvulso.getByText('Este evento mudou em outra aba ou aparelho. Esta é a versão atual: confira e edite de novo, se precisar.', { exact: true })).toBeVisible();
      await expect(doAvulso.getByText('Reunião mudada', { exact: true })).toBeVisible();
      expect(doCaminho(pedidos, 'GET', '/agenda/eventos/ev-avulso').length).toBeGreaterThan(leiturasAntes);
      await expect(page.getByRole('button', { name: 'Abrir evento Reunião mudada, 14:00', exact: true })).toBeVisible();

      // Excluir o avulso: confirmação sem "Aplicar a"; a rota leva só a versão (a relida).
      await doAvulso.getByRole('button', { name: 'Excluir', exact: true }).click();
      const excluirAvulso = page.getByRole('alertdialog', { name: 'Excluir o evento?' });
      await expect(excluirAvulso.getByText('Excluir este evento? Não dá para desfazer.', { exact: true })).toBeVisible();
      await expect(excluirAvulso.getByRole('radiogroup', { name: 'Aplicar a' })).toHaveCount(0);
      await excluirAvulso.getByRole('button', { name: 'Excluir', exact: true }).click();
      await expect(doAvulso).toBeHidden();

      const putAvulso = doCaminho(pedidos, 'PUT', '/agenda/eventos/ev-avulso');
      expect(putAvulso.map((p) => p.busca.toString())).toEqual(['']);
      expect(putAvulso[0].corpo).toMatchObject({ titulo: 'Reunião alterada', repeticao: null, versao: 0 });
      expect(doCaminho(pedidos, 'DELETE', '/agenda/eventos/ev-avulso').map((p) => p.busca.toString())).toEqual(['versao=1']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('filtro de responsável manda meus ou responsavel (nunca os dois) nas atualizações, compromissos e resumo', async ({ page }) => {
      const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [], compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      // [meus, responsavel, de] do último pedido da rota (o `de` separa o pedido da Semana do pedido do Ano).
      const filtrosDe = (caminho: string) => () => {
        const p = ultimo(pedidos, caminho);
        return p ? [p.busca.get('meus'), p.busca.get('responsavel'), p.busca.get('de')] : null;
      };
      const atualizacoes = filtrosDe('/atualizacoes');
      const compromissos = filtrosDe('/agenda/compromissos');
      const resumo = filtrosDe('/agenda/resumo');
      const botao = async (rotulo: string) => {
        await expect((await painel(page)).getByRole('button', { name: `Responsável: ${rotulo}. Escolher.`, exact: true })).toBeVisible();
        await fecharPainel(page);
      };
      // O filtro é lido do endereço (`?meus=true` / `?membro=`); aqui se entra por ele. Escolher pela folha está no fim do arquivo.
      await page.goto('/treinador/agenda');
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00', exact: true })).toBeVisible();
      // Toda a equipe: atualizações com meus=false; compromissos sem responsável.
      await expect.poll(atualizacoes).toEqual(['false', null, '2026-10-19']);
      expect(compromissos()).toEqual([null, null, '2026-10-19']);
      await botao('Toda a equipe');

      await page.goto('/treinador/agenda?meus=true');
      await expect.poll(atualizacoes).toEqual(['true', null, '2026-10-19']);
      await expect.poll(compromissos).toEqual([null, TREINADOR.id, '2026-10-19']);
      await botao('Só os meus');

      await page.goto(`/treinador/agenda?membro=${OUTRO_MEMBRO.id}`);
      await expect.poll(atualizacoes).toEqual([null, OUTRO_MEMBRO.id, '2026-10-19']);
      await expect.poll(compromissos).toEqual([null, OUTRO_MEMBRO.id, '2026-10-19']);
      await botao('Bruno Equipe');

      // No Ano o resumo segue o mesmo filtro: um membro ou eu = responsavel (nunca `meus`); sem filtro, nada.
      await page.goto(`/treinador/agenda?visao=ano&membro=${OUTRO_MEMBRO.id}`);
      await expect.poll(resumo).toEqual([null, OUTRO_MEMBRO.id, '2026-01-01']);
      await expect.poll(atualizacoes).toEqual([null, OUTRO_MEMBRO.id, '2026-01-01']);
      await page.goto('/treinador/agenda?visao=ano&meus=true');
      await expect.poll(resumo).toEqual([null, TREINADOR.id, '2026-01-01']);
      await expect.poll(atualizacoes).toEqual(['true', null, '2026-01-01']);
      await page.goto('/treinador/agenda?visao=ano');
      await expect.poll(resumo).toEqual([null, null, '2026-01-01']);
      await expect.poll(atualizacoes).toEqual(['false', null, '2026-01-01']);
      // Trocar de visão mantém o filtro no endereço.
      await page.goto('/treinador/agenda?meus=true');
      await visao(page, 'Ano').click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano&meus=true');
      await expect.poll(resumo).toEqual([null, TREINADOR.id, '2026-01-01']);

      const filtrados = pedidos.filter((p) => ['/atualizacoes', '/agenda/resumo', '/agenda/compromissos'].includes(p.caminho));
      expect(filtrados.filter((p) => p.busca.has('meus') && p.busca.has('responsavel'))).toEqual([]);
      expect(filtrados.filter((p) => p.caminho === '/agenda/resumo' && p.busca.has('meus'))).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem AGENDA_LER nada vai a /agenda nem aparece "Criar", também no Ano; o painel só tem as atualizações', async ({ page }) => {
      const estado: Estado = {
        agendas: [agenda('g1', 'Pessoal', 'AZUL')],
        eventos: [{ id: 'ev1', agendaId: 'g1', titulo: 'Consulta pessoal', hora: '10:00', datas: ['2026-10-20'], repeticao: null, versao: 0 }],
        compromissos: [compromisso('k1', [ANA], HOJE, '09:00')],
      };
      // Sem AGENDA_LER: só as atualizações, também no Ano; o painel só tem a agenda delas.
      const sem = await abrirAgenda(page, estado, { permissoes: ['ATUALIZACAO_LER'] });
      await page.goto('/treinador/agenda');
      await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar', exact: true })).toHaveCount(0);
      const onde = await painel(page);
      await expect(onde.getByRole('group', { name: 'Agendas visíveis' }).getByRole('checkbox')).toHaveCount(1);
      await expect(onde.getByRole('checkbox', { name: 'Atualizações, cor Ardósia. Mostrar na agenda', exact: true })).toBeChecked();
      await expect(onde.getByRole('button', { name: 'Nova agenda', exact: true })).toHaveCount(0);
      await fecharPainel(page);
      await page.goto('/treinador/agenda?visao=ano');
      await expect(page.getByRole('button', { name: 'segunda-feira, 19 de outubro de 2026, hoje, 1 atualização. Abrir o dia', exact: true })).toBeVisible();
      expect(sem.pedidos.filter((p) => p.caminho.startsWith('/agenda'))).toEqual([]);
      expect(sem.naoTratadas).toEqual([]);
      expect(sem.errosDaPagina).toEqual([]);
    });

    test('só AGENDA_LER (sem AGENDA_ALTERAR): vê compromissos e eventos, sem "Criar", "Nova agenda", editar nem excluir', async ({ page }) => {
      const estado: Estado = {
        agendas: [agenda('g1', 'Pessoal', 'AZUL')],
        eventos: [{ id: 'ev1', agendaId: 'g1', titulo: 'Consulta pessoal', hora: '10:00', datas: ['2026-10-20'], repeticao: null, versao: 0 }],
        compromissos: [compromisso('k1', [ANA], HOJE, '09:00')],
      };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado, { permissoes: ['AGENDA_LER', 'ATUALIZACAO_LER'] });
      await page.goto('/treinador/agenda');
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar', exact: true })).toHaveCount(0);
      const onde = await painel(page);
      await expect(onde.getByRole('checkbox', { name: 'Pessoal, cor Azul. Mostrar na agenda', exact: true })).toBeChecked();
      await expect(onde.getByRole('button', { name: 'Nova agenda', exact: true })).toHaveCount(0);
      await expect(onde.getByRole('button', { name: 'Editar a agenda Pessoal', exact: true })).toHaveCount(0);
      await fecharPainel(page);

      await page.getByRole('button', { name: 'Abrir evento Consulta pessoal, 10:00', exact: true }).click();
      const detalhe = page.getByRole('dialog', { name: 'Evento', exact: true });
      await expect(detalhe.getByText('Consulta pessoal', { exact: true })).toBeVisible();
      await expect(detalhe.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
      await expect(detalhe.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
      await detalhe.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(detalhe).toBeHidden();
      expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho.startsWith('/agenda'))).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Ano lê só o resumo e as atualizações do ano (sem baixar compromissos nem eventos); o mês abre o Mês', async ({ page }) => {
      const estado: Estado = {
        agendas: [agenda('g1', 'Pessoal', 'AZUL')],
        eventos: [{ id: 'ev1', agendaId: 'g1', titulo: 'Consulta pessoal', hora: '10:00', datas: [HOJE, '2026-10-21'], repeticao: null, versao: 0 }],
        compromissos: [compromisso('k1', [ANA], HOJE, '09:00')],
      };
      const { naoTratadas, errosDaPagina, pedidos } = await abrirAgenda(page, estado);
      await page.goto('/treinador/agenda?visao=ano');
      await expect(page.getByRole('heading', { name: '2026', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'segunda-feira, 19 de outubro de 2026, hoje, 1 compromisso, 1 evento, 1 atualização. Abrir o dia', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'quarta-feira, 21 de outubro de 2026, 1 evento. Abrir o dia', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'terça-feira, 20 de outubro de 2026, nada marcado. Abrir o dia', exact: true })).toBeVisible();

      const resumo = ultimo(pedidos, '/agenda/resumo');
      expect([resumo?.busca.get('de'), resumo?.busca.get('ate')]).toEqual(['2026-01-01', '2026-12-31']);
      const atualizacoes = ultimo(pedidos, '/atualizacoes');
      expect([atualizacoes?.busca.get('de'), atualizacoes?.busca.get('ate')]).toEqual(['2026-01-01', '2026-12-31']);
      expect(pedidos.filter((p) => p.caminho === '/agenda/compromissos' || p.caminho === '/agenda/eventos')).toEqual([]);
      await semRolagemHorizontal(page);

      // O nome do mês abre o Mês (empilha), e só então as listas do período são pedidas.
      await page.getByRole('button', { name: 'Abrir outubro de 2026', exact: true }).click();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=mes');
      await expect.poll(() => ultimo(pedidos, '/agenda/compromissos')?.busca.get('de')).toBe('2026-09-28');
      await expect.poll(() => ultimo(pedidos, '/agenda/eventos')?.busca.get('ate')).toBe('2026-11-08');
      await page.goBack();
      await expect.poll(() => endereco(page)).toBe('/treinador/agenda?visao=ano');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

/**
 * Filtros que moram em Folha e preferência lida do aparelho: o filtro escolhido numa Folha vale (a URL só muda depois de a Folha
 * fechar, `depoisDeFecharAsFolhas`) e, ao recarregar, a agenda escondida nem é pedida (`preferenciasLidas`).
 */
test.describe('filtros em Folha e preferências (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('?novo=evento (atalho da busca) abre o evento novo e sai do endereço', async ({ page }) => {
    const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [], compromissos: [] };
    await abrirAgenda(page, estado);
    await page.goto('/treinador/agenda?novo=evento');
    await expect(page.getByRole('dialog', { name: 'Novo evento', exact: true })).toBeVisible();
    await expect.poll(() => endereco(page), { timeout: 3000 }).toBe('/treinador/agenda');
  });

  test('escolher "Só os meus" na folha do Responsável grava ?meus=true e filtra', async ({ page }) => {
    const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [], compromissos: [] };
    const { pedidos } = await abrirAgenda(page, estado);
    await page.goto('/treinador/agenda');
    await page.getByRole('button', { name: 'Responsável: Toda a equipe. Escolher.', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Mostrar a agenda de', exact: true });
    await folha.getByRole('radio', { name: 'Só os meus', exact: true }).click();
    await expect(folha).toBeHidden();
    await expect(page.getByRole('button', { name: 'Responsável: Só os meus. Escolher.', exact: true })).toBeVisible({ timeout: 3000 });
    await expect.poll(() => endereco(page), { timeout: 3000 }).toBe('/treinador/agenda?meus=true');
    expect(ultimo(pedidos, '/atualizacoes')?.busca.get('meus')).toBe('true');
  });

  // TemaProvider.tsx:69-73 entrega PREFERENCIAS_PADRAO até a leitura do AsyncStorage terminar (não há marca de "lidas"), e
  // useCalendario.ts:71-77 pede os compromissos com `agendasOcultas` ainda vazio: ao recarregar, a agenda escondida é
  // baixada uma vez (não aparece, mas o pedido sai).
  test('com "Compromissos com alunos" escondido, recarregar não pede /agenda/compromissos', async ({ page }) => {
    const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [], compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] };
    const { pedidos } = await abrirAgenda(page, estado);
    await page.goto('/treinador/agenda');
    const caixa = page.getByRole('checkbox', { name: 'Compromissos com alunos, cor Índigo. Mostrar na agenda', exact: true });
    await caixa.click();
    await expect(caixa).not.toBeChecked();
    await expect.poll(() => page.evaluate((id) => localStorage.getItem(`treinos:${id}:preferencias`) ?? '', TREINADOR.id)).toContain('compromissos');
    const antes = pedidos.length;
    await page.reload();
    await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo/ })).toBeVisible();
    expect(pedidos.slice(antes).filter((p) => p.caminho === '/agenda/compromissos')).toEqual([]);
  });
});

test.describe('filtros em Folha (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('escolher "Agendados" na folha Agendas e filtros grava ?situacao=AGENDADO e filtra', async ({ page }) => {
    const estado: Estado = { agendas: [agenda('g1', 'Pessoal', 'AZUL')], eventos: [], compromissos: [compromisso('k1', [ANA], HOJE, '09:00')] };
    const { pedidos } = await abrirAgenda(page, estado);
    await page.goto('/treinador/agenda');
    await page.getByRole('button', { name: 'Agendas e filtros', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Agendas e filtros', exact: true });
    await opcao(folha, 'Compromissos', 'Agendados').click();
    // Esperado: a folha continua aberta com "Agendados" marcado (é só um filtro dentro dela).
    await expect(folha).toBeVisible({ timeout: 3000 });
    await expect(opcao(folha, 'Compromissos', 'Agendados')).toHaveAttribute('aria-checked', 'true');
    await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect.poll(() => endereco(page), { timeout: 3000 }).toBe('/treinador/agenda?situacao=AGENDADO');
    expect(ultimo(pedidos, '/agenda/compromissos')?.busca.get('situacao')).toBe('AGENDADO');
  });
});
