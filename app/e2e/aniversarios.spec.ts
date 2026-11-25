import { expect, test, type Page } from '@playwright/test';

import type { AniversarianteDoAluno } from '../src/api/aniversariosTipos';
import type { PainelTreinador } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Bloco "Aniversários" do Início do treinador (`docs/planos/aniversarios.md`, T-012 de 25/11): um bloco da grade como os
 * outros, só com ALUNO_LER; nome e "Hoje", "Amanhã" ou dd/mm (nunca ano nem idade); P mostra 3, M 6 e G 10, e o "+N" abre a
 * lista inteira; sem ninguém na janela, uma linha e o bloco fica. A janela (Só hoje, 3, 7 ou 15 dias) é a opção do bloco, no
 * ⋯ da edição do Início; o `diasAniversario` antigo das preferências é migrado. Relógio em 19/10/2026. Só dados fictícios.
 */

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 24,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [], pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0,
  alunosSemRegistroTotal: 0, alunosSemAcesso: 3, alunosInativos: 3, sessoesConcluidas7Dias: 0,
};

const idDe = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ANIVERSARIANTES: AniversarianteDoAluno[] = [
  { alunoId: idDe(101), nome: 'Aluna Fictícia Um', dia: 19, mes: 10, diasAte: 0 },
  { alunoId: idDe(102), nome: 'Aluno Fictício Dois', dia: 20, mes: 10, diasAte: 1 },
  { alunoId: idDe(103), nome: 'Aluna Fictícia Três', dia: 25, mes: 10, diasAte: 6 },
];
/** 12 aniversariantes, um por dia a partir de hoje (19/10 a 30/10). */
const DOZE: AniversarianteDoAluno[] = Array.from({ length: 12 }, (_, i) => ({ alunoId: idDe(200 + i), nome: `Pessoa Fictícia ${String.fromCharCode(65 + i)}`, dia: 19 + i, mes: 10, diasAte: i }));

async function abrir(page: Page, { permissoes = PERMISSOES_TREINADOR, lista = ANIVERSARIANTES, preferencias, falhar }: { permissoes?: string[]; lista?: AniversarianteDoAluno[]; preferencias?: object; falhar?: () => boolean } = {}) {
  await fixarHoje(page);
  if (preferencias) {
    await page.addInitScript(([id, p]) => { if (!localStorage.getItem(`treinos:${id}:preferencias`)) localStorage.setItem(`treinos:${id}:preferencias`, p); }, [TREINADOR.id, JSON.stringify(preferencias)] as const);
  }
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, perfil: { id: 'p1', nome: 'Treinador', acessoTotal: false } })),
    'GET /painel': { corpo: PAINEL },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos/aniversariantes': (_p, route) => route.fulfill(falhar?.()
      ? { status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Falha.').corpo) }
      : { contentType: 'application/json', body: JSON.stringify(lista) }),
    'GET /alunos/{id}': erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO'),
  });
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  return api;
}

const pedidosDeAniversario = (pedidos: { caminho: string; busca: URLSearchParams }[]) => pedidos.filter((p) => p.caminho === '/alunos/aniversariantes');
const linhasDoBloco = (page: Page) => page.getByRole('link', { name: /, (Hoje|Amanhã|\d\d\/\d\d)$/ });
const preferenciaGravada = (page: Page) => page.evaluate((id) => JSON.parse(localStorage.getItem(`treinos:${id}:preferencias`) ?? '{}'), TREINADOR.id);

