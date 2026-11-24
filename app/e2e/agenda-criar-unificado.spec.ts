import { expect, type Locator, test, type Page } from '@playwright/test';

import type { AgendaPessoal, Compromisso, EventoRequest } from '../src/api/agendaTipos';
import type { AlunoResumo } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, type PedidoFalso, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';

/**
 * agenda: criar unificado (23/11; `docs/planos/agenda-criar-unificado.md`): o "Criar" no topo da coluna da esquerda (PC) ou
 * no cabeçalho (celular) com o menu dos dois tipos; a barra única (Hoje, setas, período, Filtros e o segmento da visão); a
 * dica da semana vazia no meio da grade; e a janela "Criar" com o segmento do tipo, a troca que mantém data, horário, local e
 * observação, o fim que acompanha o início, a duração escrita, o dia inteiro na linha do horário, a agenda com a bolinha, o
 * rodapé ("Mais opções", Cancelar, primário), os rótulos à vista e o "Sair sem salvar?". Relógio: segunda, 19/10/2026, 12:00
 * de Brasília (o início sugerido é 12:00). Só dados fictícios.
 */

const HOJE = '2026-10-19';
const ANA: AlunoResumo = { id: 'a0000000-0000-4000-8000-000000000001', nome: 'Ana Fictícia', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null };
const AGENDAS: AgendaPessoal[] = [{ id: 'g1', nome: 'Pessoal', cor: 'AZUL', versao: 0 }, { id: 'g2', nome: 'Estudos', cor: 'VIOLETA', versao: 0 }];

async function abrir(page: Page, compromissos: Compromisso[] = []) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: [...PERMISSOES_TREINADOR, 'AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR'],
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 1, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens: [ANA], total: 1 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [] },
    'GET /agenda/compromissos': { corpo: compromissos },
    'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
    'GET /agenda/agendas': { corpo: AGENDAS },
    'GET /agenda/eventos': { corpo: [] },
    'GET /agenda/resumo': { corpo: { dias: [] } },
    'POST /agenda/eventos/cruzamentos': { corpo: { quantidade: 0, datas: [], incompleto: false } },
    'POST /agenda/eventos': (p, route) => json(route, {
      id: 'ev-1', agendaId: (p.corpo as EventoRequest).agendaId, titulo: (p.corpo as EventoRequest).titulo, local: null, descricao: null, data: HOJE,
      diaInteiro: true, hora: null, duracaoMinutos: null, repeticao: null, versao: 0, ocorrencia: null,
    }),
    'POST /agenda/compromissos': (p, route) => json(route, { id: 'k-novo', ...(p.corpo as object) } as unknown as Compromisso),
  });
  await page.goto('/treinador/agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  return api;
}

const corpos = (pedidos: PedidoFalso[], metodo: string, caminho: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho).map((p) => p.corpo);
const caixa = async (l: Locator) => (await l.boundingBox())!;
const centroY = (b: { y: number; height: number }) => b.y + b.height / 2;

async function abrirCriar(page: Page, tipo: 'Compromisso com aluno' | 'Evento pessoal'): Promise<Locator> {
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Criar' });
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: new RegExp(`^${tipo}\\.`) }).click();
  const folha = page.getByRole('dialog', { name: 'Criar', exact: true });
  await expect(folha.getByRole('radio', { name: tipo, exact: true, checked: true })).toBeVisible();
  return folha;
}

async function escolherInicio(page: Page, folha: Locator, hora: string) {
  await folha.getByRole('button', { name: /^Início: / }).click();
  const lista = page.getByRole('dialog', { name: 'Início (Brasília)', exact: true });
  await lista.getByRole('radio', { name: hora, exact: true }).click();
  await expect(lista).toBeHidden();
}

