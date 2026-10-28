import { expect, test, type Page } from '@playwright/test';

import type { RegistroEnvio, RegistroSessaoConcluidaEnvio, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * "Concluir treino" (frente Engajamento, passo 0.1). Treino fictício de um exercício com três séries (o único
 * exercício é também o último) e o relógio fixado em segunda, 19/10/2026, 12:00.
 */
const VERSAO = 't0000000-0000-4000-8000-000000000002';
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const ROTA = '/aluno/sessoes-concluidas';

interface Opcoes {
  ligada?: boolean;
  /** Como o POST das conclusões responde: aceita, sem internet (aborta) ou recusa. */
  post?: 'aceita' | 'semInternet' | 'recusa';
}

async function abrir(page: Page, { ligada = true, post = 'aceita' }: Opcoes = {}) {
  await fixarHoje(page);
  const conclusoes: RegistroSessaoConcluidaEnvio[] = [];
  const series: RegistroEnvio[] = [];
  const mensagens: string[] = [];
  page.on('console', (m) => mensagens.push(m.text()));
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, [sessaoFalsa('sx', 'Treino curto', 1, 1)])),
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      series.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    ...(ligada
      ? {
          [`GET ${ROTA}`]: { corpo: { totalConcluidos: 4, sessoes: [] } satisfies SessoesConcluidasResponse },
          [`POST ${ROTA}`]: (p, route) => {
            if (post === 'semInternet') return route.abort('internetdisconnected');
            const lote = (p.corpo as { registros: RegistroSessaoConcluidaEnvio[] }).registros;
            conclusoes.push(...lote);
            return json(route, {
              resultados: lote.map((r) =>
                post === 'recusa'
                  ? { id: r.id, situacao: 'RECUSADO', motivo: 'Treino fora do plano.' }
                  : { id: r.id, situacao: 'ACEITO', motivo: null },
              ),
            });
          },
        }
      : {}),
  });
  return { ...api, conclusoes, series, mensagens };
}

const serie = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true });
const botoesConcluir = (page: Page) => page.getByRole('button', { name: 'Concluir treino', exact: true });
const folha = (page: Page) => page.getByRole('dialog', { name: 'Concluir treino' });
const minutos = (page: Page) => folha(page).getByRole('textbox', { name: 'Duração em minutos', exact: true });
const comentario = (page: Page) => folha(page).getByRole('textbox', { name: 'Como foi seu treino? (opcional)', exact: true });
const confirmar = (page: Page) => folha(page).getByRole('button', { name: 'Concluir treino', exact: true });
const opcao = (page: Page, rotulo: string) => folha(page).getByLabel(rotulo, { exact: true });

