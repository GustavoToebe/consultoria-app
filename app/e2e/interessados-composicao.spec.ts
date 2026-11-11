import { expect, test, type Locator, type Page } from '@playwright/test';

import { json, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { contagensFalsas, detalheFalso, idDe, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Composição dos Interessados (`docs/planos/composicao-visual.md`, passo 4c; P2 e P3 de `docs/design-e-front.md` 4.6),
 * conferida por posição e tamanho, sem capturas: os filtros de data (Entrada e Última atividade) e a folha "Mover".
 * A API é simulada; só dados fictícios.
 */

type Caixa = { x: number; y: number; width: number; height: number };
type Tema = { tema: 'CLARO' | 'ESCURO' | 'AREIA'; contraste?: 'ALTO' };

const NOME_LONGO = 'Pessoa Fictícia Com Um Nome Bem Comprido Para Conferir A Quebra Do Título Da Folha';
const DATAS = ['Entrada: data inicial', 'Entrada: data final', 'Última atividade: data inicial', 'Última atividade: data final'] as const;

const QUATRO_TEMAS: Tema[] = [{ tema: 'CLARO' }, { tema: 'ESCURO' }, { tema: 'AREIA' }, { tema: 'CLARO', contraste: 'ALTO' }];
const DOIS_TEMAS: Tema[] = [{ tema: 'CLARO' }, { tema: 'ESCURO' }];
const CASOS: { largura: number; temas: Tema[] }[] = [
  { largura: 390, temas: QUATRO_TEMAS },
  { largura: 768, temas: DOIS_TEMAS },
  { largura: 1280, temas: QUATRO_TEMAS },
  { largura: 1920, temas: DOIS_TEMAS },
];
const nomeDoTema = (t: Tema) => `${t.tema.toLowerCase()}${t.contraste ? ' contraste alto' : ''}`;

async function abrir(page: Page, largura: number, tema: Tema, caminho: string, extra: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, prefs]) => localStorage.setItem(`treinos:${id}:preferencias`, prefs),
    [TREINADOR.id, JSON.stringify({ tema: tema.tema, contraste: tema.contraste ?? 'PADRAO' })] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela(),
    'GET /questionarios/opcoes': { corpo: [] },
    'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
    // O Kanban pede uma lista por coluna: o cartão só vem na de Nova (e na Lista, que não filtra por etapa).
    'GET /inscricoes': (p, route) => json(route, ['EM_CONTATO', 'EM_NEGOCIACAO', 'ACEITA', 'RECUSADA', 'DESISTIU'].includes(p.busca.get('situacao') ?? '')
      ? { itens: [], total: 0 } : { itens: [resumoFalso(1, { nome: NOME_LONGO })], total: 1 }),
    ...extra,
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

/** A caixa com borda em volta do controle (o `input` da data fica dentro dela, com o ícone do calendário). */
async function caixa(alvo: Locator): Promise<Caixa> {
  return alvo.evaluate((el) => {
    let e: Element | null = el;
    while (e && e !== document.body && !(parseFloat(getComputedStyle(e).borderTopWidth) > 0)) e = e.parentElement;
    const r = (e ?? el).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

const perto = (a: number, b: number, folga = 1) => Math.abs(a - b) <= folga;
const sobrepoe = (a: Caixa, b: Caixa) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

async function abrirFiltros(page: Page) {
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page.getByRole('textbox', { name: DATAS[0], exact: true })).toBeVisible();
}

for (const { largura, temas } of CASOS) {
  for (const tema of temas) {
    for (const visao of ['kanban', 'lista'] as const) {
      test(`filtros de data ${visao} ${largura}px ${nomeDoTema(tema)}: grupos De/Até, base comum, nomes únicos e calendário na janela`, async ({ page }) => {
        const { naoTratadas, errosDaPagina } = await abrir(page, largura, tema, `/treinador/interessados?visao=${visao}`);
        await abrirFiltros(page);

        // Nome acessível inequívoco: um campo por nome, sem "De"/"Até" soltos.
        for (const nome of DATAS) await expect(page.getByRole('textbox', { name: nome, exact: true })).toHaveCount(1);
        await expect(page.getByRole('textbox', { name: 'De', exact: true })).toHaveCount(0);
        // Tudo medido de uma vez: as contagens dos chips chegam depois e podem quebrar a linha da Situação entre duas medidas.
        const [responsavel, origem, ...datas] = await Promise.all([
          caixa(page.getByRole('button', { name: /^Responsável:/ })), caixa(page.getByRole('button', { name: /^Origem:/ })),
          ...DATAS.map((n) => caixa(page.getByRole('textbox', { name: n, exact: true }))),
        ]);
        const [entradaDe, entradaAte, atividadeDe, atividadeAte] = datas;

        // De e Até de cada período lado a lado, com o mesmo topo, a mesma altura e a mesma largura.
        for (const [de, ate] of [[entradaDe, entradaAte], [atividadeDe, atividadeAte]]) {
          expect(perto(de.y, ate.y) && perto(de.height, ate.height) && perto(de.width, ate.width)).toBe(true);
          expect(ate.x).toBeGreaterThan(de.x + de.width - 1);
          expect(de.width).toBeGreaterThanOrEqual(150);
        }
        // Seletores numa linha (ou um sob o outro, sem espaço), períodos na linha de baixo, nas mesmas colunas.
        expect(perto(responsavel.height, origem.height)).toBe(true);
        expect(perto(responsavel.x, entradaDe.x) && perto(origem.x, atividadeDe.x)).toBe(true);
        if (perto(responsavel.y, origem.y)) expect(perto(entradaDe.y, atividadeDe.y)).toBe(true);
        expect(entradaDe.y).toBeGreaterThan(Math.max(responsavel.y + responsavel.height, origem.y + origem.height));
        const todas = [responsavel, origem, ...datas];
        for (let i = 0; i < todas.length; i++) {
          expect(todas[i].x).toBeGreaterThanOrEqual(0);
          expect(todas[i].x + todas[i].width).toBeLessThanOrEqual(largura);
          for (let j = i + 1; j < todas.length; j++) expect(sobrepoe(todas[i], todas[j])).toBe(false);
        }
        // Tela larga: os seletores não se esticam pela janela inteira.
        expect(responsavel.width).toBeLessThanOrEqual(481);

        // Data inteira sem cortar o texto.
        for (const nome of DATAS) {
          const campo = page.getByRole('textbox', { name: nome, exact: true });
          await campo.fill('31/12/2026');
          expect(await campo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        }

        // Erro só no Até: as caixas continuam com o mesmo topo e a mesma altura.
        await page.getByRole('textbox', { name: DATAS[0], exact: true }).fill('10/10/2026');
        await page.getByRole('textbox', { name: DATAS[1], exact: true }).fill('01/10/2026');
        await expect(page.getByText('Fim antes do início.')).toBeVisible();
        const [deComErro, ateComErro] = await Promise.all([DATAS[0], DATAS[1]].map((n) => caixa(page.getByRole('textbox', { name: n, exact: true }))));
        expect(perto(deComErro.y, ateComErro.y) && perto(deComErro.height, ateComErro.height)).toBe(true);
        // Fora da faixa de planejamento: a mensagem diz qual campo.
        await page.getByRole('textbox', { name: DATAS[2], exact: true }).fill('01/01/1999');
        await expect(page.getByText(/^Última atividade, data inicial: use uma data entre 01\/01\/2000/)).toBeVisible();

        // O calendário do último campo (o mais à direita) abre inteiro dentro da janela.
        await page.getByRole('textbox', { name: DATAS[3], exact: true }).locator('xpath=..').getByRole('button', { name: 'Abrir calendário' }).click();
        const calendario = await caixa(page.getByRole('button', { name: 'Mês anterior' }).locator('xpath=../..'));
        const janela = page.viewportSize()!;
        expect(calendario.x).toBeGreaterThanOrEqual(0);
        expect(calendario.y).toBeGreaterThanOrEqual(0);
        expect(calendario.x + calendario.width).toBeLessThanOrEqual(janela.width);
        expect(calendario.y + calendario.height).toBeLessThanOrEqual(janela.height);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Mês anterior' })).toHaveCount(0);

        if (visao === 'lista') {
          // Na Lista a Situação vem antes, numa linha só dela.
          // O grupo de opções não tem borda própria: mede ele mesmo, não o painel em volta.
          const situacao = (await page.getByRole('radiogroup', { name: 'Situação' }).boundingBox())!;
          expect(situacao.y + situacao.height).toBeLessThanOrEqual(responsavel.y + 1);
        }
        expect(naoTratadas).toEqual([]);
        expect(errosDaPagina).toEqual([]);
      });
    }
  }
}

for (const largura of [390, 1280]) {
  for (const tema of QUATRO_TEMAS) {
    test(`Mover ${largura}px ${nomeDoTema(tema)}: lista de ações da mesma largura, etapa separada de aceitar e encerrar, nome longo`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, tema, '/treinador/interessados?visao=kanban', {
        [`GET /inscricoes/${idDe(1)}`]: { corpo: detalheFalso(resumoFalso(1, { nome: NOME_LONGO })) },
      });
      await page.getByRole('button', { name: `Mover ${NOME_LONGO} para` }).click();
      const folha = page.getByRole('dialog', { name: `Mover ${NOME_LONGO}` });
      await expect(folha).toBeVisible();
      await expect(folha.getByText('Etapa atual: Nova.')).toBeVisible();

      const etapas = folha.getByRole('group', { name: 'Mudar de etapa' });
      const decisoes = folha.getByRole('group', { name: 'Aceitar ou encerrar' });
      await expect(etapas.getByRole('button')).toHaveText(['Em contato', 'Em negociação']);
      await expect(decisoes.getByRole('button')).toHaveText(['Aceitar (cadastrar aluno)', 'Recusar', 'Desistiu']);
      await expect(etapas.getByText('Muda na hora.')).toBeVisible();
      await expect(decisoes.getByText('Abre a confirmação antes de valer.')).toBeVisible();

      // Todas as linhas com a mesma largura e a mesma borda esquerda; a folha e o X dentro da janela com o nome longo.
      const linhas = await Promise.all((await folha.locator('[role="group"] [role="button"]').all()).map(caixa));
      expect(linhas).toHaveLength(5);
      for (const l of linhas) expect(perto(l.x, linhas[0].x) && perto(l.width, linhas[0].width) && l.height >= 44).toBe(true);
      const painel = await folha.boundingBox();
      const fechar = await folha.getByRole('button', { name: 'Fechar' }).boundingBox();
      expect(painel!.x + painel!.width).toBeLessThanOrEqual(largura);
      expect(fechar!.x + fechar!.width).toBeLessThanOrEqual(painel!.x + painel!.width);
      expect(linhas[0].width).toBeGreaterThan(painel!.width - 64);

      // Teclado (regra da `ui/Folha`): centralizada, o foco entra na primeira ação; de baixo (celular), no X. Esc cancela.
      await expect(largura >= 768 /* folha centrada (LARGURA_MENU_LATERAL) */ ? etapas.getByRole('button', { name: 'Em contato', exact: true }) : folha.getByRole('button', { name: 'Fechar' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Mover ${NOME_LONGO} para` })).toBeFocused();

      // Recusar não encerra na hora: abre a confirmação com o motivo, já em "Recusar".
      await page.getByRole('button', { name: `Mover ${NOME_LONGO} para` }).click();
      await decisoes.getByRole('button', { name: 'Recusar', exact: true }).click();
      await expect(page.getByText('Encerrar atendimento?')).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Recusada pela equipe', exact: true })).toBeChecked();
      expect(pedidos.some((p) => p.metodo !== 'GET' && p.caminho.startsWith('/inscricoes/'))).toBe(false);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('Mover de uma encerrada: só "Reabrir atendimento", que abre a confirmação', async ({ page }) => {
  const recusada = resumoFalso(7, { situacao: 'RECUSADA' });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, 1280, { tema: 'CLARO' }, '/treinador/interessados?visao=kanban', {
    'GET /inscricoes/contagens': { corpo: contagensFalsas({ RECUSADA: 1 }) },
    'GET /inscricoes': (p, route) =>
      json(route, p.busca.get('situacao') === 'RECUSADA' ? { itens: [recusada], total: 1 } : { itens: [], total: 0 }),
    [`GET /inscricoes/${recusada.id}`]: { corpo: detalheFalso(recusada, { motivoEncerramento: 'SEM_RETORNO', encerradaEm: '2026-10-29T13:00:00Z' }) },
  });
  await page.getByRole('checkbox', { name: 'Mostrar encerradas' }).click();
  await page.getByRole('button', { name: `Mover ${recusada.nome} para` }).click();
  const folha = page.getByRole('dialog', { name: `Mover ${recusada.nome}` });
  await expect(folha.getByText('Etapa atual: Recusada.')).toBeVisible();
  await expect(folha.getByRole('group', { name: 'Mudar de etapa' })).toHaveCount(0);
  await expect(folha.locator('[role="group"] [role="button"]')).toHaveText(['Reabrir atendimento']);
  await folha.getByRole('button', { name: 'Reabrir atendimento', exact: true }).click();
  await expect(page.getByText('Reabrir atendimento?')).toBeVisible();
  expect(pedidos.some((p) => p.caminho.endsWith('/reabrir'))).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