for (const largura of [390, 1280]) {
  test(`o bloco mostra nome e Hoje/Amanhã/dd/mm em ordem, sem ano nem idade, e o nome abre a ficha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page);
    await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toBeVisible();
    await expect(page.getByText('Hoje e nos próximos 7 dias · Só os meus alunos', { exact: true })).toBeVisible();
    await expect(linhasDoBloco(page)).toHaveText([/Aluna Fictícia Um\s*Hoje/, /Aluno Fictício Dois\s*Amanhã/, /Aluna Fictícia Três\s*25\/10/]);
    expect(await linhasDoBloco(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
      .toEqual(['Aluna Fictícia Um, Hoje', 'Aluno Fictício Dois, Amanhã', 'Aluna Fictícia Três, 25/10']);
    // Nunca a idade nem o ano de nascimento.
    await expect(page.getByText(/\banos?\b|\b(19|20)\d\d\b/i)).toHaveCount(0);
    // Padrão: 7 dias; o membro (sem acesso total) começa em "Meus".
    expect(pedidosDeAniversario(pedidos).at(-1)?.busca.toString()).toBe('dias=7&meus=true');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
    await expect(linhasDoBloco(page).first()).toHaveAttribute('href', `/treinador/alunos/${idDe(101)}`);
    await linhasDoBloco(page).first().click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${idDe(101)}$`));
  });

  test(`sem aniversário na janela: uma linha só e o bloco continua (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await abrir(page, { lista: [], preferencias: { painelDoInicio: { ordem: ['aniversarios'], escondidos: [], meus: {}, opcoes: { aniversarios: { dias: 15 } } } } });
    await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toBeVisible();
    const frase = page.getByText('Nenhum aniversário nos próximos 15 dias', { exact: true });
    await expect(frase).toBeVisible();
    // Uma linha, também em 390.
    const caixa = (await frase.boundingBox())!;
    const linha = await frase.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
    expect(caixa.height).toBeLessThan(linha * 1.5);
  });

  for (const [t, n, letra] of [[1, 3, 'P'], [2, 6, 'M'], [3, 10, 'G']] as const) {
    test(`${letra} mostra até ${n}; o "+${12 - n}" abre a lista inteira (${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrir(page, { lista: DOZE, preferencias: { painelDoInicio: { ordem: ['aniversarios'], escondidos: [], meus: {}, tamanhos: { aniversarios: t }, opcoes: { aniversarios: { dias: 15 } } } } });
      await expect(linhasDoBloco(page)).toHaveCount(n);
      await page.getByRole('button', { name: `+${12 - n}: ver todos os 12 aniversários` }).click();
      const folha = page.getByRole('dialog', { name: 'Aniversários' });
      await expect(folha.getByText('12 aniversários · Hoje e nos próximos 15 dias')).toBeVisible();
      await expect(folha.getByRole('link', { name: /^Pessoa Fictícia / })).toHaveCount(12);
      await folha.getByRole('link', { name: 'Pessoa Fictícia L, 30/10' }).click();
      await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${idDe(211)}$`));
    });
  }
}

test('sem ALUNO_LER o bloco não existe, nem em Adicionar blocos, e nada é consultado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos } = await abrir(page, {
    permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_LER'),
    preferencias: { painelDoInicio: { ordem: [], escondidos: ['aniversarios', 'interessados'], meus: {} } },
  });
  await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar Interessados ao Início' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar Aniversários ao Início' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Aniversários' })).toHaveCount(0);
  expect(pedidosDeAniversario(pedidos)).toEqual([]);
});

test('a consulta que falhou diz "Não carregou" no bloco e o Atualizar tenta de novo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let falhar = true;
  const { pedidos } = await abrir(page, { falhar: () => falhar });
  const bloco = page.getByRole('heading', { name: 'Aniversários', level: 2 });
  await expect(bloco).toBeVisible();
  await expect(page.getByText('Não carregou.', { exact: true })).toBeVisible();
  falhar = false;
  const antes = pedidosDeAniversario(pedidos).length;
  await page.getByRole('button', { name: 'Atualizar Aniversários' }).last().click();
  await expect.poll(() => pedidosDeAniversario(pedidos).length).toBeGreaterThan(antes);
  await expect(linhasDoBloco(page)).toHaveCount(3);
});

test('migração: o diasAniversario salvo vira a opção do bloco (3 dias na consulta e na lista)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos } = await abrir(page, { preferencias: { diasAniversario: 3 } });
  await expect(page.getByText('Hoje e nos próximos 3 dias · Só os meus alunos', { exact: true })).toBeVisible();
  expect(pedidosDeAniversario(pedidos).at(-1)?.busca.get('dias')).toBe('3');
  // A resposta traz também quem faz em 6 dias (fora da janela): a regra do app não o mostra.
  await expect(page.getByRole('link', { name: /^Aluna Fictícia Três/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Aluno Fictício Dois, Amanhã' })).toBeVisible();
});

test('layout antigo salvo, sem o bloco: Aniversários entra por último, visível', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, { preferencias: { painelDoInicio: { ordem: ['alunos', 'interessados'], escondidos: [], meus: {} } } });
  await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toBeVisible();
  expect((await page.getByRole('heading', { level: 2 }).allTextContents()).at(-1)).toBe('Aniversários');
});

for (const largura of [390, 1280]) {
  test(`o Início espera a preferência antes de pedir: nenhum pedido sai com a janela padrão (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos } = await abrir(page, { preferencias: { painelDoInicio: { ordem: [], escondidos: [], meus: {}, opcoes: { aniversarios: { dias: 15 } } } } });
    await expect(page.getByText('Hoje e nos próximos 15 dias · Só os meus alunos', { exact: true })).toBeVisible();
    await expect(page.getByText(/Hoje e nos próximos 7 dias/)).toHaveCount(0);
    const janelas = pedidosDeAniversario(pedidos).map((p) => p.busca.get('dias'));
    expect(janelas.length).toBeGreaterThan(0);
    expect(new Set(janelas)).toEqual(new Set(['15']));
  });

  test(`"Mostrar aniversários de" no ⋯ do bloco muda a lista na hora e fica salvo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos } = await abrir(page);
    await expect(linhasDoBloco(page)).toHaveCount(3);
    await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
    await page.getByRole('button', { name: 'Mais ações de Aniversários' }).click();
    const menu = page.getByRole('menu', { name: 'Mais ações de Aniversários' });
    await expect(menu.getByRole('group', { name: 'Mostrar aniversários de' })).toBeVisible();
    await expect(menu.getByRole('menuitemradio', { name: '7 dias' })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: 'Só hoje' }).click();
    await expect.poll(() => pedidosDeAniversario(pedidos).at(-1)?.busca.get('dias')).toBe('0');
    await expect(page.getByText('1 alteração', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar o Início' }).click();
    await expect(linhasDoBloco(page)).toHaveCount(1);
    await expect(page.getByText('Hoje · Só os meus alunos', { exact: true })).toBeVisible();
    expect((await preferenciaGravada(page)).painelDoInicio.opcoes).toEqual({ aniversarios: { dias: 0 } });
    expect('diasAniversario' in (await preferenciaGravada(page))).toBe(false);
  });
}
