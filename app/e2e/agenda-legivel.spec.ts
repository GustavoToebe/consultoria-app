import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AgendaPessoal, Compromisso, OcorrenciaDeEvento, Participante, SituacaoCompromisso } from '../src/api/agendaTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';

/**
 * Agenda legível (Lote A 14, reunião de 30/10 com o Saraiva: "a cor ocupa pouco do evento"): a faixa da cor da agenda tem
 * 8 px e o fundo do item é tingido com ela; título e horário ficam na cor do texto; o status (cancelado, realizado, faltou,
 * atualização adiada) aparece escrito num selo, ou, no bloco curto, em ícone com o status no nome acessível; o cancelado
 * não é mais esmaecido. Casos: grade do PC (Dia e Semana), lista do celular, compromisso de 15 min, dois itens sobrepostos
 * e itens de dia inteiro, nos temas claro e escuro. O relógio fica em segunda-feira, 19/10/2026, 12:00 de Brasília.
 * Só dados fictícios; as fixtures ficam neste arquivo (a `api-falsa.ts` não mudou).
 */

const HOJE = '2026-10-19';

const aluno = (n: number, nome: string): AlunoResumo => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null,
});
const ANA = aluno(1, 'Ana Fictícia');
const BRUNO = aluno(2, 'Bruno Exemplo');
const CARLA = aluno(3, 'Carla Teste');
const DAVI = aluno(4, 'Davi Modelo');

