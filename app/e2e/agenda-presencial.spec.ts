import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import type { Compromisso, CompromissoDoAluno, Participante, SituacaoCompromisso } from '../src/api/agendaTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';

/**
 * Agenda presencial: na tela Agenda do treinador os compromissos e as atualizações aparecem juntos, por dia. Um
 * compromisso tem de 1 a 20 alunos (a linha diz "Ana, Bruno +2", o selo resume a situação de cada um, a série mostra
 * "Ocorrência 3 de 10" e o cancelado tem o selo Cancelado). Na folha: marcar com vários alunos (chips, sem repetir), o aviso de
 * aluno ocupado (só aviso), a repetição semanal com fim e a prévia, o 409 HORARIO_OCUPADO com as datas que conflitam (o
 * formulário fica), editar uma ocorrência perguntando o escopo, a situação por aluno e cancelar o compromisso inteiro.
 * O aluno vê os próprios próximos compromissos no Início, só leitura. O relógio fica em segunda-feira, 19/10/2026, 12:00
 * de Brasília. Só dados fictícios.
 */

function aluno(n: number, nome: string): AlunoResumo {
  return { id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null };
}
const ALUNOS = [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo'), aluno(3, 'Carla Teste'), aluno(4, 'Davi Modelo')];
const [ANA, BRUNO, CARLA, DAVI] = ALUNOS;

const participante = (a: AlunoResumo, situacao: SituacaoCompromisso = 'AGENDADO'): Participante => ({ id: a.id, nome: a.nome, situacao });

/** Compromisso fictício de 60 min; `inicio` em UTC (Brasília = UTC−3). */
function compromisso(id: string, alunos: AlunoResumo[], data: string, hora: string, extra: Partial<Compromisso> = {}): Compromisso {
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const horaFim = new Date(fim.getTime() - 3 * 3600_000).toISOString().slice(11, 16);
  return {
    id, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    participantes: alunos.map((a) => participante(a)), cancelado: false,
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data, hora, horaFim, duracaoMinutos: 60, local: 'Sala 2',
    observacao: 'Observação fictícia', versao: 0, ...extra,
  };
}

const ATUALIZACAO: AtualizacaoDaLista = {
  id: null as unknown as string, pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: BRUNO.id, nomeAluno: 'Bruno Exemplo',
  dataAtualizacao: '2026-10-19', fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null,
};

const PAINEL = { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 1, alunosAtivos: 4, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] };

/** 409 HORARIO_OCUPADO como a API manda: uma data (AAAA-MM-DD) por item em `fieldErrors`. */
function horarioOcupado(route: Route, datas: string[]) {
  return json(route, {
    status: 409, message: 'O responsável já tem um compromisso nesse horário.', codigo: 'HORARIO_OCUPADO',
    fieldErrors: datas.map((d) => ({ field: 'datasEmConflito', message: d })),
  }, 409);
}

/**
 * Treinador com a agenda e as atualizações; `lista` é o estado dos compromissos que a API falsa devolve. As rotas de
 * situação (por aluno e do compromisso inteiro) e o aviso de aluno ocupado (`ocupados`, padrão ninguém) já vêm simulados.
 */
async function abrirComoTreinador(page: Page, lista: Compromisso[], opcoes: {
  permissoes?: string[]; extra?: RespostasApi; ocupados?: (p: PedidoFalso) => { id: string; nome: string }[];
} = {}) {
  await fixarHoje(page);
  const trocar = (id: string, mudar: (c: Compromisso) => Compromisso) => {
    const i = lista.findIndex((c) => c.id === id);
    lista[i] = { ...mudar(lista[i]), versao: lista[i].versao + 1 };
    return lista[i];
  };
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, ...(opcoes.permissoes ?? ['AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER'])] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
    'GET /agenda/compromissos': (_p, route) => json(route, lista),
    'GET /agenda/agendas': { corpo: [] },
    'GET /agenda/compromissos/alunos-ocupados': (p, route) => json(route, opcoes.ocupados?.(p) ?? []),
    'POST /agenda/compromissos/{id}/alunos/{alunoId}/situacao': (p, route) => {
      const partes = p.caminho.split('/');
      const { situacao } = p.corpo as { situacao: SituacaoCompromisso };
      return json(route, trocar(partes[3], (c) => {
        const participantes = c.participantes.map((a) => (a.id === partes[5] ? { ...a, situacao } : a));
        return { ...c, participantes, cancelado: participantes.every((a) => a.situacao === 'CANCELADO') };
      }));
    },
    'POST /agenda/compromissos/{id}/situacao': (p, route) => {
      const { cancelado } = p.corpo as { cancelado: boolean };
      return json(route, trocar(p.caminho.split('/')[3], (c) => ({
        ...c, cancelado, participantes: c.participantes.map((a) => ({ ...a, situacao: cancelado ? 'CANCELADO' : 'AGENDADO' })),
      })));
    },
    ...opcoes.extra,
  });
}

