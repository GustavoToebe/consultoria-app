import { expect, test, type Locator, type Page } from '@playwright/test';

import type { PastaModelo, Receita, TipoReceita } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Planejamento agrupado por coleção: um cartão por coleção em ordem alfabética, "Sem coleção" por último, a busca
 * procura em todas (a coleção que fica sem resultado some) e as abas Dieta, Pacotes e Mobilidade agrupam do mesmo
 * jeito. Só dados fictícios.
 */
const COLECOES: PastaModelo[] = [
  { id: 'p0000000-0000-4000-8000-000000000001', nome: 'Hipertrofia', versao: 1 },
  { id: 'p0000000-0000-4000-8000-000000000002', nome: 'Avançados', versao: 1 },
];
const [HIPERTROFIA, AVANCADOS] = COLECOES;

function modelo(n: number, tipo: TipoReceita, nome: string, pastaId: string | null, descricao: string | null = null): Receita {
  return { id: `r0000000-0000-4000-8000-00000000000${n}`, tipo, origem: 'CONSULTORIA', nome, descricao, conteudo: null, ordem: n, pastaId, versao: 1 };
}

const MODELOS: Receita[] = [
  modelo(1, 'PLANO_TREINO', 'Semana de hipertrofia', HIPERTROFIA.id),
  modelo(2, 'PLANO_TREINO', 'Semana avançada', AVANCADOS.id),
  modelo(3, 'PLANO_TREINO', 'Semana solta', null, 'Iniciação'),
  modelo(4, 'SESSAO_TREINO', 'Dia de pernas', HIPERTROFIA.id),
  modelo(5, 'PLANO_DIETA', 'Dieta base', null),
  modelo(6, 'PASTA_PLANO', 'Pacote inicial', AVANCADOS.id),
  modelo(7, 'MOBILIDADE', 'Mobilidade geral', HIPERTROFIA.id),
];

async function abrir(page: Page, aba = '', extra: RespostasApi = {}) {
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /receitas': { corpo: MODELOS },
    'GET /pastas-modelos': { corpo: COLECOES },
    ...extra,
  });
  await page.goto(`/treinador/planejamento${aba ? `?aba=${aba}` : ''}`);
  return { naoTratadas, errosDaPagina };
}

/** A faixa de uma coleção é um botão nomeado "<coleção>, aberto|recolhido" (`CabecalhoDeGrupo`). */
const faixa = (page: Page, nome: string, estado: 'aberto' | 'recolhido' = 'aberto') =>
  page.getByRole('button', { name: `${nome}, ${estado}`, exact: true });
const modeloNaTela = (page: Page, nome: string) => page.getByText(nome, { exact: true });
const dialogo = (page: Page) => page.getByRole('dialog', { name: 'Organizar coleções' });

/**
 * "Organizar coleções" com uma API que guarda o que muda (criar, renomear, excluir): Força com 12 modelos (de dois
 * tipos), Hipertrofia com 1 e Vazia sem nenhum. Devolve os pedidos para conferir o corpo.
 */
