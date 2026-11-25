import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * T-006 (25/11): linha com ação desabilitada na `ListaDeDados` (Dados do aluno › Configuração do acompanhamento, "Grupo da
 * comunidade"). Aluno sem acesso: o valor ("Sem grupo") não pode ficar sem largura nem quebrar letra por letra, e o motivo
 * ("Só entra num grupo quem já tem acesso ao app.") fica numa linha de ajuda abaixo da linha, na largura toda, nunca dentro
 * da coluna da ação. Mede retângulos de verdade (largura do valor, linhas do texto, sobreposição). Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const MOTIVO = 'Só entra num grupo quem já tem acesso ao app.';
/** O mesmo mínimo da peça (`LARGURA_MINIMA_DO_VALOR` em `ui/ListaDeDados.tsx`, texto normal). */
const MINIMO_DO_VALOR = 120;
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, podId: null, podNome: null,
};
const SEM_ACESSO: AlunoDetalhe = { ...FICHA, temAcesso: false, emailDeAcesso: null };
const PERMISSOES = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'];

const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}

async function abrirFicha(page: Page, ficha: AlunoDetalhe, tema?: string, tamanhoTexto = 'PADRAO') {
  if (tema || tamanhoTexto !== 'PADRAO') await page.addInitScript(([id, t, tt]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, contraste: 'PADRAO', tamanhoTexto: tt })), [TREINADOR.id, tema ?? 'ESCURO', tamanhoTexto]);
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: ficha },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  const linha = page.getByRole('listitem').filter({ hasText: 'Grupo da comunidade' });
  await linha.scrollIntoViewIfNeeded();
  await expect(linha).toBeVisible();
  return linha;
}

interface Caixa { x: number; y: number; w: number; h: number }
interface Medidas { linha: Caixa; valor: Caixa; texto: Caixa; linhasDoTexto: number; botao: Caixa; ajuda: Caixa | null; ajudaNaAcao: boolean }

/** Retângulos da linha "Grupo da comunidade": o valor (coluna e texto), o desenho do botão e a ajuda abaixo. */
async function medir(page: Page, valorDaLinha = 'Sem grupo'): Promise<Medidas> {
  return page.evaluate((valorEsperado) => {
    const caixa = (r: DOMRect): Caixa => ({ x: r.x, y: r.y, w: r.width, h: r.height });
    const item = [...document.querySelectorAll('[role="listitem"]')].find((e) => e.textContent?.includes('Grupo da comunidade'))!;
    const valor = item.querySelector('[role="definition"]')!;
    const botao = item.querySelector('[role="button"]')!;
    const alvo = [...valor.querySelectorAll('div')].find((e) => e.childElementCount === 0 && e.textContent === valorEsperado)!;
    const intervalo = document.createRange();
    intervalo.selectNodeContents(alvo);
    const ajuda = item.querySelector('[data-testid="ajuda-da-linha"]');
    // A ajuda está "na ação" se a coluna dela também contém o botão.
    const ajudaNaAcao = !!ajuda && [...item.querySelectorAll('*')].some((e) => e.contains(botao) && e.contains(ajuda) && e !== item && !e.contains(valor));
    return {
      linha: caixa(item.getBoundingClientRect()), valor: caixa(valor.getBoundingClientRect()), texto: caixa(intervalo.getBoundingClientRect()),
      linhasDoTexto: intervalo.getClientRects().length, botao: caixa((botao.firstElementChild ?? botao).getBoundingClientRect()),
      ajuda: ajuda ? caixa(ajuda.getBoundingClientRect()) : null, ajudaNaAcao,
    };
  }, valorDaLinha);
}

const cruza = (a: Caixa, b: Caixa) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

