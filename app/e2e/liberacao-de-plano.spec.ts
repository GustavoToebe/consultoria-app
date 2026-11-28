import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, ConteudoDieta, PastaResumo, PlanoDetalhe, PlanoResumo } from '../src/api/tipos';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Liberação agendada do plano (bloco E de `docs/planos/atualizacao-pasta-e-questionarios.md`), lado do treinador:
 * - "Agendar" no editor do plano do aluno: data conferida no dia de Brasília, 422 `LIBERACAO_INVALIDA` no campo, corpo com
 *   `liberarEm` e a barra dizendo o agendamento;
 * - "Publicar tudo" da pasta com uma data só, sem aviso, e o plano agendado que ficou de fora orientando a "Alterar data";
 * - selo "Agendado para dd/mm" na linha da pasta e no plano, "Alterar data de liberação" e "Liberar agora" (com painel).
 * O relógio fica em 26/11/2026, meio-dia de Brasília: amanhã = 27/11. Só dados fictícios.
 */

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-0000000000e1';
const DIETA_ID = 'd0000000-0000-4000-8000-0000000000e1';
const TREINO_ID = 'b0000000-0000-4000-8000-0000000000e1';
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const BASE: Omit<PlanoResumo, 'id' | 'titulo'> = {
  alunoId: ALUNO_ID, pastaId: PASTA_ID, inicio: '2026-11-26', fim: '2026-12-10', ativo: true, versaoPublicada: 1,
  publicadoEm: '2026-11-20T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 3, versaoLiberada: 1, liberarEm: null, avisarNaLiberacao: true,
};

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null,
  aguaLitros: null, variacoes: [], refeicoes: [],
};

async function abrir(page: Page, permissoes: string[], extras: RespostasApi) {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00-03:00'));
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', ...permissoes] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    'GET /alimentos': { corpo: [] },
    'GET /alimentos/fatores': { corpo: [] },
    // O seletor de questionário da Folha da pasta (fora do que este spec confere).
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: erroApi(404, 'Sem atualização.', 'NAO_ENCONTRADO'),
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    ...extras,
  });
}

