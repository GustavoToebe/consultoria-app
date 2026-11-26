import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, Refeicao, VariacaoDaDieta, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';
/**
 * Dieta por dia da semana (passos 3 e 4 do plano `dieta-por-dia-da-semana`; abas e faixa da semana em 25/11): no editor,
 * as abas das variações e a faixa da semana da aberta (o número da variação de cada dia; marcar tira da outra), duplicar,
 * nova variação, excluir com confirmação, criar a partir da dieta sem variação e voltar; no aluno, a dieta abre na
 * variação de hoje (relógio em segunda-feira, 19/10/2026, Brasília) com troca à mão, o Início conta as refeições de hoje e
 * a prévia do rascunho com segunda descoberta avisa. Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000c1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000c2';

const item = (uid: string, nome: string, kcal: number): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal, proteina: 10, carboidrato: 20, gordura: 5, manual: true });
const refeicao = (uid: string, nome: string, kcal: number): Refeicao =>
  ({ uid, nome, horario: null, observacao: null, modoDePreparo: null, opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: [item(`${uid}-i`, `${nome} fictício`, kcal)] }] });

const VAZIA: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [], variacoes: [],
};
const TREINO: VariacaoDaDieta = { uid: 'v-treino', rotulo: 'Dia de treino', dias: [1, 3, 5], refeicoes: [refeicao('cafe', 'Café', 400), refeicao('almoco', 'Almoço', 700)] };
const DESCANSO: VariacaoDaDieta = { uid: 'v-descanso', rotulo: 'Descanso', dias: [2, 4, 6, 7], refeicoes: [refeicao('jantar', 'Jantar', 500)] };
const COM_VARIACOES: ConteudoDieta = { ...VAZIA, variacoes: [TREINO, DESCANSO] };
const SEM_VARIACAO: ConteudoDieta = { ...VAZIA, refeicoes: [refeicao('cafe', 'Café', 400)] };

const detalhe = (rascunho: ConteudoDieta): PlanoDetalhe<ConteudoDieta> => ({
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-10-01', fim: '2026-10-31', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000c3', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
});

const versaoDoAluno = (conteudo: ConteudoDieta): VersaoDetalhe<ConteudoDieta> => ({
  id: 'd0000000-0000-4000-8000-0000000000c4', planoId: PLANO_ID, numero: 1, titulo: 'Dieta fictícia',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z', conteudo,
});

async function abrirEditor(page: Page, rascunho: ConteudoDieta | 'erro', extra: RespostasApi = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /alimentos/fatores': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-dieta/${PLANO_ID}`]: rascunho === 'erro' ? erroApi(503, 'Servidor fora do ar.') : { corpo: detalhe(rascunho) },
    [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: { ...detalhe(VAZIA), plano: { ...detalhe(VAZIA).plano, versao: 2 } } },
    ...extra,
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  return api;
}

/** O conteúdo do último "Salvar rascunho". */
async function salvarERetornar(page: Page, pedidos: { metodo: string; caminho: string; corpo: unknown }[]): Promise<ConteudoDieta> {
  const antes = pedidos.filter((p) => p.metodo === 'PUT').length;
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).length).toBe(antes + 1);
  const put = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).at(-1);
  return (put?.corpo as { conteudo: ConteudoDieta }).conteudo;
}

