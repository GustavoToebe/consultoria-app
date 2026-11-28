import { expect, test, type Page, type Route } from '@playwright/test';

import type { AlunoDetalhe, FotoDaLinha } from '../src/api/tipos';
import { ALUNO, MARCA, PERMISSOES_TREINADOR, type Resposta, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Visualizador das fotos de evolução (ficha do aluno › Evolução e Histórico do aluno): foto aberta, navegação pelas
 * setas, teclado e miniaturas, dados ao lado (PC) ou embaixo (celular) e o modo Comparar. API falsa; as fotos são um
 * JPEG mínimo, sem imagem de pessoa. Capturas só com `SWARM_CAPTURAS_DIR` (pasta fora do repositório).
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

/** 12 fotos: Frente em 8 datas e Costas em 4; a anamnese abre a série. Pesos fictícios. */
const FOTOS: FotoDaLinha[] = [
  { fotoId: 'f1', origem: 'ANAMNESE', origemId: 'n1', data: '2026-01-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 80 },
  { fotoId: 'c1', origem: 'ANAMNESE', origemId: 'n1', data: '2026-01-01', perguntaId: 'costas', posicao: 'Costas', ordem: 1, pesoKg: 80 },
  { fotoId: 'f2', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-15', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.6 },
  { fotoId: 'f3', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-01-29', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.1 },
  { fotoId: 'c2', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-01-29', perguntaId: 'costas', posicao: 'Costas', ordem: 1, pesoKg: 79.1 },
  { fotoId: 'f4', origem: 'ATUALIZACAO', origemId: 'u3', data: '2026-02-12', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: null },
  { fotoId: 'f5', origem: 'ATUALIZACAO', origemId: 'u4', data: '2026-02-19', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 78.4 },
  { fotoId: 'c3', origem: 'ATUALIZACAO', origemId: 'u4', data: '2026-02-19', perguntaId: 'costas', posicao: 'Costas', ordem: 1, pesoKg: 78.4 },
  { fotoId: 'f6', origem: 'ATUALIZACAO', origemId: 'u5', data: '2026-02-26', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 78.1 },
  { fotoId: 'f7', origem: 'ATUALIZACAO', origemId: 'u6', data: '2026-03-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 77.9 },
  { fotoId: 'c4', origem: 'ATUALIZACAO', origemId: 'u7', data: '2026-03-04', perguntaId: 'costas', posicao: 'Costas', ordem: 1, pesoKg: 77.6 },
  { fotoId: 'f8', origem: 'ATUALIZACAO', origemId: 'u7', data: '2026-03-04', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 77.6 },
];

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);
const jpeg = (_pedido: unknown, route: Route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
const PERMISSOES = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'ANAMNESE_LER'];
const TEMAS = { claro: { tema: 'CLARO' }, escuro: { tema: 'ESCURO' } } as const;

async function capturar(page: Page, nome: string) {
  const pasta = process.env.SWARM_CAPTURAS_DIR;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

async function abrirFicha(page: Page, opcoes: { largura: number; tema?: keyof typeof TEMAS; fotos?: FotoDaLinha[]; foto?: Resposta }) {
  await page.setViewportSize({ width: opcoes.largura, height: opcoes.largura >= 1920 ? 1080 : opcoes.largura >= 1280 ? 900 : 844 });
  await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)),
    [TREINADOR.id, TEMAS[opcoes.tema ?? 'claro']] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca: MARCA })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: null } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: opcoes.fotos ?? FOTOS },
    'GET /atualizacoes/{id}/fotos/{fotoId}': opcoes.foto ?? jpeg,
    'GET /anamneses/{id}/fotos/{fotoId}': opcoes.foto ?? jpeg,
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  return api;
}

const dialogo = (page: Page, nome: 'Foto' | 'Comparar fotos') => page.getByRole('dialog', { name: nome, exact: true });

