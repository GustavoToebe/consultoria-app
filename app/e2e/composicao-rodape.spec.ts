import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, type RespostasApi, paginaDeExerciciosFalsa, sessao, simularApi, TREINADOR } from './api-falsa';
import { detalheFalso, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Rodapé único da `Folha` e do `PainelConfirmacao` (`docs/planos/composicao-visual.md`, passo 4a; P1 e P5 de
 * `docs/design-e-front.md` 4.6), conferido por posição, tamanho e estilo calculado, sem capturas: sem faixa vazia embaixo
 * do rodapé (evidência 05), a ação principal na ponta (cheia e em cima no celular) e o motivo de uma ação indisponível
 * uma vez só, colado sob ela e com o mesmo alinhamento (evidência 06). A API é simulada; só dados fictícios.
 */

type Tema = { tema: 'CLARO' | 'ESCURO' | 'AREIA'; contraste?: 'ALTO' };
const QUATRO_TEMAS: Tema[] = [{ tema: 'CLARO' }, { tema: 'ESCURO' }, { tema: 'AREIA' }, { tema: 'CLARO', contraste: 'ALTO' }];
const DOIS_TEMAS: Tema[] = [{ tema: 'CLARO' }, { tema: 'ESCURO' }];
const CASOS: { largura: number; altura: number; temas: Tema[] }[] = [
  { largura: 390, altura: 844, temas: QUATRO_TEMAS },
  { largura: 768, altura: 1024, temas: DOIS_TEMAS },
  { largura: 1280, altura: 900, temas: QUATRO_TEMAS },
  { largura: 1920, altura: 1080, temas: DOIS_TEMAS },
];
const nomeDoTema = (t: Tema) => `${t.tema.toLowerCase()}${t.contraste ? ' contraste alto' : ''}`;
const celular = (largura: number) => largura < 768;

const EXERCICIO: Exercicio = {
  id: 'e0000001-0000-4000-8000-000000000000', nome: 'Elevação fictícia', grupoMuscular: 'Ombro', equipamento: null,
  modalidade: 'LIVRE', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
};

async function abrir(page: Page, largura: number, altura: number, tema: Tema, caminho: string, permissoes: string[], extra: RespostasApi) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, prefs]) => localStorage.setItem(`treinos:${id}:preferencias`, prefs),
    [TREINADOR.id, JSON.stringify({ tema: tema.tema, contraste: tema.contraste ?? 'PADRAO' })] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, ...permissoes] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...extra,
  });
  await page.goto(caminho);
  return api;
}

async function caixa(l: Locator) {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

/** Onde o texto de fato começa e termina (o `Range` mede as letras, não a caixa do bloco). */
function letras(l: Locator) {
  return l.evaluate((e) => {
    const faixa = document.createRange();
    faixa.selectNodeContents(e);
    const r = faixa.getBoundingClientRect();
    return { esquerda: r.left, direita: r.right, topo: r.top, fundo: r.bottom };
  });
}

/** O centro do elemento está na janela e nada o cobre. */
function semNadaPorCima(l: Locator) {
  return l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!no && (no === e || e.contains(no));
  });
}

/** Contraste do texto com o primeiro fundo opaco atrás dele (WCAG 2.2, 1.4.3). */
function contraste(l: Locator) {
  return l.evaluate((e) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const luz = ([r, g, b]: number[]) => {
      const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };
    let fundo: number[] | null = null;
    for (let no: Element | null = e; no && !fundo; no = no.parentElement) {
      const c = rgb(getComputedStyle(no).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] === 1)) fundo = c.slice(0, 3);
    }
    const [a, b] = [luz(rgb(getComputedStyle(e).color)), luz(fundo ?? [255, 255, 255])].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

/** Painel, rolagem e rodapé da folha: o rodapé é o último filho do diálogo. */
function medirFolha(dialogo: Locator) {
  return dialogo.evaluate((d) => {
    const rolagem = [...d.querySelectorAll<HTMLElement>('div')].find((n) => ['auto', 'scroll'].includes(getComputedStyle(n).overflowY))!;
    rolagem.scrollTop = rolagem.scrollHeight;
    const painel = d.getBoundingClientRect();
    const rodape = d.lastElementChild!.getBoundingClientRect();
    return {
      painel: { esquerda: painel.left, direita: painel.right, fundo: painel.bottom },
      rodape: { topo: rodape.top, fundo: rodape.bottom },
      fimDaRolagem: rolagem.getBoundingClientRect().bottom,
      folgaDoFim: parseFloat(getComputedStyle(rolagem.firstElementChild!).paddingBottom),
    };
  });
}

