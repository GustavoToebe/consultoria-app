import { expect, test, type Page } from '@playwright/test';

import type { PaginaDoMural, PodResumo, PostDoMural } from '../src/api/comunidadeTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Mural da equipe de 19/11 (D5 de `docs/planos/comunidade-19-11.md`): barra única (seletor do mural com "Gerenciar grupos",
 * Avisos | Alunos, busca e Filtros), "Configurações do mural" com "Quem publica" e "Grupos", "Fixados" e "Enquetes
 * abertas" numa coluna à direita a partir de 1280 px de área (no topo do feed abaixo disso), o tipo e o "Fixado" em selo,
 * os comentários em frase e a "Nova publicação" com o texto novo. API simulada nos formatos reais; só dados fictícios.
 */
const BASE: PostDoMural = {
  id: 'x', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: '',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-11-18T09:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const AVISO: PostDoMural = {
  ...BASE, id: 'm1', tipo: 'AVISO', fixado: true, totalComentarios: 1, criadoEm: '2026-11-19T08:00:00-03:00',
  texto: 'Aviso de teste: a academia fecha mais cedo na sexta. Confiram o horário novo do treino em grupo e avisem quem faltou.',
};
const ENQUETE: PostDoMural = {
  ...BASE, id: 'm2', tipo: 'ENQUETE', texto: 'Qual horário fica melhor para o treino em grupo?', totalComentarios: 3, criadoEm: '2026-11-18T10:00:00-03:00',
  enquete: {
    variasRespostas: false, encerrada: false, encerraEm: '2026-11-28T23:59:00-03:00', meusVotos: [], participantes: 3,
    opcoes: [{ id: 'o1', texto: 'Manhã', votos: 2, votantesAmostra: [] }, { id: 'o2', texto: 'Noite', votos: 1, votantesAmostra: [] }],
  },
};
const ENQUETE_NOVA: PostDoMural = {
  ...ENQUETE, id: 'm3', texto: 'Enquete de teste sem votos ainda?', totalComentarios: 0, criadoEm: '2026-11-17T10:00:00-03:00',
  enquete: { ...ENQUETE.enquete!, encerraEm: null, participantes: 0, opcoes: ENQUETE.enquete!.opcoes.map((o) => ({ ...o, votos: 0 })) },
};
const CONVERSA: PostDoMural = { ...BASE, id: 'm4', autorId: 'u2', autorNome: 'Aluno Fictício', autorEhAluno: true, texto: 'Treino de teste concluído.', totalComentarios: 2 };
const POD: PodResumo = { id: 'd0000000-0000-4000-8000-0000000000a1', nome: 'Turma das 6h', membros: 5, temMenor: false, criadoEm: '2026-11-10T12:00:00-03:00' };
const POD_2: PodResumo = { ...POD, id: 'd0000000-0000-4000-8000-0000000000b2', nome: 'Turma da noite', membros: 3 };

const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
/** Como a API: só o `?tipo=` pedido; o grupo (`?podId=`) está vazio. */
const mural = (p: PedidoFalso) =>
  pagina(...(p.busca.get('podId') ? [] : [AVISO, ENQUETE, ENQUETE_NOVA, CONVERSA]).filter((x) => x.tipo === p.busca.get('tipo')));

const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}
async function tema(page: Page, t: string) {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [TREINADOR.id, t]);
}

async function abrirMural(page: Page, rotas: RespostasApi = {}, endereco = '/treinador/comunidade?aba=mural') {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /comunidade/aulas': { corpo: [] },
    'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
    'GET /comunidade/pods': { corpo: [POD, POD_2] },
    'GET /comunidade/mural': (p, route) => json(route, mural(p)),
    ...rotas,
  });
  await page.goto(endereco);
  return api;
}

/** A fonte do texto: a numérica (mono) só vale para número solto. */
const fonteDe = (page: Page, texto: string) =>
  page.getByText(texto, { exact: true }).first().evaluate((el) => getComputedStyle(el).fontFamily);

