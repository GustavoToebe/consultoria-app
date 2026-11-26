import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, Lesao } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * ficha: folha de lesão (24/11; grade de regiões, lado e datas, 26/11, `docs/planos/ficha-folha-de-lesao.md`): Registrar e
 * Editar lesão em 390 e 1280 px. Região numa grade de 3 por linha (radiogroup com setas), "Outra" abre o "Qual região?"; o
 * lado só para região com lado; o texto salvo é o de sempre. Início e Fim lado a lado (empilhados em 390) com "Usar hoje"
 * (relógio em 19/10/2026, Brasília); o Fim só se edita com "Recuperada" e a folha não muda de altura ao trocar a situação.
 * Salvar apagado com o motivo embaixo; fim antes do início no campo; "Sair sem salvar?". API simulada, só dados fictícios.
 */
const ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const RECUPERADA: Lesao = {
  id: 'l-rec', regiao: 'Ombro direito', descricao: 'Tendinite', dataInicio: '2026-03-01', dataFim: '2026-05-15', situacao: 'RECUPERADA',
  observacao: 'Evitar desenvolvimento acima da cabeça.',
};
const FORA_DA_LISTA: Lesao = { id: 'l-out', regiao: 'Costas', descricao: null, dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null };

async function abrir(page: Page, lesoes: Lesao[] = []) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: { corpo: lesoes },
    [`POST /alunos/${ID}/lesoes`]: (p, route) => json(route, { id: 'l-nova', ...(p.corpo as Omit<Lesao, 'id'>) }),
    [`PUT /alunos/${ID}/lesoes/l-rec`]: (p, route) => json(route, { id: 'l-rec', ...(p.corpo as Omit<Lesao, 'id'>) }),
    [`PUT /alunos/${ID}/lesoes/l-out`]: (p, route) => json(route, { id: 'l-out', ...(p.corpo as Omit<Lesao, 'id'>) }),
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  return api;
}