/** Motivo uma vez só, colado sob a ação e com o alinhamento dela: à direita no PC, centralizado no botão cheio. */
async function conferirMotivo(dentro: Locator, acao: Locator, texto: string, largura: number) {
  await expect(dentro.getByText(texto, { exact: true })).toHaveCount(1);
  const motivo = dentro.getByText(texto, { exact: true });
  const botao = await caixa(acao);
  const l = await letras(motivo);
  expect(l.topo - (botao.y + botao.height)).toBeGreaterThanOrEqual(0);
  expect(l.topo - (botao.y + botao.height)).toBeLessThanOrEqual(8);
  if (celular(largura)) expect(Math.abs((l.esquerda + l.direita) / 2 - (botao.x + botao.width / 2))).toBeLessThanOrEqual(2);
  else expect(Math.abs(l.direita - (botao.x + botao.width))).toBeLessThanOrEqual(2);
  expect(await contraste(motivo)).toBeGreaterThanOrEqual(4.5);
  expect(await semNadaPorCima(acao)).toBe(true);
}

/** Cancelar e a principal: no PC lado a lado, a principal na borda direita do conteúdo; no celular em coluna, a principal em cima, as duas cheias. */
async function conferirOrdem(principal: Locator, cancelar: Locator, borda: { esquerda: number; direita: number }, largura: number) {
  const p = await caixa(principal);
  const c = await caixa(cancelar);
  expect(Math.abs(p.x + p.width - borda.direita)).toBeLessThanOrEqual(2);
  if (celular(largura)) {
    expect(p.y + p.height).toBeLessThanOrEqual(c.y + 1);
    for (const b of [p, c]) {
      expect(Math.abs(b.x - borda.esquerda)).toBeLessThanOrEqual(2);
      expect(Math.abs(b.x + b.width - borda.direita)).toBeLessThanOrEqual(2);
    }
  } else {
    expect(Math.abs(p.y - c.y)).toBeLessThanOrEqual(1);
    expect(c.x + c.width).toBeLessThanOrEqual(p.x);
  }
}