for (const largura of [390, 1280, 1920]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`abre a foto, navega e compara em ${largura}px, tema ${tema}`, async ({ page }) => {
      const { errosDaPagina } = await abrirFicha(page, { largura, tema });
      // A lista mostra o envio mais novo primeiro; a Frente de 01/03 é a 10ª foto da série (da mais antiga à mais nova).
      await page.getByRole('button', { name: 'Abrir foto: Frente, 01/03/2026' }).click();
      const foto = dialogo(page, 'Foto');
      await expect(foto).toBeVisible();
      await expect(foto.getByRole('heading', { name: '10 de 12' })).toBeVisible();
      await expect(foto.getByRole('img', { name: 'Frente, 01/03/2026' })).toBeVisible();
      await expect(foto.getByRole('button', { name: 'Fechar' })).toBeFocused();

      // Dados da foto: ao lado no PC; no celular, recolhidos embaixo (o resumo fica à vista).
      const alca = foto.getByRole('button', { name: 'Dados da foto' });
      if (largura < 768) {
        await expect(alca).toHaveAttribute('aria-expanded', 'false');
        await expect(alca).toContainText('01/03/2026 · Frente · 77,9 kg');
        await alca.click();
        await expect(alca).toHaveAttribute('aria-expanded', 'true');
      } else {
        await expect(alca).toHaveCount(0);
      }
      await expect(foto.getByText('Aluno, na atualização')).toBeVisible();
      await expect(foto.getByText('77,9 kg', { exact: true })).toBeVisible();
      await capturar(page, `visualizador-foto-${largura}-${tema}`);

      // Setas e teclado; a miniatura aberta fica marcada.
      await foto.getByRole('button', { name: 'Próxima foto' }).click();
      await expect(foto.getByRole('heading', { name: '11 de 12' })).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await expect(foto.getByRole('heading', { name: '12 de 12' })).toBeVisible();
      await expect(foto.getByRole('button', { name: 'Próxima foto' })).toBeDisabled();
      await page.keyboard.press('ArrowLeft');
      await expect(foto.getByRole('heading', { name: '11 de 12' })).toBeVisible();
      const miniaturas = foto.getByRole('list', { name: 'Todas as fotos' }).getByRole('button');
      await expect(miniaturas).toHaveCount(12);
      await miniaturas.nth(3).click();
      await expect(foto.getByRole('heading', { name: '4 de 12' })).toBeVisible();
      await expect(miniaturas.nth(3)).toHaveAttribute('aria-current', 'true');
      await expect(foto.getByRole('img', { name: 'Frente, 29/01/2026' })).toBeVisible();
      await capturar(page, `visualizador-miniaturas-${largura}-${tema}`);

      // A foto fica inteira dentro do palco e centralizada.
      const imagem = await foto.getByRole('img', { name: 'Frente, 29/01/2026' }).boundingBox();
      expect(imagem).not.toBeNull();
      expect(imagem!.x).toBeGreaterThanOrEqual(0);
      expect(imagem!.x + imagem!.width).toBeLessThanOrEqual(largura + 1);

      // Comparar: primeira e mais recente data do mesmo ângulo (Frente), lado a lado e da mesma altura.
      await foto.getByRole('button', { name: 'Comparar' }).click();
      const par = dialogo(page, 'Comparar fotos');
      await expect(par.getByRole('heading', { name: 'Comparar · Frente' })).toBeVisible();
      await expect(par.getByText('62 dias · peso −2,4 kg')).toBeVisible();
      const esquerda = par.getByRole('img', { name: 'Frente, 01/01/2026' });
      const direita = par.getByRole('img', { name: 'Frente, 04/03/2026' });
      await expect(esquerda).toBeVisible();
      await expect(direita).toBeVisible();
      const [a, b] = [await esquerda.boundingBox(), await direita.boundingBox()];
      expect(Math.abs(a!.height - b!.height)).toBeLessThan(2);
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
      expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
      await capturar(page, `visualizador-comparar-${largura}-${tema}`);

      // Trocar a data da esquerda refaz a diferença; a data sem peso mostra o traço.
      await par.getByRole('button', { name: /Data da foto da esquerda/ }).click();
      await page.getByRole('option', { name: /12\/02\/2026/ }).click();
      await expect(par.getByText('20 dias · peso —')).toBeVisible();

      // Esc fecha primeiro o Comparar, depois o visualizador; o foco volta à miniatura da lista.
      await page.keyboard.press('Escape');
      await expect(dialogo(page, 'Foto')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialogo(page, 'Foto')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir foto: Frente, 01/03/2026' })).toBeFocused();
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`foto que não carrega oferece tentar de novo em ${largura}px`, async ({ page }) => {
    let falhar = false;
    await abrirFicha(page, {
      largura,
      foto: (pedido, route) => (falhar ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : jpeg(pedido, route)),
    });
    await page.getByRole('button', { name: 'Abrir foto: Frente, 04/03/2026' }).click();
    const foto = dialogo(page, 'Foto');
    await expect(foto.getByRole('img', { name: 'Frente, 04/03/2026' })).toBeVisible();
    // As miniaturas já chegaram; só a foto grande da anterior falha.
    falhar = true;
    await foto.getByRole('button', { name: 'Foto anterior' }).click();
    await expect(foto.getByText('Não foi possível carregar a foto.')).toBeVisible();
    await capturar(page, `visualizador-erro-${largura}`);
    falhar = false;
    await foto.getByRole('button', { name: 'Tentar de novo', exact: true }).click();
    await expect(foto.getByRole('img', { name: 'Frente, 01/03/2026' })).toBeVisible();
  });

  test(`com uma data só, Comparar fica desabilitado com o motivo em ${largura}px`, async ({ page }) => {
    await abrirFicha(page, { largura, fotos: FOTOS.filter((f) => f.data === '2026-01-01') });
    await page.getByRole('button', { name: 'Abrir foto: Frente, 01/01/2026' }).click();
    const foto = dialogo(page, 'Foto');
    await expect(foto.getByRole('heading', { name: '1 de 2' })).toBeVisible();
    await expect(foto.getByRole('button', { name: 'Comparar' })).toBeDisabled();
    await expect(foto.getByText('Só há fotos de uma data neste ângulo.')).toBeVisible();
    await expect(foto.getByRole('button', { name: 'Foto anterior' })).toBeDisabled();
    await foto.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialogo(page, 'Foto')).toHaveCount(0);
  });
}

test('o aluno abre a própria foto no Histórico, sem pedir rota de equipe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/fotos/linha-do-tempo': { corpo: FOTOS },
    'GET /aluno/fotos/{id}': jpeg,
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/execucoes': { corpo: [] },
  });
  await page.goto('/aluno/historico?aba=corpo');
  await page.getByRole('button', { name: 'Abrir foto: Costas, 04/03/2026' }).click();
  const foto = dialogo(page, 'Foto');
  await expect(foto.getByRole('heading', { name: '12 de 12' })).toBeVisible();
  await foto.getByRole('button', { name: 'Comparar' }).click();
  await expect(dialogo(page, 'Comparar fotos').getByText('62 dias · peso −2,4 kg')).toBeVisible();
  expect(pedidos.some((p) => p.caminho.includes('/alunos/') || p.caminho.includes('/atualizacoes/'))).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
