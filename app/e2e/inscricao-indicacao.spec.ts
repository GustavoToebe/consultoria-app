import { expect, test, type Page } from '@playwright/test';

import { simularApi } from './api-falsa';
import { CODIGO, paginaPublica } from './inscricoes-falsas';

/**
 * Link de indicação de um aluno (`/inscricao/<codigo>?origem=indicacao#indicacao=<uuid>`): o uuid vai no fragmento, a
 * página o guarda na guia e tira o fragmento do endereço (o `?origem=` fica) e o manda no envio como `codigoIndicacao`
 * (só quando é um UUID válido). Só dados fictícios.
 */
const UUID = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const envios = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/inscricoes/'));

/** O código de indicação guardado no `sessionStorage` desta guia (`null` = nada). */
const guardadaIndicacao = (page: Page) => page.evaluate(() => window.sessionStorage.getItem('indicacao_codigo'));

/** Parte 1 preenchida (nome e WhatsApp), "Continuar" e "Enviar inscrição" na parte 2 (sem texto da consultoria, sem ciência). */
async function preencherEEnviar(page: Page) {
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
}

for (const largura of [390, 1440]) {
  test(`indicação: o código do fragmento sai do endereço, fica na guia e vai no envio (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}?origem=indicacao#indicacao=${UUID}`);
    await expect(page.getByRole('heading', { name: 'Quero ser aluno', level: 1 })).toBeVisible();
    // Logo ao carregar: o fragmento saiu do endereço, o `?origem=` ficou e o código está guardado na guia.
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).searchParams.get('origem')).toBe('indicacao');
    expect(await guardadaIndicacao(page)).toBe(UUID);

    await preencherEEnviar(page);
    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).toMatchObject({ codigoIndicacao: UUID, origemLink: 'indicacao' });
    // Enviou com sucesso: a indicação sai da guia e o endereço continua sem fragmento.
    expect(await guardadaIndicacao(page)).toBeNull();
    expect(new URL(page.url()).hash).toBe('');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`indicação: sem fragmento, o envio não leva codigoIndicacao (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}`);
    await expect(page.getByRole('heading', { name: 'Quero ser aluno', level: 1 })).toBeVisible();
    expect(await guardadaIndicacao(page)).toBeNull();

    await preencherEEnviar(page);
    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).not.toHaveProperty('codigoIndicacao');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`indicação: fragmento que não é UUID não quebra a tela e o envio segue sem o código (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
      [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição.' } },
    });
    await page.goto(`/inscricao/${CODIGO}?origem=indicacao#indicacao=nao-e-um-uuid`);
    await expect(page.getByRole('heading', { name: 'Quero ser aluno', level: 1 })).toBeVisible();
    // Fragmento inválido não é guardado, mas sai do endereço mesmo assim; nunca é exibido.
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    expect(await guardadaIndicacao(page)).toBeNull();
    await expect(page.getByText('nao-e-um-uuid')).toHaveCount(0);

    await preencherEEnviar(page);
    expect(envios(pedidos)).toHaveLength(1);
    expect(envios(pedidos)[0].corpo).not.toHaveProperty('codigoIndicacao');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
