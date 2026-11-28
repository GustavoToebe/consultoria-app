import { expect, test, type Page } from '@playwright/test';

import type { SessaoDetalhe } from '../src/servicos/importacaoAssistida';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Leitura por imagem (4.2), com a API simulada e só dados fictícios: JPG e PNG só passam com `importacaoPorImagemHabilitada`
 * do `GET /eu` ligada (desligada, o app recusa com o texto de sempre e não mostra o aviso); com ela, o aviso do que vai
 * inteiro ao provedor aparece embaixo da área, a imagem acima de 900 KB é recusada sem subir e o arquivo lido pela IA
 * com o documento anexo diz "Lido pela imagem do documento", sem a cobertura do texto extraído.
 */
const BASE = '/importacoes/assistidas/sessoes';
const TODAS = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', 'PASTA_ALTERAR', 'MODELO_ALTERAR'];
const AVISO = /enviados inteiros ao provedor de IA/;

const vazia: SessaoDetalhe = {
  id: 's1', estado: 'RECEBENDO', revisao: 1, arquivos: [], grupos: [], duvidas: [],
  criadoEm: '2026-10-19T12:00:00Z', expiraEm: '2026-10-20T12:00:00Z',
  modoProcessamento: { modoEfetivo: 'REGRAS', fallbackParaRegras: false },
};
const arquivoDeImagem = { id: 'f1', nomeOriginal: 'print-de-teste.png', formato: 'PNG', tamanhoBytes: 2048, estado: 'RECEBIDO', criadoEm: '2026-10-19T12:00:00Z' };
/** Lida: o print pela IA com o arquivo anexo e um PDF escaneado que caiu nas regras (este mantém a cobertura em vermelho). */
const lida: SessaoDetalhe = {
  ...vazia, estado: 'REVISANDO', revisao: 2,
  arquivos: [
    { ...arquivoDeImagem, estado: 'PROCESSADO', modo: 'IA', enviadoComoArquivo: true, cobertura: { status: 'SEM_TEXTO' } },
    { id: 'f2', nomeOriginal: 'escaneado-de-teste.pdf', formato: 'PDF', tamanhoBytes: 4096, estado: 'PROCESSADO', criadoEm: '2026-10-19T12:00:00Z',
      modo: 'REGRAS', motivoFallback: 'ENVIO_DESLIGADO', enviadoComoArquivo: false, cobertura: { status: 'SEM_TEXTO', paginasTotal: 2, paginasLidas: 0 } },
  ],
};

const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (!CAPTURAS) return;
  const janela = page.viewportSize();
  if (janela) await page.setViewportSize({ width: janela.width, height: 2000 });
  await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
  if (janela) await page.setViewportSize(janela);
}

async function abrir(page: Page, { comImagem, inicial = vazia }: { comImagem: boolean; inicial?: SessaoDetalhe }) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: TODAS, importacaoPorImagemHabilitada: comImagem })),
    [`POST ${BASE}`]: { corpo: vazia },
    [`GET ${BASE}`]: (_p, route) => json(route, []),
    [`GET ${BASE}/{id}`]: (_p, route) => json(route, inicial),
    [`POST ${BASE}/{id}/arquivos`]: { corpo: arquivoDeImagem },
  });
}

/** Solta na área arquivos de mentira com o tamanho pedido (os eventos vão no elemento, como no `importacao-assistida`). */
async function soltar(page: Page, arquivos: { nome: string; bytes: number; tipo: string }[]) {
  const dt = await page.evaluateHandle((lista) => {
    const d = new DataTransfer();
    for (const a of lista) d.items.add(new File([new Uint8Array(a.bytes)], a.nome, { type: a.tipo }));
    return d;
  }, arquivos);
  const area = page.getByTestId('area-de-soltar');
  await area.dispatchEvent('dragenter', { dataTransfer: dt });
  await area.dispatchEvent('dragover', { dataTransfer: dt });
  await area.dispatchEvent('drop', { dataTransfer: dt });
}

const enviosDeArquivo = (api: Awaited<ReturnType<typeof abrir>>) =>
  api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/arquivos`);

for (const largura of [390, 1280]) {
  test.describe(`leitura por imagem, ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('desligada: o PNG é recusado com o texto de sempre, sem subir e sem o aviso', async ({ page }) => {
      const api = await abrir(page, { comImagem: false });
      await page.goto('/treinador/importacao/assistida');
      await expect(page.getByTestId('area-de-soltar')).toBeVisible();
      await expect(page.getByText(AVISO)).toHaveCount(0);
      await soltar(page, [{ nome: 'print-de-teste.png', bytes: 2048, tipo: 'image/png' }]);
      const lista = page.getByRole('list', { name: 'Arquivos do último envio' });
      await expect(lista.getByText('Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.')).toBeVisible();
      expect(enviosDeArquivo(api)).toHaveLength(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('ligada: aviso embaixo da área; o PNG sobe, a imagem acima de 900 KB e o GIF são recusados sem subir', async ({ page }) => {
      const api = await abrir(page, { comImagem: true });
      await page.goto('/treinador/importacao/assistida');
      await expect(page.getByText(AVISO)).toBeVisible();
      await expect(page.getByText(/não envie fotos de corpo/)).toBeVisible();
      await capturar(page, `importacao-imagem-aviso-${largura}`);
      await soltar(page, [
        { nome: 'print-de-teste.png', bytes: 2048, tipo: 'image/png' },
        { nome: 'grande-de-teste.jpg', bytes: 901 * 1024, tipo: 'image/jpeg' },
        { nome: 'anim-de-teste.gif', bytes: 10, tipo: 'image/gif' },
      ]);
      const lista = page.getByRole('list', { name: 'Arquivos do último envio' });
      await expect(lista.getByRole('listitem')).toHaveCount(3);
      await expect(lista.getByRole('listitem').nth(0)).toContainText('Enviado');
      await expect(lista.getByText('Passa do tamanho máximo de 900 KB. Divida em partes menores.')).toBeVisible();
      await expect(lista.getByText('Formato não aceito. Envie PDF, DOCX, XLSX, CSV, JPG ou PNG.')).toBeVisible();
      await capturar(page, `importacao-imagem-envio-${largura}`);
      expect(enviosDeArquivo(api)).toHaveLength(1);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('lido pela imagem do documento: sem a cobertura do texto; o escaneado sem IA mantém a dele', async ({ page }) => {
      const api = await abrir(page, { comImagem: true, inicial: lida });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      const arquivos = page.getByRole('list', { name: 'Arquivos da importação' });
      const imagem = arquivos.getByRole('listitem').nth(0);
      await expect(imagem.getByText('Lido pela imagem do documento')).toBeVisible();
      await expect(imagem.getByText('PNG', { exact: true })).toBeVisible();
      await expect(imagem.getByText('Sem texto legível no arquivo')).toHaveCount(0);
      await expect(arquivos.getByRole('listitem').nth(1).getByText('Nenhuma página legível (0 de 2)')).toBeVisible();
      await capturar(page, `importacao-imagem-lida-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}
