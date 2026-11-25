import { expect, test, type Page } from '@playwright/test';

import { CONVITE, MEMBROS, PERFIS, prepararEquipe } from './equipe-dados';

/**
 * Equipe na tela larga (24/11, "sem meia tela vazia"): da faixa larga (≥ 1600 px de área) em diante, Membros ganha a coluna
 * de ~360 px com "Convites pendentes" (que saem da tabela) e "Equipe por perfil" (filtra a tabela, chip em "Filtrando:");
 * a tabela e as abas terminam na mesma borda. Perfis em grade de células ≥ 360 px, equilibrada, com os botões na mesma
 * base. Abaixo de 1600 nada muda. Hoje fixo em 19/10/2026; só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

/** Borda direita da faixa das abas (o `tablist` só mede os botões; o fio de baixo é do ancestral largo). */
const direitaDasAbas = (page: Page) => page.getByRole('tablist').evaluate((el) => {
  let atual = el as HTMLElement;
  while (atual.parentElement && atual.getBoundingClientRect().width < 1000) atual = atual.parentElement;
  return atual.getBoundingClientRect().right;
});

const caixa = async (alvo: ReturnType<Page['locator']>) => {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};

test('1920 px: convites e perfis na coluna ao lado, filtro por perfil com chip e a mesma borda das abas', async ({ page }) => {
  const { pedidos, errosDaPagina } = await prepararEquipe(page, 1920, 1080, [...MEMBROS, CONVITE]);
  await page.goto('/treinador/equipe?aba=membros');
  const tabela = page.getByRole('table', { name: 'Membros da equipe' });
  const lateral = page.getByRole('complementary', { name: 'Convites e perfis da equipe' });
  await expect(tabela).toBeVisible();
  await expect(lateral).toBeVisible();

  // O convite está só na coluna ao lado, com perfil e envio relativo.
  await expect(tabela.getByText('Eva Amostra')).toHaveCount(0);
  await expect(lateral.getByText('Eva Amostra')).toBeVisible();
  await expect(lateral.getByText('Treinador · Enviado há 2 dias')).toBeVisible();
  await expect(lateral.getByRole('button', { name: 'Renovar convite de Eva Amostra' })).toBeVisible();

  // Tabela e coluna lado a lado; a coluna tem ~360 px e termina na borda direita das abas. Membro é a coluna mais larga.
  const [t, l, abas] = await Promise.all([caixa(tabela), caixa(lateral), direitaDasAbas(page)]);
  expect(l.x).toBeGreaterThan(t.x + t.width);
  expect(Math.abs(l.width - 360)).toBeLessThanOrEqual(1);
  expect(Math.abs(l.x + l.width - abas)).toBeLessThanOrEqual(4);
  const cabecalhos = await Promise.all((await tabela.getByRole('columnheader').all()).map(caixa));
  expect(cabecalhos[0].width).toBeGreaterThan(Math.max(...cabecalhos.slice(1).map((c) => c.width)));

  // "Equipe por perfil": Treinador · 2 (o convite não conta). Tocar filtra e mostra o chip; tocar de novo tira.
  const treinador = lateral.getByRole('button', { name: 'Treinador · 2 membros' });
  await treinador.click();
  await expect(page.getByText('Filtrando:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar filtro: Perfil: Treinador' })).toBeVisible();
  await expect(tabela.getByText('Ana Fictícia')).toHaveCount(0);
  await expect(tabela.getByText('Bia Exemplo')).toBeVisible();
  await expect(tabela.getByText('Caio Teste')).toBeVisible();
  await expect(treinador).toHaveAttribute('aria-pressed', 'true');
  await treinador.click();
  await expect(page.getByText('Filtrando:')).toHaveCount(0);
  await expect(tabela.getByText('Ana Fictícia')).toBeVisible();

  // Cancelar pede confirmação (painel, nunca confirm()) e usa a rota de sempre.
  await lateral.getByRole('button', { name: 'Cancelar convite de Eva Amostra' }).click();
  await expect(page.getByText('O link enviado para c-eva@exemplo.test deixa de funcionar.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar convite', exact: true }).click();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/usuarios/convites/c-eva']);
  expect(errosDaPagina).toEqual([]);
});

test('1920 px sem convite: "Nenhum convite pendente"', async ({ page }) => {
  const { errosDaPagina } = await prepararEquipe(page, 1920, 1080, MEMBROS);
  await page.goto('/treinador/equipe?aba=membros');
  const lateral = page.getByRole('complementary', { name: 'Convites e perfis da equipe' });
  await expect(lateral.getByText('Nenhum convite pendente')).toBeVisible();
  await expect(lateral.getByRole('button', { name: 'Administrador · 1 membro' })).toBeVisible();
  await expect(lateral.getByRole('button', { name: 'Assistente · 0 membros' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`${largura} px: nada muda (lista de linhas com o convite, sem coluna ao lado)`, async ({ page }) => {
    const { errosDaPagina } = await prepararEquipe(page, largura, 900, [...MEMBROS, CONVITE]);
    await page.goto('/treinador/equipe?aba=membros');
    await expect(page.getByRole('button', { name: 'Renovar convite de Eva Amostra' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renovar convite de Eva Amostra' })).toHaveText('Renovar convite');
    await expect(page.getByRole('table', { name: 'Membros da equipe' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Convites e perfis da equipe' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('3440 px: os 4 perfis numa linha, na largura toda, com os botões na mesma base', async ({ page }) => {
  const { errosDaPagina } = await prepararEquipe(page, 3440, 1440, MEMBROS);
  await page.goto('/treinador/equipe?aba=perfis');
  // Os perfis do sistema não têm Editar (o motivo fica no lugar) e todos têm Duplicar. A Nutricionista tem a descrição mais
  // longa (cartão mais alto), e os botões continuam na mesma base.
  const editar = await Promise.all(PERFIS.map((p) => caixa(page.getByRole('button', { name: `Duplicar ${p.nome}` }))));
  for (const b of editar) expect(Math.abs(b.y + b.height - (editar[0].y + editar[0].height))).toBeLessThan(2);
  const titulos = await Promise.all(PERFIS.map((p) => caixa(page.getByRole('heading', { name: p.nome, exact: true }))));
  for (const h of titulos) expect(Math.abs(h.y - titulos[0].y)).toBeLessThan(2);
  // O cartão dos perfis vai até a borda das abas (sem a sobra à direita).
  const [abas, novo] = await Promise.all([direitaDasAbas(page), caixa(page.getByRole('button', { name: 'Novo perfil' }))]);
  expect(abas - (novo.x + novo.width)).toBeLessThan(48);
  expect(errosDaPagina).toEqual([]);
});
