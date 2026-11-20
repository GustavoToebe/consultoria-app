import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, PlaylistDaComunidade } from '../src/api/comunidadeTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Novo vídeo / Editar vídeo na ordem do D4 (19/11, `docs/planos/comunidade-19-11.md`): Link do vídeo primeiro, a capa do
 * YouTube preenchida sozinha logo abaixo (pela nossa API, nunca pelo YouTube), depois Título, Coleção e Descrição; "Publicar"
 * e "Salvar"; link inválido com o erro sob o campo e o Publicar desativado. API simulada; só dados fictícios.
 * `CAPTURAS_DIR` (fora do repositório) guarda as capturas.
 */
const YT_A = 'https://youtu.be/aaaaaaaaaaa';
const YT_B = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';
const COLECOES: PlaylistDaComunidade[] = [
  { id: 'p1', nome: 'Técnica', ordem: 0, totalAulas: 1 },
  { id: 'p2', nome: 'Alimentação', ordem: 1, totalAulas: 0 },
];
const AULA: AulaDaComunidade = {
  id: 'a1', titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: YT_A, capaId: 'capa-da-aula',
  playlistId: 'p1', ordem: 0, publicada: true, criadaEm: '2026-11-19T12:00:00-03:00', totalComentarios: 0,
};
const base = (aulas: AulaDaComunidade[] = []): RespostasApi => ({
  'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
  'GET /comunidade/mural': { corpo: { content: [], totalElements: 0 } },
  'GET /comunidade/aulas': { corpo: aulas },
  'GET /comunidade/pods': { corpo: [] },
  'GET /comunidade/playlists': { corpo: COLECOES },
});

const CAPTURAS = process.env.CAPTURAS_DIR;
const capturar = async (page: Page, nome: string) => {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
};
const tema = (page: Page, t: string) => page.addInitScript(([id, tm]) =>
  localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [TREINADOR.id, t]);
const foiPost = (p: { metodo: string; caminho: string }, caminho: string) => p.metodo === 'POST' && p.caminho === caminho;

/** Capa fictícia: um JPEG liso gerado na página. */
async function jpegFicticio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#5a7d9a';
    ctx.fillRect(0, 0, 320, 180);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

async function abrir(page: Page, respostas: RespostasApi, aulas: AulaDaComunidade[] = []) {
  let jpeg: Buffer = Buffer.alloc(0);
  let n = 0;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })),
    ...base(aulas),
    'POST /comunidade/capas/youtube': (p, route) => json(route, { id: `capa-yt-${++n}` }),
    'GET /comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
    ...respostas,
  });
  await page.goto('/treinador/comunidade');
  jpeg = await jpegFicticio(page);
  return api;
}

