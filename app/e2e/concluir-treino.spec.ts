import { expect, test, type Page } from '@playwright/test';

import type { RegistroEnvio, RegistroSessaoConcluidaEnvio, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, sessao, simularApi } from './api-falsa';

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
  /** Como o POST das conclusões responde: aceita, sem internet (aborta), recusa ou 503 de recurso desligado. */
  post?: ModoDoPost;
}

type ModoDoPost = 'aceita' | 'semInternet' | 'recusa' | 'indisponivel';

async function abrir(page: Page, { ligada = true, post = 'aceita' }: Opcoes = {}) {
  await fixarHoje(page);
  const conclusoes: RegistroSessaoConcluidaEnvio[] = [];
  const series: RegistroEnvio[] = [];
  const mensagens: string[] = [];
  // Mutável: o teste do 503 troca a resposta do POST entre uma abertura e a outra.
  const estado: { post: ModoDoPost } = { post };
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
            if (estado.post === 'semInternet') return route.abort('internetdisconnected');
            const lote = (p.corpo as { registros: RegistroSessaoConcluidaEnvio[] }).registros;
            conclusoes.push(...lote);
            if (estado.post === 'indisponivel') {
              const { status, corpo } = erroApi(503, 'Recurso indisponível.', 'RETORNO_INDISPONIVEL');
              return json(route, corpo, status);
            }
            return json(route, {
              resultados: lote.map((r) =>
                estado.post === 'recusa'
                  ? { id: r.id, situacao: 'RECUSADO', motivo: 'Treino fora do plano.' }
                  : { id: r.id, situacao: 'ACEITO', motivo: null },
              ),
            });
          },
        }
      : {}),
    // A Conta do aluno (usada no teste do 503) consulta a foto de perfil e o uso de imagem.
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
  });
  return { ...api, conclusoes, series, mensagens, estado };
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
    // Abre o "Bom trabalho!" (0.4): 4 no servidor + este = o 5º. A lista do dia volta pelo botão.
    await expect(page).toHaveURL(/\/aluno\/sessao\/sx\/concluido\?data=2026-10-19$/);
    await expect(page.getByText('Este é o seu 5º treino.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à lista do dia' }).click();
    await expect(page).toHaveURL(/\/aluno\/sessao\/sx\?data=2026-10-19$/);
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
  // A recusada não vale como concluída: o "Bom trabalho!" diz isso e, na lista, o botão volta.
  await expect(page.getByText('Este treino não está concluído. Volte à lista do dia para concluir.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à lista do dia' }).click();
  await expect(botoesConcluir(page)).toHaveCount(2);
  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('503 RETORNO_INDISPONIVEL no envio: volta ao estado de chave desligada, sem falha, e a conclusão segue quando a chave volta', async ({ page }) => {
  const api = await abrir(page, { post: 'indisponivel' });
  const posts = () => api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === ROTA);
  const leituras = () => api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === ROTA).length;
  await page.goto(LISTA);
  await botoesConcluir(page).first().click();
  await minutos(page).fill('45');
  await comentario(page).fill('Comentario-ficticio-do-503');
  await confirmar(page).click();

  // O POST é feito uma vez e a tela volta ao que era com a chave desligada: botão antigo, nada de concluído.
  await expect.poll(() => posts().length, { timeout: 15_000 }).toBe(1);
  await expect(page.getByText('Este treino não está concluído. Volte à lista do dia para concluir.')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Voltar à lista do dia' }).click();
  await expect(page.getByRole('button', { name: 'Começar treino' })).toBeVisible();
  await expect(botoesConcluir(page)).toHaveCount(0);
  await expect(page.getByText('Treino concluído')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Reabrir o treino' })).toHaveCount(0);
  await expect(page.getByText(/Fiz em parte|Fiz tudo/)).toHaveCount(0);
  // Nada de falha: nem no selo, nem na Conta (o aviso de "Sair" também não conta a conclusão).
  await expect(page.getByText(/Falha ao enviar|aguardando envio/)).toHaveCount(0);
  const aposOErro = leituras();

  // Pela navegação do app (sem recarregar a página, que reabriria a sessão): Conta e "Sincronizar agora".
  await page.getByRole('link', { name: 'Conta', exact: true }).click();
  await expect(page.getByText('Tudo o que você registrou já está com o seu treinador.')).toBeVisible();
  await expect(page.getByText(/Conclusão do treino,/)).toHaveCount(0);
  await expect(page.getByText(/Falha ao enviar|aguardando envio|com falha/)).toHaveCount(0);
  await expect(page.getByText('Tentar de novo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toBeEnabled();
  // Sem segunda chamada: nem o envio nem a leitura das conclusões do servidor.
  expect(posts()).toHaveLength(1);
  expect(leituras()).toBe(aposOErro);

  // A chave volta (o /eu traz `retornoHabilitado: true` ao reabrir a sessão) e o servidor passa a aceitar.
  api.estado.post = 'aceita';
  await page.goto(LISTA);
  await expect.poll(() => posts().length, { timeout: 15_000 }).toBe(2);
  expect(posts()[1].corpo).toMatchObject({ registros: [{ id: api.conclusoes[0].id, concluida: true, resultado: 'PARCIAL', duracaoSegundos: 2700 }] });
  expect(api.conclusoes[1].id).toBe(api.conclusoes[0].id);
  await expect(page.getByText('Treino concluído', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Falha ao enviar/)).toHaveCount(0);
  expect(api.mensagens.filter((m) => m.includes('Comentario-ficticio'))).toEqual([]);

  expect(api.naoTratadas).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});