for (const { largura, altura, temas } of CASOS) {
  for (const tema of temas) {
    test(`folha Editar exercício ${largura}px ${nomeDoTema(tema)}: sem faixa embaixo do rodapé, ordem das ações e motivo junto do Salvar`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura, tema, '/treinador/biblioteca', ['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'], {
        'GET /exercicios/pagina': paginaDeExerciciosFalsa([EXERCICIO]),
      });
      await page.getByRole('button', { name: `Editar ${EXERCICIO.nome}` }).click();
      const dialogo = page.getByRole('dialog', { name: 'Editar exercício' });
      await expect(dialogo.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue(EXERCICIO.nome);

      // Evidência 05: o rodapé fecha a folha e o corpo encosta nele, sem a folga do "voltar ao início" numa folha curta.
      const m = await medirFolha(dialogo);
      expect(m.painel.fundo - m.rodape.fundo).toBeLessThanOrEqual(3);
      expect(Math.abs(m.fimDaRolagem - m.rodape.topo)).toBeLessThanOrEqual(2);
      expect(m.folgaDoFim).toBeLessThanOrEqual(16);
      const tirar = await caixa(dialogo.getByRole('button', { name: 'Tirar da biblioteca' }));
      expect(m.rodape.topo - (tirar.y + tirar.height)).toBeLessThanOrEqual(18);

      const salvar = dialogo.getByRole('button', { name: 'Salvar', exact: true });
      const cancelar = dialogo.getByRole('button', { name: 'Cancelar', exact: true });
      const borda = { esquerda: m.painel.esquerda + 16, direita: m.painel.direita - 16 };
      await conferirOrdem(salvar, cancelar, borda, largura);

      // Evidência 06: sem nome, o Salvar fica indisponível com o motivo uma vez, sob ele; a ação não sai do lugar.
      const antes = await caixa(salvar);
      await dialogo.getByRole('textbox', { name: 'Nome', exact: true }).fill('');
      await expect(salvar).toBeDisabled();
      await conferirMotivo(dialogo, salvar, 'Informe o nome.', largura);
      const depois = await caixa(salvar);
      expect(Math.abs(depois.x + depois.width - (antes.x + antes.width))).toBeLessThanOrEqual(1);
      if (!celular(largura)) expect(Math.abs((await caixa(cancelar)).y - depois.y)).toBeLessThanOrEqual(1);
      const comMotivo = await medirFolha(dialogo);
      expect(comMotivo.painel.fundo - comMotivo.rodape.fundo).toBeLessThanOrEqual(3);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`evidência 06 ${largura}px: "Criar e editar" sem nome mostra o motivo uma vez, com o mesmo alinhamento do botão`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura, { tema: 'CLARO' }, '/treinador/planejamento', ['MODELO_LER', 'MODELO_ALTERAR'], {
      'GET /pastas-modelos': { corpo: [] },
      'GET /receitas': { corpo: [] },
    });
    await page.getByRole('radio', { name: 'Metodologias', exact: true }).click();
    await page.getByRole('button', { name: 'Nova metodologia', exact: true }).click();
    const dialogo = page.getByRole('dialog');
    const criar = dialogo.getByRole('button', { name: 'Criar e editar', exact: true });
    await expect(criar).toBeDisabled();
    const m = await medirFolha(dialogo);
    expect(m.painel.fundo - m.rodape.fundo).toBeLessThanOrEqual(3);
    const botao = await caixa(criar);
    expect(Math.abs(botao.x + botao.width - (m.painel.direita - 16))).toBeLessThanOrEqual(2);
    if (celular(largura)) expect(Math.abs(botao.x - (m.painel.esquerda + 16))).toBeLessThanOrEqual(2);
    await conferirMotivo(dialogo, criar, 'Informe o nome do modelo.', largura);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`painel de confirmação ${largura}px: mesmo rodapé da folha`, async ({ page }) => {
    // "Tirar da biblioteca?" sai do Editar exercício.
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura, { tema: 'CLARO' }, '/treinador/biblioteca', ['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'], {
      'GET /exercicios/pagina': paginaDeExerciciosFalsa([EXERCICIO]),
    });
    await page.getByRole('button', { name: `Editar ${EXERCICIO.nome}` }).click();
    await page.getByRole('dialog', { name: 'Editar exercício' }).getByRole('button', { name: 'Tirar da biblioteca' }).click();
    const tirar = page.getByRole('alertdialog');
    await expect(tirar).toBeVisible();
    const p = await caixa(tirar);
    // O corpo do painel tem 20 px de respiro dos lados.
    const borda = { esquerda: p.x + 20, direita: p.x + p.width - 20 };
    await conferirOrdem(tirar.getByRole('button', { name: 'Tirar da biblioteca' }), tirar.getByRole('button', { name: 'Cancelar', exact: true }), borda, largura);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`painel de confirmação ${largura}px: motivo uma vez, colado sob a ação`, async ({ page }) => {
    // "Encerrar atendimento?" com o confirmar bloqueado até escolher o motivo.
    const r = resumoFalso(1);
    await page.setViewportSize({ width: largura, height: altura });
    const crm = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...rotasDaTela(),
      'GET /questionarios/opcoes': { corpo: [] },
      'GET /inscricoes': { corpo: { itens: [r], total: 1 } },
      [`GET /inscricoes/${r.id}`]: (_p, route) => json(route, detalheFalso(r)),
    });
    await page.goto('/treinador/interessados');
    await page.getByRole('button', { name: `Abrir inscrição de ${r.nome}` }).click();
    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar atendimento?' });
    const recusar = encerrar.getByRole('button', { name: /^Recusar/ });
    await expect(recusar).toBeDisabled();
    const e = await caixa(encerrar);
    await conferirOrdem(recusar, encerrar.getByRole('button', { name: 'Cancelar', exact: true }), { esquerda: e.x + 20, direita: e.x + e.width - 20 }, largura);
    await conferirMotivo(encerrar, recusar, 'Escolha o motivo.', largura);
    expect(crm.naoTratadas).toEqual([]);
    expect(crm.errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`tela longa ${largura}px: a folga do "voltar ao início" continua no fim da rolagem`, async ({ page }) => {
    const todos = Array.from({ length: 30 }, (_, i) => ({ ...EXERCICIO, id: `e${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`, nome: `Elevação ${i + 1}` }));
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, 844, { tema: 'CLARO' }, '/treinador/biblioteca', ['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'], {
      'GET /exercicios/pagina': paginaDeExerciciosFalsa(todos),
    });
    const ultima = page.getByRole('button', { name: 'Editar Elevação 30' });
    await expect(ultima).toBeVisible();
    const folga = await ultima.evaluate((e) => {
      let no: Element | null = e;
      while (no && !(['auto', 'scroll'].includes(getComputedStyle(no).overflowY) && no.scrollHeight > no.clientHeight)) no = no.parentElement;
      return parseFloat(getComputedStyle(no!.firstElementChild!).paddingBottom);
    });
    // A `Tela` já tem 16 px de respiro; com a folga, 16 + 44 + 8.
    expect(folga).toBe(68);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
