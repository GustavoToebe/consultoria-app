import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Montador de telas (`/montador`, `docs/planos/montador-de-telas.md`):
 * - Fechado no bundle de produção (`npx expo export --platform web` sem `EXPO_PUBLIC_MONTADOR=1` e com `__DEV__ = false`),
 *   mostrando a página de não encontrada (`+not-found.tsx`).
 * - Em desenvolvimento, funciona sem nenhuma chamada à API (rede bloqueada), permite montar cabeçalho + cartão com
 *   3 linhas e selos + botão primário, alternar entre 1280 e 390 px e tema escuro, exportar JSON, limpar tudo,
 *   reimportar o mesmo JSON e recusar JSON inválido sem interpretar HTML.
 */

test('montador: fechado no export de produção sem EXPO_PUBLIC_MONTADOR=1', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/montador');
  await expect(page.getByText('Página não encontrada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Montador de telas' })).toHaveCount(0);
});

test('montador: monta tela com cabeçalho, cartão com 3 linhas e botão primário, alterna 390/escuro, exporta/importa JSON e funciona com rede bloqueada', async ({
  page,
}) => {
  const errosDaPagina: string[] = [];
  page.on('pageerror', (e) => errosDaPagina.push(e.stack ?? e.message));

  // Rede completamente bloqueada para a API (Critério 6).
  await page.route('**/api/**', (route) => route.abort());

  // Simula `__DEV__ = true` sobre o bundle estático dos testes e2e.
  await page.addInitScript(() => {
    Object.defineProperty(window, '__DEV__', {
      get: () => true,
      set: () => undefined,
      configurable: true,
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/montador');

  await expect(page.getByRole('heading', { name: 'Montador de telas' })).toBeVisible();
  await expect(page.getByText('Prancheta vazia')).toBeVisible();

  // Nome do rascunho
  await page.getByLabel('Nome do rascunho').fill('Alunos — revisão da semana');

  // 1. Cabeçalho "Alunos"
  await page.getByRole('button', { name: 'Inserir Cabeçalho' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Alunos');
  await page.getByLabel('Subtítulo', { exact: true }).fill('Acompanhamento e revisões da consultoria');

  // 2. Cartão "Para revisar"
  await page.getByRole('button', { name: 'Inserir Cartão' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Para revisar');
  await page.getByLabel('Descrição', { exact: true }).fill('3 alunos aguardando retorno');

  // 3. Lista de linhas dentro do cartão vazio + 3 linhas com selo
  await page.getByRole('button', { name: 'Inserir Lista de linhas' }).click();

  await page.getByRole('button', { name: 'Inserir Linha da lista' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Ana Clara Souza');
  await page.getByLabel('Metadados', { exact: true }).fill('Hipertrofia · enviado hoje');
  await page.getByLabel('Selos (texto;tipo por linha)').fill('Para revisar;atencao');

  await page.getByRole('button', { name: 'Inserir Linha da lista' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Bruno Oliveira');
  await page.getByLabel('Metadados', { exact: true }).fill('Força · 3 dias de atraso');
  await page.getByLabel('Selos (texto;tipo por linha)').fill('Atrasado;perigo');

  await page.getByRole('button', { name: 'Inserir Linha da lista' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Carla Mendes');
  await page.getByLabel('Metadados', { exact: true }).fill('Condicionamento · revisado ontem');
  await page.getByLabel('Selos (texto;tipo por linha)').fill('Em dia;sucesso');

  // 4. Seleciona o cartão "Para revisar", pede "Inserir abaixo" e insere um botão primário
  await page.getByText('3 alunos aguardando retorno').click({ position: { x: 20, y: 10 } });
  await page.getByRole('button', { name: 'Inserir abaixo' }).click();
  await page.getByRole('button', { name: 'Inserir Botão' }).click();
  await page.getByLabel('Rótulo').fill('Novo aluno');

  // Confere que a prancheta desenhou todos os itens
  await expect(page.getByText('Ana Clara Souza')).toBeVisible();
  await expect(page.getByText('Bruno Oliveira')).toBeVisible();
  await expect(page.getByText('Carla Mendes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo aluno' })).toBeVisible();

  const pastaPrints = process.env.MONTADOR_PRINTS_DIR;
  if (pastaPrints) {
    await page.getByText('3 alunos aguardando retorno').click({ position: { x: 20, y: 10 } });
    await page.screenshot({ path: join(pastaPrints, 'montador-1280.png') });
  }

  // Troca para 390 px e para o tema escuro sem quebrar (Critério 3)
  await page.getByText('Celular 390', { exact: true }).click();
  await page.getByText('Escuro', { exact: true }).click();
  await expect(page.getByText('Ana Clara Souza')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo aluno' })).toBeVisible();

  // Confere também a visualização responsiva em 390 px (abas Blocos / Tela / Propriedades)
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: /Tela/ })).toBeVisible();
  await expect(page.getByText('Ana Clara Souza')).toBeVisible();
  if (pastaPrints) {
    await page.screenshot({ path: join(pastaPrints, 'montador-390.png') });
  }

  // Volta para 1280 px para testar exportação, limpeza e importação (Critérios 4 e 5)
  await page.setViewportSize({ width: 1280, height: 900 });

  // Exportar JSON (Critério 4)
  await page.getByRole('button', { name: 'Exportar ▾' }).click();
  await expect(page.getByText('Exportar rascunho')).toBeVisible();
  await page.getByText('Copiar JSON').click();
  await expect(page.getByText('Copiado')).toBeVisible();

  const jsonExportado = await page.evaluate(() => window.localStorage.getItem('montador:rascunho'));
  expect(jsonExportado).toBeTruthy();

  // Apagar tudo com PainelConfirmacao
  await page.getByRole('button', { name: 'Limpar tudo' }).click();
  await expect(page.getByText('Limpar tudo?')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar tudo' }).last().click();
  await expect(page.getByText('Prancheta vazia')).toBeVisible();
  await expect(page.getByText('Ana Clara Souza')).toHaveCount(0);

  // Critério 5: recusar JSON com tipo desconhecido, prop desconhecida e texto > 2.000 caracteres
  await page.getByRole('button', { name: 'Modelos ▾' }).click();
  await page.getByText('Importar JSON').click();

  await page.getByLabel('JSON do rascunho').fill(
    JSON.stringify({
      versao: 1,
      nome: 'Ruim',
      largura: 1280,
      tema: 'claro',
      blocos: [{ id: '1', tipo: 'blocoInexistente', props: {} }],
    }),
  );
  await page.getByRole('button', { name: 'Importar rascunho' }).click();
  await expect(page.getByText('Tipo de bloco desconhecido.')).toBeVisible();

  await page.getByLabel('JSON do rascunho').fill(
    JSON.stringify({
      versao: 1,
      nome: 'Ruim',
      largura: 1280,
      tema: 'claro',
      blocos: [{ id: '1', tipo: 'cabecalho', props: { titulo: 'Oi', subtitulo: '', extra: 1 } }],
    }),
  );
  await page.getByRole('button', { name: 'Importar rascunho' }).click();
  await expect(page.getByText('Propriedade desconhecida em um bloco.')).toBeVisible();

  await page.getByLabel('JSON do rascunho').fill(
    JSON.stringify({
      versao: 1,
      nome: 'Ruim',
      largura: 1280,
      tema: 'claro',
      blocos: [{ id: '1', tipo: 'texto', props: { texto: 'x'.repeat(3000), variante: 'corpo', nivel: 'nenhum' } }],
    }),
  );
  await page.getByRole('button', { name: 'Importar rascunho' }).click();
  await expect(page.getByText('Texto acima do limite de 2.000 caracteres.')).toBeVisible();

  // Critério 4: importar o mesmo JSON exportado e obter a mesma tela
  await page.getByLabel('JSON do rascunho').fill(jsonExportado ?? '');
  await page.getByRole('button', { name: 'Importar rascunho' }).click();

  await expect(page.getByText('Ana Clara Souza')).toBeVisible();
  await expect(page.getByText('Bruno Oliveira')).toBeVisible();
  await expect(page.getByText('Carla Mendes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo aluno' })).toBeVisible();

  // Critério 5: nenhum texto importado vira HTML executável
  await page.getByRole('button', { name: 'Modelos ▾' }).click();
  await page.getByText('Importar JSON').click();
  const payloadHtml = '<img src=x onerror="window.__xssMontador=1"><b>Literal</b>';
  await page.getByLabel('JSON do rascunho').fill(
    JSON.stringify({
      versao: 1,
      nome: 'Teste HTML literal',
      largura: 1280,
      tema: 'claro',
      blocos: [{ id: 'h1', tipo: 'texto', props: { texto: payloadHtml, variante: 'corpo', nivel: 'nenhum' } }],
    }),
  );
  await page.getByRole('button', { name: 'Importar rascunho' }).click();
  await expect(page.getByTestId('moldura-prancheta').getByText(payloadHtml)).toBeVisible();
  const xssExecutou = await page.evaluate(() => (window as { __xssMontador?: number }).__xssMontador);
  expect(xssExecutou).toBeUndefined();

  expect(errosDaPagina).toEqual([]);
});
