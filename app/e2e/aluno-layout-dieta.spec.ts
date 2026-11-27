import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, VersaoDetalhe } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { colunasEstaveis, conferirAlturasDeColunas, maiorVazioDentroDosCartoes } from './alturasDeColunas';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';

/**
 * Dieta do aluno na web (27/11, contêiner do treinador: começa ao lado do menu e preenche a área, sem o teto de 1312): com
 * espaço na área (972 px), as refeições com o nome no título e "Horário: 07:00" embaixo (A12) e, à direita, a coluna de
 * apoio (380 na faixa normal, 420 na larga, 440 na ultralarga) com Total do dia, Água de hoje, Suplementação, Medicação e
 * ergogênicos, Lista de compras, Baixar PDF e Observações. Refeições numa coluna até a faixa `normal`; duas na `larga` e na
 * `ultralarga`, empilhadas pela altura medida (27/11: as duas primeiras abrem as colunas, o topo de cada uma nunca acima do da
 * anterior, nenhum cartão esticado com vazio por dentro e o fim das duas colunas a menos de 80 px). O total da refeição ganha respiro
 * (kcal em destaque, P · C · G · Fibra numa linha menor embaixo) com os mesmos textos. No celular nada muda. Só dados
 * fictícios. Com `E2E_CAPTURAS=<pasta>` (ou `CAPTURAS`), guarda as telas (nunca no git).
 */
const item = (uid: string, nome: string, fibra: number | null): ItemDieta => ({
  uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: 100, proteina: 5, carboidrato: 10, gordura: 2, fibra, manual: true,
});
const refeicao = (uid: string, nome: string, horario: string, fibra: number | null = 1) => ({
  uid, nome, horario, observacao: null, opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: [item(`${uid}1`, `Alimento fictício ${uid} 1`, fibra), item(`${uid}2`, `Alimento fictício ${uid} 2`, fibra)] }],
});
const NOMES = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'];

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: '2026-10-05', profissional: 'Profissional fictícia', aguaLitros: 3, variacoes: [],
  orientacoes: [{ titulo: 'Orientação fictícia', texto: 'Texto fictício da orientação.' }],
  observacoes: 'Observação fictícia da dieta.',
  refeicoes: [
    { ...refeicao('cafe', NOMES[0], '07:00'), opcoes: [{ uid: 'cafe-a', rotulo: 'A', itens: [item('pao', 'Pão fictício', 2.4), item('ovo', 'Ovo fictício', null)] }] },
    refeicao('lm', NOMES[1], '10:00'),
    { ...refeicao('alm', NOMES[2], '12:30'), opcoes: [...refeicao('alm', NOMES[2], '12:30').opcoes, { uid: 'alm-b', rotulo: 'B', itens: [item('alm3', 'Alimento fictício B', 1)] }] },
    refeicao('lt', NOMES[3], '16:00'),
    refeicao('jan', NOMES[4], '20:00'),
  ],
  ergogenicos: [
    { uid: 'e1', nome: 'Item fictício A', principioAtivo: '', concentracao: '', dose: '5mg', horario: 'Pós-treino', observacao: '', prescricao: '' },
    { uid: 'e2', nome: 'Item fictício B', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '' },
  ],
  suplementacao: [
    { uid: 's1', nome: 'Suplemento fictício A', dose: '3g', horario: '08:00', observacao: '', link: null },
    { uid: 's2', nome: 'Suplemento fictício B', dose: '1 scoop (30g)', horario: '16:00', observacao: '', link: null },
  ],
};

const versao = (conteudo: ConteudoDieta): VersaoDetalhe<ConteudoDieta> => ({
  id: 'd0000000-0000-4000-8000-0000000003a1', planoId: 'p0000000-0000-4000-8000-0000000003a2', numero: 1, titulo: 'Dieta fictícia',
  inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z', conteudo,
});

type Janela = { largura: number; altura?: number; recolhido?: boolean };

