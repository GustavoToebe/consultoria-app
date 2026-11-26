import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ItemDieta, PlanoDetalhe, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Fibra (18/11, V089; plano `docs/planos/fibra-do-alimento.md`): campo "Fibras (g)" opcional no alimento (vazio = nulo,
 * fora da faixa trava o Salvar, 422 da API no campo), "Fibra X g" e "Fibra —" na Biblioteca e no item da dieta, totais com
 * "(parcial)" quando algum item não tem fibra, também na dieta do aluno ("Fibra —" no aluno desde 25/11). A fibra não entra na kcal.
 * Macros do alimento e cor da fibra (19/11): a fibra ganhou a marca verde-lima (só a marca; o texto segue neutro) e o
 * Editar alimento, a grade de colunas iguais (5 no modal largo, kcal no título e 4 ou 2 + 2 no estreito). Só dados
 * fictícios. Com `CAPTURAS=<pasta>`, guarda as telas.
 */
/** A marca da fibra (`PALETA_DA_FIBRA`) como o navegador a pinta. */
const COR_DA_FIBRA = { claro: 'rgb(106, 138, 0)', escuro: 'rgb(184, 227, 74)' } as const;
/** Quantas marcas da fibra (quadradinho de 8 px na cor dela) há dentro do elemento. */
const marcasDaFibra = (raiz: ReturnType<Page['locator']>, escuro: boolean) =>
  raiz.evaluate((no, cor) => [...no.querySelectorAll<HTMLElement>('div')].filter((d) => getComputedStyle(d).backgroundColor === cor && d.getBoundingClientRect().width === 8).length,
    COR_DA_FIBRA[escuro ? 'escuro' : 'claro']);
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000f1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000f2';

function alimento(id: string, nome: string, kcal: number, p: number, c: number, g: number, fibra: number | null): Alimento {
  return {
    id, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g, fibra, gramasPorUnidade: null,
    fonte: null, origem: 'PROPRIO', fatorCorrecao: null, fatorCoccao: null, grupo: null,
  };
}
const ARROZ = alimento('al-arroz', 'Arroz fictício', 128, 2.5, 28.1, 0.2, 1.6);
const FRANGO = alimento('al-frango', 'Frango fictício', 159, 32, 0, 2.5, null);

const daBiblioteca = (uid: string, a: Alimento): ItemDieta => ({
  uid, alimentoId: a.id, nome: a.nome, quantidade: 100, unidade: 'g', kcal: a.kcal, proteina: a.proteina, carboidrato: a.carboidrato,
  gordura: a.gordura, fibra: a.fibra ?? null, manual: false,
});
const manual: ItemDieta = { uid: 'salada', alimentoId: null, nome: 'Salada fictícia', quantidade: 80, unidade: 'g', kcal: 15, proteina: 1, carboidrato: 3, gordura: 0, fibra: null, manual: true };

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null, variacoes: [],
  refeicoes: [{
    uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null,
    opcoes: [{ uid: 'a', rotulo: 'A', itens: [daBiblioteca('arroz', ARROZ), daBiblioteca('frango', FRANGO), manual] }],
  }],
};

const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000f3', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

const DIETA_DO_ALUNO: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-0000000000f4', planoId: PLANO_ID, numero: 1, titulo: 'Dieta fictícia',
  inicio: '2026-11-01', fim: '2026-11-30', publicadoEm: '2026-11-01T12:00:00Z', conteudo: CONTEUDO,
};

async function tema(page: Page, usuarioId: string, escuro: boolean) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [usuarioId, escuro ? 'ESCURO' : 'CLARO'] as const);
}

/** Captura (só com `CAPTURAS`): a tela alta, com o alvo rolado para o meio. */
async function capturar(page: Page, nome: string, alvo?: ReturnType<Page['getByText']>) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1400 });
  if (alvo) await alvo.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

/** Biblioteca › Alimentos com o arroz (com fibra) e o frango (sem), para abrir o Editar alimento. */
async function abrirBiblioteca(page: Page) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [ARROZ, FRANGO] },
    'GET /catalogo/alimentos/grupos': { corpo: [] },
  });
  await page.goto('/treinador/biblioteca?aba=alimentos');
  await expect(page.getByText('Fibra 1,6 g', { exact: true })).toBeVisible();
  return api;
}