/** Uma opção de `Escolha` (grupo com o rótulo dado). */
const opcao = (onde: Locator | Page, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

/**
 * Escolhe numa lista suspensa (`EscolhaEmFolha`): o botão "Rótulo: valor. Escolher." abre uma folha com rádios, que fecha
 * ao escolher. O título da folha é o rótulo, a não ser que se diga outro.
 */
async function escolherNaLista(page: Page, onde: Locator, rotulo: string, opcaoEscolhida: string, titulo = rotulo) {
  await onde.getByRole('button', { name: new RegExp(`^${rotulo}: .*\. Escolher\.$`) }).click();
  const lista = page.getByRole('dialog', { name: titulo, exact: true });
  await lista.getByRole('radio', { name: opcaoEscolhida, exact: true }).click();
  await expect(lista).toBeHidden();
}
/** O início do compromisso (o fim acompanha: a duração se mantém). */
const escolherInicio = (page: Page, folha: Locator, hora: string) => escolherNaLista(page, folha, 'Início', hora, 'Início (Brasília)');

/** Abre a busca "Aluno: Adicionar" da folha e escolhe o aluno. */
async function adicionarAluno(page: Page, folha: Locator, nome: string) {
  await folha.getByRole('button', { name: /^Aluno: Adicionar/ }).click();
  const busca = page.getByRole('dialog', { name: 'Adicionar aluno' });
  await busca.getByRole('radio', { name: nome }).click();
  await expect(busca).toBeHidden();
  await expect(folha.getByRole('button', { name: `Remover ${nome}`, exact: true })).toBeVisible();
}

/** O compromisso novo sai do "Criar" (menu com "Compromisso com aluno" e "Evento"). */
async function novoCompromisso(page: Page) {
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Compromisso com aluno/ }).click();
}

