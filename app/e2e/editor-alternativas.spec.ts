import { expect, test, type Page } from '@playwright/test';

import type { ConteudoTreino, Exercicio } from '../src/api/tipos';
import { exercicio, serie } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * "Alternativas de troca" do exercício no editor de treino (Lote B, passo 3a de `docs/planos/trocar-exercicio.md`): até 3
 * da biblioteca, do mesmo tipo do principal, sem repetir; remover; "Trocar em todas as sessões" com confirmação; e o erro
 * da API na linha da alternativa. Só dados fictícios (o plano de `editor-inspetor.dados.ts`).
 */

const PC = { width: 1280, height: 900 };
const CELULAR = { width: 390, height: 844 };

const SUPINO = BIBLIOTECA[0];
// Um exercício a mais na biblioteca, só para ser alternativa já gravada do supino.
const HALTERES: Exercicio = { ...BIBLIOTECA[1], id: 'e0000000-0000-4000-8000-000000000008', nome: 'Supino com halteres no banco' };
const alt = (e: Exercicio) => ({ exercicioId: e.id, nome: e.nome, videoUrl: null });

async function abrir(page: Page, ajustar: (c: ConteudoTreino) => void = () => {}, publicar?: { field: string; message: string }[]) {
  const detalhe = () => {
    const d = planoDetalhe(false);
    ajustar(d.rascunho);
    return d;
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: [...BIBLIOTECA, HALTERES] },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, detalhe()),
    [`PUT /planos-treino/${PLANO_ID}/rascunho`]: (p, route) => {
      const d = detalhe();
      const corpo = p.corpo as { conteudo: ConteudoTreino };
      return json(route, { ...d, plano: { ...d.plano, versao: 2 }, rascunho: corpo.conteudo });
    },
    [`POST /planos-treino/${PLANO_ID}/publicar`]: (_p, route) => {
      const e = erroApi(422, 'O plano tem problemas que impedem a publicação.', 'PLANO_INVALIDO', publicar ?? []);
      return json(route, e.corpo, e.status);
    },
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  return api;
}

const escritas = (pedidos: PedidoFalso[]) => pedidos.filter((p) => (p.metodo === 'PUT' || p.metodo === 'POST') && !p.caminho.startsWith('/auth/'));
const corpoSalvo = (pedidos: PedidoFalso[]) =>
  (escritas(pedidos).filter((p) => p.caminho.endsWith('/rascunho')).at(-1)?.corpo as { conteudo: ConteudoTreino } | undefined)?.conteudo;
const secao = (page: Page) => page.getByRole('button', { name: /^Alternativas de troca/ });
const adicionar = (page: Page) => page.getByRole('button', { name: `Adicionar alternativa a ${SUPINO.nome}`, exact: true });

async function escolherAlternativa(page: Page, nome: string) {
  await adicionar(page).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByText('Escolher alternativa', { exact: true })).toBeVisible();
  await folha.getByRole('button', { name: `Escolher ${nome}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Remover a alternativa ${nome}`, exact: true })).toBeVisible();
}