async function abrirOrganizar(page: Page, colecoes: PastaModelo[] = [
  { id: 'q0000000-0000-4000-8000-000000000001', nome: 'Força', versao: 1 },
  { id: 'q0000000-0000-4000-8000-000000000002', nome: 'Hipertrofia', versao: 1 },
  { id: 'q0000000-0000-4000-8000-000000000003', nome: 'Vazia', versao: 1 },
]) {
  let lista = [...colecoes];
  const [forca, hipertrofia] = colecoes;
  const modelos: Receita[] = [
    ...Array.from({ length: forca ? 12 : 0 }, (_, i) => ({ ...modelo(0, i % 2 ? 'PLANO_DIETA' : 'PLANO_TREINO', `Modelo ${i + 1}`, forca.id), id: `r1000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}` })),
    ...(hipertrofia ? [modelo(9, 'PLANO_TREINO', 'Semana única', hipertrofia.id)] : []),
  ];
  const r = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /receitas': { corpo: modelos },
    'GET /pastas-modelos': (_p, route) => json(route, lista),
    'POST /pastas-modelos': (p, route) => {
      const nova = { id: `q0000000-0000-4000-8000-00000000009${lista.length}`, nome: (p.corpo as { nome: string }).nome, versao: 1 };
      lista = [...lista, nova];
      return json(route, nova);
    },
    'PUT /pastas-modelos/{id}': (p, route) => {
      const id = p.caminho.split('/').pop();
      const { nome } = p.corpo as { nome: string };
      lista = lista.map((c) => (c.id === id ? { ...c, nome, versao: c.versao + 1 } : c));
      return json(route, lista.find((c) => c.id === id));
    },
    'DELETE /pastas-modelos/{id}': (p, route) => {
      const id = p.caminho.split('/').pop();
      lista = lista.filter((c) => c.id !== id);
      return route.fulfill({ status: 204 });
    },
  });
  // Nenhum `confirm()`/`alert()` do navegador: a confirmação é o painel da tela.
  page.on('dialog', (d) => { r.errosDaPagina.push(`diálogo do navegador: ${d.message()}`); void d.dismiss(); });
  await page.goto('/treinador/planejamento');
  await page.getByRole('button', { name: 'Organizar coleções', exact: true }).click();
  await expect(dialogo(page)).toBeVisible();
  return r;
}