// Macros do alimento e cor da fibra (19/11): modal entre 480 e 640 px (folha de baixo numa janela de 560), 4 colunas e a kcal no título.
test('macros do alimento e cor da fibra (19/11): em 560 px os quatro numa linha e a kcal no título', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 1000 });
  await tema(page, TREINADOR.id, false);
  const { naoTratadas, errosDaPagina } = await abrirBiblioteca(page);
  await page.getByRole('button', { name: `Editar ${ARROZ.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar alimento' });
  const caixas = await Promise.all(['Proteína (g)', 'Carboidrato (g)', 'Gordura (g)', 'Fibras (g)'].map(async (r) => (await folha.getByLabel(r, { exact: true }).boundingBox())!));
  for (const b of caixas) expect(Math.abs(b.y - caixas[0].y)).toBeLessThanOrEqual(1);
  const k = (await folha.getByLabel('Kcal (calculada): 124,2', { exact: true }).boundingBox())!;
  expect(k.y + k.height).toBeLessThanOrEqual(caixas[0].y);
  await capturar(page, 'editar-alimento-macros-560-claro', folha.getByText('Porção e macronutrientes'));
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}-${escuro ? 'escuro' : 'claro'}`;

  test(`fibra (18/11): biblioteca mostra a fibra, valida a faixa, manda nula quando vazia e mostra o 422 no campo (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, TREINADOR.id, escuro);
    const { naoTratadas, pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [ARROZ, FRANGO] },
      'GET /catalogo/alimentos/grupos': { corpo: [] },
      'POST /alimentos': erroApi(422, 'Alimento inválido.', 'ALIMENTO_INVALIDO', [{ field: 'fibra', message: 'Fibra fora da faixa aceita.' }]),
      [`PUT /alimentos/${FRANGO.id}`]: { corpo: FRANGO },
    });
    await page.goto('/treinador/biblioteca?aba=alimentos');
    // Com fibra, "Fibra 1,6 g"; sem, "Fibra —" (nunca zero).
    await expect(page.getByText('Fibra 1,6 g', { exact: true })).toBeVisible();
    await expect(page.getByText('Fibra —', { exact: true })).toBeVisible();
    await capturar(page, `biblioteca-lista-${sufixo}`);

    // Novo alimento: fora da faixa o campo mostra o erro e o Salvar trava com o motivo.
    await page.getByRole('button', { name: 'Novo alimento' }).click();
    const folha = page.getByRole('dialog', { name: 'Novo alimento' });
    await folha.getByLabel('Nome', { exact: true }).fill('Lentilha fictícia');
    const fibra = folha.getByLabel('Fibras (g)', { exact: true });
    await fibra.fill('100000');
    await expect(folha.getByText('Use de 0 a 99.999, com até 2 casas.')).toBeVisible();
    await expect(folha.getByText('Confira as fibras: de 0 a 99.999 g.')).toBeVisible();
    await capturar(page, `biblioteca-fibra-fora-da-faixa-${sufixo}`, folha.getByText('Porção e macronutrientes'));

    // Na faixa, vai no corpo; o 422 da API no campo `fibra` aparece no próprio campo.
    await fibra.fill('7,9');
    await expect(folha.getByText('Use de 0 a 99.999, com até 2 casas.')).toHaveCount(0);
    await folha.getByRole('button', { name: 'Salvar' }).click();
    await expect(folha.getByText('Fibra fora da faixa aceita.')).toBeVisible();
    const criar = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/alimentos');
    expect(criar?.corpo).toMatchObject({ nome: 'Lentilha fictícia', fibra: 7.9, kcal: null });
    await folha.getByRole('button', { name: 'Cancelar' }).click();

    // Editar o alimento sem fibra: o campo vem vazio e o corpo leva `fibra: null` (a chave sempre vai).
    await page.getByRole('button', { name: `Editar ${FRANGO.nome}` }).click();
    const edicao = page.getByRole('dialog', { name: 'Editar alimento' });
    await expect(edicao.getByLabel('Fibras (g)', { exact: true })).toHaveValue('');
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    await expect(edicao).toHaveCount(0);
    const alterar = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/alimentos/${FRANGO.id}`);
    expect(alterar?.corpo).toHaveProperty('fibra', null);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  // Macros do alimento e cor da fibra (19/11).
  test(`macros do alimento e cor da fibra (19/11): grade do Editar alimento, kcal só de leitura e a nota da fibra (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, TREINADOR.id, escuro);
    const { naoTratadas, errosDaPagina } = await abrirBiblioteca(page);
    await page.getByRole('button', { name: `Editar ${ARROZ.nome}` }).click();
    const folha = page.getByRole('dialog', { name: 'Editar alimento' });
    const caixa = async (rotulo: string) => (await folha.getByLabel(rotulo, { exact: true }).boundingBox())!;
    const [p, c, g, f] = await Promise.all(['Proteína (g)', 'Carboidrato (g)', 'Gordura (g)', 'Fibras (g)'].map(caixa));
    // Uma kcal só, com o mesmo nome acessível de antes; a fibra tem a nota fora do campo, ligada a ele.
    const kcal = folha.getByLabel('Kcal (calculada): 124,2', { exact: true });
    await expect(kcal).toHaveCount(1);
    await expect(folha.getByLabel('Fibras (g)', { exact: true })).toHaveAccessibleDescription('Fibras são opcionais e não entram na kcal.');
    await expect(folha.getByText('Opcional. Não entra na kcal.')).toHaveCount(0);
    expect(await marcasDaFibra(folha, escuro)).toBeGreaterThanOrEqual(1);
    const k = (await kcal.boundingBox())!;
    if (largura >= 1280) {
      // Modal largo: kcal | P | C | G | F na mesma linha, colunas iguais, e o resto bate nas mesmas bordas.
      for (const b of [c, g, f]) expect(Math.abs(b.y - p.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(k.y + k.height - (p.y + p.height))).toBeLessThanOrEqual(1);
      expect(Math.abs((c.x - p.x) - (g.x - c.x))).toBeLessThanOrEqual(1);
      expect(Math.abs((p.x - k.x) - (c.x - p.x))).toBeLessThanOrEqual(1);
      expect(Math.abs((await caixa('Quantidade-base')).x - k.x)).toBeLessThanOrEqual(1);
      expect(Math.abs((await caixa('Gramas por unidade (opcional)')).x - g.x)).toBeLessThanOrEqual(1);
      expect(Math.abs((await caixa('Fonte dos valores (opcional)')).x - g.x)).toBeLessThanOrEqual(1);
      // Lista de compras (24/11): FC e FCc um por linha, na largura toda do cartão (a mesma borda da Quantidade-base).
      const fc = (await folha.getByRole('button', { name: /^Descarte e limpeza antes do preparo \(FC\)/ }).boundingBox())!;
      const fcc = (await folha.getByRole('button', { name: /^Estado na dieta e cocção \(FCc\)/ }).boundingBox())!;
      expect(Math.abs(fc.x - fcc.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(fc.width - fcc.width)).toBeLessThanOrEqual(1);
      expect(fcc.y).toBeGreaterThanOrEqual(fc.y + fc.height);
      expect(Math.abs(fc.height - fcc.height)).toBeLessThanOrEqual(1);
      expect(fc.x + fc.width).toBeGreaterThan(f.x + f.width - 2);
      const painel = (await folha.boundingBox())!;
      expect(painel.width).toBe(800);
    } else {
      // Folha estreita: kcal na linha do título e os quatro em 2 + 2, nas mesmas colunas.
      expect(k.y + k.height).toBeLessThanOrEqual(p.y);
      expect(Math.abs(c.y - p.y)).toBeLessThanOrEqual(1);
      expect(g.y).toBeGreaterThan(p.y + p.height);
      expect(Math.abs(f.y - g.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.x - p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(f.x - c.x)).toBeLessThanOrEqual(1);
    }
    await capturar(page, `editar-alimento-macros-${sufixo}`, folha.getByText('Porção e macronutrientes'));
    await capturar(page, `editar-alimento-topo-${sufixo}`, folha.getByText('Identificação', { exact: true }));
    await capturar(page, `editar-alimento-compras-${sufixo}`, folha.getByText('Lista de compras', { exact: true }));
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`fibra (18/11): editor da dieta mostra a fibra do item, o campo do manual e os totais "(parcial)" (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, TREINADOR.id, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [ARROZ, FRANGO] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    if (largura >= 1280) await page.getByRole('button', { name: /^Refeição 1 de 1: 12:00 · Almoço/ }).click();
    else await expect(page.getByRole('button', { name: /12:00 · Almoço, aberto/ })).toBeVisible();

    // Item da biblioteca: a fibra calculada nos valores; sem ela, "Fibra —". O manual tem o campo, vazio. No PC a opção é
    // tabela (20/11): a fibra é o número da coluna "Fibras (g)", sem a unidade, e o "parcial" embaixo dele no total.
    const tabela = largura >= 1280;
    if (tabela) await expect(page.getByText('1,6', { exact: true }).first()).toBeVisible();
    else {
      await expect(page.getByText('Fibra 1,6 g', { exact: true })).toBeVisible();
      await expect(page.getByText('Fibra —', { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByLabel('Fibras (g)', { exact: true })).toHaveValue('');
    // Total da opção: parcial (o frango e a salada não têm fibra), com a frase para o leitor.
    const totalA = page.getByRole('group', { name: 'Total da opção A' });
    if (tabela) {
      await expect(totalA.getByText('1,6', { exact: true })).toBeVisible();
      await expect(totalA.getByText('parcial', { exact: true })).toBeVisible();
    } else await expect(totalA.getByText('Fibra 1,6 g (parcial)', { exact: true })).toBeVisible();
    await expect(totalA.getByText(/fibra 1,6 g, parcial$/)).toHaveCount(1);
    // Total do dia: a fibra depois dos macros, com o texto e a ajuda uma vez só; a kcal não muda (128 + 159 + 15).
    await expect(page.getByRole('listitem', { name: 'Fibra: 1,6 g, parcial' })).toBeVisible();
    await expect(page.getByText('Fibra parcial: há itens sem fibra informada.')).toHaveCount(1);
    await expect(page.getByRole('listitem', { name: 'Calorias: 302 kcal' })).toBeVisible();
    // Macros do alimento e cor da fibra (19/11): a fibra tem a marca dela na linha, no total da opção e no total do dia.
    expect(await marcasDaFibra(page.locator('body'), escuro)).toBeGreaterThanOrEqual(3);
    await capturar(page, `editor-total-do-dia-${sufixo}`, page.getByText('Total do dia', { exact: true }));
    await capturar(page, `editor-itens-${sufixo}`, page.getByText('Arroz fictício', { exact: true }));

    // Digitar a fibra da salada soma no total, que segue parcial (o frango continua sem).
    await page.getByLabel('Fibras (g)', { exact: true }).fill('1,4');
    await expect(totalA.getByText(tabela ? '3,0' : 'Fibra 3,0 g (parcial)', { exact: true })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`fibra (18/11; "Fibra —" no aluno desde 25/11): dieta do aluno com a fibra em cada item e o total "(parcial)" (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, ALUNO.id, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: DIETA_DO_ALUNO } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByText('Fibra 1,6 g', { exact: true })).toBeVisible();
    // Gustavo, 25/11: o item sem fibra diz "Fibra —" também no aluno (o frango e a salada).
    await expect(page.getByText('Fibra —', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('group', { name: 'Total' }).getByText('Fibra 1,6 g (parcial)', { exact: true })).toBeVisible();
    await expect(page.getByText('1,6 g de fibra (parcial)', { exact: true })).toBeVisible();
    await expect(page.getByText('Há itens sem fibra informada.', { exact: true })).toBeVisible();
    // A fibra nula não deixa o total "incompleto" (os macros estão todos lá).
    await expect(page.getByText('Há itens sem valor nutricional informado; o total não os soma.')).toHaveCount(0);
    // Legenda (24/11): "■ Fibra" depois do "G = gordura", porque há item com fibra (sem nenhum, ela some com a fibra).
    const legenda = page.getByText('G = gordura', { exact: true }).locator('xpath=../..');
    await expect(legenda.getByText('Fibra', { exact: true })).toBeVisible();
    // Macros do alimento e cor da fibra (19/11): a marca da fibra no item, no total da opção e no total do dia.
    expect(await marcasDaFibra(page.locator('body'), escuro)).toBeGreaterThanOrEqual(3);
    await capturar(page, `aluno-dieta-${sufixo}`, page.getByText('Total do dia', { exact: true }));
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
