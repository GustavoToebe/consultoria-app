import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, DiaDeTreino, Exercicio, PastaDoAluno, PastaResumo, PlanoResumo, SerieFeita } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Passo 7A de `docs/planos/filtros-laterais.md`: os filtros dos cartões (ficha do aluno: Pastas; Histórico do aluno) no
 * painel lateral com o contexto do cartão (título dele, aluno só como leitura, sem contar nem virar etiqueta), e como etapa
 * da mesma folha, sem painel por cima: o grupo muscular das folhas de escolher exercícios (editor de treino e Progresso),
 * onde Esc, Cancelar e o voltar do navegador voltam à lista com a busca e as marcações, e os Registros e cargas da pasta
 * (decisão de 15/11), onde voltam à pasta na mesma rolagem com o foco em "Filtros". Tema claro (os Registros também no
 * escuro), 390 e 1280 px, sem a entrada animada. Capturas na pasta de resultados do teste. Só dados fictícios, API simulada.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const PASTAS: PastaResumo[] = [
  { id: 'p1', alunoId: ALUNO_ID, titulo: 'Plano 16', inicio: '2026-09-01', fim: '2026-09-30', concluidaEm: '2026-09-30T12:00:00Z' },
  { id: 'p2', alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-01', fim: '2026-10-31', concluidaEm: null },
];
const plano = (id: string, titulo: string): PlanoResumo => ({
  id, alunoId: ALUNO_ID, pastaId: 'p2', titulo, inicio: '2026-10-01', fim: '2026-10-31', ativo: id === 'pt1',
  versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
});

const serie: SerieFeita = { id: 's1', serieUid: 's', tipo: 'WS', trabalho: true, carga: 40, unidade: 'kg', repeticoes: 8, concluida: true, observacao: null };
const DIAS: DiaDeTreino[] = [{
  data: '2026-10-15',
  sessoes: [{
    sessaoUid: 'sa', sessao: 'Treino A', planoVersaoId: 'v1',
    exercicios: [
      { exercicioUid: 'x1', exercicioId: 'e1', nome: 'Supino reto', grupoMuscular: 'Peito', series: [serie] },
      { exercicioUid: 'x2', exercicioId: 'e2', nome: 'Crucifixo', grupoMuscular: 'Peito', series: [serie] },
      { exercicioUid: 'x3', exercicioId: 'e3', nome: 'Remada baixa', grupoMuscular: 'Costas', series: [serie] },
    ],
  }],
}];

const tema = (page: Page, usuarioId: string, escolhido: 'CLARO' | 'ESCURO' = 'CLARO') =>
  page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, contraste: 'PADRAO' })), [usuarioId, escolhido] as const);

/** Rolagem da folha em que o elemento está (o primeiro ancestral que rola de verdade); -1 sem rolagem. */
const rolagemDaFolha = (alvo: Locator) => alvo.evaluate((no) => {
  for (let el = no.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el.scrollTop;
  }
  return -1;
});