async function topo(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox();
  expect(caixa).not.toBeNull();
  return caixa!.y;
}

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('?tipo=metodologia abre o Planejamento já no chip Metodologias (Primeiros passos › Abrir Metodologias)', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, 'treino&tipo=metodologia', {
        'GET /receitas': { corpo: [...MODELOS, modelo(8, 'METODOLOGIA', 'Metodologia fictícia', null)] },
      });
      await expect(modeloNaTela(page, 'Metodologia fictícia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('aba Treino: coleções nascem fechadas, em ordem alfabética, "Sem coleção" por último, cada modelo no seu', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Avançados', 'recolhido')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(faixa(page, 'Sem coleção', 'recolhido')).toBeVisible();
      // Fechadas mostram o resumo e nenhum modelo.
      await expect(page.getByText('1 modelo', { exact: true })).toHaveCount(3);
      for (const nome of ['Semana avançada', 'Semana de hipertrofia', 'Semana solta']) await expect(modeloNaTela(page, nome)).toHaveCount(0);
      // Abre de baixo para cima: abrir uma não desloca as que estão acima.
      await faixa(page, 'Sem coleção', 'recolhido').click();
      await faixa(page, 'Hipertrofia', 'recolhido').click();
      await faixa(page, 'Avançados', 'recolhido').click();
      const yAvancados = await topo(faixa(page, 'Avançados'));
      const yHipertrofia = await topo(faixa(page, 'Hipertrofia'));
      const ySem = await topo(faixa(page, 'Sem coleção'));
      expect(yAvancados).toBeLessThan(yHipertrofia);
      expect(yHipertrofia).toBeLessThan(ySem);
      // Cada modelo embaixo da própria faixa.
      const yAvancada = await topo(modeloNaTela(page, 'Semana avançada'));
      expect(yAvancada).toBeGreaterThan(yAvancados);
      expect(yAvancada).toBeLessThan(yHipertrofia);
      const yDeHipertrofia = await topo(modeloNaTela(page, 'Semana de hipertrofia'));
      expect(yDeHipertrofia).toBeGreaterThan(yHipertrofia);
      expect(yDeHipertrofia).toBeLessThan(ySem);
      expect(await topo(modeloNaTela(page, 'Semana solta'))).toBeGreaterThan(ySem);
      // Só os modelos do chip escolhido (Semanas de treino) contam: um por coleção.
      await expect(page.getByText('1 modelo', { exact: true })).toHaveCount(3);
      await expect(modeloNaTela(page, 'Dia de pernas')).toHaveCount(0);
      // "Organizar coleções" fica ao lado da busca; não existe mais filtro de coleção.
      await expect(page.getByRole('button', { name: 'Organizar coleções', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Coleção:/ })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('a busca procura em todas as coleções (sem acento, nome e descrição), abre as com resultado e limpar volta ao de antes', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Avançados', 'recolhido')).toBeVisible();
      // Uma aberta à mão antes de buscar: depois de limpar a busca, só ela continua aberta.
      await faixa(page, 'Avançados', 'recolhido').click();
      await expect(modeloNaTela(page, 'Semana avançada')).toBeVisible();
      const busca = page.getByRole('textbox', { name: 'Buscar modelo', exact: true });
      await busca.fill('iniciacao');
      await expect(modeloNaTela(page, 'Semana solta')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      await expect(faixa(page, 'Hipertrofia')).toHaveCount(0);
      await busca.fill('AVANÇADA');
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana avançada')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await busca.fill('xyz');
      await expect(page.getByText('Nenhum modelo com essa busca.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      // Limpar a busca volta ao estado de antes dela: só a que a pessoa abriu fica aberta, as outras voltam fechadas.
      await busca.fill('');
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana avançada')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(faixa(page, 'Sem coleção', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('trocar o chip de tipo mantém o agrupamento; abrir ou recolher numa lista não mexe na outra', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await faixa(page, 'Hipertrofia', 'recolhido').click();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await page.getByLabel('Dias de treino', { exact: true }).click();
      // Dias de treino tem uma coleção só: nasce aberta.
      await expect(modeloNaTela(page, 'Dia de pernas')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      await faixa(page, 'Hipertrofia').click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Dia de pernas')).toHaveCount(0);
      // De volta às semanas, a coleção continua aberta como ficou; as outras, fechadas.
      await page.getByLabel('Semanas de treino', { exact: true }).click();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      await expect(faixa(page, 'Avançados', 'recolhido')).toBeVisible();
      await page.getByLabel('Dias de treino', { exact: true }).click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('abrir mostra os modelos da coleção, recolher esconde, e buscar abre; limpar volta ao de antes', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      await faixa(page, 'Hipertrofia', 'recolhido').click();
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana avançada')).toHaveCount(0);
      await faixa(page, 'Hipertrofia').click();
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      // Recolhida, a busca abre: o resultado nunca fica escondido; limpar fecha de novo.
      const busca = page.getByRole('textbox', { name: 'Buscar modelo', exact: true });
      await busca.fill('hipertrofia');
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toBeVisible();
      await busca.fill('');
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      await expect(modeloNaTela(page, 'Semana de hipertrofia')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('se as coleções não carregam, mostra o erro e não agrupa', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, '', { 'GET /pastas-modelos': erroApi(500, 'Falha fictícia nas coleções.') });
      await expect(page.getByText('Falha fictícia nas coleções.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('as abas Atualização e Anamnese não mostram coleção nenhuma', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, 'atualizacao', { 'GET /questionarios': { corpo: [] } });
      await expect(page.getByText('Nenhum questionário ainda.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Organizar coleções', exact: true })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=anamnese');
      await expect(page.getByText('Nenhuma anamnese ainda. Crie uma em branco e monte as seções.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /, aberto$/ })).toHaveCount(0);
      await expect(modeloNaTela(page, 'Semana solta')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('o lápis da faixa abre "Organizar coleções" já renomeando a coleção, com a contagem de todos os tipos', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await expect(faixa(page, 'Hipertrofia', 'recolhido')).toBeVisible();
      // "Sem coleção" não é uma coleção: não tem lápis.
      await expect(page.getByRole('button', { name: /^Renomear coleção Sem coleção/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'Renomear coleção Hipertrofia', exact: true }).click();
      const folha = dialogo(page);
      await expect(folha).toBeVisible();
      const campo = folha.getByRole('textbox', { name: 'Nome da coleção Hipertrofia', exact: true });
      await expect(campo).toHaveValue('Hipertrofia');
      await expect(campo).toBeFocused();
      await expect(folha.getByRole('button', { name: 'Salvar nome da coleção Hipertrofia', exact: true })).toBeVisible();
      // A folha conta os modelos de todos os tipos (a página mostra só os do chip): Avançados tem 2 (semana e pacote).
      await expect(folha.getByText('2 modelos', { exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Organizar coleções: uma linha por coleção com a contagem no plural certo e as ações com nome', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirOrganizar(page);
      const folha = dialogo(page);
      for (const texto of ['12 modelos', '1 modelo', 'Nenhum modelo']) await expect(folha.getByText(texto, { exact: true })).toBeVisible();
      for (const nome of ['Força', 'Hipertrofia', 'Vazia']) {
        await expect(folha.getByRole('button', { name: `Renomear coleção ${nome}`, exact: true })).toBeVisible();
        await expect(folha.getByRole('button', { name: `Excluir coleção ${nome}`, exact: true })).toBeVisible();
      }
      // A linha não estoura a folha: as ações cabem na largura dela.
      const caixa = (await folha.boundingBox())!;
      const excluir = (await folha.getByRole('button', { name: 'Excluir coleção Hipertrofia', exact: true }).boundingBox())!;
      expect(excluir.x + excluir.width).toBeLessThanOrEqual(caixa.x + caixa.width);
      // O texto explicativo continua.
      await expect(folha.getByText('Coleções só organizam seus modelos. Para aplicar treinos e dietas juntos a um aluno, use um pacote.', { exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Criar coleção fica habilitado: vazio e repetido dão erro no campo; Enter cria', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrirOrganizar(page);
      const folha = dialogo(page);
      const criar = folha.getByRole('button', { name: 'Criar coleção', exact: true });
      const campo = folha.getByRole('textbox', { name: 'Nova coleção', exact: true });
      await expect(criar).toBeEnabled();
      await criar.click();
      await expect(folha.getByText('Informe o nome da coleção.', { exact: true })).toBeVisible();
      await expect(campo).toHaveAttribute('aria-invalid', 'true');
      await expect(criar).toBeEnabled();
      await campo.fill('  forca ');
      await campo.press('Enter');
      await expect(folha.getByText('Já existe uma coleção com esse nome. Escolha outro.', { exact: true })).toBeVisible();
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/pastas-modelos')).toEqual([]);
      await campo.fill('Resistência');
      await expect(folha.getByText('Já existe uma coleção com esse nome. Escolha outro.', { exact: true })).toHaveCount(0);
      await campo.press('Enter');
      await expect(folha.getByRole('button', { name: 'Renomear coleção Resistência', exact: true })).toBeVisible();
      await expect(campo).toHaveValue('');
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/pastas-modelos').map((p) => p.corpo)).toEqual([{ nome: 'Resistência' }]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('renomear na linha: campo focado, vazio e repetido com erro, Esc cancela sem fechar a folha, Enter salva', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrirOrganizar(page);
      const folha = dialogo(page);
      const renomear = folha.getByRole('button', { name: 'Renomear coleção Hipertrofia', exact: true });
      await renomear.click();
      const campo = folha.getByRole('textbox', { name: 'Nome da coleção Hipertrofia', exact: true });
      await expect(campo).toBeFocused();
      await expect(campo).toHaveValue('Hipertrofia');
      await campo.fill('');
      await campo.press('Enter');
      await expect(folha.getByText('Informe o nome da coleção.', { exact: true })).toBeVisible();
      await campo.fill('FORÇA');
      await campo.press('Enter');
      await expect(folha.getByText('Já existe uma coleção com esse nome. Escolha outro.', { exact: true })).toBeVisible();
      // Esc cancela só a linha: a folha continua e o foco volta ao "Renomear".
      await campo.press('Escape');
      await expect(campo).toHaveCount(0);
      await expect(folha).toBeVisible();
      await expect(renomear).toBeFocused();
      await expect(folha.getByText('Hipertrofia', { exact: true })).toBeVisible();
      expect(pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
      // Cancelar pelo botão também devolve o foco.
      await renomear.click();
      await folha.getByRole('button', { name: 'Cancelar renomear Hipertrofia', exact: true }).click();
      await expect(renomear).toBeFocused();
      await renomear.click();
      await campo.fill('Hipertrofia avançada');
      await campo.press('Enter');
      const novo = folha.getByRole('button', { name: 'Renomear coleção Hipertrofia avançada', exact: true });
      await expect(novo).toBeFocused();
      expect(pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ nome: 'Hipertrofia avançada', versao: 1 }]);
      // Renomear de novo usa a versão nova (a que voltou do recarregar), sem conflito.
      await novo.click();
      await folha.getByRole('textbox', { name: 'Nome da coleção Hipertrofia avançada', exact: true }).fill('Hipertrofia 2');
      await folha.getByRole('button', { name: 'Salvar nome da coleção Hipertrofia avançada', exact: true }).click();
      await expect(folha.getByRole('button', { name: 'Renomear coleção Hipertrofia 2', exact: true })).toBeFocused();
      expect(pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ nome: 'Hipertrofia avançada', versao: 1 }, { nome: 'Hipertrofia 2', versao: 2 }]);
      // Fora da edição, o Esc fecha a folha como sempre.
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('excluir confirma no painel dizendo o que acontece com os modelos; o foco vai à linha vizinha', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrirOrganizar(page);
      const folha = dialogo(page);
      const painel = page.getByRole('alertdialog');
      await folha.getByRole('button', { name: 'Excluir coleção Força', exact: true }).click();
      await expect(painel.getByText('Os 12 modelos continuam no Planejamento, em Sem coleção.', { exact: true })).toBeVisible();
      await painel.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await folha.getByRole('button', { name: 'Excluir coleção Hipertrofia', exact: true }).click();
      await expect(painel.getByText('O modelo continua no Planejamento, em Sem coleção.', { exact: true })).toBeVisible();
      // O Esc fecha só o painel; a folha continua.
      await page.keyboard.press('Escape');
      await expect(painel).toHaveCount(0);
      await expect(folha).toBeVisible();
      await folha.getByRole('button', { name: 'Excluir coleção Vazia', exact: true }).click();
      await expect(painel.getByText('Nenhum modelo será afetado.', { exact: true })).toBeVisible();
      await painel.getByRole('button', { name: 'Excluir coleção', exact: true }).click();
      await expect(folha.getByRole('button', { name: 'Renomear coleção Vazia', exact: true })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Renomear coleção Hipertrofia', exact: true })).toBeFocused();
      expect(pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/pastas-modelos/q0000000-0000-4000-8000-000000000003']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem coleções: uma linha "Nenhuma coleção ainda."', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirOrganizar(page, []);
      await expect(dialogo(page).getByText('Nenhuma coleção ainda.', { exact: true })).toBeVisible();
      await expect(dialogo(page).getByRole('textbox', { name: 'Nova coleção', exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Dieta, Pacotes e Mobilidade agrupam do mesmo jeito', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, 'dieta');
      await expect(faixa(page, 'Sem coleção')).toBeVisible();
      await expect(modeloNaTela(page, 'Dieta base')).toBeVisible();
      await expect(faixa(page, 'Hipertrofia')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=pacotes');
      await expect(faixa(page, 'Avançados')).toBeVisible();
      await expect(modeloNaTela(page, 'Pacote inicial')).toBeVisible();
      await expect(faixa(page, 'Sem coleção')).toHaveCount(0);
      await page.goto('/treinador/planejamento?aba=mobilidade');
      await expect(faixa(page, 'Hipertrofia')).toBeVisible();
      await expect(modeloNaTela(page, 'Mobilidade geral')).toBeVisible();
      await expect(faixa(page, 'Avançados')).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
