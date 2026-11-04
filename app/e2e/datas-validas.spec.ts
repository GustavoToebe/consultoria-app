import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, Lesao, RegistroPeso } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Datas válidas (C76, reunião de 30/10), campos de REGISTRO da ficha: peso, lesão e avaliação física. Ano 0261 e data
 * futura são recusados com a mensagem no próprio campo e o botão de salvar travado (na avaliação, o Salvar confere ao
 * tocar e não chama a API). O relógio fica em 19/10/2026 para o "futuro" ser sempre o mesmo. As datas de pasta (início
 * em 0261) e de compromisso estão em `pasta-periodo.spec.ts` e `agenda-presencial.spec.ts`; a pasta que se finaliza,
 * em `pasta-e-atualizacao.spec.ts`; o nascimento (pergunta DATA), em `anamnese.spec.ts`. Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

async function abrirFicha(page: Page) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: { corpo: [] },
    [`POST /alunos/${ALUNO_ID}/pesos`]: (p, route) => {
      const c = p.corpo as { data: string; pesoKg: number };
      const novo: RegistroPeso = { id: 'r1', data: c.data, pesoKg: c.pesoKg, variacao: null, observacao: null };
      return json(route, [novo]);
    },
    [`POST /alunos/${ALUNO_ID}/lesoes`]: (p, route) => json(route, { id: 'l1', ...(p.corpo as Omit<Lesao, 'id'>) }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  return api;
}

const FAIXA_DE_REGISTRO = 'use uma data entre 01/01/1900 e hoje';

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('peso: ano 0261 e data futura são recusados no campo, com o Registrar travado; a data de hoje passa', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirFicha(page);
      await page.getByRole('button', { name: 'Registrar peso' }).click();
      const folha = page.getByRole('dialog', { name: 'Registrar peso' });
      // A observação do peso é só da equipe: o formulário diz isso.
      await expect(folha.getByText('Só a equipe vê esta observação.', { exact: true })).toBeVisible();
      const data = folha.getByLabel('Data', { exact: true });
      const registrar = folha.getByRole('button', { name: 'Registrar', exact: true });
      await folha.getByRole('textbox', { name: 'Peso (kg)', exact: true }).fill('80,5');
      await expect(registrar).toBeEnabled();

      await data.fill('05/05/0261');
      // A máscara não troca o ano digitado.
      await expect(data).toHaveValue('05/05/0261');
      await expect(folha.getByText(`Data do peso: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
      await expect(registrar).toBeDisabled();

      // Futuro (o relógio está em 19/10/2026): também recusado.
      await data.fill('20/10/2026');
      await expect(folha.getByText(`Data do peso: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
      await expect(registrar).toBeDisabled();

      await data.fill('19/10/2026');
      await expect(folha.getByText(/use uma data entre/)).toHaveCount(0);
      await expect(registrar).toBeEnabled();
      await registrar.click();
      await expect(folha).toHaveCount(0);
      const envios = pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/pesos`);
      expect(envios.map((p) => p.corpo)).toEqual([{ data: '2026-10-19', pesoKg: 80.5, observacao: null }]);
      expect(errosDaPagina).toEqual([]);
    });

    test('lesão: início em 0261 e fim no futuro são recusados nos campos, com o Salvar travado; datas passadas passam', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirFicha(page);
      await page.getByRole('button', { name: 'Registrar lesão' }).click();
      const folha = page.getByRole('dialog', { name: 'Registrar lesão' });
      const salvar = folha.getByRole('button', { name: 'Salvar', exact: true });
      const inicio = folha.getByLabel('Início (opcional)');
      const fim = folha.getByLabel('Fim (opcional)');
      await folha.getByLabel('Região do corpo').fill('Ombro direito');
      await expect(salvar).toBeEnabled();

      await inicio.fill('05/05/0261');
      await expect(inicio).toHaveValue('05/05/0261');
      await expect(folha.getByText(`Início da lesão: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
      await expect(salvar).toBeDisabled();

      await inicio.fill('05/03/2025');
      await expect(salvar).toBeEnabled();
      await fim.fill('20/10/2026');
      await expect(folha.getByText(`Fim da lesão: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
      await expect(salvar).toBeDisabled();

      await fim.fill('19/10/2026');
      await expect(folha.getByText(/use uma data entre/)).toHaveCount(0);
      await expect(salvar).toBeEnabled();
      await salvar.click();
      await expect(folha).toHaveCount(0);
      const envios = pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/lesoes`);
      expect(envios).toHaveLength(1);
      expect(envios[0].corpo).toMatchObject({ regiao: 'Ombro direito', dataInicio: '2025-03-05', dataFim: '2026-10-19' });
      expect(errosDaPagina).toEqual([]);
    });

    test('avaliação física: ano 0261 e data futura mostram a mensagem no campo e o Salvar não chama a API', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirFicha(page);
      await page.getByRole('button', { name: 'Nova avaliação' }).click();
      const folha = page.getByRole('dialog', { name: 'Nova avaliação física' });
      const data = folha.getByLabel('Data', { exact: true });
      await folha.getByLabel('Cintura (cm)').fill('85,5');
      const envios = () => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/avaliacoes-fisicas`);

      for (const invalida of ['05/05/0261', '20/10/2026']) {
        await data.fill(invalida);
        await expect(data).toHaveValue(invalida);
        await expect(folha.getByText(`Data da avaliação: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
        await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect(folha.getByText(`Data da avaliação: ${FAIXA_DE_REGISTRO}`)).toBeVisible();
        expect(envios()).toHaveLength(0);
      }
      expect(errosDaPagina).toEqual([]);
    });
  });
}
