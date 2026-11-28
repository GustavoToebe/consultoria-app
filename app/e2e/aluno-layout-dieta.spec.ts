import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, VersaoDetalhe } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';

/**
 * Dieta do aluno na web (28/11, contêiner do treinador: começa ao lado do menu e preenche a área, sem o teto de 1312): com
 * espaço na área (972 px), à direita a coluna de apoio (380 na faixa normal, 420 na larga, 440 na ultralarga) SEM rolagem
 * própria, fixa ao rolar só quando cabe inteira na janela: "Lista de compras" e "Baixar PDF da dieta" lado a lado no topo,
 * Total do dia e Água de hoje (dias anteriores numa linha rolável, "Hoje" fixo à direita). Na principal, as refeições numa
 * grade POR LINHA na ordem do dia (Café | Lanche, Almoço | Lanche, Janta na largura toda), com o nome no título e
 * "Horário: 07:00" embaixo (A12); duas colunas na `larga` e na `ultralarga`, uma na `normal`; os cartões da mesma linha
 * com a mesma altura e o total da refeição no pé de cada um, na mesma base. Embaixo, na mesma régua, Orientações |
 * Observações (abertas, recolhíveis) e Suplementação | Medicação e ergogênicos, também com a mesma altura. O total da refeição ganha
 * respiro (kcal em destaque, P · C · G · Fibra numa linha menor embaixo). No celular nada muda. Só dados fictícios. Com
 * `E2E_CAPTURAS=<pasta>` (ou `CAPTURAS`), guarda as telas (nunca no git).
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
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Resumo da dieta' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const cartao = (page: Page, nome: string) => page.getByTestId('cartao').filter({ has: nomeDaRefeicao(page, nome) }).first();
/** Pelo texto do título: no cartão recolhível o título fica dentro do botão (filhos de botão não são lidos como heading). */
const cartaoDe = (page: Page, tituloDoCartao: string) => page.getByTestId('cartao').filter({ has: page.getByText(tituloDoCartao, { exact: true }) }).first();
const pdf = (page: Page) => page.getByRole('button', { name: 'Baixar PDF da dieta' });
const lista = (page: Page) => page.getByRole('button', { name: 'Lista de compras' });
/** Posição do apoio e se ele tem rolagem própria (não pode ter: rola com a página ou gruda inteiro). */
const estiloDoApoio = (page: Page) => page.getByTestId('apoio-da-dieta').evaluate((el) => {
  const s = getComputedStyle(el);
  return { position: s.position, overflowY: s.overflowY, rolaPorDentro: el.scrollHeight > el.clientHeight + 1 };
});

/**
 * Cartões da mesma linha da grade com a mesma altura (±2 px) e o total da refeição no pé de cada um: a base do total a
 * menos de 40 px da base do cartão (o recuo do rodapé) e a mesma distância nos dois (o vazio que sobra fica acima do total).
 */
async function conferirLinha(page: Page, nomes: string[]) {
  const medidas = await Promise.all(nomes.map(async (n) => {
    const c = await caixa(cartao(page, n));
    const t = await caixa(cartao(page, n).getByRole('group', { name: /^Total/ }).first());
    return { altura: c.height, folga: c.y + c.height - (t.y + t.height) };
  }));
  for (const m of medidas) {
    expect(Math.abs(m.altura - medidas[0].altura), `altura na linha de ${nomes.join(' | ')}`).toBeLessThan(2);
    expect(m.folga).toBeLessThan(40);
    expect(Math.abs(m.folga - medidas[0].folga), `total na base, linha de ${nomes.join(' | ')}`).toBeLessThan(2);
  }
}