async function ficha(page: Page, aba: string, extra: RespostasApi = {}, temaDaTela: 'CLARO' | 'ESCURO' = 'CLARO') {
  await fixarHoje(page);
  await tema(page, TREINADOR.id, temaDaTela);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'TREINO_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: DIAS },
    ...extra,
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=${aba}`);
  return api;
}

const filtros = (onde: Locator | Page) => onde.getByRole('button', { name: /^Filtros, / });

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test.beforeEach(({ page }) => page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 }));

    test('Pastas: painel "Filtros de pastas" com o aluno de contexto, etiqueta e contador próprios', async ({ page }, testInfo) => {
      const { errosDaPagina } = await ficha(page, 'planos');
      await expect(page.getByText('Plano 17', { exact: true })).toBeVisible();
      const botao = filtros(page);
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await botao.click();
      const painel = page.getByRole('dialog', { name: 'Filtros de pastas' });
      await expect(painel).toBeVisible();
      // O aluno é contexto: aparece como leitura, não conta nem vira etiqueta.
      await expect(painel.getByText(ALUNO.nome, { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`pastas-painel-${largura}.png`) });
      await painel.getByRole('radio', { name: 'Concluídas', exact: true }).click();
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toBeFocused();
      await expect(page.getByText('Plano 17', { exact: true })).toBeVisible();

      await botao.click();
      await painel.getByRole('radio', { name: 'Concluídas', exact: true }).click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(page.getByText('Plano 17', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Plano 16', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`pastas-aplicado-${largura}.png`) });
      await page.getByRole('button', { name: 'Tirar filtro: Situação: Concluídas' }).click();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await expect(page.getByText('Plano 17', { exact: true })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    for (const temaDaTela of ['CLARO', 'ESCURO'] as const) {
      test(`Registros da pasta (${temaDaTela.toLowerCase()}): etapa da própria folha, sem véu duplo; volta na mesma rolagem com o foco em "Filtros"`, async ({ page }, testInfo) => {
        // Nove planos (dez opções com "Todos os planos", mais que `OPCOES_PARA_BUSCAR`): a etapa mostra todos ali mesmo, sem
        // abrir outra folha; e a pasta fica longa, para a rolagem contar.
        const planos = 'ABCDEFGHI'.split('').map((l, i) => plano(`pt${i + 1}`, `Treino ${l}`));
        const { errosDaPagina } = await ficha(page, 'planos', {
          [`GET /alunos/${ALUNO_ID}/planos-treino`]: (_p, route) => json(route, planos),
        }, temaDaTela);
        await page.getByText('Plano 17', { exact: true }).click();
        const pasta = page.getByRole('dialog', { name: 'Plano 17' });
        const etapa = page.getByRole('dialog', { name: 'Filtros de registros' });
        // A seção "Registros e cargas" nasce fechada (docs/design-e-front.md §4.8): abre antes de procurar o "Filtros".
        await pasta.getByRole('button', { name: 'Registros e cargas, recolhido' }).click();
        await expect(pasta.getByText('Registros e cargas', { exact: true })).toBeVisible();
        const botao = filtros(pasta);
        await botao.scrollIntoViewIfNeeded();
        await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
        const antes = await rolagemDaFolha(botao);
        expect(antes).toBeGreaterThan(0);
        const voltouIgual = async () => {
          await expect(pasta).toBeVisible();
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await expect(botao).toBeFocused();
          await expect.poll(async () => Math.abs((await rolagemDaFolha(botao)) - antes)).toBeLessThanOrEqual(1);
        };

        // A folha troca título, corpo e rodapé pelos da etapa: um diálogo só, sem painel por cima.
        await botao.click();
        await expect(etapa).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        // O corpo da pasta fica escondido (montado), fora da tela e do leitor de tela.
        await expect(etapa.getByText('Registros e cargas', { exact: true })).toBeHidden();
        await expect(etapa.getByRole('button', { name: 'Finalizar pasta' })).toHaveCount(0);
        // Aluno e pasta são contexto; dentro da pasta o período é o dela (sem 14/30/60 dias).
        await expect(etapa.getByText(ALUNO.nome, { exact: true })).toBeVisible();
        await expect(etapa.getByText('Plano 17', { exact: true })).toBeVisible();
        await expect(etapa.getByRole('radio', { name: '30 dias' })).toHaveCount(0);
        await expect(etapa.getByRole('radio', { name: 'Treino I', exact: true })).toBeVisible();
        await expect(etapa.getByRole('radio', { name: 'Todos os planos', exact: true })).toBeFocused();
        await page.screenshot({ path: testInfo.outputPath(`registros-etapa-${largura}-${temaDaTela}.png`) });
        // Esc volta à pasta (não fecha a folha).
        await page.keyboard.press('Escape');
        await voltouIgual();

        // Cancelar descarta o rascunho.
        await botao.click();
        await etapa.getByRole('radio', { name: 'Treino B', exact: true }).click();
        await etapa.getByRole('button', { name: 'Cancelar' }).click();
        await voltouIgual();
        await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');

        // O voltar do navegador também só volta à pasta.
        await botao.click();
        await expect(etapa).toBeVisible();
        await page.goBack();
        await voltouIgual();

        // O X da etapa também só volta à pasta.
        await botao.click();
        await etapa.getByRole('button', { name: 'Fechar', exact: true }).click();
        await voltouIgual();

        await botao.click();
        await etapa.getByRole('radio', { name: 'Treino B', exact: true }).click();
        await etapa.getByRole('button', { name: 'Aplicar filtros' }).click();
        await voltouIgual();
        await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
        await expect(pasta.getByRole('button', { name: 'Tirar filtro: Plano: Treino B' })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`registros-aplicado-${largura}-${temaDaTela}.png`) });
        // O ✕ da etiqueta e o "Limpar filtros" da página tiram na hora, com a folha da pasta aberta.
        await pasta.getByRole('button', { name: 'Tirar filtro: Plano: Treino B' }).click();
        await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
        await expect(pasta).toBeVisible();
        await botao.click();
        await etapa.getByRole('radio', { name: 'Treino B', exact: true }).click();
        await etapa.getByRole('button', { name: 'Aplicar filtros' }).click();
        await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
        await pasta.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
        await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
        await expect(pasta).toBeVisible();

        // Fechar a pasta com um filtro ligado: ao reabrir, os Registros começam sem filtro; o botão das Pastas nunca contou o dos Registros.
        await botao.click();
        await etapa.getByRole('radio', { name: 'Treino C', exact: true }).click();
        await etapa.getByRole('button', { name: 'Aplicar filtros' }).click();
        await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
        await pasta.getByRole('button', { name: 'Fechar' }).click();
        await expect(pasta).toHaveCount(0);
        await expect(filtros(page)).toHaveAccessibleName('Filtros, nenhum ligado');
        await page.getByText('Plano 17', { exact: true }).click();
        await pasta.getByRole('button', { name: 'Registros e cargas, recolhido' }).click();
        await expect(filtros(pasta)).toHaveAccessibleName('Filtros, nenhum ligado');
        expect(errosDaPagina).toEqual([]);
      });
    }

    test('Histórico do aluno: período no painel "Filtros de registros"; o padrão não conta e "Limpar filtros" volta a ele', async ({ page }, testInfo) => {
      await fixarHoje(page);
      await tema(page, ALUNO.id);
      const pastas: PastaDoAluno[] = [
        { id: 'p-out', titulo: 'Outubro', inicio: '2026-10-01', fim: '2026-10-31', concluidaEm: null, atual: true, temTreino: true, temDieta: false },
        { id: 'p-set', titulo: 'Setembro', inicio: '2026-09-01', fim: '2026-09-30', concluidaEm: '2026-09-30T12:00:00Z', atual: false, temTreino: true, temDieta: false },
      ];
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        'GET /aluno/pastas': { corpo: pastas },
        'GET /aluno/execucoes': { corpo: DIAS },
        'GET /aluno/pesos': { corpo: [] },
      });
      await page.goto('/aluno/historico');
      const botao = filtros(page);
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await botao.click();
      const painel = page.getByRole('dialog', { name: 'Filtros de registros' });
      await expect(painel.getByRole('radio', { name: 'Pasta em uso', exact: true })).toBeChecked();
      await page.screenshot({ path: testInfo.outputPath(`historico-painel-${largura}.png`) });
      await painel.getByRole('radio', { name: 'Pasta anterior', exact: true }).click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Período: Pasta anterior' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`historico-aplicado-${largura}.png`) });
      await botao.click();
      await painel.getByRole('button', { name: 'Limpar filtros' }).click();
      await expect(painel.getByRole('radio', { name: 'Pasta em uso', exact: true })).toBeChecked();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await expect(page.getByRole('button', { name: /^Tirar filtro: Período/ })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('editor de treino: o grupo é etapa da folha (sem outra folha, mesmo com 9 grupos); Esc, Cancelar e voltar mantêm busca e marcações', async ({ page }, testInfo) => {
      const ID = 'f0000000-0000-4000-8000-000000000001';
      const exercicio = (n: number, nome: string, grupo: string): Exercicio => ({
        id: `e000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
        observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
      });
      await tema(page, TREINADOR.id);
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'MODELO_LER', 'MODELO_ALTERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        // Nove grupos (com o "Todos", mais que `OPCOES_PARA_BUSCAR`): a etapa mostra todos ali mesmo, sem abrir outra folha.
        'GET /exercicios': { corpo: [
          exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Crucifixo', 'Peito'), exercicio(3, 'Remada baixa', 'Costas'),
          exercicio(4, 'Elevação lateral', 'Ombros'), exercicio(5, 'Rosca martelo', 'Bíceps'), exercicio(6, 'Tríceps testa', 'Tríceps'),
          exercicio(7, 'Agachamento', 'Quadríceps'), exercicio(8, 'Stiff', 'Posterior'), exercicio(9, 'Elevação pélvica', 'Glúteos'),
        ] },
        [`GET /receitas/${ID}`]: { corpo: { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: { sessoes: [{ nome: 'Treino A' }] }, ordem: 0, pastaId: null, versao: 1 } },
      });
      await page.goto(`/treinador/planejamento/modelo/${ID}`);
      await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
      const lista = page.getByRole('dialog', { name: 'Escolher exercício' });
      await lista.getByRole('checkbox', { name: 'Supino reto' }).click();
      await lista.getByRole('checkbox', { name: 'Remada baixa' }).click();
      const busca = lista.getByRole('textbox', { name: 'Buscar na biblioteca' });
      await busca.fill('re');
      const botao = filtros(lista);
      const etapa = page.getByRole('dialog', { name: 'Filtros de exercícios' });
      const conferirLista = async () => {
        await expect(lista).toBeVisible();
        await expect(busca).toHaveValue('re');
        await expect(lista.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked();
        await expect(lista.getByRole('checkbox', { name: 'Remada baixa' })).toBeChecked();
        await expect(lista.getByRole('button', { name: 'Adicionar 2 exercícios' })).toBeEnabled();
      };

      // Esc na etapa volta à lista (não fecha a folha) e o foco volta ao botão.
      await botao.click();
      await expect(etapa).toBeVisible();
      await expect(lista).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(etapa.getByRole('radio', { name: 'Glúteos', exact: true })).toBeVisible();
      await expect(etapa.getByRole('radio', { name: 'Todos', exact: true })).toBeFocused();
      await expect(etapa.getByText('2 exercícios marcados. Ao aplicar outro grupo, sai da seleção o que não for dele.')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`biblioteca-etapa-${largura}.png`) });
      await page.keyboard.press('Escape');
      await conferirLista();
      await expect(botao).toBeFocused();

      // Cancelar descarta o rascunho.
      await botao.click();
      await etapa.getByRole('radio', { name: 'Peito', exact: true }).click();
      await etapa.getByRole('button', { name: 'Cancelar' }).click();
      await conferirLista();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');

      // O voltar do navegador também só volta à lista.
      await botao.click();
      await expect(etapa).toBeVisible();
      await page.goBack();
      await conferirLista();

      // Aplicar outro grupo tira só o que não é dele, com aviso no rodapé.
      await botao.click();
      await etapa.getByRole('radio', { name: 'Peito', exact: true }).click();
      await etapa.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(lista).toBeVisible();
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(lista.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' })).toBeVisible();
      await expect(lista.getByRole('status').filter({ hasText: '1 exercício marcado saiu da seleção porque não é do grupo Peito.' })).toBeVisible();
      await expect(lista.getByRole('checkbox', { name: 'Supino reto' })).toBeChecked();
      await expect(lista.getByRole('button', { name: 'Adicionar exercício' })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`biblioteca-aplicado-${largura}.png`) });
      // O ✕ da etiqueta tira na hora e a folha continua aberta.
      await lista.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' }).click();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await expect(lista.getByRole('checkbox', { name: 'Remada baixa' })).not.toBeChecked();
      // Fechar e abrir de novo começa na lista, com o foco de sempre (a busca no PC; o X na folha de baixo do celular).
      await lista.getByRole('button', { name: 'Cancelar' }).click();
      await expect(lista).toHaveCount(0);
      await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
      await expect(largura === 390 ? lista.getByRole('button', { name: 'Fechar' }) : busca).toBeFocused();
      expect(errosDaPagina).toEqual([]);
    });

    test('Progresso: o grupo é etapa da folha "Escolher exercícios" e as marcações ficam', async ({ page }, testInfo) => {
      const { errosDaPagina } = await ficha(page, 'evolucao');
      await page.getByRole('button', { name: 'Escolher exercícios (1)' }).click();
      const lista = page.getByRole('dialog', { name: 'Escolher exercícios' });
      await lista.getByRole('checkbox', { name: 'Remada baixa' }).click();
      const botao = filtros(lista);
      await botao.click();
      const etapa = page.getByRole('dialog', { name: 'Filtros de progresso' });
      await expect(etapa).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`progresso-etapa-${largura}.png`) });
      await etapa.getByRole('radio', { name: 'Peito', exact: true }).click();
      await etapa.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(lista).toBeVisible();
      await expect(botao).toBeFocused();
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(lista.getByRole('checkbox', { name: 'Remada baixa' })).toHaveCount(0);
      await lista.getByRole('button', { name: 'Concluir' }).click();
      // Remada (Costas) continua marcada: o grupo só mudou a lista para escolher.
      await expect(page.getByRole('button', { name: 'Escolher exercícios (2)' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });
  });
}
