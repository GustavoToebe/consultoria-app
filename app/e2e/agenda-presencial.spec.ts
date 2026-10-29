import { expect, test, type Page } from '@playwright/test';

import type { Compromisso, CompromissoDoAluno } from '../src/api/agendaTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';

/**
 * Agenda presencial: na tela Agenda do treinador os compromissos e as atualizações aparecem juntos, por dia (cada um
 * com o seu texto e selo); "Novo compromisso" abre a folha, o 409 HORARIO_OCUPADO aparece no formulário e o
 * compromisso salvo entra na lista; marcar realizado e cancelar (com confirmação) passam pela API. O aluno vê os
 * próprios próximos compromissos no Início, só leitura. O relógio fica em segunda-feira, 19/10/2026, 12:00 de Brasília.
 * Só dados fictícios.
 */

function aluno(n: number, nome: string): AlunoResumo {
  return { id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null };
}
const ALUNOS = [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo')];

/** Compromisso fictício de 60 min; `inicio` em UTC (Brasília = UTC−3). */
function compromisso(id: string, alunoIdx: number, data: string, hora: string, extra: Partial<Compromisso> = {}): Compromisso {
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const horaFim = new Date(fim.getTime() - 3 * 3600_000).toISOString().slice(11, 16);
  return {
    id, alunoId: ALUNOS[alunoIdx].id, alunoNome: ALUNOS[alunoIdx].nome, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data, hora, horaFim, duracaoMinutos: 60, local: 'Sala 2',
    observacao: 'Observação fictícia', situacao: 'AGENDADO', versao: 0, ...extra,
  };
}

const ATUALIZACAO: AtualizacaoDaLista = {
  id: null as unknown as string, pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: ALUNOS[1].id, nomeAluno: 'Bruno Exemplo',
  dataAtualizacao: '2026-10-19', fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null,
};

const PAINEL = { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 1, alunosAtivos: 2, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] };

