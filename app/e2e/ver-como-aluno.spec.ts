import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ConteudoTreino, FatoresDoAlimento, PlanoDetalhe, PlanoResumo } from '../src/api/tipos';
import { exercicio, serie, sessao as sessaoDeTreino } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * "Ver como o aluno" (C34, plano `ver-como-aluno`): o botão da barra do editor abre a Folha com a prévia só de leitura,
 * montada com o que está na tela (inclusive o que não foi salvo), a faixa da D4, o ✓ desabilitado e sem efeito, e
 * nenhuma requisição além de GET depois de abrir. Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const TREINO_ID = 'p0000000-0000-4000-8000-0000000000a1';
const DIETA_ID = 'p0000000-0000-4000-8000-0000000000b1';
const TEXTO_DA_PREVIA = 'Prévia: é assim que o aluno vê. Nada é registrado aqui.';

function resumo(id: string, titulo: string): PlanoResumo {
  return {
    id, alunoId: ALUNO_ID, pastaId: null, titulo, inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 3,
  };
}

const TREINO: PlanoDetalhe<ConteudoTreino> = {
  plano: resumo(TREINO_ID, 'Treino de teste'),
  rascunho: {
    objetivo: null,
    orientacoes: null,
    sessoes: [
      sessaoDeTreino('sa', [exercicio('remada', { nome: 'Remada fictícia', series: [serie('s1'), serie('s2')] })], [], { nome: 'Costas' }),
    ],
  },
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000a1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: resumo(DIETA_ID, 'Dieta de teste'),
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
    refeicoes: [{
      uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null,
      opcoes: [{ uid: 'almoco-a', rotulo: 'A', itens: [{
        uid: 'arroz', alimentoId: 'arroz', nome: 'Arroz fictício', quantidade: 150, unidade: 'g',
        kcal: null, proteina: null, carboidrato: null, gordura: null, manual: false, fatorCorrecao: null, fatorCoccao: null,
      }] }],
    }],
  },
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000b1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

const FATORES: FatoresDoAlimento[] = [{ alimentoId: 'arroz', fatorCorrecao: null, fatorCoccao: 2.5, grupo: 'Cereais e derivados' }];

/** Sessão do treinador com o tema escolhido e as rotas que os editores leem ao abrir. */
async function abrirApi(page: Page, tema: 'CLARO' | 'ESCURO', extra: RespostasApi) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
    // O editor em duas colunas (1280) mostra a foto do aluno; sem foto a API responde 404.
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: [] },
    'GET /alimentos': { corpo: [] },
    // O ponto de Interessados no menu lateral.
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...extra,
  });
}

/**
 * A partir de agora, guarda todo pedido que não é GET (para a página inteira, não só a API). A única exceção é o `HEAD /`
 * do NetInfo, que confere a conexão na própria origem do app de tempos em tempos, com ou sem a prévia (não lê nem grava dado).
 */