async function abrir(page: Page, janela: Janela, escuro: boolean, extra: RespostasApi = {}, conteudo = CONTEUDO) {
  await page.setViewportSize({ width: janela.largura, height: janela.altura ?? 1080 });
  await page.addInitScript(([id, t, recolhido]) => {
    try {
      if (recolhido) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, escuro ? 'ESCURO' : 'CLARO', !!janela.recolhido] as const);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: versao(conteudo) } },
    'GET /aluno/pesos': { corpo: [] },
    ...extra,
  });
  await page.goto('/aluno/dieta');
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, exact: true });
/** O nome da refeição é o título do cabeçalho em qualquer largura (A12); o horário vem embaixo. */
const nomeDaRefeicao = (page: Page, nome: string) => page.getByText(nome, { exact: true });
const refeicoes = (page: Page) => NOMES.map((n) => nomeDaRefeicao(page, n));
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Resumo da dieta' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const cartao = (page: Page, nome: string) => page.getByTestId('cartao').filter({ has: nomeDaRefeicao(page, nome) });

// A matriz das orientações de 26/11 (0.5): escuro e claro em 390, 1280, 1920 e 3440; as outras larguras no escuro. `apoio`
// e `duas`: a faixa da área com o menu aberto (1280 e 1536 normal, 1920 e 2560 larga, 3440 ultralarga).
const MATRIZ: (Janela & { temas: boolean[]; lado: boolean; apoio?: number; duas?: boolean })[] = [
  { largura: 390, altura: 844, temas: [true, false], lado: false },
  { largura: 1024, altura: 768, temas: [true], lado: false },
  { largura: 1024, altura: 768, recolhido: true, temas: [true], lado: false },
  { largura: 1280, altura: 720, temas: [true, false], lado: true, apoio: 380, duas: false },
  { largura: 1536, altura: 864, temas: [true], lado: true, apoio: 380, duas: false },
  { largura: 1920, temas: [true, false], lado: true, apoio: 420, duas: true },
  { largura: 2560, altura: 1440, temas: [true], lado: true, apoio: 420, duas: true },
  { largura: 3440, altura: 1440, temas: [true, false], lado: true, apoio: 440, duas: true },
];

