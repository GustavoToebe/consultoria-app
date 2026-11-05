import { expect, test, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { contagensFalsas } from './inscricoes-falsas';

/**
 * Banco vazio (consultoria zerada, 05/11): Planejamento, Biblioteca, Interessados, Agenda e Alunos abrem sem nenhum
 * dado, sem exceção na página e sem pedido que a API falsa não conheça, no PC e no celular. As listas vêm todas vazias:
 * nada de receita, coleção, questionário, exercício, alimento, inscrição, compromisso, evento ou aluno. Só dados fictícios.
 */
const PERMISSOES = [
  ...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_ALTERAR', 'BIBLIOTECA_LER',
  'BIBLIOTECA_ALTERAR', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR', 'AGENDA_LER', 'AGENDA_ALTERAR', 'TREINO_LER', 'DIETA_LER',
  'ATUALIZACAO_LER', 'PASTA_ALTERAR',
];

const PAINEL_VAZIO = { alunosAtivos: 0, atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, semPlano: 0, aniversariantes: [] };

/** Tudo vazio; a lista de cada tela só entra aqui quando a tela a pede (o que faltar aparece em `naoTratadas`). */
const VAZIO: RespostasApi = {
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  'GET /inscricoes/configuracao': { corpo: { aberta: false, codigo: null, texto: null, responsavelId: null, camposOcultos: [], versao: null } },
  'GET /inscricoes/retornos': { corpo: [] },
  'GET /inscricoes/modelos-de-mensagem': { corpo: [] },
  'GET /inscricoes/planos-de-referencia': { corpo: [] },
  'GET /inscricoes/contagens': { corpo: contagensFalsas() },
  'GET /inscricoes/indicadores': {
    corpo: {
      de: '2026-10-06', ate: '2026-11-05', entradas: 0, pessoas: 0, aceites: 0, recusadas: 0, desistencias: 0, reaberturas: 0,
      aceitesDasEntradas: 0, conversao: null, diasAteAceite: { mediana: null, media: null }, porMotivo: [], porOrigem: [],
    },
  },
  'GET /receitas': { corpo: [] },
  'GET /pastas-modelos': { corpo: [] },
  'GET /questionarios': { corpo: [] },
  'GET /questionarios/opcoes': { corpo: [] },
  'GET /exercicios': { corpo: [] },
  'GET /exercicios/pagina': { corpo: { itens: [], total: 0, grupos: [] } },
  'GET /alimentos': { corpo: [] },
  'GET /suplementos': { corpo: [] },
  'GET /ergogenicos': { corpo: [] },
  'GET /catalogo/exercicios': { corpo: { itens: [], total: 0 } },
  'GET /catalogo/exercicios/grupos': { corpo: [] },
  'GET /catalogo/alimentos': { corpo: { itens: [], total: 0 } },
  'GET /catalogo/alimentos/grupos': { corpo: [] },
  'GET /agenda/compromissos': { corpo: [] },
  'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
  'GET /agenda/agendas': { corpo: [] },
  'GET /agenda/eventos': { corpo: [] },
  'GET /agenda/resumo': { corpo: [] },
  'GET /atualizacoes': { corpo: [] },
  'GET /painel': { corpo: PAINEL_VAZIO },
  'GET /alunos': { corpo: { itens: [], total: 0 } },
  'GET /responsaveis': { corpo: [] },
};

/** [nome, endereço, o que a tela diz estando vazia]. */
const TELAS: readonly (readonly [string, string, RegExp])[] = [
  ['Planejamento (Treino)', '/treinador/planejamento', /Nenhum modelo ainda/],
  ['Planejamento (Dieta)', '/treinador/planejamento?aba=dieta', /Nenhum modelo ainda/],
  ['Planejamento (Atualização)', '/treinador/planejamento?aba=atualizacao', /Nenhum questionário/],
  ['Planejamento (Anamnese)', '/treinador/planejamento?aba=anamnese', /Nenhuma anamnese ainda/],
  ['Planejamento (Inscrição)', '/treinador/planejamento?aba=inscricao', /Campos fixos da página/],
  ['Biblioteca (Exercícios)', '/treinador/biblioteca?aba=exercicios', /Exercícios da biblioteca/],
  ['Biblioteca (Alimentos)', '/treinador/biblioteca?aba=alimentos', /Alimentos da biblioteca/],
  ['Biblioteca (Suplementos)', '/treinador/biblioteca?aba=suplementos', /Suplementos da biblioteca/],
  ['Biblioteca (Outros)', '/treinador/biblioteca?aba=ergogenicos', /Medicação, ergogênicos/],
  ['Biblioteca (Catálogo)', '/treinador/biblioteca?aba=catalogo', /Catálogo público/],
  ['Interessados (Lista)', '/treinador/interessados', /Nenhuma inscrição nesta lista/],
  ['Interessados (Kanban)', '/treinador/interessados?visao=kanban', /Nenhuma inscrição\./],
  ['Interessados (Indicadores)', '/treinador/interessados?visao=indicadores', /Conversão das entradas/],
  ['Agenda', '/treinador/agenda', /Nada neste período/],
  ['Alunos', '/treinador/alunos', /Nenhum aluno seu/],
];

async function abrir(page: Page, caminho: string) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    ...VAZIO,
  });
  await page.goto(caminho);
  return api;
}

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    for (const [tela, caminho, vazio] of TELAS) {
      test(`${tela} abre vazia, sem erro de página`, async ({ page }) => {
        const { naoTratadas, errosDaPagina } = await abrir(page, caminho);
        await expect(page.getByText(vazio).first()).toBeVisible();
        expect(naoTratadas).toEqual([]);
        expect(errosDaPagina).toEqual([]);
      });
    }

    test('Alunos: "Ver todos os alunos" mostra a lista vazia sem erro', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, '/treinador/alunos');
      await page.getByRole('button', { name: 'Ver todos os alunos' }).click();
      await expect(page.getByText('Nenhum aluno seu')).toHaveCount(0);
      await expect(page.getByText(/Nenhum aluno/).first()).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
