import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PastaDoAluno, Sessao, VersaoDetalhe } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, simularApi } from './api-falsa';

/**
 * Dieta do aluno (25/11, T-218): "Fibra —" quando falta (itens, total da opção e Total do dia, com "■ Fibra" na legenda);
 * Medicação e ergogênicos e Suplementação agrupadas pelo horário que o treinador escreveu (ordem do dia, "Sem horário
 * definido" por último, relógio no subtítulo), dose na pílula da quantidade com o espaço entre número e unidade, os dois
 * cartões lado a lado na tela larga e empilhados no celular, cartão vazio some; e o título do plano (nome de trabalho do
 * treinador) fora da Dieta e do Treino. Só dados fictícios. Com `CAPTURAS=<pasta>`, guarda as telas.
 */
const item = (uid: string, nome: string, fibra: number | null): ItemDieta => ({
  uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: 100, proteina: 5, carboidrato: 10, gordura: 2, fibra, manual: true,
});

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('pao', 'Pão fictício', 2.4), item('ovo', 'Ovo fictício', null)] }] },
    { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [{ uid: 'b', rotulo: 'A', itens: [item('frango', 'Frango fictício', null)] }] },
  ],
  // "Pós-treino" antes de "Antes de dormir": a ordem é a da primeira aparição, não a alfabética.
  ergogenicos: [
    { uid: 'e1', nome: 'Medicação fictícia A', principioAtivo: '', concentracao: '', dose: '5mg', horario: 'Pós-treino', observacao: 'Com água', prescricao: '' },
    { uid: 'e2', nome: 'Medicação fictícia B', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '' },
    { uid: 'e3', nome: 'Medicação fictícia C', principioAtivo: '', concentracao: '', dose: '10.000UI', horario: 'Antes de dormir', observacao: '', prescricao: '' },
    { uid: 'e4', nome: 'Medicação fictícia D', principioAtivo: '', concentracao: '', dose: '2caps', horario: 'pós-treino', observacao: '', prescricao: '' },
  ],
  // Só horas: em ordem cronológica ("8:00" junto de "08:00").
  suplementacao: [
    { uid: 's1', nome: 'Creatina fictícia', dose: '1,2g', horario: '22:00', observacao: '', link: 'https://exemplo.com/creatina', cupom: 'CUPOM10' },
    { uid: 's2', nome: 'Whey fictício', dose: '1 scoop (30g)', horario: '08:00', observacao: 'Depois do treino', link: null },
    { uid: 's3', nome: 'Ômega fictício', dose: '2 cápsulas', horario: '8:00', observacao: '', link: null },
  ],
};

const versao = (conteudo: ConteudoDieta): VersaoDetalhe<ConteudoDieta> => ({
  id: 'd0000000-0000-4000-8000-0000000002a1', planoId: 'p0000000-0000-4000-8000-0000000002a2', numero: 1, titulo: 'Dieta importada (rascunho)',
  inicio: '2026-11-01', fim: '2026-11-30', publicadoEm: '2026-11-01T12:00:00Z', conteudo,
});

async function tema(page: Page, escuro: boolean) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, escuro ? 'ESCURO' : 'CLARO'] as const);
}

async function abrirDieta(page: Page, conteudo: ConteudoDieta) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: versao(conteudo) } },
    'GET /aluno/pesos': { corpo: [] },
  });
  await page.goto('/aluno/dieta');
  await expect(page.getByText('Total do dia', { exact: true })).toBeVisible();
  return api;
}

const cartao = (page: Page, titulo: string) => page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) });
const subtitulos = (c: Locator) => c.getByRole('heading', { level: 3 }).allTextContents();