for (const janela of MATRIZ) {
  for (const escuro of janela.temas) {
    const { largura } = janela;
    const nome = `${largura}${janela.recolhido ? '-recolhido' : ''}-${escuro ? 'escuro' : 'claro'}`;
    test(`dieta do aluno: arranjo da web (${nome})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, janela, escuro);
      await expect(page.getByText('Total do dia', { exact: true })).toBeVisible();
      await expect(titulo(page, 'Suplementação')).toBeVisible();
      // O primeiro desenho é sempre o do celular (a área ainda não foi medida): espera o arranjo final antes de medir.
      if (janela.lado) {
        // Caixa nula = o cartão está sendo remontado na troca de arranjo: conta como "ainda não".
        await expect.poll(async () => {
          const [t, r] = await Promise.all([titulo(page, 'Total do dia').boundingBox(), refeicoes(page)[0].boundingBox()]);
          return t && r ? t.x - r.x : 0;
        }).toBeGreaterThan(400);
      }
      if (janela.lado) {
        // O apoio começa na mesma linha das refeições (grudado ou não): espera a medida dele assentar antes da captura.
        await expect.poll(async () => {
          const [t, r] = await Promise.all([apoio(page).boundingBox(), cartao(page, NOMES[0]).boundingBox()]);
          return t && r ? Math.abs(t.y - r.y) : 99;
        }).toBeLessThan(2);
      }
      // Duas colunas medidas: espera o arranjo assentar (as medidas chegam em mais de um quadro) antes da captura.
      const colunas = janela.duas ? await conferirAlturasDeColunas(page, { prefixo: 'dieta-coluna', colunasEsperadas: 2 }) : null;
      const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
      if (pasta) await page.screenshot({ path: `${pasta}/dieta-${nome}.png`, fullPage: true });

      const rs = await Promise.all(refeicoes(page).map(caixa));
      if (janela.duas && colunas) {
        test.info().annotations.push({ type: 'fim das colunas', description: colunas.map((c) => `${c.pecas.join('+')}: ${Math.round(c.fim)}`).join(' | ') });
        // As duas primeiras abrem as colunas, lado a lado; as outras na ordem do dia (o topo nunca acima do da anterior).
        expect(Math.abs(rs[1].y - rs[0].y)).toBeLessThan(2);
        expect(rs[1].x).toBeGreaterThan(rs[0].x + 300);
        for (let i = 2; i < rs.length; i++) {
          expect(rs[i].y).toBeGreaterThanOrEqual(rs[i - 1].y - 1);
          expect([rs[0].x, rs[1].x].some((x) => Math.abs(rs[i].x - x) < 2)).toBe(true);
        }
        // Nenhum cartão esticado para acompanhar o vizinho (o "Lanche da tarde" tinha ~110 px vazios por dentro).
        const vazio = await maiorVazioDentroDosCartoes(page, 'dieta-coluna');
        expect(vazio.vazio, `vazio dentro de "${vazio.cartao}"`).toBeLessThan(48);
      } else {
        // Refeições numa coluna só (mesma borda), na ordem do dia.
        for (const r of rs) expect(Math.abs(r.x - rs[0].x)).toBeLessThan(2);
        expect(rs.map((r) => r.y)).toEqual([...rs.map((r) => r.y)].sort((a, b) => a - b));
      }
      // Os textos da fibra continuam os mesmos (itens, total da refeição e total do dia).
      await expect(page.getByText('Fibra 2,4 g (parcial)', { exact: true })).toBeVisible();
      await expect(page.getByText('10,4 g de fibra (parcial)', { exact: true })).toBeVisible();

      const total = await caixa(titulo(page, 'Total do dia'));
      if (!janela.lado) {
        // Celular igual ao de antes: uma pilha só, Água → Observações → Lista → Total → refeições → Medicação → Suplementação → PDF.
        await expect(apoio(page)).toHaveCount(0);
        await expect(page.getByText('Horário: 07:00', { exact: true })).toBeVisible();
        const ordem = await Promise.all([titulo(page, 'Água de hoje'), page.getByText('Observações', { exact: true }), page.getByRole('button', { name: 'Lista de compras' }),
          titulo(page, 'Total do dia'), page.getByText(NOMES[0], { exact: true }), titulo(page, 'Medicação e ergogênicos'), titulo(page, 'Suplementação'),
          page.getByRole('button', { name: 'Baixar PDF da dieta' })].map(caixa));
        expect(ordem.map((c) => c.y)).toEqual([...ordem.map((c) => c.y)].sort((a, b) => a - b));
      } else {
        // Apoio à direita das refeições, na ordem pedida: só resumo e ações (Total, Água, Suplementação, Lista, PDF).
        await expect(apoio(page)).toBeVisible();
        expect(total.x).toBeGreaterThan(rs[0].x + 400);
        const ordem = await Promise.all([titulo(page, 'Total do dia'), titulo(page, 'Água de hoje'), titulo(page, 'Suplementação'),
          page.getByRole('button', { name: 'Lista de compras' }), page.getByRole('button', { name: 'Baixar PDF da dieta' })]
          .map((l) => l.boundingBox()));
        const ys = ordem.map((c) => c!.y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        for (const c of ordem) expect(Math.abs(c!.x - ordem[0]!.x)).toBeLessThan(30);
        // Medicação e Observações na principal, depois das refeições (conteúdo, não resumo): numa coluna, abaixo da última; em
        // duas, abaixo da refeição da própria coluna (fecham a coluna mais curta).
        const ultima = Math.max(...rs.map((r) => r.y));
        for (const l of [titulo(page, 'Medicação e ergogênicos'), page.getByText('Observações', { exact: true })]) {
          const c = await caixa(l);
          expect(c.x).toBeLessThan(total.x);
          const acima = rs.filter((r) => Math.abs(r.x - c.x) < 200);
          expect(c.y).toBeGreaterThan(janela.duas ? Math.max(...acima.map((r) => r.y)) : ultima - 5);
        }
        await expect(apoio(page).getByText('Observações', { exact: true })).toHaveCount(0);
        // A12 também com o apoio ao lado: o nome é o título e o horário vem embaixo.
        await expect(page.getByText('Horário: 07:00', { exact: true })).toBeVisible();
        await expect(page.getByText('07:00 · Café da manhã', { exact: true })).toHaveCount(0);
        // O Total do dia é o primeiro do apoio e aparece sem rolar, também com 720 de altura.
        await expect(titulo(page, 'Total do dia')).toBeInViewport();
        // Contêiner do treinador: o apoio tem a largura da faixa e termina no recuo da direita (sem faixa vazia), e o título
        // "Dieta" fica na borda das refeições.
        const apoioCaixa = await caixa(apoio(page));
        expect(Math.abs(apoioCaixa.width - janela.apoio!)).toBeLessThan(2);
        // Recuo da `Tela`: 16 (+ 48 de respiro lateral na ultralarga).
        expect(largura - (apoioCaixa.x + apoioCaixa.width)).toBeLessThanOrEqual(64 + 1);
        expect(Math.abs((await caixa(page.getByRole('heading', { name: 'Dieta', level: 1 }))).x - rs[0].x)).toBeLessThan(30);
        // Respiro: no total do café, P/C/G/Fibra numa linha abaixo da kcal.
        const cafe = cartao(page, NOMES[0]);
        const kcal = await caixa(cafe.getByText('200 kcal', { exact: true }));
        const p = await caixa(cafe.getByText('Fibra 2,4 g (parcial)', { exact: true }));
        expect(p.y).toBeGreaterThan(kcal.y + 10);
      }
      expect(await semRolagemDeLado(page)).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

const LONGA: ConteudoDieta = {
  ...CONTEUDO,
  suplementacao: Array.from({ length: 10 }, (_, i) => ({ uid: `sl${i}`, nome: `Suplemento fictício ${i + 1}`, dose: '1 cápsula', horario: `${String(6 + i).padStart(2, '0')}:00`, observacao: '', link: null })),
};

test('1280 × 720: o apoio mais alto que a janela não gruda, rola com a página e o PDF no fim dele se alcança', async ({ page }) => {
  await abrir(page, { largura: 1280, altura: 720 }, true, {}, LONGA);
  await expect(apoio(page)).toBeVisible();
  // O Total do dia é o primeiro do apoio e aparece sem rolar.
  await expect(titulo(page, 'Total do dia')).toBeInViewport();
  const pdf = page.getByRole('button', { name: 'Baixar PDF da dieta' });
  await pdf.scrollIntoViewIfNeeded();
  await expect(pdf).toBeInViewport();
  // Rolou com a página: o Total do dia saiu por cima (não ficou grudado cobrindo o fim do apoio).
  await expect.poll(async () => (await titulo(page, 'Total do dia').boundingBox())!.y).toBeLessThan(0);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1280x720-apoio-rolado.png` });
});