for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    const celular = largura < 768;

    test('Criar no lugar certo com o menu, barra única e a dica da semana vazia', async ({ page }) => {
      const { errosDaPagina, naoTratadas } = await abrir(page);
      const criar = page.getByRole('button', { name: 'Criar', exact: true });
      const lateral = page.getByTestId('lateral-da-agenda');
      if (celular) await expect(lateral).toHaveCount(0);
      else {
        // No topo da coluna da esquerda, acima do mini calendário.
        const c = await caixa(criar);
        const l = await caixa(lateral);
        expect(c.x).toBeGreaterThanOrEqual(l.x - 1);
        expect(c.x + c.width).toBeLessThanOrEqual(l.x + l.width + 1);
        expect(c.y).toBeLessThan((await caixa(page.getByRole('button', { name: /^segunda-feira, 19 de outubro de 2026/i }))).y);
      }
      await expect(criar).toHaveAttribute('aria-haspopup', 'menu');
      await criar.click();
      const menu = page.getByRole('menu', { name: 'Criar' });
      await expect(menu.getByRole('menuitem', { name: /^Compromisso com aluno\./ })).toBeFocused();
      await expect(menu.getByRole('menuitem', { name: /^Evento pessoal\./ })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      // Barra única: Hoje, setas e o período; Filtros (com o contador) e a visão em segmento.
      const hoje = await caixa(page.getByRole('button', { name: 'Hoje', exact: true }));
      const filtros = await caixa(page.getByRole('button', { name: 'Filtros, nenhum ligado', exact: true }));
      const visao = page.getByRole('radiogroup', { name: 'Visão do calendário' });
      await expect(visao.getByRole('radio')).toHaveCount(4);
      await expect(visao.getByRole('radio', { name: 'Semana', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('heading', { name: '19–25 out. 2026', level: 2 })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Visão do calendário: / })).toHaveCount(0);
      if (!celular) {
        expect(Math.abs(centroY(filtros) - centroY(hoje))).toBeLessThanOrEqual(4);
        expect(filtros.x + filtros.width).toBeLessThanOrEqual((await caixa(visao)).x);
      }

      // "Nada neste período." saiu; a dica fica no meio da grade (PC) ou cada dia diz "Nada marcado" (celular).
      await expect(page.getByText('Nada neste período.')).toHaveCount(0);
      if (celular) await expect(page.getByText('Nada marcado').first()).toBeVisible();
      else await expect(page.getByText('Nenhum compromisso nesta semana. Clique num horário para criar.', { exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`barra-${largura}.png`) });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('janela de criação: segmento, troca que mantém o que dá, fim acompanha o início, rótulos e rodapé', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await abrirCriar(page, 'Compromisso com aluno');
      // O fim aparece desde o começo: início na próxima meia hora e a duração padrão (1 h).
      await expect(folha.getByRole('button', { name: 'Início: 12:00. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Fim: 13:00. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByText('1 h', { exact: true })).toBeVisible();
      await expect(folha.getByText('Alunos · 0 de 20')).toBeVisible();
      // Fim acompanha o início mantendo a duração, inclusive pela meia-noite.
      await escolherInicio(page, folha, '23:30');
      await expect(folha.getByRole('button', { name: 'Fim: 00:30. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByText('1 h, dia seguinte', { exact: true })).toBeVisible();
      await escolherInicio(page, folha, '09:00');
      await expect(folha.getByRole('button', { name: 'Fim: 10:00. Escolher.', exact: true })).toBeVisible();
      await folha.getByLabel('Local (opcional)').fill('Sala 2');
      await folha.getByLabel('Observação (opcional)').fill('Trazer a ficha');

      // Rodapé: "Mais opções" discreto à esquerda, Cancelar e o primário à direita.
      const mais = await caixa(folha.getByRole('button', { name: 'Mais opções', exact: true }));
      const cancelar = await caixa(folha.getByRole('button', { name: 'Cancelar', exact: true }));
      const marcar = await caixa(folha.getByRole('button', { name: 'Marcar compromisso', exact: true }));
      if (celular) {
        // Celular: o link acima das ações empilhadas, o primário em cima do Cancelar.
        expect(mais.y).toBeLessThan(marcar.y);
        expect(marcar.y).toBeLessThan(cancelar.y);
      } else {
        expect(mais.x + mais.width).toBeLessThan(cancelar.x);
        expect(cancelar.x + cancelar.width).toBeLessThanOrEqual(marcar.x);
      }

      // Escolhe um aluno e troca para o evento: data, horário, local e observação vão; o aluno fica só no compromisso (aviso).
      await folha.getByRole('button', { name: /^Aluno: Adicionar/ }).click();
      const busca = page.getByRole('dialog', { name: 'Adicionar aluno' });
      await busca.getByRole('radio', { name: ANA.nome }).click();
      await expect(busca).toBeHidden();
      await folha.getByRole('radio', { name: 'Evento pessoal', exact: true }).click();
      await expect(folha.getByText('Fica só no compromisso: aluno.', { exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Início: 09:00. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByLabel('Local (opcional)')).toHaveValue('Sala 2');
      await expect(folha.getByLabel('Descrição (opcional)')).toHaveValue('Trazer a ficha');
      // Rótulos à vista no evento; a agenda é uma lista suspensa com a bolinha e o nome.
      for (const r of ['Título', 'Data', 'Local (opcional)', 'Descrição (opcional)']) await expect(folha.getByText(r, { exact: true })).toBeVisible();
      await folha.getByRole('button', { name: 'Agenda: Pessoal, azul. Escolher.', exact: true }).click();
      const agendas = page.getByRole('dialog', { name: 'Escolher agenda', exact: true });
      await agendas.getByRole('radio', { name: 'Estudos, violeta', exact: true }).click();
      await expect(agendas).toBeHidden();
      await expect(folha.getByRole('button', { name: 'Agenda: Estudos, violeta. Escolher.', exact: true })).toBeVisible();

      // Dia inteiro na mesma linha da data (PC); ligado, some o início e o fim.
      const dia = folha.getByRole('switch', { name: 'Dia inteiro' });
      if (!celular) expect(Math.abs(centroY(await caixa(dia)) - centroY(await caixa(folha.getByLabel('Data', { exact: true }))))).toBeLessThanOrEqual(12);
      await dia.click();
      await expect(folha.getByRole('button', { name: /^Início: / })).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath(`janela-evento-${largura}.png`) });

      // Volta ao compromisso: o aluno continua lá; título e dia inteiro ficam só no evento.
      await folha.getByLabel('Título', { exact: true }).fill('Estudo de teste');
      await folha.getByRole('radio', { name: 'Compromisso com aluno', exact: true }).click();
      await expect(folha.getByText('Fica só no evento pessoal: título e dia inteiro.', { exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: `Remover ${ANA.nome}`, exact: true })).toBeVisible();
      await expect(folha.getByLabel('Observação (opcional)')).toHaveValue('Trazer a ficha');

      // De volta ao evento e salvar: o corpo é o do evento, com a agenda escolhida e o dia inteiro.
      await folha.getByRole('radio', { name: 'Evento pessoal', exact: true }).click();
      await folha.getByRole('button', { name: 'Salvar evento', exact: true }).click();
      await expect(folha).toBeHidden();
      expect(corpos(pedidos, 'POST', '/agenda/compromissos')).toEqual([]);
      expect(corpos(pedidos, 'POST', '/agenda/eventos')).toEqual([expect.objectContaining({
        agendaId: 'g2', titulo: 'Estudo de teste', local: 'Sala 2', descricao: 'Trazer a ficha', data: HOJE, diaInteiro: true,
      })]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Sair sem salvar? só com alteração; Continuar editando mantém, Sair fecha sem salvar', async ({ page }) => {
      const { pedidos } = await abrir(page);
      // Sem nada digitado, Cancelar fecha direto.
      let folha = await abrirCriar(page, 'Evento pessoal');
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(folha).toBeHidden();

      folha = await abrirCriar(page, 'Evento pessoal');
      await folha.getByLabel('Título', { exact: true }).fill('Rascunho');
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      const pergunta = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      await expect(pergunta).toBeVisible();
      await pergunta.getByRole('button', { name: 'Continuar editando', exact: true }).click();
      await expect(folha.getByLabel('Título', { exact: true })).toHaveValue('Rascunho');
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
      await expect(folha).toBeHidden();
      // Abrir de novo começa limpo.
      folha = await abrirCriar(page, 'Evento pessoal');
      await expect(folha.getByLabel('Título', { exact: true })).toHaveValue('');
      expect(corpos(pedidos, 'POST', '/agenda/eventos')).toEqual([]);
    });
  });
}

// agenda: retoques (23/11): na coluna estreita da Semana o bloco mostra só o início; o intervalo fica no nome acessível e no
// bloco aberto pelo mouse. O bloco largo (o Dia) mantém o intervalo.
function compromisso(id: string, nome: string, hora: string, horaFim: string): Compromisso {
  return {
    id, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    participantes: [{ id: `p-${id}`, nome, situacao: 'AGENDADO' }], cancelado: false, serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: `${HOJE}T${String(Number(hora.slice(0, 2)) + 3).padStart(2, '0')}${hora.slice(2)}:00.000Z`,
    fim: `${HOJE}T${String(Number(horaFim.slice(0, 2)) + 3).padStart(2, '0')}${horaFim.slice(2)}:00.000Z`,
    data: HOJE, hora, horaFim, duracaoMinutos: 60, local: null, observacao: null, versao: 0, lembretesMinutos: [30],
  };
}

test.describe('1280 px: horário do bloco', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('bloco estreito da Semana mostra só o início; o Dia mostra o intervalo', async ({ page }) => {
    const tres = [compromisso('k1', 'Ana Fictícia', '09:00', '10:00'), compromisso('k2', 'Bruno Exemplo', '09:00', '10:00'), compromisso('k3', 'Carla Teste', '09:00', '10:00')];
    const { errosDaPagina, naoTratadas } = await abrir(page, tres);
    const bloco = page.getByRole('button', { name: /^Abrir compromisso de Ana Fictícia, das 9h às 10h/ });
    await expect(bloco).toBeVisible();
    // Três lado a lado na coluna de 1280 px: o bloco tem ~28 px e o próprio início sai com reticências; o texto é só o início.
    await expect(bloco.getByText('09:00', { exact: true })).toHaveCount(1);
    await expect(bloco.getByText('09:00–10:00', { exact: true })).toHaveCount(0);
    // O mouse abre o bloco por cima da grade (cresce na altura) com o intervalo inteiro, que pode quebrar em duas linhas.
    await bloco.hover();
    await expect(bloco.getByText('09:00–10:00', { exact: true })).toHaveCount(1);

    await page.getByRole('radiogroup', { name: 'Visão do calendário' }).getByRole('radio', { name: 'Dia', exact: true }).click();
    await expect(page.getByRole('heading', { name: '19 de outubro de 2026', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir compromisso de Ana Fictícia, das 9h às 10h/ }).getByText('09:00–10:00', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
});