test.describe('alternativas de troca no PC (1280)', () => {
  test.use({ viewport: PC });

  test('adiciona até 3 do mesmo tipo, sem o principal, trava com o motivo, remove e salva', async ({ page }) => {
    const api = await abrir(page);
    await expect(secao(page)).toHaveAccessibleName(/\(nenhuma\)/);
    await secao(page).click();
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'true');

    await adicionar(page).click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText('Escolher alternativa', { exact: true })).toBeVisible();
    // Cardio não troca por carga, e o próprio supino não é alternativa dele.
    await expect(folha.getByRole('button', { name: 'Escolher Esteira', exact: true })).toHaveCount(0);
    await expect(folha.getByRole('button', { name: `Escolher ${SUPINO.nome}`, exact: true })).toHaveCount(0);
    // Sem "exercício manual": a alternativa é sempre da biblioteca.
    await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Inexistente');
    await expect(folha.getByRole('button', { name: /^Usar só o nome/ })).toHaveCount(0);
    await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('');
    await folha.getByRole('button', { name: 'Escolher Supino inclinado com halteres', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remover a alternativa Supino inclinado com halteres', exact: true })).toBeVisible();

    // A que já está na lista não aparece de novo.
    await adicionar(page).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Escolher Supino inclinado com halteres', exact: true })).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Escolher Crucifixo na máquina', exact: true }).click();
    await escolherAlternativa(page, 'Tríceps na polia');
    await expect(secao(page)).toHaveAccessibleName(/\(3 de 3\)/);
    await expect(adicionar(page)).toBeDisabled();
    await expect(page.getByText('Já tem 3 alternativas, o máximo. Remova uma para adicionar outra.')).toBeVisible();

    await page.getByRole('button', { name: 'Remover a alternativa Crucifixo na máquina', exact: true }).click();
    await expect(secao(page)).toHaveAccessibleName(/\(2 de 3\)/);
    await expect(adicionar(page)).toBeEnabled();

    // Nada vai à API antes do "Salvar rascunho".
    expect(escritas(api.pedidos)).toEqual([]);
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => corpoSalvo(api.pedidos)?.sessoes[0].exercicios[0].alternativas?.map((a) => a.exercicioId)).toEqual([
      BIBLIOTECA[1].id, BIBLIOTECA[3].id,
    ]);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('"Trocar em todas as sessões" confirma com a contagem, troca os lugares e dá para desfazer', async ({ page }) => {
    const api = await abrir(page, (c) => {
      c.sessoes[0].exercicios[0].alternativas = [alt(HALTERES)];
      // O mesmo supino também na sessão de costas, sem alternativas.
      c.sessoes[1].exercicios.push(exercicio('supino-costas', {
        exercicioId: SUPINO.id, nome: SUPINO.nome, modalidade: 'LIVRE', series: [serie('supino-costas-1', { repsMin: 8, repsMax: 10 })],
      }));
    });
    // Nasce fechada mesmo com alternativa (18/11); o botão diz quantas tem.
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(secao(page)).toHaveAccessibleName(/\(1 de 3\)/);
    await secao(page).click();
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: `Trocar em todas as sessões: ${SUPINO.nome} por ${HALTERES.nome}`, exact: true }).click();

    const painel = page.getByRole('alertdialog');
    await expect(painel.getByText('Trocar em todas as sessões deste plano?')).toBeVisible();
    await expect(painel.getByText(/em 2 exercícios \(2 sessões\)/)).toBeVisible();
    await expect(painel.getByText(/Muda só o rascunho/)).toBeVisible();
    await painel.getByRole('button', { name: 'Trocar em todas as sessões', exact: true }).click();

    // O principal virou a alternativa e o antigo ficou como alternativa dele.
    await expect(page.getByRole('button', { name: new RegExp(`^Exercício 1 de 7: ${HALTERES.nome}`) })).toBeVisible();
    await expect(page.getByRole('button', { name: `Remover a alternativa ${SUPINO.nome}`, exact: true })).toBeVisible();
    await expect(page.getByText(`“${SUPINO.nome}” trocado por “${HALTERES.nome}” em todas as sessões.`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => corpoSalvo(api.pedidos)?.sessoes[0].exercicios[0]).toMatchObject({
      exercicioId: HALTERES.id, nome: HALTERES.nome, alternativas: [alt(SUPINO)],
    });
    const costas = corpoSalvo(api.pedidos)!.sessoes[1].exercicios.at(-1)!;
    expect(costas).toMatchObject({ exercicioId: HALTERES.id, nome: HALTERES.nome });
    // As séries não mudam.
    expect(costas.series).toHaveLength(1);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('erro da API na alternativa aparece na linha dela, com a seção aberta', async ({ page }) => {
    const mensagem = 'A alternativa precisa ser do mesmo tipo do exercício (cardio só por cardio).';
    const api = await abrir(page, (c) => {
      c.sessoes[0].exercicios[0].alternativas = [alt(BIBLIOTECA[5])];
    }, [{ field: 'sessoes[0].exercicios[0].alternativas[0].exercicioId', message: mensagem }]);
    // Fechada ao abrir (18/11); o erro apontado pela publicação a abre.
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Publicar treino', exact: true }).click();
    await page.getByRole('dialog', { name: 'Publicar treino' }).getByRole('button', { name: 'Publicar agora' }).click();
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'true');
    const linha = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Remover a alternativa Paralelas', exact: true }) });
    await expect(linha.getByText(mensagem)).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });
});

test.describe('alternativas de troca no celular (390)', () => {
  test.use({ viewport: CELULAR });

  test('mesma seção no exercício aberto, troca por ícone e nada sai da largura', async ({ page }) => {
    const api = await abrir(page, (c) => {
      c.sessoes[0].exercicios[0].alternativas = [alt(HALTERES)];
    });
    await page.getByRole('button', { name: `Editar ${SUPINO.nome}`, exact: true }).click();
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'false');
    await secao(page).click();
    await expect(secao(page)).toHaveAttribute('aria-expanded', 'true');
    // No estreito o "Trocar em todas as sessões" é só o ícone, com o mesmo nome acessível.
    const trocar = page.getByRole('button', { name: `Trocar em todas as sessões: ${SUPINO.nome} por ${HALTERES.nome}`, exact: true });
    await expect(trocar).toBeVisible();
    expect((await trocar.boundingBox())!.width).toBeGreaterThanOrEqual(44);

    await escolherAlternativa(page, 'Paralelas');
    await expect(secao(page)).toHaveAccessibleName(/\(2 de 3\)/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(escritas(api.pedidos)).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
});