for (const largura of [390, 1280]) {
  test(`editor: troca de variação, total da aberta, dia que sai da outra, duplicar e desfazer (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, COM_VARIACOES);

    const abas = page.getByRole('tablist', { name: 'Variações da dieta' });
    await expect(abas.getByRole('tab')).toHaveCount(2);
    await expect(abas.getByRole('tab', { name: /^Dia de treino, Seg, Qua e Sex/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Total do dia · Dia de treino' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`editor-variacoes-${largura}.png`), fullPage: true });

    // Outra variação: total e refeições são os dela.
    await abas.getByRole('tab', { name: /^Descanso,/ }).click();
    await expect(page.getByRole('heading', { name: 'Total do dia · Descanso' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Refeições (1)' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nome da variação' })).toHaveValue('Descanso');

    // Segunda está no "Dia de treino": marcar aqui tira de lá.
    const segunda = page.getByRole('checkbox', { name: /^Segunda, está em Dia de treino/ });
    await expect(segunda).toHaveAttribute('aria-checked', 'false');
    await segunda.click();
    await expect(page.getByRole('checkbox', { name: /^Segunda$/ })).toHaveAttribute('aria-checked', 'true');
    await expect(abas.getByRole('tab', { name: /^Dia de treino, Qua e Sex/ })).toBeVisible();

    // Duplicar: a cópia abre, sem dia marcado, e o aviso diz o que falta para publicar.
    await page.getByRole('button', { name: 'Duplicar a variação Descanso' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(3);
    await expect(abas.getByRole('tab', { name: /^Descanso \(cópia\), Nenhum dia/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Sem dia marcado: Descanso (cópia).')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`editor-duplicada-${largura}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(2);
    // A cópia sumiu: o editor cai na primeira variação; volta ao Descanso.
    await abas.getByRole('tab', { name: /^Descanso,/ }).click();

    // Nome vazio: erro ao sair do campo.
    const nome = page.getByRole('textbox', { name: 'Nome da variação' });
    await nome.fill('');
    await nome.blur();
    await expect(page.getByText(/Dê um nome à variação/)).toBeVisible();
    await nome.fill('Fim de semana');

    const salvo = await salvarERetornar(page, pedidos);
    expect(salvo.refeicoes).toEqual([]);
    expect(salvo.variacoes.map((v) => [v.rotulo, v.dias])).toEqual([['Dia de treino', [3, 5]], ['Fim de semana', [1, 2, 4, 6, 7]]]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: abas, faixa da semana com o número de cada dia, contador, dica, nova variação e excluir (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, COM_VARIACOES);
    const abas = page.getByRole('tablist', { name: 'Variações da dieta' });
    await expect(abas.getByRole('tab', { name: /^Dia de treino, Seg, Qua e Sex$/ })).toContainText('Dia de treino· Seg, Qua e Sex');
    await expect(abas.getByRole('tab', { name: /^Descanso, Ter, Qui, Sáb e Dom$/ })).toContainText('2');

    // Faixa: os dias da aberta (1) marcados com o número dela; os outros com o número da outra (2).
    const faixa = page.getByRole('group', { name: 'Dias da variação Dia de treino' });
    const dias = faixa.getByRole('checkbox');
    await expect(dias).toHaveCount(7);
    await expect(dias).toHaveText(['Seg1', 'Ter2', 'Qua1', 'Qui2', 'Sex1', 'Sáb2', 'Dom2']);
    await expect(faixa.getByRole('checkbox', { checked: true })).toHaveCount(3);
    // Sete numa linha também em 390, cada um com pelo menos 44 px.
    const caixas = await dias.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: Math.round(r.y), w: r.width, h: r.height })));
    expect(new Set(caixas.map((c) => c.y)).size).toBe(1);
    for (const c of caixas) { expect(c.w).toBeGreaterThanOrEqual(44); expect(c.h).toBeGreaterThanOrEqual(44); }

    // Tocar num dia da outra passa o dia para a aberta (e o número muda para 1).
    await faixa.getByRole('checkbox', { name: 'Terça, está em Descanso' }).click();
    await expect(faixa.getByRole('checkbox', { name: 'Terça' })).toHaveAttribute('aria-checked', 'true');
    await expect(dias.nth(1)).toHaveText('Ter1');
    await expect(abas.getByRole('tab', { name: /^Descanso, Qui, Sáb e Dom$/ })).toBeVisible();

    // Contador no lugar da frase de limite.
    await expect(page.getByText('13/40', { exact: true })).toBeVisible();
    await expect(page.getByText(/Até 40 caracteres/)).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Nome da variação' }).fill('');
    await expect(page.getByText('0/40', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Nome da variação' }).fill('Treino');

    // A frase da regra virou a dica do ⓘ.
    // (o texto também mora, oculto, na descrição acessível do ⓘ: conta só o que está à vista)
    const dica = page.getByText('Marcar um dia o tira da outra variação.').filter({ visible: true });
    const info = page.getByRole('button', { name: 'Sobre dias desta variação' });
    await expect(dica).toHaveCount(0);
    await expect(info).toHaveAccessibleDescription('Marcar um dia o tira da outra variação.');
    await info.hover();
    await expect(dica).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dica).toHaveCount(0);

    // "+ Nova variação": vazia, aberta, sem dia e sem refeição.
    await page.getByRole('button', { name: 'Nova variação' }).click();
    await expect(abas.getByRole('tab', { name: /^Variação 3, Nenhum dia$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Refeições (0)' })).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(2);

    // Excluir pede confirmação; cancelar não muda nada; confirmar exclui com Desfazer.
    await abas.getByRole('tab', { name: /^Descanso,/ }).click();
    await page.getByRole('button', { name: 'Excluir a variação Descanso' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Excluir a variação “Descanso”?' });
    await expect(painel).toContainText('Qui, Sáb e Dom ficam sem dieta');
    await painel.getByRole('button', { name: 'Cancelar' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(2);
    await page.getByRole('button', { name: 'Excluir a variação Descanso' }).click();
    await painel.getByRole('button', { name: 'Excluir variação' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(1);
    await expect(page.getByText('Dias sem variação: Qui, Sáb e Dom.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(abas.getByRole('tab')).toHaveCount(2);

    const salvo = await salvarERetornar(page, pedidos);
    expect(salvo.variacoes.map((v) => [v.rotulo, v.dias])).toEqual([['Treino', [1, 2, 3, 5]], ['Descanso', [4, 6, 7]]]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: dieta sem variação vira duas e volta a ser uma só (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, SEM_VARIACAO);
    await expect(page.getByRole('heading', { name: 'Total do dia' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Variações da dieta' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Criar variação por dia' }).click();
    const abas = page.getByRole('tablist', { name: 'Variações da dieta' });
    await expect(abas.getByRole('tab', { name: /^Variação 1, Seg, Ter, Qua, Qui, Sex, Sáb e Dom/ })).toBeVisible();
    await expect(abas.getByRole('tab', { name: /^Variação 2, Nenhum dia/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Total do dia · Variação 2' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`editor-criada-${largura}.png`), fullPage: true });
    const dividida = await salvarERetornar(page, pedidos);
    expect(dividida.refeicoes).toEqual([]);
    expect(dividida.variacoes).toHaveLength(2);
    expect(dividida.variacoes[1].refeicoes[0].uid).not.toBe(dividida.variacoes[0].refeicoes[0].uid);

    await page.getByRole('button', { name: /^Usar a variação Variação 2 em todos os dias/ }).click();
    await expect(page.getByRole('button', { name: 'Criar variação por dia' })).toBeVisible();
    const uma = await salvarERetornar(page, pedidos);
    expect(uma.variacoes).toEqual([]);
    expect(uma.refeicoes.map((r) => r.nome)).toEqual(['Café']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: variação sem refeição mostra o vazio dela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, { ...VAZIA, variacoes: [TREINO, { ...DESCANSO, refeicoes: [] }] });
    await page.getByRole('tablist', { name: 'Variações da dieta' }).getByRole('tab', { name: /^Descanso,/ }).click();
    await expect(page.getByText('Nenhuma refeição nesta variação ainda.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Refeições (0)' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: falha ao abrir oferece tentar de novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas } = await abrirEditor(page, 'erro');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
  });

  test(`aluno: abre na variação de hoje, troca à mão e o Início conta as de hoje (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await fixarHoje(page);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
      'GET /aluno/dieta': { corpo: { dieta: versaoDoAluno(COM_VARIACOES) } },
      'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
      'GET /aluno/pesos': { corpo: [] },
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    });
    await page.goto('/aluno');
    await expect(page.getByRole('link', { name: /^Dieta,/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`aluno-inicio-${largura}.png`), fullPage: true });
    await expect(page.getByRole('link', { name: /^Dieta,/ })).toContainText('Hoje: Dia de treino · 2 refeições');

    await page.goto('/aluno/dieta');
    await expect(page.getByRole('heading', { name: 'Hoje: Dia de treino' })).toBeVisible();
    await expect(page.getByText('Café', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Dia de treino · hoje' })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: testInfo.outputPath(`aluno-hoje-${largura}.png`), fullPage: true });

    await page.getByRole('radio', { name: 'Descanso' }).click();
    await expect(page.getByRole('heading', { name: 'Descanso' })).toBeVisible();
    await expect(page.getByText('Vale em Ter, Qui, Sáb e Dom. Hoje é dia de Dia de treino.')).toBeVisible();
    await expect(page.getByText('Jantar', { exact: true })).toBeVisible();
    await expect(page.getByText('Café', { exact: true })).toHaveCount(0);

    // Tocar na de hoje volta a seguir o dia.
    await page.getByRole('radio', { name: 'Dia de treino · hoje' }).click();
    await expect(page.getByRole('heading', { name: 'Hoje: Dia de treino' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: dieta sem variação continua igual (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await fixarHoje(page);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: versaoDoAluno(SEM_VARIACAO) } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByRole('heading', { name: 'Total do dia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Hoje:/ })).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`prévia: segunda sem dieta marcada diz isso, não mostra refeições e deixa escolher a variação (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, { ...VAZIA, variacoes: [{ ...TREINO, dias: [3, 5] }, DESCANSO] });
    await expect(page.getByText('Dias sem variação: Seg.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Ver como o aluno' }).click();
    const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
    await expect(folha.getByRole('heading', { name: 'Sem dieta marcada para hoje' })).toBeVisible();
    // Nada de refeições de outro dia como se fossem as de hoje.
    await expect(folha.getByRole('heading', { name: 'Total do dia' })).toHaveCount(0);
    await expect(folha.getByText('Café', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`previa-descoberta-${largura}.png`) });
    await folha.getByRole('radio', { name: 'Dia de treino' }).click();
    await expect(folha.getByRole('heading', { name: 'Dia de treino' })).toBeVisible();
    await expect(folha.getByText('Sem dieta marcada para hoje. Esta é a dieta de outro dia.')).toBeVisible();
    await expect(folha.getByText('Café', { exact: true })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: dia sem variação publica depois de o aviso ser confirmado (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const semSegunda: ConteudoDieta = { ...VAZIA, variacoes: [{ ...TREINO, dias: [3, 5] }, DESCANSO] };
    const alterado = { ...detalhe(semSegunda), plano: { ...detalhe(semSegunda).plano, rascunhoAlteradoDepoisDePublicar: true } };
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, semSegunda, {
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: alterado },
      // O servidor devolve só aviso (nunca erro) para o dia que nenhuma variação cobre; confirmando, publica.
      [`POST /planos-dieta/${PLANO_ID}/publicar`]: (pedido, route) => {
        if ((pedido.corpo as { confirmarAvisos?: boolean }).confirmarAvisos) {
          return json(route, { ...alterado, plano: { ...alterado.plano, versaoPublicada: 2, rascunhoAlteradoDepoisDePublicar: false } });
        }
        const e = erroApi(422, 'Confira os avisos antes de publicar. Nada foi publicado.', 'CONFIRMAR_AVISOS',
          [{ field: 'variacoes', message: 'Dia sem dieta marcada: segunda.' }]);
        return json(route, e.corpo, e.status);
      },
    });
    await page.getByRole('button', { name: 'Publicar dieta' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Publicar com avisos?' });
    await expect(painel.getByText('Dia sem dieta marcada: segunda.')).toBeVisible();
    await painel.getByRole('button', { name: 'Publicar mesmo assim' }).click();
    await expect.poll(() => pedidos.filter((p) => p.caminho.endsWith('/publicar')).map((p) => (p.corpo as { confirmarAvisos: boolean }).confirmarAvisos)).toEqual([false, true]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: o PDF escolhe "Todas as variações" ou uma só, e a lista diz qual (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await fixarHoje(page);
    await page.addInitScript(() => { window.print = () => undefined; });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: versaoDoAluno(COM_VARIACOES) } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
    const folha = page.getByRole('dialog', { name: 'PDF da dieta' });
    await expect(folha.getByRole('radio', { name: 'Todas as variações' })).toHaveAttribute('aria-checked', 'true');

    // Todas: as duas seções no documento.
    await folha.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const bloco = page.locator('#treinos-impressao');
    await expect(bloco).toContainText('Variação · Dia de treino');
    await expect(bloco).toContainText('Variação · Descanso');

    // Uma só: o documento leva só ela; no detalhado a lista diz de qual variação é.
    await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
    await folha.getByRole('radio', { name: 'Descanso' }).click();
    await folha.getByRole('radio', { name: 'Detalhado' }).click();
    await expect(folha.getByText('Lista da variação Descanso, que vale em Ter, Qui, Sáb e Dom.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`aluno-pdf-uma-variacao-${largura}.png`) });
    await folha.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    await expect(bloco).toContainText('Variação · Descanso');
    await expect(bloco).not.toContainText('Dia de treino');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: dia sem dieta marcada (dieta publicada com dia descoberto) no Início e na Dieta (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await fixarHoje(page);
    // Segunda (o "hoje" fixo) não está em nenhuma variação: o "dia de descanso" publicável.
    const semSegunda: ConteudoDieta = { ...VAZIA, variacoes: [{ ...TREINO, dias: [3, 5] }, DESCANSO] };
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
      'GET /aluno/dieta': { corpo: { dieta: versaoDoAluno(semSegunda) } },
      'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
      'GET /aluno/pesos': { corpo: [] },
      'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    });
    await page.goto('/aluno');
    await expect(page.getByRole('link', { name: /^Dieta,/ })).toContainText('Sem dieta marcada para hoje');

    await page.goto('/aluno/dieta');
    await expect(page.getByRole('heading', { name: 'Sem dieta marcada para hoje' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Total do dia' })).toHaveCount(0);
    await expect(page.getByText('Café', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`aluno-sem-dieta-hoje-${largura}.png`), fullPage: true });
    await page.getByRole('radio', { name: 'Descanso' }).click();
    await expect(page.getByText('Jantar', { exact: true })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Capturas do editor nos três temas (claro, areia, escuro): as abas das variações, a faixa da semana com ✓ e o aviso. */
for (const tema of ['CLARO', 'AREIA', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`capturas: editor com variações (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await page.addInitScript(([ids, t]) => {
        for (const id of ids) localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
      }, [[TREINADOR.id, ALUNO.id], tema] as const);
      await abrirEditor(page, { ...VAZIA, variacoes: [TREINO, { ...DESCANSO, dias: [2, 4, 6] }] }, {
        [`POST /planos-dieta/${PLANO_ID}/validar`]: { corpo: { erros: [{ caminho: 'variacoes[1].dias', mensagem: 'Dia em mais de uma variação ou repetido: domingo.' }], avisos: [] } },
      });
      await expect(page.getByText('Dias sem variação: Dom.', { exact: false })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`editor-${largura}-${tema}.png`), fullPage: true });
      // O ícone de erro na aba da variação com problema (contraste nos três temas).
      await page.getByRole('button', { name: 'Validar' }).click();
      await expect(page.getByRole('tab', { name: /^Descanso, .*precisa corrigir$/ })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`editor-erro-${largura}-${tema}.png`) });
    });
  }
}