for (const largura of [390, 1280]) {
  test(`editor: "Agendar" confere a data, mostra o 422 no campo e publica com a data (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let plano: PlanoResumo = { ...BASE, id: DIETA_ID, titulo: 'Dieta do Plano 18', rascunhoAlteradoDepoisDePublicar: true };
    const detalhe = (): PlanoDetalhe<ConteudoDieta> => ({ plano, rascunho: CONTEUDO, versoes: [{ id: 'v1', numero: 1, publicadoEm: '2026-11-20T12:00:00Z' }] });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, ['DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'], {
      [`GET /planos-dieta/${DIETA_ID}`]: (_p, route) => json(route, detalhe()),
      [`POST /planos-dieta/${DIETA_ID}/publicar`]: (pedido, route) => {
        const corpo = pedido.corpo as { liberarEm?: string };
        // O servidor recusa o dia (como faria com um dia fora da faixa dele): a mensagem vai ao campo.
        if (corpo.liberarEm === '2026-12-25') {
          const e = erroApi(422, 'Data de liberação inválida.', 'LIBERACAO_INVALIDA', [{ field: 'liberarEm', message: 'Escolha um dia de amanhã até 31/12/2031.' }]);
          return json(route, e.corpo, e.status);
        }
        plano = { ...plano, versaoPublicada: 2, rascunhoAlteradoDepoisDePublicar: false, versao: 4, liberarEm: corpo.liberarEm ?? null };
        return json(route, detalhe());
      },
    });
    await page.goto(`/treinador/dietas/${DIETA_ID}`);
    await page.getByRole('button', { name: 'Publicar dieta', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Publicar dieta' });
    // Abre em "Liberar agora", com "Avisar o aluno" marcado (decisão do Gustavo).
    await expect(folha.getByRole('radio', { name: 'Liberar agora' })).toBeChecked();
    await expect(folha.getByRole('checkbox', { name: 'Avisar o aluno' })).toBeChecked();
    await folha.getByRole('radio', { name: 'Agendar para uma data' }).click();
    await expect(folha.getByRole('checkbox', { name: 'Avisar o aluno quando liberar' })).toBeChecked();
    if (largura === 1280) await page.screenshot({ path: captura('liberacao-editor-folha-1280.png') });

    // Hoje (Brasília) não vale: o campo diz a faixa e nada vai à API.
    const campo = folha.getByRole('textbox', { name: 'Liberar em' });
    await campo.fill('26/11/2026');
    await folha.getByRole('button', { name: 'Publicar e agendar' }).click();
    await expect(folha.getByText('Escolha um dia a partir de amanhã (27/11/2026) até 31/12/2031.', { exact: true }).first()).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/publicar'))).toHaveLength(0);

    await campo.fill('25/12/2026');
    await folha.getByRole('button', { name: 'Publicar e agendar' }).click();
    await expect(folha.getByText('Escolha um dia de amanhã até 31/12/2031.')).toBeVisible();
    if (largura === 390) await page.screenshot({ path: captura('liberacao-editor-erro-390.png') });

    await campo.fill('30/11/2026');
    await folha.getByRole('button', { name: 'Publicar e agendar' }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Publicado v2, agendado para 30/11. Até lá, o aluno continua com o que já via.')).toBeVisible();
    await expect(page.getByText(/agendado para 30\/11$/).first()).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/publicar')).map((p) => p.corpo)).toEqual([
      { versao: 3, confirmarAvisos: false, liberarEm: '2026-12-25' },
      { versao: 3, confirmarAvisos: false, liberarEm: '2026-11-30' },
    ]);
    await page.screenshot({ path: captura(`liberacao-editor-agendado-${largura}.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor: publicar agora sem avisar manda avisarAluno falso e o aluno já vê (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let plano: PlanoResumo = { ...BASE, id: DIETA_ID, titulo: 'Dieta do Plano 18', rascunhoAlteradoDepoisDePublicar: true };
    const detalhe = (): PlanoDetalhe<ConteudoDieta> => ({ plano, rascunho: CONTEUDO, versoes: [] });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, ['DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'], {
      [`GET /planos-dieta/${DIETA_ID}`]: (_p, route) => json(route, detalhe()),
      [`POST /planos-dieta/${DIETA_ID}/publicar`]: (_p, route) => {
        plano = { ...plano, versaoPublicada: 2, versaoLiberada: 2, rascunhoAlteradoDepoisDePublicar: false, versao: 4 };
        return json(route, detalhe());
      },
    });
    await page.goto(`/treinador/dietas/${DIETA_ID}`);
    await page.getByRole('button', { name: 'Publicar dieta', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Publicar dieta' });
    await folha.getByRole('checkbox', { name: 'Avisar o aluno' }).click();
    await expect(folha.getByRole('checkbox', { name: 'Avisar o aluno' })).not.toBeChecked();
    if (largura === 390) await page.screenshot({ path: captura('liberacao-editor-agora-390.png') });
    await folha.getByRole('button', { name: 'Publicar agora' }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Publicado v2. O aluno já vê esta versão.')).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/publicar')).map((p) => p.corpo)).toEqual([{ versao: 3, confirmarAvisos: false, avisarAluno: false }]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`pasta: "Publicar tudo" com data e sem aviso, e o agendado sem alteração orienta a "Alterar data" (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const pasta: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-11-26', fim: '2026-12-10', concluidaEm: null, liberarEm: '2026-12-01' };
    const treino: PlanoResumo = { ...BASE, id: TREINO_ID, titulo: 'Treino do Plano 18', versaoPublicada: 2, liberarEm: '2026-12-01' };
    let dieta: PlanoResumo = { ...BASE, id: DIETA_ID, titulo: 'Dieta do Plano 18', ativo: false, versaoPublicada: 0, publicadoEm: null, versao: 1, versaoLiberada: 0 };
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, ['TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'], {
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [pasta] },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [treino] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: (_p, route) => json(route, [dieta]),
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      [`POST /pastas/${PASTA_ID}/publicar`]: (pedido, route) => {
        const corpo = pedido.corpo as { liberarEm?: string };
        dieta = { ...dieta, versaoPublicada: 1, versao: 2, liberarEm: corpo.liberarEm ?? null, avisarNaLiberacao: false };
        return json(route, { publicados: [{ tipo: 'dieta', planoId: DIETA_ID, versao: 1, liberarEm: dieta.liberarEm }], pulados: [{ tipo: 'treino', planoId: TREINO_ID }] });
      },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    const folha = page.getByRole('dialog', { name: 'Pasta de 26/11 a 10/12' });
    await expect(folha.getByText('Agendado para 01/12', { exact: true })).toBeVisible();

    // No rodapé fixo da Folha: "Quando o aluno vê" (Agora · Agendar), a data ao lado e o interruptor do aviso.
    await folha.getByRole('radio', { name: 'Agendar', exact: true }).click();
    await folha.getByRole('textbox', { name: 'Liberar em' }).fill('30/11/2026');
    await folha.getByRole('switch', { name: 'Avisar o aluno quando liberar' }).click();
    await folha.getByRole('button', { name: 'Publicar alterações (1) da pasta de 26/11 a 10/12' }).click();
    // O resultado sai no aviso da tela, numa frase só com o agendado que ficou como estava.
    await expect(page.getByText('Dieta publicada. 1 plano sem alteração. Agendado para 30/11: até lá, o aluno continua com o que já via.')).toBeVisible();
    await expect(page.getByText(/“Treino do Plano 18” segue agendado para 01\/12\. Sem alteração, não foi publicado de novo/)).toBeVisible();
    // A lista recarrega: a dieta (na aba dela) passa a ter o selo do dia escolhido.
    await folha.getByRole('tab', { name: 'Dieta (1)' }).click();
    await expect(folha.getByText('Agendado para 30/11', { exact: true })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/publicar')).map((p) => p.corpo))
      .toEqual([{ confirmarAvisos: false, versoes: { [DIETA_ID]: 1 }, liberarEm: '2026-11-30', avisarAluno: false }]);
    await page.screenshot({ path: captura(`liberacao-pasta-publicar-tudo-${largura}.png`), fullPage: false });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`plano agendado: selo na linha da pasta, "Alterar data" e "Liberar agora" com painel (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let treino: PlanoResumo = { ...BASE, id: TREINO_ID, titulo: 'Treino do Plano 18', versaoPublicada: 2, liberarEm: '2026-12-01', avisarNaLiberacao: false };
    const pasta = (): PastaResumo => ({ id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-11-26', fim: '2026-12-10', concluidaEm: null, liberarEm: treino.liberarEm });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, ['TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'], {
      [`GET /alunos/${ALUNO_ID}/pastas`]: (_p, route) => json(route, [pasta()]),
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: (_p, route) => json(route, [treino]),
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      [`PUT /planos-treino/${TREINO_ID}/liberacao`]: (pedido, route) => {
        treino = { ...treino, liberarEm: (pedido.corpo as { liberarEm: string }).liberarEm, versao: treino.versao + 1 };
        return json(route, treino);
      },
      [`POST /planos-treino/${TREINO_ID}/liberar-agora`]: (_p, route) => {
        treino = { ...treino, liberarEm: null, versaoLiberada: 2, versao: treino.versao + 1 };
        return json(route, treino);
      },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
    const linha = page.getByRole('button', { name: /^Pasta Plano 18, aberta.*agendado para 01\/12/ });
    await expect(linha).toBeVisible();
    await expect(linha.getByText('Agendado para 01/12', { exact: true })).toBeVisible();
    await page.screenshot({ path: captura(`liberacao-linha-da-pasta-${largura}.png`) });
    await linha.click();
    const folha = page.getByRole('dialog', { name: 'Pasta de 26/11 a 10/12' });

    await folha.getByRole('button', { name: 'Mais ações de Treino do Plano 18' }).click();
    await page.getByRole('button', { name: /^Alterar data de liberação/ }).click();
    const alterar = page.getByRole('dialog', { name: 'Alterar data de liberação' });
    const campo = alterar.getByRole('textbox', { name: 'Liberar em' });
    await expect(campo).toHaveValue('01/12/2026');
    await campo.fill('03/12/2026');
    if (largura === 390) await page.screenshot({ path: captura('liberacao-alterar-data-390.png') });
    await alterar.getByRole('button', { name: 'Salvar data' }).click();
    await expect(alterar).toHaveCount(0);
    await expect(folha.getByText('Agendado para 03/12', { exact: true })).toBeVisible();

    await folha.getByRole('button', { name: 'Mais ações de Treino do Plano 18' }).click();
    await page.getByRole('button', { name: /^Liberar agora/ }).click();
    const painel = page.getByRole('alertdialog', { name: 'Liberar agora?' });
    await expect(painel.getByText('A liberação marcada para 03/12 é antecipada e o aluno passa a ver esta versão já.')).toBeVisible();
    // A caixa nasce com o que foi escolhido ao agendar (aqui, não avisar).
    await expect(painel.getByRole('checkbox', { name: 'Avisar o aluno' })).not.toBeChecked();
    if (largura === 1280) await page.screenshot({ path: captura('liberacao-liberar-agora-1280.png') });
    await painel.getByRole('button', { name: 'Liberar agora' }).click();
    await expect(painel).toHaveCount(0);
    await expect(folha.getByText(/^Agendado para/)).toHaveCount(0);
    // A lista de pastas também recarrega: fechada a Folha, a linha não tem mais o selo.
    await page.keyboard.press('Escape');
    await expect(folha).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Pasta Plano 18, aberta/ })).not.toHaveAccessibleName(/agendado/);
    expect(pedidos.filter((p) => p.caminho.includes(`/planos-treino/${TREINO_ID}/`)).map((p) => [p.metodo, p.caminho, p.corpo])).toEqual([
      ['PUT', `/planos-treino/${TREINO_ID}/liberacao`, { liberarEm: '2026-12-03' }],
      ['POST', `/planos-treino/${TREINO_ID}/liberar-agora`, { avisarAluno: false }],
    ]);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`plano já liberado pela rotina: "Liberar agora" avisa e a lista recarrega (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let treino: PlanoResumo = { ...BASE, id: TREINO_ID, titulo: 'Treino do Plano 18', versaoPublicada: 2, liberarEm: '2026-12-01' };
    const { naoTratadas, errosDaPagina } = await abrir(page, ['TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'], {
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [{ id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-11-26', fim: '2026-12-10', concluidaEm: null }] },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: (_p, route) => json(route, [treino]),
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      [`POST /planos-treino/${TREINO_ID}/liberar-agora`]: (_p, route) => {
        treino = { ...treino, liberarEm: null, versaoLiberada: 2 };
        const e = erroApi(409, 'O plano não está agendado.', 'PLANO_NAO_AGENDADO');
        return json(route, e.corpo, e.status);
      },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    const folha = page.getByRole('dialog', { name: 'Pasta de 26/11 a 10/12' });
    await folha.getByRole('button', { name: 'Mais ações de Treino do Plano 18' }).click();
    await page.getByRole('button', { name: /^Liberar agora/ }).click();
    await page.getByRole('alertdialog', { name: 'Liberar agora?' }).getByRole('button', { name: 'Liberar agora' }).click();
    await expect(page.getByText('Este plano não está mais agendado: já foi liberado ao aluno.')).toBeVisible();
    await expect(folha.getByText(/^Agendado para/)).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`capturas: Folha de publicar com a data, calendário por cima e selo (${tema}, ${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.addInitScript(([u, t]) => localStorage.setItem(`treinos:${u}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
      const plano: PlanoResumo = { ...BASE, id: DIETA_ID, titulo: 'Dieta do Plano 18', rascunhoAlteradoDepoisDePublicar: true, liberarEm: '2026-12-01' };
      const { errosDaPagina } = await abrir(page, ['DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'], {
        [`GET /planos-dieta/${DIETA_ID}`]: { corpo: { plano, rascunho: CONTEUDO, versoes: [] } },
        [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [{ id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-11-26', fim: '2026-12-10', concluidaEm: null, liberarEm: '2026-12-01' }] },
        [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [plano] },
      });
      await page.goto(`/treinador/dietas/${DIETA_ID}`);
      await page.getByRole('button', { name: 'Publicar dieta', exact: true }).click();
      const folha = page.getByRole('dialog', { name: 'Publicar dieta' });
      // Plano já agendado: a Folha abre em "Agendar" com a data gravada, e o rodapé fica à vista sem rolar.
      await expect(folha.getByRole('textbox', { name: 'Liberar em' })).toHaveValue('01/12/2026');
      await expect(folha.getByRole('button', { name: 'Publicar e agendar' })).toBeInViewport();
      await page.screenshot({ path: captura(`liberacao-folha-${tema.toLowerCase()}-${largura}.png`) });
      await folha.getByRole('button', { name: 'Abrir calendário' }).click();
      await page.screenshot({ path: captura(`liberacao-calendario-${tema.toLowerCase()}-${largura}.png`) });
      await page.keyboard.press('Escape');

      await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
      await expect(page.getByRole('dialog', { name: 'Pasta de 26/11 a 10/12' }).getByText('Agendado para 01/12', { exact: true })).toBeVisible();
      await page.screenshot({ path: captura(`liberacao-selo-${tema.toLowerCase()}-${largura}.png`) });
      expect(errosDaPagina).toEqual([]);
    });
  }
}