const TEMAS_DA_FOLHA = [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const;
const topo = async (l: Locator) => (await l.boundingBox())!.y;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const) {
      test(`folha vazia no tema ${nome}: Publicar mostra o que falta e leva o foco ao link (primeiro campo)`, async ({ page }) => {
        await tema(page, t);
        const api = await abrir(page, {});
        await page.getByRole('button', { name: 'Novo vídeo' }).click();
        const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
        await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toBeVisible();
        await capturar(page, `${nome}-vazia-${largura}`);
        await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
        await expect(folha.getByText('Cole o link do vídeo.')).toBeVisible();
        await expect(folha.getByText('Escreva o título.')).toBeVisible();
        await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toBeFocused();
        await capturar(page, `${nome}-vazia-erros-${largura}`);
        expect(api.pedidos.some((p) => foiPost(p, '/comunidade/aulas'))).toBe(false);
      });
    }

    test('a capa que chega depois de o link sair do YouTube é descartada', async ({ page }) => {
      let soltar: () => void = () => {};
      const presa = new Promise<void>((resolve) => { soltar = resolve; });
      const api = await abrir(page, {
        'POST /comunidade/capas/youtube': async (_p, route) => { await presa; return json(route, { id: 'capa-atrasada' }); },
        'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } },
      });
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      const link = folha.getByRole('textbox', { name: 'Link do vídeo' });
      await link.fill(YT_A);
      await expect(folha.getByRole('button', { name: 'Buscando a capa…' })).toBeVisible();
      await link.fill('https://exemplo.test/video');
      await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled();
      soltar();
      await expect.poll(() => api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(1);
      await page.waitForTimeout(300);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: 'https://exemplo.test/video', playlistId: null });
    });

    test('novo vídeo: ordem do D4, capa do YouTube sozinha com prévia e publica com a capa', async ({ page }) => {
      await tema(page, 'ESCURO');
      const api = await abrir(page, { 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } } });
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      const link = folha.getByRole('textbox', { name: 'Link do vídeo' });
      const titulo = folha.getByRole('textbox', { name: 'Título' });
      const colecao = folha.getByRole('button', { name: 'Coleção: Sem coleção. Escolher.' });
      const descricao = folha.getByRole('textbox', { name: /^Descrição/ });
      await expect(link).toBeVisible();
      // Link primeiro, depois Título, Coleção e Descrição; sem link, a capa ainda não aparece.
      const ys = [await topo(link), await topo(titulo), await topo(colecao), await topo(descricao)];
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
      await expect(folha.getByText('Capa (opcional)')).toHaveCount(0);
      await expect(folha.getByText('Entra no fim da coleção.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled();

      await link.fill(YT_A);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Trocar capa' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Remover capa' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toHaveCount(0);
      expect(api.pedidos.find((p) => foiPost(p, '/comunidade/capas/youtube'))?.corpo).toEqual({ videoUrl: YT_A });
      // A capa fica entre o link e o título.
      expect(await topo(folha.getByRole('img', { name: 'Capa do vídeo' }))).toBeLessThan(await topo(titulo));
      await titulo.fill('Vídeo de teste');
      await capturar(page, `escuro-link-valido-previa-${largura}`);

      // A capa automática acompanha o link: outro vídeo traz a capa dele; link fora do YouTube tira a capa.
      await link.fill(YT_B);
      await expect.poll(() => api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(2);
      await link.fill('https://video.exemplo.invalid/aula');
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Escolher capa' })).toBeVisible();
      // Voltar ao primeiro vídeo reaproveita a capa já buscada (não gasta outra da cota).
      await link.fill(YT_A);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      expect(api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(2);

      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: YT_A, playlistId: null, capaId: 'capa-yt-1' });
      await expect(folha).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('capa trocada à mão não muda com o link (aviso e "Usar a capa do YouTube"); remover deixa sem capa', async ({ page }) => {
      await tema(page, 'ESCURO');
      const api = await abrir(page, {
        'POST /comunidade/capas': { corpo: { id: 'capa-manual' } },
        'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } },
      });
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      const link = folha.getByRole('textbox', { name: 'Link do vídeo' });
      await link.fill(YT_A);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      const [seletor] = await Promise.all([page.waitForEvent('filechooser'), folha.getByRole('button', { name: 'Trocar capa' }).click()]);
      await seletor.setFiles({ name: 'capa-ficticia.jpg', mimeType: 'image/jpeg', buffer: await jpegFicticio(page) });
      await expect.poll(() => api.pedidos.some((p) => foiPost(p, '/comunidade/capas'))).toBe(true);

      await link.fill(YT_B);
      await expect(folha.getByText(/O link mudou, mas a capa continua a que estava/)).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toBeVisible();
      await folha.getByText(/O link mudou/).scrollIntoViewIfNeeded();
      await capturar(page, `escuro-capa-fixa-aviso-${largura}`);
      expect(api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(1);

      // Remover: fica sem capa e não volta a buscar sozinho; "Usar a capa do YouTube" é o caminho de volta.
      await folha.getByRole('button', { name: 'Remover capa' }).click();
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toHaveCount(0);
      await link.fill(`${YT_B}&t=5`);
      expect(api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(1);
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo sem capa');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo sem capa', videoUrl: `${YT_B}&t=5`, playlistId: null });
      expect(api.errosDaPagina).toEqual([]);
    });

    for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO'], ['areia', 'AREIA']] as const) {
      test(`link inválido no tema ${nome}: erro sob o campo e Publicar desativado; corrigido, publica`, async ({ page }) => {
        await tema(page, t);
        const api = await abrir(page, { 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } } });
        await page.getByRole('button', { name: 'Novo vídeo' }).click();
        const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
        const link = folha.getByRole('textbox', { name: 'Link do vídeo' });
        await link.fill('http://exemplo.test/video');
        // Ainda digitando: o Publicar já espera, com o motivo; o erro aparece ao sair do campo.
        await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();
        await expect(folha.getByText('Corrija o link do vídeo.')).toBeVisible();
        await link.press('Tab');
        await expect(folha.getByText('Use um link https completo.')).toBeVisible();
        await expect(link).toHaveAttribute('aria-invalid', 'true');
        await capturar(page, `${nome}-link-invalido-${largura}`);
        await link.fill('https://exemplo.test/video');
        await expect(folha.getByText('Use um link https completo.')).toHaveCount(0);
        await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled();
        if (t === 'CLARO') await capturar(page, `claro-link-fora-do-youtube-${largura}`);
        expect(api.pedidos.some((p) => foiPost(p, '/comunidade/capas/youtube'))).toBe(false);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    for (const [nome, t] of TEMAS_DA_FOLHA) test(`coleção escolhida no tema ${nome}: entra no fim dela e vai no corpo`, async ({ page }) => {
      await tema(page, t);
      const api = await abrir(page, { 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } } });
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YT_A);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Coleção: Sem coleção. Escolher.' }).click();
      await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
      await expect(folha.getByRole('button', { name: 'Coleção: Alimentação. Escolher.' })).toBeVisible();
      await capturar(page, `${nome}-com-colecao-${largura}`);
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: YT_A, playlistId: 'p2', capaId: 'capa-yt-1' });
    });

    test('"Adicionar vídeo" da coleção abre já nela; fechar sem mexer não pergunta (colecaoInicialId)', async ({ page }) => {
      const api = await abrir(page, { 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } } });
      await page.getByRole('button', { name: 'Adicionar vídeo à coleção Alimentação' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await expect(folha.getByRole('button', { name: 'Coleção: Alimentação. Escolher.' })).toBeVisible();
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('alertdialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
      // O "Novo vídeo" do topo continua sem coleção.
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      await expect(folha.getByRole('button', { name: 'Coleção: Sem coleção. Escolher.' })).toBeVisible();
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: 'Adicionar vídeo à coleção Técnica' }).click();
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: 'https://exemplo.test/video', playlistId: 'p1' });
    });

    for (const [nome, t] of TEMAS_DA_FOLHA) test(`editar no tema ${nome}: abre com a capa da aula, não busca nada, "Salvar"; trocar o link não troca a capa`, async ({ page }) => {
      await tema(page, t);
      const api = await abrir(page, { 'PUT /comunidade/aulas/{id}': (p, route) => json(route, { ...AULA, ...(p.corpo as object) }) }, [AULA]);
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
      await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Editar vídeo/ }).click();
      const folha = page.getByRole('dialog', { name: 'Editar vídeo' });
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
      await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);
      await expect(folha.getByText('Trocar de coleção leva o vídeo para o fim da nova.')).toBeVisible();
      await capturar(page, `${nome}-editar-${largura}`);
      // Fechar sem mexer não pergunta (abrir não buscou capa nem marcou alteração).
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('alertdialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/capas/youtube'))).toBe(false);

      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
      await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Editar vídeo/ }).click();
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YT_B);
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toBeVisible();
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => p.metodo === 'PUT')?.corpo).toEqual({
        titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: YT_B, capaId: 'capa-da-aula', playlistId: 'p1', publicada: true,
      });
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/capas/youtube'))).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    for (const [nome, t] of TEMAS_DA_FOLHA) test(`erro ao publicar (503) no tema ${nome} fica no rodapé; "Sair sem salvar?" continua valendo e zera a próxima abertura`, async ({ page }) => {
      await tema(page, t);
      const e = erroApi(503, 'Comunidade indisponível agora.');
      await abrir(page, { 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YT_A);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(folha.getByText('Comunidade indisponível agora.')).toBeVisible();
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      const aviso = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      await expect(aviso).toBeVisible();
      await capturar(page, `${nome}-sair-sem-salvar-${largura}`);
      await aviso.getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(folha).toHaveCount(0);
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toHaveValue('');
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toHaveCount(0);
      await expect(folha.getByText('Comunidade indisponível agora.')).toHaveCount(0);
    });
  });
}