/** Treinador com a agenda e as atualizações; `lista` é o estado dos compromissos que a API falsa devolve. */
async function abrirComoTreinador(page: Page, lista: Compromisso[], permissoesExtras = ['AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER'],
  extra: RespostasApi = {}) {
  await fixarHoje(page);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, ...permissoesExtras] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
    'GET /agenda/compromissos': (_p, route) => json(route, lista),
    ...extra,
  });
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('compromissos e atualizações juntos; novo compromisso com horário ocupado e depois livre', async ({ page }) => {
      const lista = [compromisso('k1', 0, '2026-10-19', '09:00')];
      let tentativas = 0;
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, undefined, {
        'POST /agenda/compromissos': (p, route) => {
          tentativas += 1;
          const corpo = p.corpo as { hora: string; data: string };
          if (tentativas === 1) {
            const ocupado = erroApi(409, 'O responsável já tem um compromisso nesse horário. Escolha outro horário.', 'HORARIO_OCUPADO');
            return json(route, ocupado.corpo, 409);
          }
          const novo = compromisso('k2', 1, corpo.data, corpo.hora);
          lista.push(novo);
          return json(route, novo);
        },
      });
      await page.goto('/treinador/agenda');

      // O dia de hoje traz o compromisso (horário, local, responsável, selo) e a atualização, cada um com o seu texto.
      await expect(page.getByText('Hoje, 19/10')).toBeVisible();
      await expect(page.getByText('Compromisso · 09:00–10:00 · Sala 2 · com Treinadora Teste')).toBeVisible();
      await expect(page.getByText('Agendado', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /Abrir atualização de Bruno Exemplo/ })).toBeVisible();
      await expect(page.getByText('1 compromisso · 1 atualização')).toBeVisible();
      // O período pedido é o da semana (hoje e os 7 dias seguintes).
      const consulta = pedidos.find((p) => p.metodo === 'GET' && p.caminho === '/agenda/compromissos');
      expect(consulta?.busca.get('de')).toBe('2026-10-19');
      expect(consulta?.busca.get('ate')).toBe('2026-10-26');

      await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await expect(folha).toBeVisible();
      await folha.getByRole('button', { name: /^Aluno: Escolher/ }).click();
      await page.getByRole('radio', { name: 'Bruno Exemplo' }).click();
      await expect(folha.getByRole('button', { name: /^Aluno: Bruno Exemplo/ })).toBeVisible();
      // O responsável já vem preenchido com quem está marcando; a data, com o dia da agenda.
      await expect(folha.getByRole('button', { name: /^Responsável: Treinadora Teste/ })).toBeVisible();
      await expect(folha.getByLabel('Data')).toHaveValue('19/10/2026');
      await folha.getByLabel('Hora (Brasília)').fill('0930');
      await expect(folha.getByLabel('Hora (Brasília)')).toHaveValue('09:30');
      // Aviso antes de salvar: o responsável já tem um compromisso nesse período (a API é quem decide).
      await expect(folha.getByText(/já tem um compromisso das 09:00 às 10:00/)).toBeVisible();

      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha.getByText('O responsável já tem um compromisso nesse horário. Escolha outro horário.')).toBeVisible();

      await folha.getByLabel('Hora (Brasília)').fill('1000');
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha).toBeHidden();
      await expect(page.getByText('Compromisso · 10:00–11:00 · Sala 2 · com Treinadora Teste')).toBeVisible();

      const envios = pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/agenda/compromissos');
      expect(envios.map((p) => p.corpo)).toEqual([
        { alunoId: ALUNOS[1].id, responsavelId: TREINADOR.id, data: '2026-10-19', hora: '09:30', duracaoMinutos: 60, local: null, observacao: null },
        { alunoId: ALUNOS[1].id, responsavelId: TREINADOR.id, data: '2026-10-19', hora: '10:00', duracaoMinutos: 60, local: null, observacao: null },
      ]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

test('detalhe: marcar realizado e cancelar com confirmação', async ({ page }) => {
  const lista = [compromisso('k1', 0, '2026-10-19', '09:00'), compromisso('k3', 1, '2026-10-20', '15:00')];
  const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, ['AGENDA_LER', 'AGENDA_ALTERAR'], {
    'POST /agenda/compromissos/{id}/situacao': (p, route) => {
      const id = p.caminho.split('/').at(-2) ?? '';
      const { situacao } = p.corpo as { situacao: Compromisso['situacao'] };
      const i = lista.findIndex((c) => c.id === id);
      lista[i] = { ...lista[i], situacao, versao: lista[i].versao + 1 };
      return json(route, lista[i]);
    },
  });
  await page.goto('/treinador/agenda');
  // Sem ATUALIZACAO_LER a tela abre só com os compromissos e não pede as atualizações.
  await expect(page.getByText('Compromisso · 09:00–10:00 · Sala 2 · com Treinadora Teste')).toBeVisible();
  expect(pedidos.some((p) => p.caminho === '/atualizacoes')).toBe(false);

  await page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, 09:00' }).click();
  const folha = page.getByRole('dialog', { name: 'Compromisso' });
  await expect(folha.getByText('Observação fictícia')).toBeVisible();
  await folha.getByRole('button', { name: 'Marcar realizado', exact: true }).click();
  await expect(folha.getByText('Realizado', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(folha).toBeHidden();

  // O de amanhã ainda não começou: realizado e falta ficam desabilitados; cancelar pede confirmação.
  await page.getByRole('button', { name: 'Abrir compromisso de Bruno Exemplo, 15:00' }).click();
  const outra = page.getByRole('dialog', { name: 'Compromisso' });
  await expect(outra.getByRole('button', { name: 'Marcar realizado', exact: true })).toBeDisabled();
  await outra.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
  const painel = page.getByRole('alertdialog', { name: 'Cancelar este compromisso?' });
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
  await expect(outra.getByText('Cancelado', { exact: true })).toBeVisible();

  const situacoes = pedidos.filter((p) => p.caminho.endsWith('/situacao')).map((p) => [p.caminho, p.corpo]);
  expect(situacoes).toEqual([
    ['/agenda/compromissos/k1/situacao', { situacao: 'REALIZADO', versao: 0 }],
    ['/agenda/compromissos/k3/situacao', { situacao: 'CANCELADO', versao: 0 }],
  ]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('sem AGENDA_LER a tela segue só com as atualizações, sem "Novo compromisso"', async ({ page }) => {
  const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, [], ['ATUALIZACAO_LER']);
  await page.goto('/treinador/agenda');
  await expect(page.getByRole('link', { name: /Abrir atualização de Bruno Exemplo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo compromisso' })).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.startsWith('/agenda'))).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('aluno vê os próximos compromissos no Início, só leitura', async ({ page }) => {
  await fixarHoje(page);
  const meus: CompromissoDoAluno[] = [
    { id: 'k1', inicio: '2026-10-20T12:00:00.000Z', fim: '2026-10-20T13:00:00.000Z', data: '2026-10-20', hora: '09:00', horaFim: '10:00',
      duracaoMinutos: 60, local: 'Sala 2', situacao: 'AGENDADO', responsavelNome: 'Treinadora Teste' },
    { id: 'k2', inicio: '2026-10-22T12:00:00.000Z', fim: '2026-10-22T13:00:00.000Z', data: '2026-10-22', hora: '09:00', horaFim: '10:00',
      duracaoMinutos: 60, local: null, situacao: 'CANCELADO', responsavelNome: null },
  ];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/compromissos': { corpo: meus },
    'GET /aluno/dieta': { corpo: { dieta: null } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  });
  await page.goto('/aluno');
  await expect(page.getByText('Seus compromissos')).toBeVisible();
  await expect(page.getByText('Amanhã, 20/10 · 09:00–10:00')).toBeVisible();
  await expect(page.getByText('Sala 2 · com Treinadora Teste')).toBeVisible();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();
  // Só leitura: nada de marcar, remarcar ou cancelar.
  await expect(page.getByRole('button', { name: /compromisso/i })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