test('1920 × 1080: o apoio que cabe na janela fica grudado no topo ao rolar até as Observações', async ({ page }) => {
  const curto: ConteudoDieta = { ...CONTEUDO, suplementacao: CONTEUDO.suplementacao.slice(0, 1) };
  await abrir(page, { largura: 1920 }, true, {}, curto);
  await expect(apoio(page)).toBeVisible();
  // As colunas só ficam no lugar depois de medir as peças: rolar antes disso não leva as Observações até a vista.
  await colunasEstaveis(page, 'dieta-coluna');
  const obs = page.getByText('Observações', { exact: true });
  await obs.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await nomeDaRefeicao(page, NOMES[0]).boundingBox())!.y).toBeLessThan(0);
  // Grudado a 16 px do topo da área de rolagem (o cabeçalho rola com a página no PC).
  await expect.poll(async () => Math.round((await apoio(page).boundingBox())!.y)).toBe(16);
  await expect(titulo(page, 'Total do dia')).toBeInViewport();
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1920-apoio-grudado.png` });
});

test('3440 com a Largura do conteúdo Limitada: tudo dentro de 1800, duas colunas e o apoio de 440', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO', larguraConteudo: 'LIMITADA' })), ALUNO.id);
  await fixarHoje(page);
  await simularApi(page, { ...(await sessaoDeAluno(page)), 'GET /aluno/dieta': { corpo: { dieta: versao(CONTEUDO) } }, 'GET /aluno/pesos': { corpo: [] } });
  await page.goto('/aluno/dieta');
  await expect(apoio(page)).toBeVisible();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([nomeDaRefeicao(page, NOMES[0]).boundingBox(), nomeDaRefeicao(page, NOMES[1]).boundingBox()]);
    return a && b ? Math.abs(a.y - b.y) : 99;
  }).toBeLessThan(2);
  const [cafe, ap] = await Promise.all([caixa(cartao(page, NOMES[0])), caixa(apoio(page))]);
  expect(ap.x + ap.width - cafe.x).toBeLessThanOrEqual(1800 + 1);
  expect(Math.abs(ap.width - 440)).toBeLessThan(2);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-3440-limitada-escuro.png` });
});