for (const [largura, altura] of [[390, 900], [1280, 900], [1920, 1080]] as const) {
  test.describe(`mural da equipe (19/11) em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    // 1920 com o menu aberto deixa ~1624 px de área: a coluna aparece. 1280 deixa ~984: os blocos ficam no topo do feed.
    const comColuna = largura >= 1920;

    test('barra única com o seletor e "Gerenciar grupos"; selos do tipo e "Fixado"; comentários e votos em frase', async ({ page }) => {
      const api = await abrirMural(page);
      const seletor = page.getByRole('radiogroup', { name: 'Mural' });
      await expect(seletor.getByRole('radio', { name: 'Geral' })).toHaveAttribute('aria-checked', 'true');
      await expect(seletor.getByRole('radio', { name: POD.nome })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gerenciar grupos' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Grupos', exact: true })).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: 'Publicações', exact: true })).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Buscar na comunidade' })).toBeVisible();
      if (largura >= 1920) {
        // Com área folgada a barra é uma linha só: o seletor, as abas, a busca e o Filtros na mesma altura. Em 1280 (área
        // de ~984 px) com dois grupos ela quebra em duas: seletor e abas em cima, busca e Filtros embaixo.
        const y = async (b: ReturnType<Page['getByRole']>) => (await b.boundingBox())!.y;
        expect(Math.abs((await y(seletor)) - (await y(page.getByRole('searchbox', { name: 'Buscar na comunidade' }))))).toBeLessThanOrEqual(30);
      }

      const feed = page.getByTestId('coluna-das-publicacoes');
      // Abaixo de 1280 px de área os destaques ficam dentro do feed, no topo: o aviso aparece lá e no cartão.
      await expect(feed.getByText(AVISO.texto).last()).toBeVisible();
      await expect(feed.getByText('Aviso', { exact: true })).toBeVisible();
      await expect(feed.getByText('Fixado', { exact: true })).toHaveCount(1);
      await expect(feed.getByText('Enquete', { exact: true })).toHaveCount(2);
      // Comentários em frase, sem a fonte numérica; o nome do botão leva o texto à vista.
      await expect(feed.getByText('1 comentário', { exact: true })).toBeVisible();
      await expect(feed.getByText('3 comentários', { exact: true })).toBeVisible();
      await expect(feed.getByText('Nenhum comentário', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver comentários: 3 comentários' })).toBeVisible();
      expect(await fonteDe(page, '3 comentários')).not.toMatch(/mono/i);
      expect(await fonteDe(page, 'Ninguém votou ainda')).not.toMatch(/mono/i);
      expect(await fonteDe(page, '3 pessoas votaram')).not.toMatch(/mono/i);
      // O percentual continua número solto, na fonte numérica.
      expect(await fonteDe(page, '67% · 2 votos')).toMatch(/mono/i);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test(comColuna ? 'Fixados e Enquetes abertas na coluna da direita; tocar leva à publicação' : 'Fixados e Enquetes abertas no topo do feed; tocar leva à publicação', async ({ page }) => {
      const api = await abrirMural(page);
      const feed = page.getByTestId('coluna-das-publicacoes');
      await expect(feed.getByText(CONVERSA.texto)).toHaveCount(0);
      await expect(feed.getByText(AVISO.texto).first()).toBeVisible();
      const fixados = page.getByRole('heading', { name: 'Fixados' });
      const enquetes = page.getByRole('heading', { name: 'Enquetes abertas' });
      await expect(fixados).toBeVisible();
      await expect(enquetes).toBeVisible();
      if (comColuna) {
        const coluna = page.getByTestId('coluna-dos-destaques');
        await expect(coluna).toBeVisible();
        const caixaDoFeed = (await feed.boundingBox())!;
        const caixaDaColuna = (await coluna.boundingBox())!;
        expect(caixaDaColuna.x).toBeGreaterThanOrEqual(caixaDoFeed.x + caixaDoFeed.width);
        expect(caixaDoFeed.width).toBeLessThanOrEqual(720);
        expect(caixaDoFeed.width).toBeGreaterThanOrEqual(700);
      } else {
        await expect(page.getByTestId('coluna-dos-destaques')).toHaveCount(0);
        // No topo do feed, antes da primeira publicação.
        const primeira = (await page.getByRole('button', { name: `Ações da publicação de ${AVISO.autorNome}` }).first().boundingBox())!;
        expect((await enquetes.boundingBox())!.y).toBeLessThan(primeira.y);
      }
      const bloco = comColuna ? page.getByTestId('coluna-dos-destaques') : feed;
      // A enquete aberta: pergunta, prazo e votos em frase; a fixada (o aviso) com o autor.
      const itemDaEnquete = bloco.getByRole('button', { name: /Qual horário fica melhor/ });
      await expect(itemDaEnquete).toContainText('Encerra em 28/11/2026');
      await expect(itemDaEnquete).toContainText('3 pessoas votaram');
      await expect(bloco.getByRole('button', { name: /Enquete de teste sem votos/ })).toContainText('Ninguém votou ainda');
      await capturar(page, `destaques-${largura}`);

      if (comColuna) {
        // Fixa ao rolar: numa janela baixa o feed passa da altura e a rolagem (a da `Tela`, não a da janela) não leva a coluna.
        await page.setViewportSize({ width: largura, height: 560 });
        const coluna = page.getByTestId('coluna-dos-destaques');
        const antes = (await coluna.boundingBox())!.y;
        await page.mouse.move(500, 400);
        await page.mouse.wheel(0, 900);
        await expect.poll(async () => (await page.getByRole('button', { name: `Ações da publicação de ${AVISO.autorNome}` }).first().boundingBox())?.y ?? 0).toBeLessThan(0);
        await expect(coluna).toBeInViewport();
        expect((await coluna.boundingBox())!.y).toBeLessThan(antes);
        expect((await coluna.boundingBox())!.y).toBeGreaterThanOrEqual(0);
        await page.mouse.wheel(0, -2000);
        await page.setViewportSize({ width: largura, height: altura });
      }

      // Na aba Alunos, só as enquetes; tocar numa volta à aba Avisos e leva à publicação.
      await page.getByRole('radio', { name: 'Alunos', exact: true }).click();
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByText(CONVERSA.texto)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Fixados' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Enquetes abertas' })).toBeVisible();
      await page.getByRole('button', { name: /Qual horário fica melhor/ }).first().click();
      await expect(page).toHaveURL(/[?&]mural=avisos/);
      const cartao = page.locator(`[id="mural-post-${ENQUETE.id}"]`);
      await expect(cartao).toBeInViewport();
      await expect(cartao).toBeFocused();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('Configurações do mural: "Quem publica" e "Grupos" numa folha; "Gerenciar grupos" abre já em Grupos', async ({ page }) => {
      const api = await abrirMural(page);
      await page.getByRole('button', { name: 'Configurações do mural' }).click();
      const folha = page.getByRole('dialog', { name: 'Configurações do mural' });
      await expect(folha.getByRole('heading', { name: 'Quem publica' })).toBeVisible();
      await expect(folha.getByRole('switch', { name: 'Alunos podem publicar' })).toBeChecked();
      await expect(folha.getByRole('heading', { name: 'Grupos', exact: true })).toBeAttached();
      await expect(folha.getByText(/Até 12 alunos por grupo; o aluno entra pela ficha dele, em Dados\./)).toBeAttached();
      // Não há excluir grupo: a API não tem a rota.
      await expect(folha.getByRole('button', { name: /Excluir/ })).toHaveCount(0);
      await capturar(page, `configuracoes-quem-publica-${largura}`);
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);

      await page.getByRole('button', { name: 'Gerenciar grupos' }).click();
      const grupos = page.getByRole('dialog', { name: 'Configurações do mural' });
      await expect(grupos.getByRole('heading', { name: 'Grupos', exact: true })).toBeInViewport();
      await expect(grupos.getByText('5 de 12 alunos')).toBeVisible();
      await capturar(page, `configuracoes-grupos-${largura}`);
      // Nome digitado: fechar pergunta "Sair sem salvar?" (D1).
      await grupos.getByRole('textbox', { name: 'Nome do novo grupo' }).fill('Turma de teste');
      await grupos.getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(grupos).toHaveCount(0);
      expect(api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === '/comunidade/pods')).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('Nova publicação: "Escreva para a comunidade" e, no Vídeo, o caminho para as coleções', async ({ page }) => {
      await abrirMural(page, {}, '/treinador/comunidade?aba=mural&mural=alunos');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = page.getByRole('dialog', { name: 'Nova publicação' });
      await expect(folha.getByRole('textbox', { name: 'Texto', exact: true })).toHaveAttribute('placeholder', 'Escreva para a comunidade');
      await expect(folha.getByText('Para organizar em coleção, publique na aba Vídeos.')).toHaveCount(0);
      await folha.getByRole('radio', { name: 'Vídeo', exact: true }).click();
      await expect(folha.getByText('Para organizar em coleção, publique na aba Vídeos.')).toBeVisible();
    });

    test('grupo vazio diz o grupo e leva às publicações dos alunos; erro da API com "Tentar de novo"', async ({ page }) => {
      let falhar = false;
      const api = await abrirMural(page, {
        'GET /comunidade/mural': (p, route) => (falhar ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500) : json(route, mural(p))),
      });
      await page.getByRole('radiogroup', { name: 'Mural' }).getByRole('radio', { name: POD.nome }).click();
      await expect(page.getByText(`Nenhum aviso, vídeo ou enquete no grupo ${POD.nome} ainda.`)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver publicações dos alunos' })).toBeVisible();
      // O grupo não tem fixados nem enquetes: os destaques somem, e a coluna da direita também (sem vão ao lado do feed).
      await expect(page.getByRole('heading', { name: 'Fixados' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Enquetes abertas' })).toHaveCount(0);
      await expect(page.getByTestId('coluna-dos-destaques')).toHaveCount(0);
      await capturar(page, `grupo-vazio-${largura}`);

      falhar = true;
      await page.getByRole('radiogroup', { name: 'Mural' }).getByRole('radio', { name: 'Geral' }).click();
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      falhar = false;
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByTestId('coluna-das-publicacoes').getByText(AVISO.texto).last()).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

// Capturas do Mural para a conferência (escuro e claro, nas três larguras): Avisos com o fixado e a enquete aberta,
// Alunos, um grupo vazio e as Configurações nas duas seções.
for (const [largura, altura] of [[390, 900], [1280, 900], [1920, 1080]] as const) {
  for (const t of ['ESCURO', 'CLARO'] as const) {
    test(`capturas ${t.toLowerCase()} ${largura} px`, async ({ page }) => {
      test.skip(!CAPTURAS, 'só gera as capturas com CAPTURAS_DIR');
      // Seis capturas de página inteira por caso: em 1920 passam do minuto padrão.
      test.slow();
      await page.setViewportSize({ width: largura, height: altura });
      await tema(page, t);
      const nome = (n: string) => `${n}-${t.toLowerCase()}-${largura}`;
      await abrirMural(page);
      await expect(page.getByTestId('coluna-das-publicacoes').getByText(AVISO.texto).last()).toBeVisible();
      await capturar(page, nome('avisos'));
      await page.getByRole('radio', { name: 'Alunos', exact: true }).click();
      await expect(page.getByText(CONVERSA.texto)).toBeVisible();
      await capturar(page, nome('alunos'));
      await page.getByRole('radiogroup', { name: 'Mural' }).getByRole('radio', { name: POD.nome }).click();
      await page.getByRole('radio', { name: 'Avisos', exact: true }).click();
      await expect(page.getByText(`Nenhum aviso, vídeo ou enquete no grupo ${POD.nome} ainda.`)).toBeVisible();
      await capturar(page, nome('grupo-vazio'));
      await page.getByRole('button', { name: 'Configurações do mural' }).click();
      await expect(page.getByRole('dialog', { name: 'Configurações do mural' }).getByRole('switch', { name: 'Alunos podem publicar' })).toBeVisible();
      await page.screenshot({ path: `${CAPTURAS}/${nome('configuracoes-quem-publica')}.png` });
      await page.keyboard.press('Escape');
      // Janela baixa: a folha não cabe inteira e a captura mostra que ela abre já na seção Grupos.
      await page.setViewportSize({ width: largura, height: 560 });
      await page.getByRole('button', { name: 'Gerenciar grupos' }).click();
      await expect(page.getByRole('dialog', { name: 'Configurações do mural' }).getByText('5 de 12 alunos')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${CAPTURAS}/${nome('configuracoes-grupos')}.png` });
    });
  }
}