test('chave desligada: nada novo aparece e o "Concluir treino" de sempre só volta à lista', async ({ page }) => {
  const api = await abrir(page, { ligada: false });
  await page.goto(LISTA);
  await expect(page.getByRole('button', { name: 'Começar treino' })).toBeVisible();
  await expect(botoesConcluir(page)).toHaveCount(0);

  await page.goto(EXERCICIO);
  await expect(botoesConcluir(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Lista do dia' })).toHaveCount(0);
  await botoesConcluir(page).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sx\?data=2026-10-19$/);
  await expect(folha(page)).toHaveCount(0);
  await expect(page.getByText('Treino concluído')).toHaveCount(0);

  expect(api.pedidos.filter((p) => p.caminho === ROTA)).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`concluir e reabrir pela lista do dia, com a sugestão e a duração desde a primeira série (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page);
    await page.goto(EXERCICIO);

    // Último exercício: um no topo (secundário) e um no rodapé (primário), e a "Lista do dia" continua.
    await expect(botoesConcluir(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Lista do dia' })).toBeVisible();

    // Só uma série marcada: a sugestão é "Fiz em parte".
    await serie(page, 1).click();
    await expect(serie(page, 1)).toBeChecked();
    await botoesConcluir(page).first().click();
    await expect(folha(page)).toBeVisible();
    await expect(opcao(page, 'Fiz em parte')).toHaveAttribute('aria-checked', 'true');
    await expect(folha(page).getByText('Você marcou 1 de 3 séries.')).toBeVisible();
    await folha(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha(page)).toHaveCount(0);

    // Todas marcadas e 52 minutos depois da primeira: "Fiz tudo" e a duração já preenchida.
    await serie(page, 2).click();
    await serie(page, 3).click();
    await expect(serie(page, 3)).toBeChecked();
    await page.clock.setFixedTime(new Date('2026-10-19T12:52:00-03:00'));
    await page.getByRole('button', { name: 'Lista do dia' }).click();
    await expect(page).toHaveURL(/\/aluno\/sessao\/sx\?data=2026-10-19$/);
    await expect(botoesConcluir(page)).toHaveCount(2);
    await botoesConcluir(page).first().click();
    await expect(opcao(page, 'Fiz tudo')).toHaveAttribute('aria-checked', 'true');
    await expect(minutos(page)).toHaveValue('52');
    await comentario(page).fill('Treino puxado, mas deu.');
    await expect(folha(page).getByText('23/300')).toBeVisible();
    await confirmar(page).click();

    await expect(folha(page)).toHaveCount(0);
    await expect(page.getByText('Treino concluído.')).toBeVisible();
    // Topo e rodapé mostram o mesmo estado.
    await expect(page.getByText('Treino concluído', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Fiz tudo · 52 min')).toHaveCount(2);
    await expect(botoesConcluir(page)).toHaveCount(0);
    await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(1);
    expect(api.conclusoes[0]).toMatchObject({
      planoVersaoId: VERSAO, sessaoUid: 'sx', data: '2026-10-19', concluida: true, resultado: 'COMPLETA', duracaoSegundos: 3120,
      comentario: 'Treino puxado, mas deu.',
    });
    // Nada estoura a largura da tela (390 px inclusive).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Reabrir é o mesmo registro, sem resultado nem duração.
    await page.getByRole('button', { name: 'Reabrir o treino' }).first().click();
    await expect(page.getByText('Treino reaberto.')).toBeVisible();
    await expect(botoesConcluir(page)).toHaveCount(2);
    await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(2);
    expect(api.conclusoes[1]).toMatchObject({ id: api.conclusoes[0].id, concluida: false, resultado: null, duracaoSegundos: null });

    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('duração abaixo de 10 min: pergunta, "Ajustar duração" leva ao campo e menos de 1 min não salva', async ({ page }) => {
  const api = await abrir(page);
  await page.goto(EXERCICIO);
  await serie(page, 1).click();
  await expect(serie(page, 1)).toBeChecked();
  // O relógio está parado: desde a primeira série passaram 0 min.
  await botoesConcluir(page).last().click();
  await expect(minutos(page)).toHaveValue('0');
  const pergunta = folha(page).getByText('Esse treino durou menos de 10 minutos. Quer ajustar a duração?');
  await expect(pergunta).toHaveCount(0);
  await confirmar(page).click();
  await expect(pergunta).toBeVisible();

  await folha(page).getByRole('button', { name: 'Ajustar duração' }).click();
  await expect(pergunta).toHaveCount(0);
  await expect(minutos(page)).toBeFocused();

  // "Manter" abaixo de 1 minuto: a regra recusa e o erro fica no campo, sem enviar nada.
  await confirmar(page).click();
  await folha(page).getByRole('button', { name: 'Manter' }).click();
  await expect(folha(page).getByText('Ajuste a duração: o mínimo é 1 minuto.')).toBeVisible();
  await expect(folha(page)).toBeVisible();

  // 5 minutos e "Manter": salva.
  await minutos(page).fill('5');
  await expect(folha(page).getByText('Ajuste a duração: o mínimo é 1 minuto.')).toHaveCount(0);
  await confirmar(page).click();
  await expect(pergunta).toBeVisible();
  await folha(page).getByRole('button', { name: 'Manter' }).click();
  await expect(folha(page)).toHaveCount(0);
  await expect(page.getByText('Fiz em parte · 5 min').first()).toBeVisible();
  await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(1);
  expect(api.conclusoes[0]).toMatchObject({ concluida: true, resultado: 'PARCIAL', duracaoSegundos: 300, comentario: null });

  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('comentário passa de 300 caracteres só até o limite e nunca aparece no console', async ({ page }) => {
  const api = await abrir(page);
  await page.goto(LISTA);
  const texto = `Comentario-ficticio-${'x'.repeat(281)}`;
  expect(texto).toHaveLength(301);
  await botoesConcluir(page).first().click();
  // Sem série marcada não há início: o campo vem vazio (sem duração) e não pergunta nada.
  await expect(minutos(page)).toHaveValue('');
  await expect(opcao(page, 'Fiz em parte')).toHaveAttribute('aria-checked', 'true');
  await comentario(page).fill(texto);
  await expect(comentario(page)).toHaveValue(texto.slice(0, 300));
  await expect(folha(page).getByText('300/300')).toBeVisible();
  await confirmar(page).click();
  await expect(folha(page)).toHaveCount(0);
  await expect(page.getByText('Fiz em parte', { exact: true }).first()).toBeVisible();
  await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(1);
  expect(api.conclusoes[0].comentario).toHaveLength(300);
  expect(api.conclusoes[0].duracaoSegundos).toBeNull();
  expect(api.mensagens.filter((m) => m.includes('Comentario-ficticio'))).toEqual([]);

  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('data futura não mostra o botão', async ({ page }) => {
  const api = await abrir(page);
  await page.goto('/aluno/sessao/sx?data=2026-10-21');
  await expect(page.getByText('Você poderá concluir este treino a partir de 21/10/2026.')).toBeVisible();
  await expect(botoesConcluir(page)).toHaveCount(0);
  await page.goto('/aluno/sessao/sx/sxe1?data=2026-10-21');
  await expect(page.getByText('Você poderá concluir este treino a partir de 21/10/2026.')).toHaveCount(1);
  await expect(botoesConcluir(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lista do dia' })).toBeVisible();
  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('sem internet a conclusão fica no aparelho e o selo mostra o que falta enviar', async ({ page }) => {
  const api = await abrir(page, { post: 'semInternet' });
  await page.goto(LISTA);
  await botoesConcluir(page).first().click();
  await minutos(page).fill('45');
  await confirmar(page).click();
  await expect(folha(page)).toHaveCount(0);
  await expect(page.getByText('Fiz em parte · 45 min').first()).toBeVisible();
  await expect(page.getByText(/1 salvo\(s\) no aparelho|1 aguardando envio/)).toBeVisible({ timeout: 15_000 });
  expect(api.conclusoes).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('conclusão recusada pelo servidor acende a falha no selo', async ({ page }) => {
  const api = await abrir(page, { post: 'recusa' });
  await page.goto(LISTA);
  await botoesConcluir(page).first().click();
  await minutos(page).fill('30');
  await confirmar(page).click();
  await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(1);
  await expect(page.getByText('Falha ao enviar — tentar de novo')).toBeVisible({ timeout: 15_000 });
  // A recusada não vale como concluída: o botão volta.
  await expect(botoesConcluir(page)).toHaveCount(2);
  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