test('1920: sem dieta publicada, o vazio de sempre e sem coluna de apoio', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1920 }, true, { 'GET /aluno/dieta': { corpo: { dieta: null } } });
  await expect(page.getByText('Sem plano de dieta', { exact: true })).toBeVisible();
  await expect(apoio(page)).toHaveCount(0);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1920-vazio.png` });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920: erro da API mostra a mensagem com "Tentar de novo"', async ({ page }) => {
  await abrir(page, { largura: 1920 }, false, { 'GET /aluno/dieta': erroApi(500, 'Erro fictício.', 'ERRO_INTERNO') });
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await expect(apoio(page)).toHaveCount(0);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1920-erro.png` });
});

test('1920: dia sem dieta marcada mostra o aviso no topo e o apoio sem o total', async ({ page }) => {
  // Variação só no domingo; o dia fixo dos testes (19/10/2026) é segunda.
  const conteudo: ConteudoDieta = { ...CONTEUDO, refeicoes: [], variacoes: [{ uid: 'v1', rotulo: 'Domingo fictício', dias: [7], refeicoes: CONTEUDO.refeicoes }] };
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1920 }, true, {}, conteudo);
  await expect(titulo(page, 'Sem dieta marcada para hoje')).toBeVisible();
  await expect(titulo(page, 'Total do dia')).toHaveCount(0);
  await expect(nomeDaRefeicao(page, NOMES[0])).toHaveCount(0);
  await expect(apoio(page)).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1280: orientações e observações com o formato do treinador aplicado (sem asteriscos nem traços crus)', async ({ page }) => {
  const formatado: ConteudoDieta = {
    ...CONTEUDO,
    orientacoes: [{ titulo: 'Hidratação', texto: 'Beba **3 litros** por dia.' }],
    observacoes: '__Sem açúcar__ no café.',
  };
  const { errosDaPagina } = await abrir(page, { largura: 1280, altura: 720 }, true, {}, formatado);
  // O primeiro desenho é o do celular e a troca de arranjo remonta os cartões (fechando o que foi aberto): espera o apoio.
  await expect(apoio(page)).toBeVisible();
  await expect.poll(async () => {
    const [t, r] = await Promise.all([titulo(page, 'Total do dia').boundingBox(), refeicoes(page)[0].boundingBox()]);
    return t && r ? t.x - r.x : 0;
  }).toBeGreaterThan(400);
  await page.getByRole('button', { name: /^Orientações/ }).click();
  await page.getByRole('button', { name: /^Observações/ }).click();
  await expect(page.getByText('Beba 3 litros por dia.', { exact: true })).toBeVisible();
  await expect(page.getByText('3 litros', { exact: true })).toBeVisible();
  await expect(page.getByText('Sem açúcar no café.', { exact: true })).toBeVisible();
  await expect(page.getByText(/\*\*|__/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
