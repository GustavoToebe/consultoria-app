import { expect, test, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import type { ContratoPublicoAberto, ContratoPublicoAssinado, ContratoPublicoConsulta } from '../src/api/contratosPublicos';
import { erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Página pública do contrato do responsável (passo 4 de `docs/planos/contrato-digital.md`): `/contrato#codigo=...`, sem login.
 * O código vem no fragmento e sai do endereço; CPF e nome só no corpo dos POST (nunca no caminho nem na busca). Só dados
 * fictícios: o CPF é de teste e o código de verificação é inventado (o app nunca calcula hash). Capturas em
 * `CAPTURAS_CONTRATOS` quando a variável existe (fora do repositório).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CODIGO = 'Tq3vX9_kLm2Pw8Zr-Ab4Cd7Ef';
const CPF = '529.982.247-25';
const HASH = '9b74c9897bac770ffc029102a200c5de4c1a6e3f0d2b8a7c6e5f4d3c2b1a0f9e';
const HASH_NOVO = '0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0';
const MARCA: ContratoPublicoConsulta['consultoria'] = {
  id: 'c0000000-0000-4000-8000-0000000000c1', nome: 'Consultoria Fictícia', corPrimaria: '#1F6FEB', fonteTitulo: 'PADRAO',
  temaPadrao: 'CLARO', logoUrl: null, temaPdf: 'CLASSICO',
};
const CONSULTA: ContratoPublicoConsulta = { consultoria: MARCA, titulo: 'Prestação de serviço' };
const ABERTO: ContratoPublicoAberto = {
  titulo: 'Prestação de serviço', origem: 'MODELO', temArquivo: false, sha256: HASH,
  texto: '**Contratante:** Aluno Teste, representado por seu responsável.\n\nCláusula de exemplo do contrato.',
};
const ASSINADO: ContratoPublicoAssinado = {
  titulo: 'Prestação de serviço', texto: ABERTO.texto, sha256: HASH, assinadoEm: '2026-11-26T17:03:09Z', assinanteNome: 'Maria Responsável Teste',
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_CONTRATOS;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true });
}

async function abrir(page: Page, largura: number, rotas: RespostasApi = {}, fragmento = `#codigo=${CODIGO}`) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    'POST /publico/contratos/consultar': { corpo: CONSULTA },
    'POST /publico/contratos/abrir': (p, r) => ((p.corpo as { cpf: string }).cpf === CPF
      ? json(r, ABERTO)
      : json(r, erroApi(422, 'Confira os dados.', 'CPF_NAO_CONFERE', [{ field: 'cpf', message: 'O CPF não confere.' }]).corpo, 422)),
    'POST /publico/contratos/assinar': { corpo: ASSINADO },
    ...rotas,
  });
  await page.goto(`/contrato${fragmento}`);
  return api;
}

/** Nada do código, do CPF ou do nome no endereço de nenhuma chamada (caminho e busca): só no corpo. */
function semDadoNaUrl(pedidos: PedidoFalso[]) {
  for (const p of pedidos) {
    const endereco = `${p.caminho}?${p.busca.toString()}`;
    for (const segredo of [CODIGO, CPF, CPF.replace(/\D/g, ''), 'Maria']) expect(endereco).not.toContain(segredo);
  }
}

const cpf = (page: Page) => page.getByLabel('CPF do responsável', { exact: true });
const nome = (page: Page) => page.getByLabel('Nome completo do responsável', { exact: true });
const aceite = (page: Page) => page.getByRole('checkbox', { name: 'Li o contrato e concordo com os termos.' });
const declaracao = (page: Page) => page.getByRole('checkbox', { name: 'Declaro que sou o responsável legal do aluno.' });