/** Brasília = UTC−3 (sem horário de verão em 2026). */
const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`);
const horaDe = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(11, 16);

function compromisso(id: string, a: AlunoResumo, hora: string, minutos: number, situacao: SituacaoCompromisso = 'AGENDADO'): Compromisso {
  const inicio = instante(HOJE, hora);
  const fim = new Date(inicio.getTime() + minutos * 60_000);
  const participante: Participante = { id: a.id, nome: a.nome, situacao };
  return {
    id, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome, participantes: [participante], cancelado: situacao === 'CANCELADO',
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data: HOJE, hora, horaFim: horaDe(fim), duracaoMinutos: minutos, local: 'Sala 2',
    observacao: null, versao: 0,
  };
}

const COMPROMISSOS: Compromisso[] = [
  compromisso('k-realizado', ANA, '07:00', 60, 'REALIZADO'),
  // Curto: 15 minutos, o bloco tem só a altura mínima do toque.
  compromisso('k-curto', DAVI, '09:00', 15),
  // Cancelado com 90 minutos: no Dia do PC o bloco tem altura e largura para o selo escrito.
  compromisso('k-cancelado', BRUNO, '10:00', 90, 'CANCELADO'),
  // Sobreposto ao evento das 14:00: os dois dividem a largura do dia.
  compromisso('k-sobreposto', CARLA, '14:00', 60),
];

const AGENDAS: AgendaPessoal[] = [
  { id: 'g-pessoal', nome: 'Pessoal', cor: 'AZUL', versao: 0 },
  { id: 'g-feriados', nome: 'Feriados', cor: 'OLIVA', versao: 0 },
];

function ocorrencia(eventoId: string, agendaId: string, titulo: string, hora: string | null): OcorrenciaDeEvento {
  const diaInteiro = hora === null;
  const inicio = instante(HOJE, hora ?? '00:00');
  const fim = new Date(inicio.getTime() + (diaInteiro ? 24 * 60 : 60) * 60_000);
  return {
    eventoId, agendaId, dataOriginal: HOJE, data: HOJE, hora, horaFim: diaInteiro ? null : horaDe(fim), inicio: inicio.toISOString(),
    fim: fim.toISOString(), diaInteiro, titulo, local: null, descricao: null, recorrente: false,
  };
}

const EVENTOS: OcorrenciaDeEvento[] = [
  ocorrencia('ev-reuniao', 'g-pessoal', 'Reunião de teste', '14:00'),
  ocorrencia('ev-feriado', 'g-feriados', 'Feriado fictício', null),
];

/** Atualização do dia, adiada: aparece como item de dia inteiro com o selo "Adiada para 21/10". */
const ATUALIZACAO: AtualizacaoDaLista = {
  id: null as unknown as string, pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: BRUNO.id, nomeAluno: 'Bruno Exemplo',
  dataAtualizacao: HOJE, fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: '2026-10-21',
};

const PAINEL = { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 1, alunosAtivos: 4, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] };

/**
 * Cores esperadas (tema claro da marca de teste e tema escuro escolhido nas preferências). O fundo é a `superficie2` com
 * 16% da cor da agenda (`PROPORCAO_DO_TINGIDO`; nessas cores o contraste não pede menos, ver `contrasteDaAgenda.test.ts`).
 */
const CLARO = {
  texto: 'rgb(17, 17, 20)', superficie2: 'rgb(244, 244, 245)',
  azul: 'rgb(27, 111, 214)', fundoAzul: 'rgb(209, 223, 240)', indigo: 'rgb(75, 63, 191)', fundoIndigo: 'rgb(217, 215, 236)',
  oliva: 'rgb(117, 132, 24)', fundoOliva: 'rgb(224, 226, 210)',
};
const ESCURO = { texto: 'rgb(244, 244, 245)', azul: 'rgb(74, 144, 247)', fundoAzul: 'rgb(40, 52, 71)' };

async function abrirAgenda(page: Page, opcoes: { escuro?: boolean } = {}) {
  await fixarHoje(page);
  if (opcoes.escuro) {
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  }
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': { corpo: { itens: [ANA, BRUNO, CARLA, DAVI], total: 4 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
    'GET /agenda/compromissos': (p, route) => json(route, COMPROMISSOS.filter((c) => c.data >= (p.busca.get('de') ?? '') && c.data <= (p.busca.get('ate') ?? ''))),
    'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
    'GET /agenda/agendas': { corpo: AGENDAS },
    'GET /agenda/eventos': (p, route) => json(route, EVENTOS.filter((o) => o.data >= (p.busca.get('de') ?? '') && o.data <= (p.busca.get('ate') ?? ''))),
  });
}

const doCompromisso = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true });

/** Nenhum ancestral do elemento apaga o que ele mostra (a opacidade baixava o contraste do texto e do selo). */
const opacidadeAcumulada = (alvo: Locator) => alvo.evaluate((e) => {
  let total = 1;
  for (let atual: Element | null = e; atual; atual = atual.parentElement) total *= Number(getComputedStyle(atual).opacity);
  return total;
});

const NOMES = {
  realizado: 'Abrir compromisso de Ana Fictícia, 07:00, realizado',
  curto: 'Abrir compromisso de Davi Modelo, 09:00',
  cancelado: 'Abrir compromisso de Bruno Exemplo, 10:00, cancelado',
  sobreposto: 'Abrir compromisso de Carla Teste, 14:00',
  reuniao: 'Abrir evento Reunião de teste, 14:00',
  feriado: 'Abrir evento Feriado fictício, dia inteiro',
};

test.describe('390 px (lista do celular)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('o status vem escrito em selo, o cancelado não é esmaecido e nada rola de lado', async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirAgenda(page);
    await page.goto('/treinador/agenda');
    await expect(page.getByText('Hoje, 19/10')).toBeVisible();

    // O nome acessível diz título, horário e o status (o de todos agendados continua sem status).
    for (const nome of [NOMES.realizado, NOMES.curto, NOMES.cancelado, NOMES.sobreposto, NOMES.reuniao, NOMES.feriado]) {
      await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo, .*Adiada para 21\/10$/ })).toBeVisible();

    // Selos escritos: realizado, cancelado e a atualização adiada.
    await expect(page.getByText('Realizado', { exact: true })).toBeVisible();
    const cancelado = page.getByText('Cancelado', { exact: true });
    await expect(cancelado).toBeVisible();
    await expect(page.getByText('Adiada para 21/10', { exact: true })).toBeVisible();
    await expect.poll(() => opacidadeAcumulada(cancelado)).toBe(1);

    // O evento curto e os de dia inteiro dizem o horário nos metadados.
    await expect(page.getByText('Evento · Dia inteiro · Feriados')).toBeVisible();
    await expect(page.getByText(/09:00–09:15/)).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
});

test.describe('1280 px (grade de horários)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Dia: faixa de 8 px, fundo tingido, texto na cor do texto e status escrito ou em ícone', async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirAgenda(page);
    await page.goto(`/treinador/agenda?visao=dia&data=${HOJE}`);

    // Evento: faixa larga na cor da agenda e fundo tingido com ela; título e horário em `texto`.
    const reuniao = doCompromisso(page, NOMES.reuniao);
    await expect(reuniao).toBeVisible();
    await expect(reuniao).toHaveCSS('border-left-width', '8px');
    await expect(reuniao).toHaveCSS('border-left-color', CLARO.azul);
    await expect(reuniao).toHaveCSS('background-color', CLARO.fundoAzul);
    await expect(reuniao.getByText('Reunião de teste', { exact: true })).toHaveCSS('color', CLARO.texto);
    await expect(reuniao.getByText('14:00–15:00', { exact: true })).toHaveCSS('color', CLARO.texto);

    // Sobrepostos: cada um com a sua faixa e o seu texto, lado a lado (metade do dia cada).
    const sobreposto = doCompromisso(page, NOMES.sobreposto);
    await expect(sobreposto).toHaveCSS('border-left-color', CLARO.indigo);
    await expect(sobreposto).toHaveCSS('background-color', CLARO.fundoIndigo);
    await expect(sobreposto.getByText('Carla Teste', { exact: true })).toBeVisible();
    const [a, b] = [await reuniao.boundingBox(), await sobreposto.boundingBox()];
    expect(a && b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1)).toBe(true);

    // Curto (15 min): título e horário inteiros, sem cortar; o status do compromisso fica no ícone e no nome acessível.
    const curto = doCompromisso(page, NOMES.curto);
    await expect(curto.getByText('Davi Modelo', { exact: true })).toBeVisible();
    await expect(curto.getByText('09:00–09:15', { exact: true })).toBeVisible();

    // Cancelado: selo "Cancelado" escrito, título riscado, sem tinta e sem opacidade.
    const cancelado = doCompromisso(page, NOMES.cancelado);
    await expect(cancelado.getByText('Cancelado', { exact: true })).toBeVisible();
    await expect(cancelado.getByText('Bruno Exemplo', { exact: true })).toHaveCSS('text-decoration-line', 'line-through');
    await expect(cancelado).toHaveCSS('background-color', CLARO.superficie2);
    await expect.poll(() => opacidadeAcumulada(cancelado)).toBe(1);

    // Dia inteiro: a mesma faixa e o fundo tingido; a atualização adiada leva o selo escrito ao lado do nome.
    const feriado = doCompromisso(page, NOMES.feriado);
    await expect(feriado).toHaveCSS('border-left-width', '8px');
    await expect(feriado).toHaveCSS('border-left-color', CLARO.oliva);
    await expect(feriado).toHaveCSS('background-color', CLARO.fundoOliva);
    const atualizacao = page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo, .*Adiada para 21\/10$/ });
    await expect(atualizacao.getByText('Adiada para 21/10', { exact: true })).toBeVisible();
    await expect(atualizacao).toHaveCSS('border-left-width', '8px');

    // Por último (o mouse fica sobre a grade depois de fechar a folha e acenderia o hover): o realizado de uma hora tem o
    // status em ícone na grade e no nome acessível; o detalhe o diz por extenso.
    await doCompromisso(page, NOMES.realizado).click();
    const folha = page.getByRole('dialog', { name: 'Compromisso' });
    await expect(folha.getByText('Realizado', { exact: true }).first()).toBeVisible();
    await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(folha).toBeHidden();

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test('Semana: colunas estreitas mantêm a faixa, o texto e o status no nome acessível', async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirAgenda(page);
    await page.goto('/treinador/agenda');
    for (const nome of [NOMES.realizado, NOMES.curto, NOMES.cancelado, NOMES.sobreposto, NOMES.reuniao, NOMES.feriado]) {
      const item = doCompromisso(page, nome);
      await expect(item).toBeVisible();
      await expect(item).toHaveCSS('border-left-width', '8px');
    }
    await expect(page.getByRole('link', { name: /^Abrir atualização de Bruno Exemplo, .*Adiada para 21\/10$/ })).toBeVisible();
    await expect(doCompromisso(page, NOMES.curto).getByText('Davi Modelo', { exact: true })).toBeVisible();
    await expect.poll(() => opacidadeAcumulada(doCompromisso(page, NOMES.cancelado))).toBe(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test('tema escuro: fundo tingido pela cor escura da agenda e texto claro', async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirAgenda(page, { escuro: true });
    await page.goto(`/treinador/agenda?visao=dia&data=${HOJE}`);
    const reuniao = doCompromisso(page, NOMES.reuniao);
    await expect(reuniao).toHaveCSS('border-left-color', ESCURO.azul);
    await expect(reuniao).toHaveCSS('background-color', ESCURO.fundoAzul);
    await expect(reuniao.getByText('Reunião de teste', { exact: true })).toHaveCSS('color', ESCURO.texto);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
});
