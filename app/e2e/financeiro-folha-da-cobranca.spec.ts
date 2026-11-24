import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CobrancaResponse, LembretesDaCobranca } from '../src/api/financeiroTipos';
import { fixarHoje } from './aluno';
import { simularApi } from './api-falsa';
import {
  COBRANCA_ATRASADA, estadoFinanceiro, LINK_DE_PAGAMENTO, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro,
} from './financeiro-falso';

/**
 * Folha da cobrança (23/11, `docs/planos/folha-da-cobranca.md`): nome do aluno como link para a ficha, linha de origem,
 * prazo relativo na cor da situação, as quatro datas (duas por linha no celular), o bloco "Cobrar o aluno" (sem
 * recebimento online e sem telefone; tudo configurado; ausente na paga), o id encurtado com "Copiar ID" e o rodapé da paga.
 * Relógio fixo em 19/10/2026; só dados fictícios, API simulada.
 */

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${id.padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-28T12:00:00Z', ...parcial,
});
/** Em aberto, vence em 26/10 (hoje + 7), sem telefone e sem recebimento online. */
const EM_ABERTO = cobranca('1', 'Bruna Teste', { vencimento: '2026-10-26', vencida: false, diasDeAtraso: null, planoNome: 'Plano Cauã' });
/** Vencida há 14 dias, com recebimento e telefone. */
const VENCIDA = cobranca('2', 'Caio Teste', {});
const PAGA = cobranca('3', 'Dora Teste', {
  situacao: 'PAGA', vencimento: '2026-10-10', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-15', forma: 'PIX_DIRETO', provedor: 'MANUAL',
  baixaPor: 'u1', baixaPorNome: 'Treinador Teste', versao: 1,
});
/** Sem telefone e sem lembrete enviado, mas com responsável financeiro: o título "Lembretes por e-mail" aparece só com a linha. */
const SEM_TELEFONE: LembretesDaCobranca = { itens: [], whatsapp: { telefone: null, mensagem: 'Olá.' }, motivoSemWhatsapp: null, alunoDesligou: false, paraResponsavel: true };
const COM_TUDO: LembretesDaCobranca = {
  itens: [{ id: 'l1', tipo: 'ANTES', situacao: 'ENVIADO', motivo: null, dataPrevista: '2026-10-02', enviadoEm: '2026-10-02T12:07:00Z', atualizadoEm: '2026-10-02T12:07:00Z' }],
  whatsapp: { telefone: '(45) 99999-8888', mensagem: 'Olá, Caio.' }, motivoSemWhatsapp: null, alunoDesligou: false, paraResponsavel: true,
};
const LINHA_DOS_LEMBRETES = 'Os lembretes vão ao responsável.';

async function abrir(page: Page, largura: number, estado: EstadoFinanceiro, nome: string) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  // A cópia vai para uma variável da página (o Chromium sem permissão recusaria a área de transferência).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
    });
  });
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await page.getByRole('button', { name: `Abrir cobrança de ${nome}` }).click();
  return { ...api, folha: page.getByRole('dialog') };
}

const cor = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);
const topo = async (l: Locator) => Math.round((await l.boundingBox())!.y);