const registrar = async (page: Page) => {
  await page.getByRole('button', { name: 'Registrar lesão' }).click();
  return page.getByRole('dialog', { name: 'Registrar lesão' });
};
const editar = async (page: Page, regiao: string) => {
  await page.getByRole('button', { name: `Mais ações da lesão em ${regiao}` }).click();
  await page.getByRole('dialog', { name: regiao }).getByRole('button', { name: 'Editar' }).click();
  return page.getByRole('dialog', { name: 'Editar lesão' });
};
const enviosDe = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[], metodo: 'POST' | 'PUT') => pedidos.filter((p) => p.metodo === metodo && p.caminho.startsWith(`/alunos/${ID}/lesoes`));
const caixa = async (l: Locator) => (await l.boundingBox())!;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 1000 } });

    test('vazia: grade de 9 regiões em 3 colunas iguais, sem lado nem "Qual região?"; Fim desabilitado com a dica; Salvar diz o que falta', async ({ page }) => {
      const { errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      const grade = folha.getByRole('radiogroup', { name: 'Região do corpo' });
      const regioes = grade.getByRole('radio');
      await expect(regioes).toHaveText(['Ombro', 'Cotovelo', 'Punho', 'Cervical', 'Lombar', 'Quadril', 'Joelho', 'Tornozelo', 'Outra']);
      for (const r of await regioes.all()) await expect(r).toHaveAttribute('aria-checked', 'false');
      // Grade regular: 3 por linha, larguras iguais, alvo de pelo menos 44 e nenhum nome cortado.
      const [a, b, c, d] = await Promise.all([0, 1, 2, 3].map((i) => caixa(regioes.nth(i))));
      expect(Math.abs(a.y - c.y)).toBeLessThan(2);
      expect(d.y).toBeGreaterThan(a.y + a.height - 1);
      expect(Math.abs(a.width - b.width)).toBeLessThan(2);
      expect(Math.abs(a.width - (await caixa(regioes.nth(7))).width)).toBeLessThan(2);
      for (const r of await regioes.all()) {
        expect((await caixa(r)).height).toBeGreaterThanOrEqual(44);
        expect(await r.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      await expect(folha.getByLabel('Qual região?')).toHaveCount(0);
      await expect(folha.getByRole('radiogroup', { name: 'Lado (opcional)' })).toHaveCount(0);
      // Fim desabilitado, com a dica visível e ligada ao campo.
      const fim = folha.getByLabel('Fim (opcional)');
      await expect(fim).not.toBeEditable();
      await expect(fim).toHaveAttribute('aria-disabled', 'true');
      const dica = folha.getByText('Preencha quando a lesão estiver recuperada', { exact: true });
      await expect(dica).toBeVisible();
      expect(await fim.getAttribute('aria-describedby')).toBe(await dica.getAttribute('id'));
      await expect(folha.getByRole('button', { name: 'Usar hoje no Fim' })).toHaveCount(0);
      // A linha do cadeado logo abaixo do rótulo dos cuidados, ligada ao campo.
      const privacidade = folha.getByText('Só a equipe com acesso a dados sensíveis vê. Não aparece para o aluno.', { exact: true });
      await expect(privacidade).toBeVisible();
      const cuidados = folha.getByLabel('Cuidados no treino (opcional)');
      expect(await cuidados.getAttribute('aria-describedby')).toBe(await privacidade.getAttribute('id'));
      expect((await caixa(privacidade)).y).toBeLessThan((await caixa(cuidados)).y);
      const salvar = folha.getByRole('button', { name: 'Salvar', exact: true });
      await expect(salvar).toBeDisabled();
      const motivo = folha.getByText('Escolha a região do corpo', { exact: true });
      await expect(motivo).toBeVisible();
      const [s, m] = [await caixa(salvar), await caixa(motivo)];
      expect(m.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
      expect(errosDaPagina).toEqual([]);
    });

    test('região e lado: setas andam na grade, o lado some em Cervical e Lombar (e é descartado), o texto salvo é o de sempre', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      const regiao = (nome: string) => folha.getByRole('radiogroup', { name: 'Região do corpo' }).getByRole('radio', { name: nome, exact: true });
      const lado = (nome: string) => folha.getByRole('radiogroup', { name: 'Lado (opcional)' }).getByRole('radio', { name: nome, exact: true });
      await regiao('Ombro').click();
      await expect(regiao('Ombro')).toHaveAttribute('aria-checked', 'true');
      // Teclado: as setas movem o foco entre as regiões; Enter escolhe (o Espaço não: limite do primitivo, o mesmo do `Escolha`).
      await regiao('Ombro').focus();
      await page.keyboard.press('ArrowRight');
      await expect(regiao('Cotovelo')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(regiao('Cotovelo')).toHaveAttribute('aria-checked', 'true');
      await lado('Ambos').click();
      await expect(lado('Ambos')).toHaveAttribute('aria-checked', 'true');
      // Cervical e Lombar não têm lado: a escolha some e o lado é descartado.
      await regiao('Lombar').click();
      await expect(folha.getByRole('radiogroup', { name: 'Lado (opcional)' })).toHaveCount(0);
      await regiao('Joelho').click();
      await expect(lado('Ambos')).toHaveAttribute('aria-checked', 'false');
      await lado('Direito').click();
      // Tocar no lado marcado tira o lado.
      await lado('Esquerdo').click();
      await lado('Esquerdo').click();
      await expect(lado('Esquerdo')).toHaveAttribute('aria-checked', 'false');
      await lado('Direito').click();
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST').map((p) => p.corpo)).toEqual([
        { regiao: 'Joelho direito', descricao: null, dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('"Outra" abre o "Qual região?" com o foco; o lado vai sem flexionar; vazio trava o Salvar com o motivo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await folha.getByRole('radio', { name: 'Outra', exact: true }).click();
      const qual = folha.getByLabel('Qual região?');
      await expect(qual).toBeFocused();
      await expect(folha.getByText('Escreva qual é a região', { exact: true })).toBeVisible();
      await qual.fill('Antebraço');
      await folha.getByRole('radio', { name: 'Direito', exact: true }).click();
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST').map((p) => (p.corpo as Lesao).regiao)).toEqual(['Antebraço (lado direito)']);
      expect(errosDaPagina).toEqual([]);
    });

    test('datas: lado a lado no PC e empilhadas no celular; Recuperada sugere hoje no Fim, sair limpa; a folha não muda de altura', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await folha.getByRole('radio', { name: 'Punho', exact: true }).click();
      const inicio = folha.getByLabel('Início (opcional)');
      const fim = folha.getByLabel('Fim (opcional)');
      const [i, f] = [await caixa(inicio), await caixa(fim)];
      if (largura >= 1280) {
        expect(Math.abs(i.y - f.y)).toBeLessThan(2);
        expect(Math.abs(i.width - f.width)).toBeLessThan(2);
      } else {
        expect(f.y).toBeGreaterThan(i.y + i.height);
      }
      // "Usar hoje" embaixo do Início.
      const hojeNoInicio = folha.getByRole('button', { name: 'Usar hoje no Início' });
      expect((await caixa(hojeNoInicio)).y).toBeGreaterThanOrEqual(i.y + i.height - 1);
      await hojeNoInicio.click();
      await expect(inicio).toHaveValue('19/10/2026');
      await inicio.fill('01/03/2026');
      const salvar = folha.getByRole('button', { name: 'Salvar', exact: true });
      // A altura do conteúdo entre a Situação e os Cuidados não muda com a situação (no celular o rodapé é fixo, então
      // mede-se o conteúdo, não o Salvar).
      const situacao = folha.getByRole('radiogroup', { name: 'Situação' });
      const cuidados = folha.getByLabel('Cuidados no treino (opcional)');
      const altura = async () => (await caixa(cuidados)).y - (await caixa(situacao)).y;
      const antes = await altura();
      await folha.getByRole('radio', { name: 'Recuperada' }).click();
      await expect(fim).toBeEditable();
      await expect(fim).toHaveValue('19/10/2026');
      await expect(folha.getByText('Preencha quando a lesão estiver recuperada', { exact: true })).toHaveAttribute('aria-hidden', 'true');
      expect(Math.abs((await altura()) - antes)).toBeLessThan(1);
      // Apagar a sugestão vale; "Usar hoje no Fim" devolve.
      await fim.fill('');
      await folha.getByRole('button', { name: 'Usar hoje no Fim' }).click();
      await expect(fim).toHaveValue('19/10/2026');
      await fim.fill('15/05/2026');
      await folha.getByRole('radio', { name: 'Em recuperação' }).click();
      await expect(fim).not.toBeEditable();
      await expect(fim).toHaveValue('');
      expect(Math.abs((await altura()) - antes)).toBeLessThan(1);
      await salvar.click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST').map((p) => p.corpo)).toEqual([
        { regiao: 'Punho', descricao: null, dataInicio: '2026-03-01', dataFim: null, situacao: 'EM_RECUPERACAO', observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('fim antes do início: erro fixo no campo Fim e Salvar apagado com o motivo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await folha.getByRole('radio', { name: 'Tornozelo', exact: true }).click();
      await folha.getByRole('radio', { name: 'Recuperada' }).click();
      await folha.getByLabel('Início (opcional)').fill('10/05/2026');
      await folha.getByLabel('Fim (opcional)').fill('09/05/2026');
      await expect(folha.getByText('O fim não pode ser antes do início.', { exact: true })).toBeVisible();
      await expect(folha.getByLabel('Fim (opcional)')).toHaveAttribute('aria-invalid', 'true');
      await expect(folha.getByLabel('Início (opcional)')).toHaveAttribute('aria-invalid', 'false');
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
      await expect(folha.getByText('Corrija a data de fim', { exact: true })).toBeVisible();
      await folha.getByLabel('Fim (opcional)').fill('10/05/2026');
      await expect(folha.getByText('O fim não pode ser antes do início.')).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
      expect(enviosDe(pedidos, 'POST')).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Sair sem salvar? só com alteração; Continuar editando mantém, Sair fecha sem gravar', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      let folha = await registrar(page);
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      folha = await registrar(page);
      await folha.getByRole('radio', { name: 'Cervical', exact: true }).click();
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const pergunta = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      await expect(pergunta).toBeVisible();
      await pergunta.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(pergunta).toHaveCount(0);
      await expect(folha.getByRole('radio', { name: 'Cervical', exact: true })).toHaveAttribute('aria-checked', 'true');
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST')).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('editar: abre com a região, o lado e o fim; trocar para Ativa grava dataFim nulo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, [RECUPERADA]);
      const folha = await editar(page, 'Ombro direito');
      await expect(folha.getByRole('radio', { name: 'Ombro', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByRole('radio', { name: 'Direito', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByLabel('O que é (opcional)')).toHaveValue('Tendinite');
      await expect(folha.getByLabel('Cuidados no treino (opcional)')).toHaveValue('Evitar desenvolvimento acima da cabeça.');
      await expect(folha.getByLabel('Início (opcional)')).toHaveValue('01/03/2026');
      await expect(folha.getByLabel('Fim (opcional)')).toHaveValue('15/05/2026');
      await folha.getByRole('radio', { name: 'Ativa' }).click();
      await expect(folha.getByLabel('Fim (opcional)')).toHaveValue('');
      // Voltar a Recuperada devolve o fim com que a lesão abriu.
      await folha.getByRole('radio', { name: 'Recuperada' }).click();
      await expect(folha.getByLabel('Fim (opcional)')).toHaveValue('15/05/2026');
      await folha.getByRole('radio', { name: 'Ativa' }).click();
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'PUT').map((p) => p.corpo)).toEqual([
        { regiao: 'Ombro direito', descricao: 'Tendinite', dataInicio: '2026-03-01', dataFim: null, situacao: 'ATIVA', observacao: 'Evitar desenvolvimento acima da cabeça.' },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('editar região fora da lista: abre em "Outra" com o texto; salvar sem mexer grava o mesmo texto', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, [FORA_DA_LISTA]);
      const folha = await editar(page, 'Costas');
      await expect(folha.getByRole('radio', { name: 'Outra', exact: true })).toHaveAttribute('aria-checked', 'true');
      const qual = folha.getByLabel('Qual região?');
      await expect(qual).toHaveValue('Costas');
      await folha.getByLabel('O que é (opcional)').fill('Contratura');
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'PUT').map((p) => (p.corpo as Lesao).regiao)).toEqual(['Costas']);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

test('390 px com o texto EXTRA: grade de 3 colunas sem cortar e a folha sem mudar de altura ao trocar a situação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  const { errosDaPagina } = await abrir(page);
  const folha = await registrar(page);
  const regioes = folha.getByRole('radiogroup', { name: 'Região do corpo' }).getByRole('radio');
  await regioes.nth(7).click();
  const [a, c] = [await caixa(regioes.nth(0)), await caixa(regioes.nth(2))];
  expect(Math.abs(a.y - c.y)).toBeLessThan(2);
  for (const r of await regioes.all()) expect(await r.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const situacao = folha.getByRole('radiogroup', { name: 'Situação' });
  const cuidados = folha.getByLabel('Cuidados no treino (opcional)');
  const altura = async () => (await caixa(cuidados)).y - (await caixa(situacao)).y;
  const antes = await altura();
  await folha.getByRole('radio', { name: 'Recuperada' }).click();
  await expect(folha.getByLabel('Fim (opcional)')).toBeEditable();
  expect(Math.abs((await altura()) - antes)).toBeLessThan(1);
  expect(errosDaPagina).toEqual([]);
});