function gravarEscritas(page: Page) {
  const escritas: string[] = [];
  const pedidos: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    pedidos.push(`${r.method()} ${url.pathname}`);
    const conferenciaDeConexao = r.method() === 'HEAD' && url.pathname === '/';
    if (r.method() !== 'GET' && !conferenciaDeConexao) escritas.push(`${r.method()} ${r.url()}`);
  });
  return { escritas, pedidos };
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`treino: prévia com a sessão renomeada sem salvar, ✓ sem efeito e só GET (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const { naoTratadas, errosDaPagina } = await abrirApi(page, tema, { [`GET /planos-treino/${TREINO_ID}`]: { corpo: TREINO } });
      await page.goto(`/treinador/treinos/${TREINO_ID}`);
      const nome = page.getByRole('textbox', { name: 'Nome da sessão' });
      await expect(nome).toHaveValue('Costas');
      await nome.fill('Costas no rascunho');
      await page.screenshot({ path: testInfo.outputPath(`treino-barra-${largura}-${tema}.png`) });

      const { escritas, pedidos } = gravarEscritas(page);
      await page.getByRole('button', { name: 'Ver como o aluno' }).click();
      const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
      await expect(folha).toBeVisible();
      await expect(folha.getByText(TEXTO_DA_PREVIA)).toBeVisible();
      await expect(folha.getByText('Divisões da semana', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`treino-divisoes-${largura}-${tema}.png`) });

      // O nome editado e não salvo é o que o aluno veria; o dia abre a lista de exercícios, e o exercício, as séries.
      await folha.getByRole('button', { name: /Costas no rascunho/ }).click();
      await expect(folha.getByText('1 exercício programado')).toBeVisible();
      await folha.getByRole('link', { name: /Remada fictícia/ }).click();
      await expect(folha.getByText(/Exercício 1 de 1/)).toBeVisible();

      const marcas = folha.getByRole('checkbox');
      await expect(marcas).toHaveCount(2);
      const primeira = marcas.first();
      await expect(primeira).toBeDisabled();
      await primeira.click({ force: true });
      await expect(primeira).toHaveAttribute('aria-checked', 'false');
      await expect(folha.getByText(TEXTO_DA_PREVIA)).toBeVisible();
      // Os controles da carga parecem ativos, mas na prévia não gravam nada (o "só GET" no fim cobre também eles).
      await folha.getByRole('button', { name: /^Aumentar/ }).first().click();
      await page.screenshot({ path: testInfo.outputPath(`treino-exercicio-${largura}-${tema}.png`) });

      // Voltar percorre o mesmo caminho, sem sair da folha.
      await folha.getByRole('button', { name: 'Voltar para lista do dia' }).click();
      await expect(folha.getByText('1 exercício programado')).toBeVisible();
      await folha.getByRole('button', { name: 'Voltar para divisões da semana' }).click();
      await expect(folha.getByText('Divisões da semana', { exact: true })).toBeVisible();

      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      // O editor continua com o rascunho: nada foi salvo nem registrado.
      await expect(nome).toHaveValue('Costas no rascunho');
      expect(escritas).toEqual([]);
      expect(pedidos.filter((p) => p.includes('/api/aluno/'))).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(`dieta: prévia com o título mudado sem salvar, fatores da biblioteca e só GET (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const { naoTratadas, errosDaPagina } = await abrirApi(page, tema, {
        [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DIETA },
        'GET /alimentos/fatores': { corpo: FATORES },
      });
      await page.goto(`/treinador/dietas/${DIETA_ID}`);
      await page.getByRole('button', { name: /Configuração do plano/ }).click();
      const nome = page.getByRole('textbox', { name: 'Título' });
      await expect(nome).toHaveValue('Dieta de teste');
      await nome.fill('Dieta no rascunho');

      const { escritas, pedidos } = gravarEscritas(page);
      await page.getByRole('button', { name: 'Ver como o aluno' }).click();
      const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
      await expect(folha).toBeVisible();
      await expect(folha.getByText(TEXTO_DA_PREVIA)).toBeVisible();
      await expect(folha.getByText('Dieta no rascunho', { exact: true })).toBeVisible();
      await expect(folha.getByText(/Almoço/).first()).toBeVisible();
      await expect(folha.getByText('Arroz fictício').first()).toBeVisible();
      await expect(folha.getByText('Só o aluno abre isto no app dele.')).toHaveCount(2);
      // D7: os fatores vêm da biblioteca na hora (prova também que o ouvinte de pedidos está ligado).
      expect(pedidos.some((p) => p.startsWith('GET /api/alimentos/fatores'))).toBe(true);

      // Lista de compras e PDF ficam desabilitados e sem efeito.
      const url = page.url();
      for (const rotulo of ['Lista de compras', 'Baixar PDF da dieta']) {
        const botao = folha.getByRole('button', { name: rotulo });
        await expect(botao).toBeDisabled();
        await botao.click({ force: true });
      }
      expect(page.url()).toBe(url);
      await expect(folha.getByRole('dialog', { name: 'PDF da dieta' })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`dieta-${largura}-${tema}.png`) });

      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(nome).toHaveValue('Dieta no rascunho');
      expect(escritas).toEqual([]);
      expect(pedidos.filter((p) => p.includes('/api/aluno/'))).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('dieta: fatores que não carregam mostram o erro e "Tentar de novo" busca outra vez', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let vezes = 0;
  const { errosDaPagina } = await abrirApi(page, 'CLARO', {
    [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DIETA },
    'GET /alimentos/fatores': (_pedido, route) => {
      vezes += 1;
      const r = vezes === 1 ? erroApi(500, 'Erro.') : { status: 200, corpo: FATORES };
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.corpo) });
    },
  });
  await page.goto(`/treinador/dietas/${DIETA_ID}`);
  await expect(page.getByRole('button', { name: 'Ver como o aluno' })).toBeVisible();
  const { escritas } = gravarEscritas(page);
  await page.getByRole('button', { name: 'Ver como o aluno' }).click();
  const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
  await folha.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(folha.getByText('Arroz fictício').first()).toBeVisible();
  expect(vezes).toBe(2);
  expect(escritas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// Decisão 17 (Gustavo, 04/11): mesmo com o treinador em libras, a prévia mostra kg (a unidade do aluno fica no aparelho dele).
test('treino: prévia em kg mesmo com o treinador em libras', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ unidadeDeCarga: 'lb' })), TREINADOR.id);
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR'], unidadeDeCargaHabilitada: true })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: [] },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${TREINO_ID}`]: { corpo: TREINO },
  });
  await page.goto(`/treinador/treinos/${TREINO_ID}`);
  await page.getByRole('button', { name: 'Ver como o aluno' }).click();
  const folha = page.getByRole('dialog', { name: 'Ver como o aluno' });
  await folha.getByRole('button', { name: /Costas/ }).click();
  await folha.getByRole('link', { name: /Remada fictícia/ }).click();
  await expect(folha.getByRole('button', { name: /^Aumentar .* kg em / }).first()).toBeVisible();
  await expect(folha.getByRole('button', { name: /^Aumentar .* lb em / })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