for (const largura of [390, 1280]) {
  test(`${largura}px: em aberto, sem telefone e sem recebimento online`, async ({ page }) => {
    const estado = estadoFinanceiro({ cobrancas: [EM_ABERTO], lembretesDasCobrancas: { [EM_ABERTO.id]: SEM_TELEFONE } });
    const { folha, errosDaPagina } = await abrir(page, largura, estado, 'Bruna Teste');

    // Cabeçalho: o nome é o link da ficha (o botão "Abrir ficha do aluno" saiu) e a origem fica logo abaixo.
    const nome = folha.getByRole('link', { name: 'Abrir ficha de Bruna Teste' });
    await expect(nome).toHaveAttribute('href', `/treinador/alunos/${EM_ABERTO.alunoId}?aba=ficha`);
    await expect(folha.getByRole('button', { name: /Abrir ficha/ })).toHaveCount(0);
    await expect(folha.getByText('Mensalidade · Plano Cauã')).toBeVisible();
    // Prazo relativo a mais de 3 dias: texto secundário (a cor da origem), não a do selo.
    const prazo = folha.getByText('Vence em 7 dias');
    await expect(prazo).toBeVisible();
    expect(await cor(prazo)).toBe(await cor(folha.getByText('Mensalidade · Plano Cauã')));

    // As quatro datas: numa linha na folha do PC, duas por linha no celular.
    const datas = ['Competência: 10/2026', 'Vencimento: 26/10/2026', 'Emissão: 28/09/2026', 'Pagamento: —'].map((r) => folha.getByLabel(r));
    for (const d of datas) await expect(d).toBeVisible();
    const tops = await Promise.all(datas.map(topo));
    if (largura === 390) {
      expect(tops[0]).toBe(tops[1]);
      expect(tops[2]).toBe(tops[3]);
      expect(tops[2]).toBeGreaterThan(tops[0]);
    } else {
      expect(new Set(tops).size).toBe(1);
    }

    // "Cobrar o aluno": a linha do recebimento com o link "Configurar" e o WhatsApp apagado com o motivo e "Adicionar telefone".
    await expect(folha.getByRole('heading', { name: 'Cobrar o aluno' })).toBeVisible();
    await expect(folha.getByText('Configure o recebimento online para mandar o link.')).toBeVisible();
    await expect(folha.getByRole('link', { name: 'Configurar o recebimento online' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
    await expect(folha.getByRole('button', { name: 'Enviar pelo WhatsApp' })).toBeDisabled();
    await expect(folha.getByText('O aluno não tem telefone no cadastro.')).toHaveCount(1);
    await expect(folha.getByRole('link', { name: 'Adicionar telefone de Bruna Teste' }))
      .toHaveAttribute('href', `/treinador/alunos/${EM_ABERTO.alunoId}?editar=1`);
    // Com responsável e sem histórico: o título "Lembretes por e-mail" aparece uma vez, com a linha logo embaixo.
    const lembretes = folha.getByRole('heading', { name: 'Lembretes por e-mail' });
    await expect(lembretes).toHaveCount(1);
    expect(await topo(folha.getByText(LINHA_DOS_LEMBRETES))).toBeGreaterThan(await topo(lembretes));
    expect(await topo(lembretes)).toBeGreaterThan(await topo(folha.getByRole('button', { name: 'Enviar pelo WhatsApp' })));

    // Rodapé de hoje: Cancelar, Renegociar e Registrar pagamento.
    for (const b of ['Cancelar cobrança', 'Renegociar', 'Registrar pagamento']) await expect(folha.getByRole('button', { name: b })).toBeVisible();
    // A folha não mudou com o rodapé em duas linhas do painel: no PC uma fila só; no celular empilhado, a principal em cima.
    const [cancelar, renegociar, registrar] = await Promise.all(['Cancelar cobrança', 'Renegociar', 'Registrar pagamento'].map((b) => topo(folha.getByRole('button', { name: b }))));
    if (largura === 1280) expect(new Set([cancelar, renegociar, registrar]).size).toBe(1);
    else expect(registrar < renegociar && renegociar < cancelar).toBe(true);

    // O nome leva à ficha e fecha a folha.
    await nome.click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${EM_ABERTO.alunoId}`));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: vencida, com recebimento online e telefone; o id encurtado e a cópia do inteiro`, async ({ page }) => {
    const estado = estadoFinanceiro({ cobrancas: [VENCIDA], recebimento: { ...RECEBIMENTO_CONFIGURADO }, lembretesDasCobrancas: { [VENCIDA.id]: COM_TUDO } });
    const { folha, errosDaPagina } = await abrir(page, largura, estado, 'Caio Teste');

    // Vencida: os dias de atraso na cor do selo "Vencida".
    const prazo = folha.getByText('14 dias de atraso');
    await expect(prazo).toBeVisible();
    expect(await cor(prazo)).toBe(await cor(folha.getByText('Vencida', { exact: true })));

    await expect(folha.getByRole('heading', { name: 'Cobrar o aluno' })).toBeVisible();
    await folha.getByRole('button', { name: 'Copiar link de pagamento' }).click();
    await expect(page.getByText('Link copiado.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(LINK_DE_PAGAMENTO);
    await expect(folha.getByText(/Configure o recebimento online/)).toHaveCount(0);
    await expect(folha.getByRole('button', { name: 'Enviar pelo WhatsApp' })).toBeEnabled();
    await expect(folha.getByRole('link', { name: /Adicionar telefone/ })).toHaveCount(0);
    // O histórico dos lembretes fica no mesmo bloco: título, a linha do responsável (não mais sob o "Copiar link") e a lista.
    const lembretes = folha.getByRole('heading', { name: 'Lembretes por e-mail' });
    await expect(lembretes).toHaveCount(1);
    const linha = folha.getByText(LINHA_DOS_LEMBRETES);
    await expect(linha).toHaveCount(1);
    expect(await topo(lembretes)).toBeGreaterThan(await topo(folha.getByRole('button', { name: 'Enviar pelo WhatsApp' })));
    expect(await topo(linha)).toBeGreaterThan(await topo(lembretes));
    expect(await topo(folha.getByText('Enviado em 02/10/2026'))).toBeGreaterThan(await topo(linha));

    // O id encurtado no fim; "Copiar ID" leva o inteiro.
    await expect(folha.getByText('ID c0000000…0002', { exact: true })).toBeVisible();
    await folha.getByRole('button', { name: 'Copiar ID da cobrança' }).click();
    await expect(page.getByText('ID copiado.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(VENCIDA.id);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: paga, sem "Cobrar o aluno" e com o rodapé das ações que valem`, async ({ page }) => {
    const estado = estadoFinanceiro({ cobrancas: [PAGA], recebimento: { ...RECEBIMENTO_CONFIGURADO }, lembretesDasCobrancas: { [PAGA.id]: COM_TUDO } });
    const { folha, errosDaPagina } = await abrir(page, largura, estado, 'Dora Teste');

    const prazo = folha.getByText('Paga em 15/10/2026 · Pix direto');
    await expect(prazo).toBeVisible();
    expect(await cor(prazo)).toBe(await cor(folha.getByText('Paga', { exact: true })));
    await expect(folha.getByLabel('Pagamento: 15/10/2026')).toBeVisible();
    await expect(folha.getByRole('heading', { name: 'Cobrar o aluno' })).toHaveCount(0);
    await expect(folha.getByRole('button', { name: /WhatsApp|Copiar link/ })).toHaveCount(0);
    // Fora do aberto o histórico dos lembretes continua à vista, no grupo próprio, com a linha do responsável sob o título.
    const lembretes = folha.getByRole('heading', { name: 'Lembretes por e-mail' });
    await expect(lembretes).toHaveCount(1);
    expect(await topo(folha.getByText(LINHA_DOS_LEMBRETES))).toBeGreaterThan(await topo(lembretes));
    await expect(folha.getByText('Treinador Teste')).toBeVisible();

    for (const b of ['Marcar estorno', 'Desfazer baixa', 'Marcar contestação']) await expect(folha.getByRole('button', { name: b })).toBeVisible();
    for (const b of ['Cancelar cobrança', 'Renegociar', 'Registrar pagamento']) await expect(folha.getByRole('button', { name: b })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