const corposDe = (pedidos: PedidoFalso[], metodo: string, caminho: string) =>
  pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho).map((p) => p.corpo);

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    // No celular Dia e Semana são a lista por dia (metadados e resumo do dia); no PC, a grade de horários (os blocos têm o
    // mesmo nome acessível, mas não os metadados da lista).
    const naLista = largura < 768;

    test('lista com vários alunos e série; marcar com 2 alunos, aviso de aluno ocupado e 409 com a data', async ({ page }) => {
      const lista = [
        compromisso('k1', [ANA], '2026-10-19', '09:00'),
        compromisso('k4', ALUNOS, '2026-10-20', '15:00', { serieId: 's1', ocorrenciaDaSerie: 3, totalDaSerie: 10 }),
        compromisso('k5', [BRUNO], '2026-10-20', '11:00', { cancelado: true, participantes: [participante(BRUNO, 'CANCELADO')] }),
      ];
      let tentativas = 0;
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, {
        ocupados: (p) => (p.busca.getAll('alunoIds').includes(BRUNO.id) ? [{ id: BRUNO.id, nome: BRUNO.nome }] : []),
        extra: {
          'POST /agenda/compromissos': (p, route) => {
            tentativas += 1;
            const corpo = p.corpo as { hora: string; data: string };
            if (tentativas === 1) return horarioOcupado(route, ['2026-10-19']);
            const novo = compromisso('k2', [BRUNO, CARLA], corpo.data, corpo.hora);
            lista.push(novo);
            return json(route, novo);
          },
        },
      });
      await page.goto('/treinador/agenda');

      // Hoje: o compromisso (horário, local, responsável) e a atualização, cada um com o seu texto.
      if (naLista) await expect(page.getByText('Hoje, 19/10')).toBeVisible();
      if (naLista) await expect(page.getByText('09:00–10:00 · Ana Fictícia', { exact: true })).toBeVisible();
      if (naLista) await expect(page.getByText('Compromisso · Sala 2 · com Treinadora Teste', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Abrir atualização de Bruno Exemplo/ })).toBeVisible();
      if (naLista) await expect(page.getByText('1 compromisso · 1 atualização')).toBeVisible();
      // Vários alunos: dois nomes e "+2"; o selo resume a situação; a série aparece nos metadados; o cancelado se diz.
      if (naLista) await expect(page.getByText('Ana Fictícia, Bruno Exemplo +2')).toBeVisible();
      if (naLista) await expect(page.getByText('4 agendados', { exact: true })).toBeVisible();
      if (naLista) await expect(page.getByText('15:00–16:00 · Ana Fictícia, Bruno Exemplo +2', { exact: true })).toBeVisible();
      if (naLista) await expect(page.getByText('Compromisso · Sala 2 · com Treinadora Teste · Ocorrência 3 de 10')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, Bruno Exemplo e mais 2, das 15h às 16h', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Bruno Exemplo, das 11h às 12h, cancelado', exact: true })).toBeVisible();
      // O período pedido é o da semana (segunda a domingo).
      const consulta = pedidos.find((p) => p.metodo === 'GET' && p.caminho === '/agenda/compromissos');
      expect(consulta?.busca.get('de')).toBe('2026-10-19');
      expect(consulta?.busca.get('ate')).toBe('2026-10-25');

      await novoCompromisso(page);
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await expect(folha).toBeVisible();
      await expect(folha.getByText('Alunos · 0 de 20')).toBeVisible();
      await adicionarAluno(page, folha, 'Bruno Exemplo');
      await adicionarAluno(page, folha, 'Carla Teste');
      await adicionarAluno(page, folha, 'Davi Modelo');
      await folha.getByRole('button', { name: 'Remover Davi Modelo', exact: true }).click();
      await expect(folha.getByText('Alunos · 2 de 20')).toBeVisible();
      // Quem já está no compromisso não aparece de novo na busca.
      await folha.getByRole('button', { name: /^Aluno: Adicionar/ }).click();
      const busca = page.getByRole('dialog', { name: 'Adicionar aluno' });
      await expect(busca.getByRole('radio', { name: 'Ana Fictícia' })).toBeVisible();
      await expect(busca.getByRole('radio', { name: 'Bruno Exemplo' })).toHaveCount(0);
      await busca.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(busca).toBeHidden();

      // O responsável já vem com quem está marcando; a data, com o dia da agenda.
      await expect(folha.getByRole('button', { name: /^Responsável: Treinadora Teste/ })).toBeVisible();
      await expect(folha.getByLabel('Data', { exact: true })).toHaveValue('19/10/2026');
      // Painel rápido: início "até" fim em listas (o fim acompanha o início, com a duração no rótulo); "Mais opções" no rodapé.
      await expect(folha.getByRole('button', { name: 'Mais opções', exact: true })).toBeVisible();
      await expect(folha.getByText('Escolha o início para ver o fim.')).toBeVisible();
      await escolherInicio(page, folha, '09:30');
      await expect(folha.getByRole('button', { name: 'Início: 09:30. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Fim: 10:30 (1 h). Escolher.', exact: true })).toBeVisible();
      // O fim vai de início + 15 min até o máximo do compromisso (8 h); não há mais duração digitada.
      await folha.getByRole('button', { name: 'Fim: 10:30 (1 h). Escolher.', exact: true }).click();
      const fins = page.getByRole('dialog', { name: 'Fim (Brasília)', exact: true }).getByRole('radio');
      await expect(fins.first()).toHaveAccessibleName('09:45 (15 min)');
      await expect(fins.last()).toHaveAccessibleName('17:30 (8 h)');
      await page.getByRole('dialog', { name: 'Fim (Brasília)', exact: true }).getByRole('radio', { name: '10:30 (1 h)', exact: true }).click();
      await expect(folha.getByRole('textbox', { name: 'Duração em minutos' })).toHaveCount(0);
      // Avisos que não bloqueiam: o responsável com outro compromisso na lista e o aluno ocupado (a API diz quem).
      await expect(folha.getByText(/já tem um compromisso das 09:00 às 10:00/)).toBeVisible();
      await expect(folha.getByText('Atenção: Bruno Exemplo já tem outro compromisso nesse horário. Dá para salvar mesmo assim.')).toBeVisible();
      const ocupados = pedidos.filter((p) => p.caminho === '/agenda/compromissos/alunos-ocupados').at(-1);
      expect(ocupados?.busca.getAll('alunoIds')).toEqual([BRUNO.id, CARLA.id]);
      expect([ocupados?.busca.get('data'), ocupados?.busca.get('hora'), ocupados?.busca.get('duracaoMinutos')]).toEqual(['2026-10-19', '09:30', '60']);

      // 409 com a data que conflita: a mensagem fica junto dos botões e o formulário continua preenchido.
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha.getByText('O responsável já tem compromisso nesse horário em 19/10. Escolha outro horário.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Remover Carla Teste', exact: true })).toBeVisible();
      await escolherInicio(page, folha, '10:00');
      await expect(folha.getByText(/Escolha outro horário/)).toHaveCount(0);
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha).toBeHidden();
      if (naLista) await expect(page.getByText('Bruno Exemplo e Carla Teste')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Bruno Exemplo e Carla Teste, das 10h às 11h', exact: true })).toBeVisible();

      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([
        { alunoIds: [BRUNO.id, CARLA.id], responsavelId: TREINADOR.id, data: '2026-10-19', hora: '09:30', duracaoMinutos: 60, local: null, observacao: null },
        { alunoIds: [BRUNO.id, CARLA.id], responsavelId: TREINADOR.id, data: '2026-10-19', hora: '10:00', duracaoMinutos: 60, local: null, observacao: null },
      ]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    // C76 (reunião de 30/10): data do compromisso é "planejamento" (01/01/2000 até 31/12 daqui a 5 anos; hoje fixo em 2026).
    // "Marcar compromisso" só desabilita enquanto salva: com a data fora da faixa, o toque mostra a mensagem e não chama a API.
    test('data em 0261 ou depois do teto de 5 anos: a mensagem fica no campo e o Marcar compromisso não chama a API', async ({ page }) => {
      const lista: Compromisso[] = [];
      const { pedidos, errosDaPagina } = await abrirComoTreinador(page, lista, {
        extra: {
          'POST /agenda/compromissos': (p, route) => {
            const corpo = p.corpo as { hora: string; data: string };
            const novo = compromisso('k9', [ANA], corpo.data, corpo.hora);
            lista.push(novo);
            return json(route, novo);
          },
        },
      });
      await page.goto('/treinador/agenda');
      await novoCompromisso(page);
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await adicionarAluno(page, folha, 'Ana Fictícia');
      await escolherInicio(page, folha, '09:30');
      const data = folha.getByLabel('Data', { exact: true });
      const mensagem = folha.getByText('Data do compromisso: use uma data entre 01/01/2000 e 31/12/2031');
      const marcar = folha.getByRole('button', { name: 'Marcar compromisso', exact: true });

      for (const invalida of ['05/05/0261', '01/01/2040']) {
        await data.fill(invalida);
        await expect(data).toHaveValue(invalida);
        await expect(mensagem).toBeVisible();
        await marcar.click();
        await expect(mensagem).toBeVisible();
        await expect(folha).toBeVisible();
        expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([]);
      }

      await data.fill('20/10/2026');
      await expect(mensagem).toHaveCount(0);
      await marcar.click();
      await expect(folha).toBeHidden();
      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([
        { alunoIds: [ANA.id], responsavelId: TREINADOR.id, data: '2026-10-20', hora: '09:30', duracaoMinutos: 60, local: null, observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('série semanal: dias a partir da segunda, fim obrigatório, prévia e 409 com as datas que conflitam', async ({ page }) => {
      const lista: Compromisso[] = [];
      let tentativas = 0;
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, {
        extra: {
          'POST /agenda/compromissos': (p, route) => {
            tentativas += 1;
            if (tentativas === 1) return horarioOcupado(route, ['2026-10-28', '2026-10-21']);
            const corpo = p.corpo as { hora: string; data: string };
            const novo = compromisso('k7', [ANA], corpo.data, corpo.hora, { serieId: 's2', ocorrenciaDaSerie: 1, totalDaSerie: 6 });
            lista.push(novo);
            return json(route, novo);
          },
        },
      });
      await page.goto('/treinador/agenda');
      await novoCompromisso(page);
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await adicionarAluno(page, folha, 'Ana Fictícia');
      await escolherInicio(page, folha, '08:00');

      // A repetição é uma lista com os rótulos do Google para a data (segunda-feira, 19/10).
      await folha.getByRole('button', { name: 'Repetição: Não se repete. Escolher.', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Repetição', exact: true }).getByRole('radio')).toHaveText([
        'Não se repete', 'Todos os dias', 'Semanal: cada segunda-feira', 'Mensal no dia 19', 'Anual em 19 de outubro',
        'Todos os dias da semana (segunda a sexta-feira)', 'Personalizar…',
      ]);
      await page.getByRole('dialog', { name: 'Repetição', exact: true }).getByRole('button', { name: 'Fechar', exact: true }).click();
      // Dias úteis não pulam feriado: a ajuda diz o que fazer, e some nos outros tipos.
      await escolherNaLista(page, folha, 'Repetição', 'Todos os dias da semana (segunda a sexta-feira)');
      await expect(folha.getByText('Feriados não são pulados: cancele só a ocorrência do feriado.')).toBeVisible();
      // Semanal já vem com a segunda-feira (o dia da data); no painel rápido aparecem o "Termina" e a prévia, sem os dias.
      await escolherNaLista(page, folha, 'Repetição', 'Semanal: cada segunda-feira');
      await expect(folha.getByText('Feriados não são pulados: cancele só a ocorrência do feriado.')).toHaveCount(0);
      await expect(folha.getByRole('radiogroup', { name: 'Termina' })).toBeVisible();
      await expect(folha.getByRole('group', { name: 'Dias da semana' })).toHaveCount(0);
      // "Mais opções": o formulário completo, com os dias da semana (a semana começa na segunda).
      await folha.getByRole('button', { name: 'Mais opções', exact: true }).click();
      await expect(folha.getByRole('heading', { name: 'Quando', exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Mais opções', exact: true })).toHaveCount(0);
      const dias = folha.getByRole('group', { name: 'Dias da semana' }).getByRole('checkbox');
      await expect(dias).toHaveCount(7);
      await expect(dias.first()).toHaveAccessibleName('Segunda-feira');
      await expect(folha.getByRole('checkbox', { name: 'Segunda-feira' })).toBeChecked();
      await folha.getByRole('checkbox', { name: 'Quarta-feira' }).click();
      await expect(folha.getByRole('checkbox', { name: 'Quarta-feira' })).toBeChecked();
      await expect(folha.getByRole('button', { name: 'Repetição: Semanal: segunda e quarta. Escolher.', exact: true })).toBeVisible();
      await expect(folha.getByText('Informe a data e o fim para ver quantos compromissos serão marcados.')).toBeVisible();

      // O fim é obrigatório: sem o número de vezes, o erro aparece junto do campo.
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha.getByText('Informe quantas vezes.')).toBeVisible();
      await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([]);
      await folha.getByLabel('Quantas vezes').fill('6');
      await expect(folha.getByText('6 compromissos, de 19/10 a 04/11')).toBeVisible();

      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha.getByText('O responsável já tem compromisso nesse horário nestas datas: 21/10 e 28/10. Escolha outro horário.')).toBeVisible();
      // O formulário fica: troca só a hora e marca a série.
      await expect(folha.getByText('6 compromissos, de 19/10 a 04/11')).toBeVisible();
      await escolherInicio(page, folha, '07:00');
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha).toBeHidden();
      // A série cai em mais de um dia da semana: o título se repete; a ocorrência diz qual.
      if (naLista) await expect(page.getByText('07:00–08:00 · Ana Fictícia', { exact: true }).first()).toBeVisible();
      if (naLista) await expect(page.getByText('Compromisso · Sala 2 · com Treinadora Teste · Ocorrência 1 de 6')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, das 7h às 8h', exact: true })).toBeVisible();

      const repeticao = { tipo: 'SEMANAL', diasDaSemana: ['MONDAY', 'WEDNESDAY'], vezes: 6 };
      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([
        { alunoIds: [ANA.id], responsavelId: TREINADOR.id, data: '2026-10-19', hora: '08:00', duracaoMinutos: 60, local: null, observacao: null, repeticao },
        { alunoIds: [ANA.id], responsavelId: TREINADOR.id, data: '2026-10-19', hora: '07:00', duracaoMinutos: 60, local: null, observacao: null, repeticao },
      ]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('hora digitada fora da grade (09:10 até 09:30, 20 min) e "Personalizar…" levam a duração e o semanal à API', async ({ page }) => {
      const lista: Compromisso[] = [];
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, {
        extra: {
          'POST /agenda/compromissos': (p, route) => {
            const corpo = p.corpo as { hora: string; data: string };
            const novo = compromisso('k8', [ANA], corpo.data, corpo.hora);
            lista.push(novo);
            return json(route, novo);
          },
        },
      });
      await page.goto('/treinador/agenda');
      await novoCompromisso(page);
      const folha = page.getByRole('dialog', { name: 'Novo compromisso' });
      await adicionarAluno(page, folha, 'Ana Fictícia');

      // Início: a busca aceita qualquer minuto, e o digitado vira a opção do topo.
      await folha.getByRole('button', { name: /^Início: / }).click();
      const inicios = page.getByRole('dialog', { name: 'Início (Brasília)', exact: true });
      await inicios.getByLabel('Buscar ou digitar (HH:MM)').fill('0910');
      await expect(inicios.getByRole('radio').first()).toHaveAccessibleName('09:10');
      await inicios.getByRole('radio', { name: '09:10', exact: true }).click();
      await expect(inicios).toBeHidden();
      await expect(folha.getByRole('button', { name: 'Fim: 10:10 (1 h). Escolher.', exact: true })).toBeVisible();

      // Fim: abaixo do mínimo avisa e não vira opção; 09:30 vira 20 min.
      await folha.getByRole('button', { name: /^Fim: / }).click();
      const fins = page.getByRole('dialog', { name: 'Fim (Brasília)', exact: true });
      await fins.getByLabel('Buscar ou digitar (HH:MM)').fill('09:12');
      await expect(fins.getByText('A duração mínima é 5 min.')).toBeVisible();
      await fins.getByLabel('Buscar ou digitar (HH:MM)').fill('09:30');
      await fins.getByRole('radio', { name: '09:30 (20 min)', exact: true }).click();
      await expect(fins).toBeHidden();
      await expect(folha.getByRole('button', { name: 'Fim: 09:30 (20 min). Escolher.', exact: true })).toBeVisible();

      // "Personalizar…": o completo com o semanal da segunda-feira (dia da data) e o foco na repetição; o horário fica.
      await escolherNaLista(page, folha, 'Repetição', 'Personalizar…');
      await expect(folha.getByRole('heading', { name: 'Quando', exact: true })).toBeVisible();
      const repeticao = folha.getByRole('button', { name: 'Repetição: Semanal: cada segunda-feira. Escolher.', exact: true });
      await expect(repeticao).toBeFocused();
      await expect(folha.getByRole('checkbox', { name: 'Segunda-feira' })).toBeChecked();
      await expect(folha.getByRole('button', { name: 'Fim: 09:30 (20 min). Escolher.', exact: true })).toBeVisible();
      await folha.getByLabel('Quantas vezes').fill('4');
      await folha.getByRole('button', { name: 'Marcar compromisso', exact: true }).click();
      await expect(folha).toBeHidden();

      expect(corposDe(pedidos, 'POST', '/agenda/compromissos')).toEqual([{
        alunoIds: [ANA.id], responsavelId: TREINADOR.id, data: '2026-10-19', hora: '09:10', duracaoMinutos: 20, local: null, observacao: null,
        repeticao: { tipo: 'SEMANAL', diasDaSemana: ['MONDAY'], vezes: 4 },
      }]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('série: editar uma ocorrência pergunta o escopo; mudar a data vale só para ela', async ({ page }) => {
      const lista = [compromisso('k4', ALUNOS, '2026-10-20', '15:00', { serieId: 's1', ocorrenciaDaSerie: 3, totalDaSerie: 10 })];
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, {
        extra: {
          'PUT /agenda/compromissos/{id}': (p, route) => {
            const corpo = p.corpo as { alunoIds: string[]; data: string; hora: string; versao: number };
            const atual = lista[0];
            lista[0] = {
              ...compromisso('k4', ALUNOS.filter((a) => corpo.alunoIds.includes(a.id)), corpo.data, corpo.hora,
                { serieId: 's1', ocorrenciaDaSerie: 3, totalDaSerie: 10 }), versao: atual.versao + 1,
            };
            return json(route, lista[0]);
          },
        },
      });
      await page.goto('/treinador/agenda');
      await page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, Bruno Exemplo e mais 2, das 15h às 16h', exact: true }).click();
      const detalhe = page.getByRole('dialog', { name: 'Compromisso' });
      await expect(detalhe.getByText('Ocorrência 3 de 10')).toBeVisible();
      await expect(detalhe.getByText('Alunos (4)')).toBeVisible();
      // Com vários alunos não há link de ficha (seria de quem?).
      await expect(detalhe.getByRole('link', { name: 'Abrir ficha do aluno' })).toHaveCount(0);
      await detalhe.getByRole('button', { name: 'Editar', exact: true }).click();

      const folha = page.getByRole('dialog', { name: 'Editar compromisso' });
      await expect(folha.getByText(/Ocorrência 3 de 10\. Ao salvar, você escolhe/)).toBeVisible();
      // A edição abre direto no formulário completo; remarcar nunca repete: sem a lista da repetição.
      await expect(folha.getByRole('heading', { name: 'Quando', exact: true })).toBeVisible();
      await expect(folha.getByRole('button', { name: /^Repetição: / })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Fim: 16:00 (1 h). Escolher.', exact: true })).toBeVisible();
      await folha.getByRole('button', { name: 'Remover Davi Modelo', exact: true }).click();
      await escolherInicio(page, folha, '16:00');
      // Ao remarcar, o aviso de aluno ocupado ignora o próprio compromisso (consulta depois de parar de digitar).
      await expect.poll(() => pedidos.some((p) => p.caminho === '/agenda/compromissos/alunos-ocupados'
        && p.busca.get('ignorar') === 'k4' && p.busca.get('hora') === '16:00')).toBe(true);
      await folha.getByRole('button', { name: 'Salvar alterações', exact: true }).click();

      const painel = page.getByRole('alertdialog', { name: 'Salvar em quais compromissos da série?' });
      await expect(painel).toBeVisible();
      await expect(painel.getByText('Só o compromisso de 20/10.')).toBeVisible();
      await opcao(painel, 'Aplicar a', 'Este e os seguintes').click();
      await expect(painel.getByText('O de 20/10 e os seguintes da série que ainda não terminaram.')).toBeVisible();
      await painel.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(painel).toBeHidden();
      await expect(page.getByRole('dialog', { name: 'Compromisso' }).getByText('Alunos (3)')).toBeVisible();

      // Mudar a data numa série vale só para esta ocorrência: salva sem perguntar.
      await page.getByRole('dialog', { name: 'Compromisso' }).getByRole('button', { name: 'Editar', exact: true }).click();
      await folha.getByLabel('Data', { exact: true }).fill('21102026');
      await expect(folha.getByText('Ocorrência 3 de 10. Mudar a data vale só para este compromisso da série.')).toBeVisible();
      await folha.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Compromisso' }).getByText(/21\/10 · 16:00–17:00/)).toBeVisible();

      // Cancelar o compromisso inteiro numa série também pergunta o escopo; a escolha vai na rota.
      await page.getByRole('dialog', { name: 'Compromisso' }).getByRole('button', { name: 'Cancelar compromisso inteiro', exact: true }).click();
      const cancelar = page.getByRole('alertdialog', { name: 'Cancelar o compromisso inteiro?' });
      await opcao(cancelar, 'Aplicar a', 'Todos da série').click();
      await expect(cancelar.getByText('Todos os da série que ainda não começaram. Os que já passaram não mudam.')).toBeVisible();
      await cancelar.getByRole('button', { name: 'Cancelar compromisso inteiro', exact: true }).click();
      await expect(cancelar).toBeHidden();
      await expect(page.getByRole('dialog', { name: 'Compromisso' }).getByRole('button', { name: 'Reabrir compromisso', exact: true })).toBeVisible();
      const cancelamento = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/agenda/compromissos/k4/situacao');
      expect([cancelamento?.corpo, cancelamento?.busca.get('escopo')]).toEqual([{ cancelado: true, versao: 2 }, 'TODAS']);

      const puts = pedidos.filter((p) => p.metodo === 'PUT');
      expect(puts.map((p) => [p.caminho, p.busca.get('escopo')])).toEqual([['/agenda/compromissos/k4', 'SEGUINTES'], ['/agenda/compromissos/k4', null]]);
      expect(puts[0].corpo).toEqual({
        alunoIds: [ANA.id, BRUNO.id, CARLA.id], responsavelId: TREINADOR.id, data: '2026-10-20', hora: '16:00', duracaoMinutos: 60,
        local: 'Sala 2', observacao: 'Observação fictícia', versao: 0,
      });
      expect(puts[1].corpo).toMatchObject({ data: '2026-10-21', versao: 1 });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('situação por aluno, cancelar o compromisso inteiro e reabrir com aluno inativo', async ({ page }) => {
      const lista = [
        compromisso('k6', [ANA, BRUNO, CARLA], '2026-10-19', '11:30'),
        compromisso('k3', [BRUNO], '2026-10-20', '15:00'),
      ];
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, lista, {
        permissoes: ['AGENDA_LER', 'AGENDA_ALTERAR'],
        extra: {
          // Reabrir o compromisso inteiro com um aluno inativo: 409 com a mensagem da API.
          'POST /agenda/compromissos/k6/situacao': (p, route) => {
            const { cancelado } = p.corpo as { cancelado: boolean };
            if (!cancelado) return json(route, erroApi(409, 'Bruno Exemplo está inativo. Tire-o da lista para reabrir.', 'ALUNO_INATIVO').corpo, 409);
            lista[0] = { ...lista[0], cancelado: true, participantes: lista[0].participantes.map((a) => ({ ...a, situacao: 'CANCELADO' })), versao: lista[0].versao + 1 };
            return json(route, lista[0]);
          },
        },
      });
      await page.goto('/treinador/agenda');
      // Sem ATUALIZACAO_LER a tela abre só com os compromissos e não pede as atualizações.
      if (naLista) await expect(page.getByText('Ana Fictícia, Bruno Exemplo +1')).toBeVisible();
      expect(pedidos.some((p) => p.caminho === '/atualizacoes')).toBe(false);

      await page.getByRole('button', { name: 'Abrir compromisso de Ana Fictícia, Bruno Exemplo e mais 1, das 11h30 às 12h30', exact: true }).click();
      const folha = page.getByRole('dialog', { name: 'Compromisso' });
      await expect(folha.getByText('Observação fictícia')).toBeVisible();
      await expect(folha.getByText('3 agendados', { exact: true })).toBeVisible();
      // Por aluno, a ação nunca se chama "Cancelar compromisso".
      await expect(folha.getByRole('button', { name: 'Cancelar compromisso', exact: true })).toHaveCount(0);
      await folha.getByRole('button', { name: 'Marcar realizado: Ana Fictícia', exact: true }).click();
      await expect(folha.getByText('2 agendados · 1 de 3 realizados')).toBeVisible();
      await folha.getByRole('button', { name: 'Marcar falta: Bruno Exemplo', exact: true }).click();
      await expect(folha.getByText('1 agendado · 1 de 3 realizados · 1 faltou')).toBeVisible();
      await folha.getByRole('button', { name: 'Cancelar participação: Carla Teste', exact: true }).click();
      const doAluno = page.getByRole('alertdialog', { name: 'Cancelar a participação de Carla Teste?' });
      await expect(doAluno.getByText('Carla Teste deixa de participar e recebe o aviso do cancelamento. Os outros alunos continuam marcados.')).toBeVisible();
      await doAluno.getByRole('button', { name: 'Cancelar participação', exact: true }).click();
      await expect(doAluno).toBeHidden();
      await expect(folha.getByRole('button', { name: 'Reabrir participação: Carla Teste', exact: true })).toBeVisible();

      // O compromisso inteiro: separado, diz quantos alunos recebem o aviso (os que ainda participam).
      await folha.getByRole('button', { name: 'Cancelar compromisso inteiro', exact: true }).click();
      const inteiro = page.getByRole('alertdialog', { name: 'Cancelar o compromisso inteiro?' });
      await expect(inteiro.getByText(/2 alunos recebem o aviso do cancelamento/)).toBeVisible();
      await inteiro.getByRole('button', { name: 'Cancelar compromisso inteiro', exact: true }).click();
      await expect(inteiro).toBeHidden();
      await expect(folha.getByText('Cancelado', { exact: true }).first()).toBeVisible();
      // Cancelado inteiro: nada por aluno; reabrir com aluno inativo mostra a mensagem da API e a folha continua.
      await expect(folha.getByRole('button', { name: /^Marcar/ })).toHaveCount(0);
      await folha.getByRole('button', { name: 'Reabrir compromisso', exact: true }).click();
      await expect(folha.getByText('Bruno Exemplo está inativo. Tire-o da lista para reabrir.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Editar', exact: true })).toBeEnabled();
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toBeHidden();

      // Um aluno só e no futuro: realizado e falta ainda não; cancelar é do compromisso, com confirmação; a ficha aparece.
      await page.getByRole('button', { name: 'Abrir compromisso de Bruno Exemplo, das 15h às 16h', exact: true }).click();
      const outra = page.getByRole('dialog', { name: 'Compromisso' });
      await expect(outra.getByText('Realizado e falta ficam disponíveis a partir do horário do compromisso.')).toBeVisible();
      await expect(outra.getByRole('button', { name: /^Marcar/ })).toHaveCount(0);
      await expect(outra.getByRole('link', { name: 'Abrir ficha do aluno' })).toBeVisible();
      await outra.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
      const painel = page.getByRole('alertdialog', { name: 'Cancelar este compromisso?' });
      await expect(painel.getByText(/1 aluno recebe o aviso do cancelamento/)).toBeVisible();
      await painel.getByRole('button', { name: 'Cancelar compromisso', exact: true }).click();
      await expect(outra.getByText('Cancelado', { exact: true })).toBeVisible();
      await expect(outra.getByRole('button', { name: 'Reabrir compromisso', exact: true })).toBeVisible();

      const situacoes = pedidos.filter((p) => p.caminho.endsWith('/situacao')).map((p) => [p.caminho, p.corpo, p.busca.get('escopo')]);
      expect(situacoes).toEqual([
        [`/agenda/compromissos/k6/alunos/${ANA.id}/situacao`, { situacao: 'REALIZADO', versao: 0 }, null],
        [`/agenda/compromissos/k6/alunos/${BRUNO.id}/situacao`, { situacao: 'FALTOU', versao: 1 }, null],
        [`/agenda/compromissos/k6/alunos/${CARLA.id}/situacao`, { situacao: 'CANCELADO', versao: 2 }, null],
        ['/agenda/compromissos/k6/situacao', { cancelado: true, versao: 3 }, null],
        ['/agenda/compromissos/k6/situacao', { cancelado: false, versao: 4 }, null],
        ['/agenda/compromissos/k3/situacao', { cancelado: true, versao: 0 }, null],
      ]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem AGENDA_LER a tela segue só com as atualizações, sem "Criar"', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrirComoTreinador(page, [], { permissoes: ['ATUALIZACAO_LER'] });
      await page.goto('/treinador/agenda');
      await expect(page.getByRole('link', { name: /Abrir atualização de Bruno Exemplo/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo compromisso' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Criar', exact: true })).toHaveCount(0);
      expect(pedidos.some((p) => p.caminho.startsWith('/agenda'))).toBe(false);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

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
