import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, Lesao } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * ficha: folha de lesão (24/11, `docs/planos/ficha-folha-de-lesao.md`): Registrar e Editar lesão em 390 e 1280 px. Região
 * obrigatória (marcada no rótulo) com atalhos de região e de lado que só preenchem o campo (que segue editável); "O que é" e
 * "Cuidados no treino" (com quem vê); "Hoje" no Início (relógio em 19/10/2026, Brasília); o Fim só com "Recuperada" e sem ir
 * ao corpo nas outras situações; Salvar apagado com o motivo embaixo; fim antes do início no campo; "Sair sem salvar?".
 * API simulada, só dados fictícios.
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
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  return api;
}

const registrar = async (page: Page) => {
  await page.getByRole('button', { name: 'Registrar lesão' }).click();
  return page.getByRole('dialog', { name: 'Registrar lesão' });
};
const enviosDe = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[], metodo: 'POST' | 'PUT') => pedidos.filter((p) => p.metodo === metodo && p.caminho.startsWith(`/alunos/${ID}/lesoes`));

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 1000 } });

    test('região obrigatória marcada no rótulo; Salvar apagado diz o que falta embaixo', async ({ page }) => {
      const { errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await expect(folha.getByLabel('Região do corpo (obrigatória)')).toBeVisible();
      await expect(folha.getByLabel('O que é (opcional)')).toHaveAttribute('placeholder', 'Ex.: tendinite, entorse, pós-cirúrgico');
      await expect(folha.getByLabel('Cuidados no treino (opcional)')).toHaveAttribute('placeholder', 'Ex.: evitar carga acima da cabeça');
      // Quem vê a observação: só a equipe com acesso a dados sensíveis.
      await expect(folha.getByText('Só a equipe com acesso a dados sensíveis vê. Não aparece para o aluno nem no editor de treino.')).toBeVisible();
      const salvar = folha.getByRole('button', { name: 'Salvar', exact: true });
      await expect(salvar).toBeDisabled();
      const motivo = folha.getByText('Informe a região do corpo', { exact: true });
      await expect(motivo).toBeVisible();
      // O motivo fica colado embaixo do botão, uma vez só.
      const [b, m] = [(await salvar.boundingBox())!, (await motivo.boundingBox())!];
      expect(m.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
      await folha.getByLabel('Região do corpo (obrigatória)').fill('Costas');
      await expect(salvar).toBeEnabled();
      await expect(motivo).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('atalhos: o chip preenche o campo, o lado compõe, trocar de chip não duplica o lado e dá para editar à mão', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      const regiao = folha.getByLabel('Região do corpo (obrigatória)');
      const chip = (nome: string) => folha.getByRole('radio', { name: nome, exact: true });
      // O lado sem região escolhida não preenche nada.
      await chip('Direito').click();
      await expect(regiao).toHaveValue('');
      await chip('Ombro').click();
      await expect(regiao).toHaveValue('Ombro direito');
      await expect(chip('Ombro')).toBeChecked();
      // Trocar o atalho troca a região e mantém o lado, sem duplicá-lo.
      await chip('Joelho').click();
      await expect(regiao).toHaveValue('Joelho direito');
      await chip('Esquerdo').click();
      await expect(regiao).toHaveValue('Joelho esquerdo');
      await chip('Lombar').click();
      await expect(regiao).toHaveValue('Lombar esquerda');
      await chip('Ambos').click();
      await expect(regiao).toHaveValue('Lombar (ambos os lados)');
      // Tocar no lado marcado tira o lado: fica só a região.
      await chip('Ambos').click();
      await expect(regiao).toHaveValue('Lombar');
      // Editável à mão depois; o texto livre desmarca o atalho.
      await chip('Ombro').click();
      await chip('Direito').click();
      await regiao.fill('Ombro direito, pós-cirurgia');
      await expect(chip('Ombro')).not.toBeChecked();
      // Digitar exatamente o que o atalho produz volta a marcá-lo.
      await regiao.fill('Quadril');
      await expect(chip('Quadril')).toBeChecked();
      await regiao.fill('Quadril esquerdo, dor ao agachar');
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST').map((p) => p.corpo)).toEqual([
        { regiao: 'Quadril esquerdo, dor ao agachar', descricao: null, dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Fim só aparece com Recuperada e some ao trocar de situação: o corpo não leva o fim', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await folha.getByLabel('Região do corpo (obrigatória)').fill('Punho direito');
      await folha.getByLabel('Início (opcional)').fill('01/03/2026');
      await expect(folha.getByLabel('Fim (opcional)')).toHaveCount(0);
      await folha.getByRole('radio', { name: 'Recuperada' }).click();
      const fim = folha.getByLabel('Fim (opcional)');
      await expect(fim).toBeVisible();
      await fim.fill('15/05/2026');
      // Os dois campos de data com o mesmo tamanho e o "Hoje" na linha do Início.
      const [i, f] = [(await folha.getByLabel('Início (opcional)').boundingBox())!, (await fim.boundingBox())!];
      if (Math.abs(i.y - f.y) < 4) expect(Math.abs(i.width - f.width)).toBeLessThan(4);
      await folha.getByRole('radio', { name: 'Em recuperação' }).click();
      await expect(fim).toHaveCount(0);
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST').map((p) => p.corpo)).toEqual([
        { regiao: 'Punho direito', descricao: null, dataInicio: '2026-03-01', dataFim: null, situacao: 'EM_RECUPERACAO', observacao: null },
      ]);
      expect(errosDaPagina).toEqual([]);
    });

    test('"Hoje" preenche o Início com o dia de Brasília', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      const inicio = folha.getByLabel('Início (opcional)');
      const hoje = folha.getByRole('button', { name: 'Hoje: preencher o início' });
      await folha.getByLabel('Região do corpo (obrigatória)').fill('Cotovelo');
      // Ao lado do campo, na mesma linha.
      const [c, h] = [(await inicio.boundingBox())!, (await hoje.boundingBox())!];
      expect(h.x).toBeGreaterThanOrEqual(c.x + c.width - 1);
      expect(Math.abs(h.y + h.height / 2 - (c.y + c.height / 2))).toBeLessThan(4);
      await hoje.click();
      await expect(inicio).toHaveValue('19/10/2026');
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST')[0].corpo).toMatchObject({ regiao: 'Cotovelo', dataInicio: '2026-10-19' });
      expect(errosDaPagina).toEqual([]);
    });

    test('fim antes do início: erro vermelho no campo Fim e Salvar apagado com o motivo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      const folha = await registrar(page);
      await folha.getByLabel('Região do corpo (obrigatória)').fill('Tornozelo');
      await folha.getByRole('radio', { name: 'Recuperada' }).click();
      await folha.getByLabel('Início (opcional)').fill('10/05/2026');
      await folha.getByLabel('Fim (opcional)').fill('09/05/2026');
      await expect(folha.getByText('O fim vem antes do início.', { exact: true })).toBeVisible();
      await expect(folha.getByLabel('Fim (opcional)')).toHaveAttribute('aria-invalid', 'true');
      await expect(folha.getByLabel('Início (opcional)')).toHaveAttribute('aria-invalid', 'false');
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
      await expect(folha.getByText('Corrija a data de fim', { exact: true })).toBeVisible();
      // Os campos seguem alinhados com o erro só num deles; o "Hoje" fica na linha do Início.
      const [c, h] = [(await folha.getByLabel('Início (opcional)').boundingBox())!, (await folha.getByRole('button', { name: 'Hoje: preencher o início' }).boundingBox())!];
      expect(Math.abs(h.y + h.height / 2 - (c.y + c.height / 2))).toBeLessThan(4);
      await folha.getByLabel('Fim (opcional)').fill('10/05/2026');
      await expect(folha.getByText('O fim vem antes do início.')).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
      expect(enviosDe(pedidos, 'POST')).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Sair sem salvar? só com alteração; Continuar editando mantém, Sair fecha sem gravar', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page);
      let folha = await registrar(page);
      // Sem alteração fecha direto (Cancelar e X).
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      folha = await registrar(page);
      await folha.getByLabel('Região do corpo (obrigatória)').fill('Cervical');
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const pergunta = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      await expect(pergunta).toBeVisible();
      await pergunta.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(pergunta).toHaveCount(0);
      await expect(folha.getByLabel('Região do corpo (obrigatória)')).toHaveValue('Cervical');
      await folha.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'POST')).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('editar: abre com os atalhos marcados e o fim; trocar para Ativa grava dataFim nulo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, [RECUPERADA]);
      await page.getByRole('button', { name: 'Mais ações da lesão em Ombro direito' }).click();
      await page.getByRole('dialog', { name: 'Ombro direito' }).getByRole('button', { name: 'Editar' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar lesão' });
      await expect(folha.getByLabel('Região do corpo (obrigatória)')).toHaveValue('Ombro direito');
      await expect(folha.getByRole('radio', { name: 'Ombro', exact: true })).toBeChecked();
      await expect(folha.getByRole('radio', { name: 'Direito', exact: true })).toBeChecked();
      await expect(folha.getByLabel('O que é (opcional)')).toHaveValue('Tendinite');
      await expect(folha.getByLabel('Cuidados no treino (opcional)')).toHaveValue('Evitar desenvolvimento acima da cabeça.');
      await expect(folha.getByLabel('Início (opcional)')).toHaveValue('01/03/2026');
      await expect(folha.getByLabel('Fim (opcional)')).toHaveValue('15/05/2026');
      await folha.getByRole('radio', { name: 'Ativa' }).click();
      await expect(folha.getByLabel('Fim (opcional)')).toHaveCount(0);
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      expect(enviosDe(pedidos, 'PUT').map((p) => p.corpo)).toEqual([
        { regiao: 'Ombro direito', descricao: 'Tendinite', dataInicio: '2026-03-01', dataFim: null, situacao: 'ATIVA', observacao: 'Evitar desenvolvimento acima da cabeça.' },
      ]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
