import { chromium, expect, test } from '@playwright/test';

import type { ConteudoDieta, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, MARCA, simularApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Impressão por emulação de mídia: `emulateMedia('print')` mais `page.pdf()` no Chrome e no Edge instalados, nos temas
 * claro e escuro, com e sem logo. Confere o que o CSS de impressão promete (só o documento, fundo branco, texto preto) e
 * que o PDF sai. Só roda com `IMPRESSAO_CANAIS=1` (precisa do Chrome e do Edge instalados; a CI não tem). O diálogo real de impressão do navegador não é automatizável: isto NÃO prova esse diálogo.
 */
const CONTEUDO: ConteudoDieta = {
  objetivo: null,
  dataInicio: null,
  profissional: null,
  refeicoes: [{
    uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null,
    opcoes: [{
      uid: 'cafe-a', rotulo: 'A',
      itens: [{
        uid: 'ovo', alimentoId: 'ovo', nome: 'Ovo', quantidade: 2, unidade: 'un', kcal: null, proteina: null, carboidrato: null,
        gordura: null, manual: false, fatorCorrecao: null, fatorCoccao: null,
      }],
    }],
  }],
  orientacoes: [],
  observacoes: null,
  suplementacao: [],
  ergogenicos: null,
  aguaLitros: null,
};

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001',
  planoId: 'p0000000-0000-4000-8000-000000000001',
  numero: 2,
  titulo: 'Dieta de teste',
  inicio: '2026-10-01',
  fim: '2026-10-31',
  publicadoEm: '2026-10-01T12:00:00Z',
  conteudo: CONTEUDO,
};

const LOGO_URL = '/publico/marcas/c0000000-0000-4000-8000-000000000001/logo?v=1';

/** PNG de 1 x 1 pixel. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

for (const canal of ['chrome', 'msedge'] as const) {
  test.describe(`impressão emulada no ${canal}`, () => {
    test.skip(!process.env.IMPRESSAO_CANAIS, 'precisa do Chrome e do Edge instalados');

    for (const tema of ['CLARO', 'ESCURO'] as const) {
      for (const comLogo of [false, true]) {
        test(`tema ${tema}, ${comLogo ? 'com' : 'sem'} logo: só o documento, fundo branco, texto preto e PDF gerado`, async ({ baseURL }) => {
          const navegador = await chromium.launch({ channel: canal });
          try {
          const page = await navegador.newPage({ baseURL: baseURL ?? undefined, viewport: { width: 1280, height: 800 } });
          await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema]);
          await page.addInitScript(() => { window.print = () => undefined; });
          const respostas = await sessaoDeAluno(page);
          const painel = respostas['GET /aluno/painel'];
          if (comLogo && painel && 'corpo' in painel) {
            respostas['GET /aluno/painel'] = { corpo: { ...(painel.corpo as object), marca: { ...MARCA, logoUrl: LOGO_URL } } };
          }
          const { naoTratadas, errosDaPagina } = await simularApi(page, {
            ...respostas,
            'GET /aluno/dieta': { corpo: { dieta: DIETA } },
            'GET /aluno/pesos': { corpo: [] },
            'GET /publico/marcas/{id}/logo': (_pedido, rota) => rota.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
          });
          await page.goto('/aluno/dieta');
          await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
          await page.getByRole('dialog', { name: 'PDF da dieta' }).getByRole('button', { name: 'Baixar PDF', exact: true }).click();
          const bloco = page.locator('#treinos-impressao');
          await expect(bloco).toContainText('Ovo 2 un');
          if (comLogo) await expect(bloco.locator('img')).toHaveCount(1);
          else await expect(bloco.locator('img')).toHaveCount(0);

          await page.emulateMedia({ media: 'print' });
          await expect(bloco).toBeVisible();
          const medidas = await page.evaluate(() => {
            const corpo = getComputedStyle(document.body);
            const visiveis = [...document.body.children].filter((e) => e.id !== 'treinos-impressao' && getComputedStyle(e).display !== 'none');
            return { fundo: corpo.backgroundColor, texto: corpo.color, outrosVisiveis: visiveis.map((e) => e.tagName + '#' + e.id) };
          });
          expect(medidas.fundo).toBe('rgb(255, 255, 255)');
          expect(medidas.texto).toBe('rgb(0, 0, 0)');
          expect(medidas.outrosVisiveis).toEqual([]);

          const pdf = await page.pdf({ format: 'A4', printBackground: true });
          expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
          expect(pdf.length).toBeGreaterThan(2000);

          await page.emulateMedia({ media: 'screen' });
          expect(naoTratadas).toEqual([]);
          expect(errosDaPagina).toEqual([]);
          } finally {
            await navegador.close();
          }
        });
      }
    }
  });
}