for (const largura of [390, 1280, 1920]) {
  for (const escuro of [true, false]) {
    const sufixo = `${largura}px, ${escuro ? 'escuro' : 'claro'}`;
    test(`dieta do aluno: fibra, complementos por horário e sem o título do plano (${sufixo})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await tema(page, escuro);
      const { naoTratadas, errosDaPagina } = await abrirDieta(page, CONTEUDO);

      // Fibra: "Fibra X g" e "Fibra —" nos itens, no total de cada refeição e no Total do dia, com "■ Fibra" na legenda.
      await expect(page.getByText('Fibra 2,4 g', { exact: true })).toBeVisible();
      await expect(page.getByText('Fibra —', { exact: true })).toHaveCount(3); // ovo, frango e o total do almoço
      await expect(page.getByText('Fibra 2,4 g (parcial)', { exact: true })).toBeVisible(); // total do café
      await expect(page.getByText('2,4 g de fibra (parcial)', { exact: true })).toBeVisible();
      await expect(page.getByText('G = gordura', { exact: true }).locator('xpath=../..').getByText('Fibra', { exact: true })).toBeVisible();

      // Agrupamento: texto na ordem da primeira aparição e "Sem horário definido" no fim; horas em ordem cronológica.
      const medicacao = cartao(page, 'Medicação e ergogênicos');
      const suplementacao = cartao(page, 'Suplementação');
      expect(await subtitulos(medicacao)).toEqual(['Pós-treino', 'Antes de dormir', 'Sem horário definido']);
      expect(await subtitulos(suplementacao)).toEqual(['08:00', '22:00']);
      // O relógio ao lado de cada subtítulo, e a pílula (ícone) no título de cada cartão.
      await expect(medicacao.getByRole('heading', { name: 'Pós-treino', exact: true }).locator('xpath=..').locator('svg')).toHaveCount(1);
      await expect(medicacao.getByRole('heading', { name: 'Medicação e ergogênicos', exact: true }).locator('xpath=..').locator('svg')).toHaveCount(1);

      // Dose na pílula, formatada só para mostrar; sem dose, "—". Os rótulos "Dose:" e "Horário:" saíram.
      for (const dose of ['5 mg', '2 caps', '10.000 UI', 'não informada']) await expect(medicacao.getByLabel(`Dose: ${dose}`, { exact: true })).toBeVisible();
      for (const dose of ['1,2 g', '1 scoop (30 g)', '2 cápsulas']) await expect(suplementacao.getByLabel(`Dose: ${dose}`, { exact: true })).toBeVisible();
      await expect(medicacao.getByLabel('Dose: não informada', { exact: true }).getByText('—', { exact: true })).toBeVisible();
      // (O "Horário: 07:00" da refeição continua: é o cabeçalho dela.)
      await expect(page.getByText(/^(Dose: |Horário: (08:00|8:00|22:00|Pós-treino|Antes de dormir))/)).toHaveCount(0);
      await expect(medicacao.getByText('Com água', { exact: true })).toBeVisible();
      await expect(suplementacao.getByText('Depois do treino', { exact: true })).toBeVisible();
      // Cupom e link como antes.
      await expect(suplementacao.getByRole('button', { name: 'Copiar cupom de Creatina fictícia', exact: true })).toBeVisible();
      await expect(suplementacao.getByRole('button', { name: 'Ver produto', exact: true })).toBeVisible();

      // Lado a lado na tela larga (medido), empilhados no celular.
      const a = (await medicacao.boundingBox())!;
      const b = (await suplementacao.boundingBox())!;
      if (largura === 1920) expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      if (largura === 390) expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);

      // O nome técnico do plano não aparece.
      await expect(page.getByText('Dieta importada (rascunho)')).toHaveCount(0);

      const pasta = process.env.CAPTURAS;
      if (pasta) {
        await page.screenshot({ path: `${pasta}/dieta-${largura}-${escuro ? 'escuro' : 'claro'}.png`, fullPage: true });
        await medicacao.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${pasta}/complementos-${largura}-${escuro ? 'escuro' : 'claro'}.png` });
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

const SEM_FIBRA: ConteudoDieta = {
  ...CONTEUDO, ergogenicos: null, suplementacao: [],
  refeicoes: [{ uid: 'almoco', nome: 'Almoço', horario: null, observacao: null, opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('frango', 'Frango fictício', null)] }] }],
};

for (const largura of [390, 1920]) {
  test(`dieta do aluno sem fibra nenhuma e sem complementos: "Fibra —" no Total do dia e os dois cartões somem (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirDieta(page, SEM_FIBRA);
    const total = cartao(page, 'Total do dia');
    await expect(total.getByText('Fibra —', { exact: true })).toBeVisible();
    await expect(total.getByText('Fibra', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Medicação e ergogênicos', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Suplementação', exact: true })).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`dieta do aluno com uma lista só: o cartão dela, na largura toda, e o outro some (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirDieta(page, { ...SEM_FIBRA, ergogenicos: [], suplementacao: CONTEUDO.suplementacao });
    await expect(page.getByRole('heading', { name: 'Suplementação', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Medicação e ergogênicos', exact: true })).toHaveCount(0);
    // Sozinho, ocupa a grade inteira (não meia grade): o cartão mede o que mede a grade (avó dele: grade > célula > cartão).
    const [sup, grade] = await cartao(page, 'Suplementação').evaluate((el) => [el.getBoundingClientRect().width, el.parentElement!.parentElement!.getBoundingClientRect().width]);
    expect(sup).toBeGreaterThan(grade! - 2);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const PASTAS: PastaDoAluno[] = ['1', '2'].map((n) => ({
  id: `f0000000-0000-4000-8000-00000000000${n}`, titulo: `Plano fictício ${n}`, inicio: '2026-10-05', fim: '2026-11-01', concluidaEm: null,
  atual: false, temTreino: true, temDieta: false,
}));

for (const largura of [390, 1280]) {
  test(`treino do aluno sem o título do plano sob o cabeçalho, só o período (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const sessoes: Sessao[] = [sessaoFalsa('sa', 'Peito fictício', 1, 2)];
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, sessoes)),
      // Várias pastas e nenhuma "atual": o seletor cai no rótulo de quem chama, que antes levava o título do treino.
      'GET /aluno/pastas': { corpo: PASTAS },
    });
    await page.goto('/aluno/treino');
    await expect(page.getByText('Divisões da semana', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Plano em uso: / })).toBeVisible();
    await expect(page.getByText(/Treino de outubro/)).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