test('sem espaço ao lado do valor, a ação desce para baixo dele, à direita, e o valor guarda a largura mínima (320 px, texto extra grande)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const nomeDoGrupo = 'Turma das seis da manhã do time de corrida';
  const linha = await abrirFicha(page, { ...FICHA, podId: 'd0000000-0000-4000-8000-0000000000a1', podNome: nomeDoGrupo }, undefined, 'EXTRA');
  await expect(linha.getByRole('button', { name: 'Mudar grupo' })).toBeEnabled();
  await capturar(page, 'ficha-acao-desce-320');
  const m = await medir(page, nomeDoGrupo);
  // O piso do valor cresce com o texto grande (120 x fator); a ação cai abaixo do texto e encosta na borda direita da linha.
  expect(m.valor.w).toBeGreaterThanOrEqual(MINIMO_DO_VALOR);
  expect(m.botao.y).toBeGreaterThanOrEqual(m.texto.y + m.texto.h - 0.5);
  expect(m.botao.x + m.botao.w).toBeGreaterThan(m.linha.x + m.linha.w - 40);
  expect(cruza(m.botao, m.texto)).toBe(false);
});

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('aluno sem acesso: valor legível, botão desabilitado e motivo abaixo, na largura da linha, sem sobreposição', async ({ page }) => {
      const linha = await abrirFicha(page, SEM_ACESSO);
      const botao = linha.getByRole('button', { name: /Mudar grupo/ });
      await expect(botao).toBeDisabled();
      await expect(linha.getByText(MOTIVO)).toBeVisible();
      await capturar(page, `ficha-sem-acesso-${largura}`);
      const m = await medir(page);

      expect(m.valor.w).toBeGreaterThanOrEqual(MINIMO_DO_VALOR);
      expect(m.linhasDoTexto, '"Sem grupo" em uma linha só').toBe(1);
      expect(m.ajuda, 'linha de ajuda existe').not.toBeNull();
      const ajuda = m.ajuda!;
      expect(m.ajudaNaAcao, 'o motivo não fica na coluna da ação').toBe(false);
      // Abaixo do valor e do botão, e dentro da largura da linha (a ajuda usa a largura toda).
      expect(ajuda.y).toBeGreaterThanOrEqual(m.texto.y + m.texto.h - 0.5);
      expect(ajuda.y).toBeGreaterThanOrEqual(m.botao.y + m.botao.h - 0.5);
      expect(ajuda.x).toBeGreaterThanOrEqual(m.linha.x - 0.5);
      expect(ajuda.x + ajuda.w).toBeLessThanOrEqual(m.linha.x + m.linha.w + 0.5);
      expect(ajuda.w).toBeGreaterThan(m.linha.w * 0.5);
      // Nada se sobrepõe: botão, texto do valor e motivo.
      expect(cruza(m.botao, m.texto)).toBe(false);
      expect(cruza(m.botao, ajuda)).toBe(false);
      expect(cruza(m.texto, ajuda)).toBe(false);
      // O botão fica dentro da linha e à direita do valor, ou (sem espaço) embaixo dele, alinhado à direita.
      expect(m.botao.x + m.botao.w).toBeLessThanOrEqual(m.linha.x + m.linha.w + 0.5);
      expect(m.botao.x).toBeGreaterThanOrEqual(m.linha.x - 0.5);
    });

    test('aluno com acesso: sem motivo e o botão habilitado ao lado do valor', async ({ page }) => {
      const linha = await abrirFicha(page, FICHA);
      await expect(linha.getByRole('button', { name: 'Mudar grupo' })).toBeEnabled();
      await expect(linha.getByText(MOTIVO)).toHaveCount(0);
      await capturar(page, `ficha-com-acesso-${largura}`);
      const m = await medir(page);
      expect(m.valor.w).toBeGreaterThanOrEqual(MINIMO_DO_VALOR);
      expect(m.linhasDoTexto).toBe(1);
      expect(m.ajuda).toBeNull();
      expect(cruza(m.botao, m.texto)).toBe(false);
    });

    for (const tema of ['ESCURO', 'CLARO']) {
      test(`capturas ${tema.toLowerCase()}`, async ({ page }) => {
        test.skip(!CAPTURAS, 'só com CAPTURAS_DIR');
        await abrirFicha(page, SEM_ACESSO, tema);
        await capturar(page, `ficha-sem-acesso-${tema.toLowerCase()}-${largura}`);
        const outra = await page.context().newPage();
        await outra.setViewportSize({ width: largura, height: 900 });
        await abrirFicha(outra, FICHA, tema);
        await capturar(outra, `ficha-com-acesso-${tema.toLowerCase()}-${largura}`);
      });
    }
  });
}