for (const largura of [390, 1280]) {
  test.describe(`contrato público em ${largura} px`, () => {
    test('CPF errado no app e na API, CPF certo, texto, assinar sem nada, sucesso e comprovante', async ({ page }) => {
      await page.addInitScript(() => { window.print = () => undefined; });
      const api = await abrir(page, largura);
      await expect(page.getByRole('heading', { level: 1, name: 'Prestação de serviço' })).toBeVisible();
      await expect(page.getByText('Consultoria Fictícia').first()).toBeVisible();
      // O fragmento sai do endereço logo depois de lido.
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('');
      expect(page.url()).not.toContain(CODIGO);
      expect(api.pedidos.find((p) => p.caminho === '/publico/contratos/consultar')?.corpo).toEqual({ codigo: CODIGO });
      await capturar(page, `publico-cpf-${largura}`);

      // Dígito verificador errado: nem chega à API (não gasta tentativa).
      await cpf(page).fill('52998224724');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('CPF inválido. Confira os números.')).toBeVisible();
      await expect(cpf(page)).toBeFocused();
      expect(api.pedidos.filter((p) => p.caminho === '/publico/contratos/abrir')).toEqual([]);

      // CPF válido que não é o do responsável: 422 no campo.
      await cpf(page).fill('111.444.777-35');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('O CPF não confere.')).toBeVisible();

      await cpf(page).fill('52998224725');
      await expect(cpf(page)).toHaveValue(CPF);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: 'Contrato', exact: true })).toBeVisible();
      await expect(page.getByText('Cláusula de exemplo do contrato.')).toBeVisible();
      await capturar(page, `publico-texto-${largura}`);

      // Sem nome, sem aceite e sem declaração: os três erros e nada enviado.
      const assinar = page.getByRole('button', { name: 'Assinar contrato' });
      await assinar.click();
      await expect(page.getByText('Escreva o nome completo do responsável.')).toBeVisible();
      await expect(page.getByText('Marque que leu e concorda com o contrato.')).toBeVisible();
      await expect(page.getByText('Marque que você é o responsável legal do aluno.')).toBeVisible();
      await expect(nome(page)).toBeFocused();
      await nome(page).fill('Maria');
      await assinar.click();
      await expect(page.getByText('Escreva o nome e o sobrenome.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.caminho === '/publico/contratos/assinar')).toEqual([]);

      await nome(page).fill('  Maria   Responsável Teste ');
      await aceite(page).click();
      await declaracao(page).click();
      await assinar.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Contrato assinado' })).toBeVisible();
      await expect(page.getByText('Guardamos a data, a hora e o aparelho.')).toBeVisible();
      await expect(page.getByText(HASH)).toBeVisible();
      await expect(page.getByText('26/11/2026 às 14:03:09 (horário de Brasília)')).toBeVisible();
      expect(api.pedidos.find((p) => p.caminho === '/publico/contratos/assinar')?.corpo).toEqual({
        codigo: CODIGO, cpf: CPF, sha256: HASH, nome: 'Maria Responsável Teste', aceite: true, declaroResponsavelLegal: true,
      });
      await capturar(page, `publico-assinado-${largura}`);

      await page.getByRole('button', { name: 'Baixar comprovante' }).click();
      const bloco = page.locator('#treinos-impressao');
      await expect(bloco).toContainText('Evidências da assinatura');
      await expect(bloco).toContainText(HASH);
      await expect(bloco).toContainText('Declarou ser o responsável legal do aluno.');
      await expect(bloco).not.toContainText(CPF);

      semDadoNaUrl(api.pedidos);
      expect(page.url()).not.toContain('#');
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('link inválido (404) e link sem código: o mesmo estado, e sem código nem chama a API', async ({ page }) => {
      const api = await abrir(page, largura, { 'POST /publico/contratos/consultar': erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO') });
      await expect(page.getByRole('heading', { level: 1, name: 'Este link não está mais disponível' })).toBeVisible();
      await expect(page.getByText('O link venceu, já foi usado ou o contrato foi cancelado. Peça um novo link a quem enviou.')).toBeVisible();
      await capturar(page, `publico-indisponivel-${largura}`);
      expect(api.naoTratadas).toEqual([]);
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      const semCodigo = await abrir(page, largura, {}, '');
      await expect(page.getByRole('heading', { level: 1, name: 'Este link não está mais disponível' })).toBeVisible();
      expect(semCodigo.pedidos.filter((p) => p.caminho.startsWith('/publico/contratos'))).toEqual([]);
    });

    test('409 CONTRATO_ALTERADO: lê o texto novo, mantém o nome, desmarca os aceites e avisa', async ({ page }) => {
      let aberturas = 0;
      const api = await abrir(page, largura, {
        'POST /publico/contratos/abrir': (_p, r) => {
          aberturas += 1;
          return json(r, aberturas === 1 ? ABERTO : { ...ABERTO, sha256: HASH_NOVO, texto: 'Texto novo do contrato.' });
        },
        'POST /publico/contratos/assinar': (p, r) => ((p.corpo as { sha256: string }).sha256 === HASH
          ? json(r, erroApi(409, 'O contrato mudou.', 'CONTRATO_ALTERADO').corpo, 409)
          : json(r, { ...ASSINADO, sha256: HASH_NOVO })),
      });
      await cpf(page).fill(CPF);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await nome(page).fill('Maria Responsável Teste');
      await aceite(page).click();
      await declaracao(page).click();
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await expect(page.getByText('O contrato mudou desde que você abriu. Leia de novo antes de assinar.')).toBeVisible();
      await expect(page.getByText('Texto novo do contrato.')).toBeVisible();
      await expect(nome(page)).toHaveValue('Maria Responsável Teste');
      await expect(aceite(page)).toHaveAttribute('aria-checked', 'false');
      await expect(declaracao(page)).toHaveAttribute('aria-checked', 'false');
      await capturar(page, `publico-alterado-${largura}`);
      await aceite(page).click();
      await declaracao(page).click();
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Contrato assinado' })).toBeVisible();
      const envios = api.pedidos.filter((p) => p.caminho === '/publico/contratos/assinar').map((p) => (p.corpo as { sha256: string }).sha256);
      expect(envios).toEqual([HASH, HASH_NOVO]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('429 e sem internet: dizem o porquê e "Tentar de novo" refaz', async ({ page }) => {
      let vez = 0;
      const api = await abrir(page, largura, {
        'POST /publico/contratos/consultar': (_p, r: Route) => {
          vez += 1;
          if (vez === 1) return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '120' }, body: JSON.stringify(erroApi(429, 'Muitas tentativas.', 'LIMITE_EXCEDIDO').corpo) });
          if (vez === 2) return r.abort('internetdisconnected');
          return json(r, CONSULTA);
        },
      });
      await expect(page.getByRole('heading', { level: 1, name: 'Muitas tentativas' })).toBeVisible();
      await expect(page.getByText('Muitas tentativas. Tente de novo em alguns minutos.')).toBeVisible();
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Sem internet' })).toBeVisible();
      await capturar(page, `publico-sem-internet-${largura}`);
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(cpf(page)).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('PDF próprio: "Baixar o PDF" com o código e o CPF no corpo, e assina', async ({ page }) => {
      const api = await abrir(page, largura, {
        'POST /publico/contratos/abrir': { corpo: { ...ABERTO, origem: 'PDF', texto: null, temArquivo: true } },
        'POST /publico/contratos/arquivo': (_p, r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }),
        'POST /publico/contratos/assinar': { corpo: { ...ASSINADO, texto: null } },
      });
      await cpf(page).fill(CPF);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('O contrato está no PDF. Baixe e leia antes de assinar.')).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar o PDF' }).click()]);
      expect(download.suggestedFilename()).toBe('contrato.pdf');
      expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe('%PDF-');
      expect(api.pedidos.find((p) => p.caminho === '/publico/contratos/arquivo')?.corpo).toEqual({ codigo: CODIGO, cpf: CPF });
      await nome(page).fill('Maria Responsável Teste');
      await aceite(page).click();
      await declaracao(page).click();
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Contrato assinado' })).toBeVisible();
      semDadoNaUrl(api.pedidos);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

test('390 no tema escuro: o texto do contrato (captura)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await abrir(page, 390);
  await cpf(page).fill(CPF);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Cláusula de exemplo do contrato.')).toBeVisible();
  await capturar(page, 'publico-texto-390-escuro');
});
