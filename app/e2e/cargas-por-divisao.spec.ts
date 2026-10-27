import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, DiaDeTreino, EtapaRegistrada, PastaResumo, SerieFeita } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Cargas por divisão com séries registradas por etapa (Cluster, Rest-pause): os blocos com o total do servidor,
 * "parcial", "Carga variável" no lugar do "—" e o volume de carga do exercício. Na tela do aluno (histórico) e na ficha
 * do treinador (dentro da pasta). Números fictícios.
 */

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const etapa = (posicao: number, repeticoes: number | null, carga: number | null): EtapaRegistrada => ({ posicao, repeticoes, carga, situacao: 'FEITA' });

const serie = (extra: Partial<SerieFeita>): SerieFeita => ({
  id: Math.random().toString(36),
  serieUid: 's',
  tipo: 'WS',
  trabalho: true,
  carga: 40,
  unidade: 'kg',
  repeticoes: 6,
  concluida: true,
  observacao: null,
  ...extra,
});

const exercicio = (uid: string, nome: string, series: SerieFeita[]) => ({ exercicioUid: uid, exercicioId: uid, nome, series });

const DIAS: DiaDeTreino[] = [
  {
    data: '2026-10-07',
    sessoes: [
      {
        sessaoUid: 'sa',
        sessao: 'Costas',
        planoVersaoId: 'v1',
        exercicios: [
          exercicio('e1', 'Remada com carga comum', [serie({ carga: 40, repeticoes: 14, etapas: [etapa(1, 4, 40), etapa(2, 4, 40), etapa(3, 4, 40), etapa(4, 2, 40)] })]),
          exercicio('e2', 'Remada com carga variável', [serie({ carga: null, repeticoes: 8, etapas: [etapa(1, 4, 40), etapa(2, 4, 42.5)] })]),
          exercicio('e3', 'Remada parcial', [serie({ carga: 40, repeticoes: null, concluida: false, etapas: [etapa(1, 4, 40), etapa(2, 4, 40)] })]),
          exercicio('e4', 'Remada sem etapas', [serie({ carga: 75, repeticoes: 6 })]),
          // O texto mais longo da coluna Reps: três blocos feitos e um não feito.
          exercicio('e5', 'Remada com etapa não feita', [serie({ carga: 40, repeticoes: 12, etapas: [etapa(1, 4, 40), etapa(2, 4, 40), { posicao: 3, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' }, etapa(4, 4, 40)] })]),
        ],
      },
    ],
  },
];

async function conferir(page: Page) {
  // Carga comum: a carga, os blocos com o total e o volume (40 kg × 14 = 560 kg).
  await expect(page.getByText('4+4+4+2 = 14', { exact: true })).toBeVisible();
  await expect(page.getByText('Volume de carga: 560 kg', { exact: true })).toBeVisible();
  // Carga variável: escrita, sem inventar uma carga, com os blocos.
  await expect(page.getByText('Carga variável', { exact: true })).toBeVisible();
  await expect(page.getByText('4+4 = 8', { exact: true })).toBeVisible();
  // Parcial: escrito, sem total.
  await expect(page.getByText('4+4 (parcial)', { exact: true })).toBeVisible();
  // Sem etapas: como antes, mais o volume (75 kg × 6 = 450 kg).
  await expect(page.getByText('Volume de carga: 450 kg', { exact: true })).toBeVisible();
  // "Só houve aquecimento" não vale para linha com etapas.
  await expect(page.getByText('nesse dia só houve aquecimento')).toHaveCount(0);
  // Nada cortado nem rolagem horizontal da página.
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
  // O bloco do exercício recorta o que passa da borda (overflow hidden) sem criar rolagem: nenhum texto de uma tabela
  // pode terminar além da borda direita dela.
  await expect(page.locator('[aria-label^="Cargas de"]')).toHaveCount(5);
  const cortados = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-label^="Cargas de"]')).flatMap((tabela) => {
      const limite = tabela.getBoundingClientRect().right + 1;
      return Array.from(tabela.querySelectorAll('*'))
        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
        .filter((el) => el.getBoundingClientRect().right > limite || el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent);
    }),
  );
  expect(cortados).toEqual([]);
}

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null,
  endereco: null, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null,
  anonimizado: false, emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, sexo: 'FEMININO',
};

const PASTA: PastaResumo = {
  id: 'p0000000-0000-4000-8000-000000000001', alunoId: ALUNO_ID, titulo: 'Pasta de outubro',
  inicio: '2026-10-01', fim: '2026-10-31', concluidaEm: null,
};

for (const largura of [390, 1280]) {
  test(`aluno vê os blocos, "parcial", "Carga variável" e o volume nas cargas por divisão (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/execucoes': { corpo: DIAS },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/historico');
    await conferir(page);
    expect(errosDaPagina).toEqual([]);
  });

  test(`treinador vê o mesmo na pasta do aluno (${largura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'TREINO_LER'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: DIAS },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [] },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByText('Pasta de outubro').click();
    await conferir(page);
    expect(errosDaPagina).toEqual([]);
  });
}