/** O primeiro desenho é sempre o do celular (a área ainda não foi medida): espera o apoio ao lado e, em duas, a grade. */
async function esperarArranjo(page: Page, duas: boolean) {
  await expect(apoio(page)).toBeVisible();
  await expect.poll(async () => {
    const [t, r] = await Promise.all([titulo(page, 'Total do dia').boundingBox(), nomeDaRefeicao(page, NOMES[0]).boundingBox()]);
    return t && r ? t.x - r.x : 0;
  }).toBeGreaterThan(400);
  if (duas) {
    await expect.poll(async () => {
      const [a, b] = await Promise.all([cartao(page, NOMES[0]).boundingBox(), cartao(page, NOMES[1]).boundingBox()]);
      return a && b ? b.x - a.x : 0;
    }).toBeGreaterThan(300);
  }
}

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
      if (janela.lado) await esperarArranjo(page, !!janela.duas);
      const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
      if (pasta) await page.screenshot({ path: `${pasta}/dieta-${nome}.png`, fullPage: true });

      const rs = await Promise.all(NOMES.map((n) => caixa(cartao(page, n))));
      if (janela.duas) {
        // Por linha, na ordem do dia: Café | Lanche da manhã, Almoço | Lanche da tarde, e o Jantar (ímpar) na largura toda.
        expect(Math.abs(rs[1].y - rs[0].y)).toBeLessThan(2);
        expect(Math.abs(rs[3].y - rs[2].y)).toBeLessThan(2);
        expect(rs[2].y).toBeGreaterThan(rs[0].y + 10);
        expect(rs[4].y).toBeGreaterThan(rs[2].y + 10);
        expect(rs[1].x).toBeGreaterThan(rs[0].x + 300);
        for (const r of [rs[2], rs[4]]) expect(Math.abs(r.x - rs[0].x)).toBeLessThan(2);
        expect(Math.abs(rs[3].x - rs[1].x)).toBeLessThan(2);
        // As duas colunas com a mesma largura, e a última da linha ímpar com a largura das duas (mais o vão).
        expect(Math.abs(rs[1].width - rs[0].width)).toBeLessThan(2);
        expect(Math.abs(rs[4].x + rs[4].width - (rs[1].x + rs[1].width))).toBeLessThan(2);
        // Mesma linha, mesma altura (28/11), com o total no pé de cada cartão, na mesma base do vizinho.
        await conferirLinha(page, [NOMES[0], NOMES[1]]);
        await conferirLinha(page, [NOMES[2], NOMES[3]]);
        await conferirLinha(page, [NOMES[4]]);
      } else {
        // Refeições numa coluna só (mesma borda), na ordem do dia.
        for (const r of rs) expect(Math.abs(r.x - rs[0].x)).toBeLessThan(2);
        expect(rs.map((r) => r.y)).toEqual([...rs.map((r) => r.y)].sort((a, b) => a - b));
      }
      // Os textos da fibra continuam os mesmos (há item com fibra: itens, total da refeição e total do dia).
      await expect(page.getByText('Fibra 2,4 g (parcial)', { exact: true })).toBeVisible();
      await expect(page.getByText('10,4 g de fibra (parcial)', { exact: true })).toBeVisible();

      const total = await caixa(titulo(page, 'Total do dia'));
      if (!janela.lado) {
        // Celular igual ao de antes: uma pilha só, Água → Observações → Lista → Total → refeições → Medicação → Suplementação → PDF.
        await expect(apoio(page)).toHaveCount(0);
        await expect(page.getByText('Horário: 07:00', { exact: true })).toBeVisible();
        const ordem = await Promise.all([titulo(page, 'Água de hoje'), page.getByText('Observações', { exact: true }), lista(page),
          titulo(page, 'Total do dia'), page.getByText(NOMES[0], { exact: true }), titulo(page, 'Medicação e ergogênicos'), titulo(page, 'Suplementação'),
          pdf(page)].map(caixa));
        expect(ordem.map((c) => c.y)).toEqual([...ordem.map((c) => c.y)].sort((a, b) => a - b));
        // Orientações e Observações continuam recolhidas no celular.
        await expect(page.getByText('Observação fictícia da dieta.', { exact: true })).toHaveCount(0);
      } else {
        // Apoio à direita das refeições: as duas ações lado a lado no topo, depois o Total do dia e a Água de hoje.
        await expect(apoio(page)).toBeVisible();
        expect(total.x).toBeGreaterThan(rs[0].x + 400);
        const [l, p, t, a] = await Promise.all([lista(page), pdf(page), titulo(page, 'Total do dia'), titulo(page, 'Água de hoje')].map(caixa));
        expect(Math.abs(l.y - p.y)).toBeLessThan(2);
        expect(p.x).toBeGreaterThan(l.x + l.width - 1);
        expect(t.y).toBeGreaterThan(l.y + l.height);
        expect(a.y).toBeGreaterThan(t.y);
        for (const c of [l, t, a]) expect(Math.abs(c.x - l.x)).toBeLessThan(30);
        // Só ações, total e água no apoio: o resto (conteúdo) fica na principal.
        for (const fora of ['Suplementação', 'Medicação e ergogênicos', 'Orientações', 'Observações']) {
          await expect(apoio(page).getByText(fora, { exact: true })).toHaveCount(0);
        }
        // Embaixo das refeições: Orientações | Observações (abertas) e Suplementação | Medicação, na régua das refeições.
        const ultima = Math.max(...rs.map((r) => r.y + r.height));
        const [ori, obs, sup, med] = await Promise.all([cartaoDe(page, 'Orientações'), cartaoDe(page, 'Observações'),
          cartaoDe(page, 'Suplementação'), cartaoDe(page, 'Medicação e ergogênicos')].map(caixa));
        for (const c of [ori, obs, sup, med]) {
          expect(c.y).toBeGreaterThan(ultima - 1);
          expect(c.x + c.width).toBeLessThan(total.x);
        }
        await expect(page.getByText('Texto fictício da orientação.', { exact: true })).toBeVisible();
        await expect(page.getByText('Observação fictícia da dieta.', { exact: true })).toBeVisible();
        if (janela.duas) {
          expect(Math.abs(ori.y - obs.y)).toBeLessThan(2);
          expect(Math.abs(ori.width - obs.width)).toBeLessThan(2);
          // Os pares com a mesma altura (28/11).
          expect(Math.abs(ori.height - obs.height)).toBeLessThan(2);
          expect(Math.abs(sup.height - med.height)).toBeLessThan(2);
          expect(Math.abs(ori.x - rs[0].x)).toBeLessThan(2);
          expect(Math.abs(sup.y - med.y)).toBeLessThan(2);
          expect(sup.x).toBeLessThan(med.x);
          expect(sup.y).toBeGreaterThan(ori.y + 10);
        } else {
          expect([ori.y, obs.y, sup.y, med.y]).toEqual([ori.y, obs.y, sup.y, med.y].sort((x, y) => x - y));
        }
        // A12 também com o apoio ao lado: o nome é o título e o horário vem embaixo.
        await expect(page.getByText('Horário: 07:00', { exact: true })).toBeVisible();
        await expect(page.getByText('07:00 · Café da manhã', { exact: true })).toHaveCount(0);
        // O Total do dia aparece sem rolar, também com 720 de altura.
        await expect(titulo(page, 'Total do dia')).toBeInViewport();
        // Sem rolagem própria no apoio.
        const estilo = await estiloDoApoio(page);
        expect(estilo.rolaPorDentro).toBe(false);
        expect(['auto', 'scroll']).not.toContain(estilo.overflowY);
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
        const f = await caixa(cafe.getByText('Fibra 2,4 g (parcial)', { exact: true }));
        expect(f.y).toBeGreaterThan(kcal.y + 10);
      }
      expect(await semRolagemDeLado(page)).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('1920: refeições em número ímpar (3): a última na largura das duas colunas; uma seção só por linha ocupa a linha', async ({ page }) => {
  // O Lanche da manhã com um item só: mais curto que o Café, estica até a altura dele, com o total na mesma base.
  const lancheCurto = { ...refeicao('lm', NOMES[1], '10:00'), opcoes: [{ uid: 'lm-a', rotulo: 'A', itens: [item('lm1', 'Alimento fictício lm 1', 1)] }] };
  const conteudo: ConteudoDieta = { ...CONTEUDO, refeicoes: [CONTEUDO.refeicoes[0], lancheCurto, CONTEUDO.refeicoes[2]], orientacoes: [], ergogenicos: [] };
  const { errosDaPagina } = await abrir(page, { largura: 1920 }, true, {}, conteudo);
  await esperarArranjo(page, true);
  const [a, b, c] = await Promise.all(NOMES.slice(0, 3).map((n) => caixa(cartao(page, n))));
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  await conferirLinha(page, [NOMES[0], NOMES[1]]);
  expect(Math.abs(c.x - a.x)).toBeLessThan(2);
  expect(Math.abs(c.x + c.width - (b.x + b.width))).toBeLessThan(2);
  // Sem Orientações e sem Medicação: Observações e Suplementação, cada uma na largura toda da linha dela.
  await expect(page.getByText('Orientações', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Medicação e ergogênicos', { exact: true })).toHaveCount(0);
  for (const t of ['Observações', 'Suplementação']) {
    const s = await caixa(cartaoDe(page, t));
    expect(Math.abs(s.x - a.x)).toBeLessThan(2);
    expect(Math.abs(s.width - c.width)).toBeLessThan(2);
  }
  expect(errosDaPagina).toEqual([]);
});

test('1920: Orientações | Observações: a recolhida fica com a altura própria e a aberta não muda; abrir de novo volta à mesma altura', async ({ page }) => {
  // Observações bem mais longa que as Orientações: a linha tem a altura dela.
  const longa: ConteudoDieta = { ...CONTEUDO, observacoes: Array.from({ length: 12 }, (_, i) => `Linha fictícia ${i + 1} da observação.`).join('\n') };
  const { errosDaPagina } = await abrir(page, { largura: 1920 }, true, {}, longa);
  await esperarArranjo(page, true);
  const medir = () => Promise.all([cartaoDe(page, 'Orientações'), cartaoDe(page, 'Observações')].map(caixa));
  const [ori0, obs0] = await medir();
  // Abertas: mesma altura na linha (28/11).
  expect(Math.abs(ori0.height - obs0.height)).toBeLessThan(2);
  // Recolher as Orientações: só a faixa do título, no topo da linha; as Observações não mudam de lugar nem de altura.
  await page.getByRole('button', { name: 'Orientações, expandido' }).click();
  await expect(page.getByText('Texto fictício da orientação.', { exact: true })).toHaveCount(0);
  const [ori1, obs1] = await medir();
  expect(ori1.height).toBeLessThan(ori0.height - 50);
  expect(ori1.height).toBeLessThan(obs1.height - 100);
  expect(Math.abs(ori1.y - ori0.y)).toBeLessThan(2);
  expect(Math.abs(obs1.y - obs0.y)).toBeLessThan(2);
  expect(Math.abs(obs1.height - obs0.height)).toBeLessThan(2);
  // Abrir de novo: as duas voltam à mesma altura, sem salto da vizinha.
  await page.getByRole('button', { name: 'Orientações, recolhido' }).click();
  await expect(page.getByText('Texto fictício da orientação.', { exact: true })).toBeVisible();
  const [ori2, obs2] = await medir();
  expect(Math.abs(ori2.height - obs2.height)).toBeLessThan(2);
  expect(Math.abs(obs2.height - obs0.height)).toBeLessThan(2);
  // Recolher a mais alta: a linha encolhe até as Orientações, que ficam inteiras, e a recolhida fica com a altura própria.
  await page.getByRole('button', { name: 'Observações, expandido' }).click();
  const [ori3, obs3] = await medir();
  expect(obs3.height).toBeLessThan(obs2.height - 100);
  expect(ori3.height).toBeGreaterThan(obs3.height);
  await expect(page.getByText('Texto fictício da orientação.', { exact: true })).toBeVisible();
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1920-observacoes-recolhidas.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('1920: Água de hoje com os dias anteriores numa linha rolável e "Hoje" fixo à direita', async ({ page }) => {
  await abrir(page, { largura: 1920 }, true);
  await esperarArranjo(page, true);
  const agua = cartaoDe(page, 'Água de hoje');
  const hoje = await caixa(agua.getByRole('radio', { name: /^Água, 19\/10, hoje/ }));
  const ontem = await caixa(agua.getByRole('radio', { name: /^Água, 18\/10/ }));
  const c = await caixa(agua);
  // Uma linha só: o de ontem na altura do "Hoje", logo à esquerda (a rolagem abre no fim), tudo dentro do cartão.
  expect(Math.abs(ontem.y - hoje.y)).toBeLessThan(4);
  expect(ontem.x + ontem.width).toBeLessThanOrEqual(hoje.x);
  expect(hoje.x + hoje.width).toBeLessThanOrEqual(c.x + c.width);
  // Os 7 dias seguem num grupo de rádio só, e um dia anterior continua abrindo a água dele.
  await expect(agua.getByRole('radiogroup', { name: 'Dia da água' })).toHaveCount(1);
  await expect(agua.getByRole('radio')).toHaveCount(7);
  await agua.getByRole('radio', { name: /^Água, 13\/10/ }).click();
  await expect(titulo(page, 'Água em 13/10')).toBeVisible();
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await agua.screenshot({ path: `${pasta}/dieta-1920-agua-numa-linha.png` });
});

test('1280 × 480: o apoio mais alto que a janela não gruda nem rola por dentro: rola com a página', async ({ page }) => {
  await abrir(page, { largura: 1280, altura: 480 }, true);
  await esperarArranjo(page, false);
  await expect.poll(async () => (await estiloDoApoio(page)).position).not.toBe('sticky');
  expect((await estiloDoApoio(page)).rolaPorDentro).toBe(false);
  // Rolou até o fim da principal: o apoio inteiro saiu por cima (não ficou grudado).
  await cartaoDe(page, 'Medicação e ergogênicos').scrollIntoViewIfNeeded();
  await expect.poll(async () => { const b = (await apoio(page).boundingBox())!; return b.y + b.height; }).toBeLessThan(0);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1280x480-apoio-rolado.png` });
});

test('1920 × 1080: o apoio que cabe na janela fica grudado no topo ao rolar até as Observações', async ({ page }) => {
  await abrir(page, { largura: 1920 }, true);
  await esperarArranjo(page, true);
  await expect.poll(async () => (await estiloDoApoio(page)).position).toBe('sticky');
  await cartaoDe(page, 'Medicação e ergogênicos').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await nomeDaRefeicao(page, NOMES[0]).boundingBox())!.y).toBeLessThan(0);
  // Grudado a 16 px do topo da área de rolagem (o cabeçalho rola com a página no PC), inteiro e sem rolagem própria.
  await expect.poll(async () => Math.round((await apoio(page).boundingBox())!.y)).toBe(16);
  await expect(titulo(page, 'Total do dia')).toBeInViewport();
  await expect(titulo(page, 'Água de hoje')).toBeInViewport();
  expect((await estiloDoApoio(page)).rolaPorDentro).toBe(false);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
  if (pasta) await page.screenshot({ path: `${pasta}/dieta-1920-apoio-grudado.png` });
});

test('3440 com a Largura do conteúdo Limitada: tudo dentro de 1800, duas colunas e o apoio de 440', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO', larguraConteudo: 'LIMITADA' })), ALUNO.id);
  await fixarHoje(page);
  await simularApi(page, { ...(await sessaoDeAluno(page)), 'GET /aluno/dieta': { corpo: { dieta: versao(CONTEUDO) } }, 'GET /aluno/pesos': { corpo: [] } });
  await page.goto('/aluno/dieta');
  await esperarArranjo(page, true);
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
  // As ações continuam no topo do apoio.
  await expect(apoio(page).getByRole('button', { name: 'Lista de compras' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1280: orientações e observações abertas, recolhíveis, com o formato do treinador aplicado (sem asteriscos nem traços crus)', async ({ page }) => {
  const formatado: ConteudoDieta = {
    ...CONTEUDO,
    orientacoes: [{ titulo: 'Hidratação', texto: 'Beba **3 litros** por dia.' }],
    observacoes: '__Sem açúcar__ no café.',
  };
  const { errosDaPagina } = await abrir(page, { largura: 1280, altura: 720 }, true, {}, formatado);
  await esperarArranjo(page, false);
  // No PC nascem abertas (no celular, recolhidas).
  await expect(page.getByText('Beba 3 litros por dia.', { exact: true })).toBeVisible();
  await expect(page.getByText('3 litros', { exact: true })).toBeVisible();
  await expect(page.getByText('Sem açúcar no café.', { exact: true })).toBeVisible();
  await expect(page.getByText(/\*\*|__/)).toHaveCount(0);
  // Continuam recolhíveis.
  await page.getByRole('button', { name: 'Observações, expandido' }).click();
  await expect(page.getByText('Sem açúcar no café.', { exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
