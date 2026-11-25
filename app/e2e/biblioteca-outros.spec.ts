import { expect, test, type Page } from '@playwright/test';

import type { ErgogenicoDaBiblioteca, ErgogenicoDaBibliotecaRequest } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Biblioteca › Outros (24/11): na lista, o título é o nome e, só se for outro (sem caixa nem acento), " / princípio
 * ativo"; a linha de detalhe vem sem rótulos ("30 mg · 28 caps") e o campo vazio some. No Novo item/Editar item, Nome e
 * Princípio ativo vêm primeiro e a Categoria embaixo, no seletor com busca da Vitrine: "Sem categoria", as que já existem e
 * "Criar categoria “…”" com o texto digitado. Só dados fictícios.
 */
function item(nome: string, categoria: string | null, extra: Partial<ErgogenicoDaBiblioteca> = {}): ErgogenicoDaBiblioteca {
  return { id: `e000000${nome.length}-0000-4000-8000-000000000000`, categoria, nome, principioAtivo: null, concentracao: null, apresentacao: null, observacao: null, ...extra };
}

const COM_CATEGORIAS = [
  item('Lisdexanfetamina', 'Medicamentos', { principioAtivo: 'Dimesilato', concentracao: '30 mg', apresentacao: '28 caps' }),
  item('Testosterona', 'Injetáveis'),
  item('Cafeína anidra', 'Medicamentos', { principioAtivo: 'CAFEINA ANIDRA', apresentacao: '60 caps' }),
];
const SEM_CATEGORIAS = [item('Cafeína', null)];

async function abrir(page: Page, lista: ErgogenicoDaBiblioteca[]) {
  const gravados: { metodo: string; corpo: ErgogenicoDaBibliotecaRequest }[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /ergogenicos': { corpo: lista },
    'POST /ergogenicos': (pedido, route) => {
      gravados.push({ metodo: 'POST', corpo: pedido.corpo as ErgogenicoDaBibliotecaRequest });
      return json(route, { id: 'novo', ...(pedido.corpo as ErgogenicoDaBibliotecaRequest) }, 201);
    },
    'PUT /ergogenicos/{id}': (pedido, route) => {
      gravados.push({ metodo: 'PUT', corpo: pedido.corpo as ErgogenicoDaBibliotecaRequest });
      return json(route, { id: 'x', ...(pedido.corpo as ErgogenicoDaBibliotecaRequest) });
    },
  });
  await page.goto('/treinador/biblioteca?aba=ergogenicos');
  return { gravados, naoTratadas, errosDaPagina };
}

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('lista: princípio ativo só quando é outro e detalhe sem rótulos, sem "—" no que falta', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Medicamentos, recolhido' }).click();
      await page.getByRole('button', { name: 'Injetáveis, recolhido' }).click();
      await expect(page.getByText('Lisdexanfetamina / Dimesilato', { exact: true })).toBeVisible();
      await expect(page.getByText('30 mg · 28 caps', { exact: true })).toBeVisible();
      // Princípio igual ao nome (só muda a caixa e o acento): fica só o nome; só a apresentação, sem o ponto.
      await expect(page.getByText('Cafeína anidra', { exact: true })).toBeVisible();
      await expect(page.getByText(/\/ CAFEINA/)).toHaveCount(0);
      await expect(page.getByText('60 caps', { exact: true })).toBeVisible();
      await expect(page.getByText('Testosterona', { exact: true })).toBeVisible();
      await expect(page.getByText(/Concentração:|Apresentação:/)).toHaveCount(0);
      await expect(page.getByText('—', { exact: true })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Novo item: Nome e Princípio primeiro, Categoria embaixo; criar categoria usa o texto digitado', async ({ page }) => {
      const { gravados, naoTratadas, errosDaPagina } = await abrir(page, SEM_CATEGORIAS);
      await page.getByRole('button', { name: 'Novo item' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo item' });
      const categoria = folha.getByRole('button', { name: /^Categoria: / });
      const nomeDoItem = folha.getByRole('textbox', { name: 'Nome', exact: true });
      await expect(categoria).toHaveAccessibleName('Categoria: Sem categoria. Escolher.');
      const [yCategoria, yNome] = await Promise.all([categoria.boundingBox(), nomeDoItem.boundingBox()]);
      expect(yCategoria!.y).toBeGreaterThan(yNome!.y);
      await expect(folha.getByText(/Vazio fica em/)).toHaveCount(0);

      await categoria.click();
      await page.getByLabel('Buscar ou criar categoria').fill('  Orais  ');
      await page.getByRole('option', { name: /Criar categoria “Orais”/ }).click();
      await expect(categoria).toHaveAccessibleName('Categoria: Orais. Escolher.');

      await nomeDoItem.fill('Item novo');
      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(1);
      expect(gravados[0]).toEqual({
        metodo: 'POST',
        corpo: { categoria: 'Orais', nome: 'Item novo', principioAtivo: null, concentracao: null, apresentacao: null, observacao: null },
      });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('com categorias: o seletor lista as que existem e o texto igual (sem acento nem caixa) escolhe a existente', async ({ page }) => {
      const { gravados, naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Novo item' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo item' });
      const categoria = folha.getByRole('button', { name: /^Categoria: / });
      await categoria.click();
      for (const nome of ['Sem categoria', 'Injetáveis', 'Medicamentos']) await expect(page.getByRole('option', { name: new RegExp(`^${nome}`) })).toBeVisible();
      await page.getByLabel('Buscar ou criar categoria').fill('INJETAVEIS');
      await expect(page.getByRole('option', { name: /Criar categoria/ })).toHaveCount(0);
      await page.getByRole('option', { name: /^Injetáveis/ }).click();
      await expect(categoria).toHaveAccessibleName('Categoria: Injetáveis. Escolher.');

      await folha.getByRole('textbox', { name: 'Nome', exact: true }).fill('Item novo');
      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(1);
      expect(gravados[0].corpo.categoria).toBe('Injetáveis');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('seções do Editar alimento, pares em colunas no PC e empilhados no celular, rodapé visível com o corpo rolado', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Medicamentos, recolhido' }).click();
      await page.getByRole('button', { name: 'Editar Lisdexanfetamina' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      for (const secao of ['Identificação', 'Concentração e apresentação', 'Observação']) {
        await expect(folha.getByRole('heading', { name: secao, level: 3 })).toBeVisible();
      }
      // Dicas viram placeholder; o cartão Observação não repete o rótulo (o campo continua com nome acessível).
      await expect(folha.getByRole('textbox', { name: 'Concentração (opcional)' })).toHaveAttribute('placeholder', '200 mg/ml');
      await expect(folha.getByRole('textbox', { name: 'Apresentação (opcional)' })).toHaveAttribute('placeholder', '10 ml ou 50 caps');
      await expect(folha.getByText(/Como está na embalagem|Por exemplo/)).toHaveCount(0);
      await expect(folha.getByRole('textbox', { name: 'Observação (opcional)' })).toBeVisible();
      await expect(folha.getByText('Observação (opcional)', { exact: true })).toHaveCount(0);
      const pares = [['Nome', 'Princípio ativo (opcional)'], ['Concentração (opcional)', 'Apresentação (opcional)']] as const;
      for (const [esquerda, direita] of pares) {
        const a = (await folha.getByRole('textbox', { name: esquerda, exact: true }).boundingBox())!;
        const b = (await folha.getByRole('textbox', { name: direita, exact: true }).boundingBox())!;
        if (largura < 768) expect(b.y).toBeGreaterThan(a.y + a.height);
        else {
          expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(1);
          expect(b.x).toBeGreaterThan(a.x + a.width);
        }
      }

      // Sem nome, o Salvar diz por quê.
      await folha.getByRole('textbox', { name: 'Nome', exact: true }).fill('');
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
      await expect(folha.getByText('Informe o nome.', { exact: true })).toHaveCount(1);

      await page.setViewportSize({ width: largura, height: 600 });
      const rolou = await folha.evaluate((d) => {
        const rolagem = [...d.querySelectorAll<HTMLElement>('div')].find((n) => ['auto', 'scroll'].includes(getComputedStyle(n).overflowY))!;
        rolagem.scrollTop = rolagem.scrollHeight;
        return rolagem.scrollTop;
      });
      expect(rolou).toBeGreaterThan(0);
      await expect(folha.getByRole('button', { name: 'Tirar da biblioteca' })).toBeInViewport();
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeInViewport();
      await expect(folha.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('categorias nascem fechadas, a busca abre as que casam e limpar volta ao de antes', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await expect(page.getByRole('button', { name: 'Medicamentos, recolhido' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Injetáveis, recolhido' })).toBeVisible();
      await expect(page.getByText('Testosterona', { exact: true })).toHaveCount(0);

      await page.getByLabel('Buscar em Outros').fill('testo');
      await expect(page.getByRole('button', { name: 'Injetáveis, aberto' })).toBeVisible();
      await expect(page.getByText('Testosterona', { exact: true })).toBeVisible();

      await page.getByLabel('Buscar em Outros').fill('');
      await expect(page.getByRole('button', { name: 'Injetáveis, recolhido' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Medicamentos, recolhido' })).toBeVisible();
      await expect(page.getByText('Testosterona', { exact: true })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('uma categoria só nasce aberta', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, SEM_CATEGORIAS);
      await expect(page.getByRole('button', { name: 'Sem categoria, aberto' })).toBeVisible();
      await expect(page.getByText('Cafeína', { exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('editar um item existente mantém a categoria dele, e "Sem categoria" grava vazio', async ({ page }) => {
      const { gravados, naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Medicamentos, recolhido' }).click();
      await page.getByRole('button', { name: 'Editar Lisdexanfetamina' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      const categoria = folha.getByRole('button', { name: /^Categoria: / });
      await expect(categoria).toHaveAccessibleName('Categoria: Medicamentos. Escolher.');
      await expect(folha.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Lisdexanfetamina');
      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(1);
      expect(gravados[0].metodo).toBe('PUT');
      expect(gravados[0].corpo.categoria).toBe('Medicamentos');

      await page.getByRole('button', { name: 'Editar Lisdexanfetamina' }).click();
      await categoria.click();
      await page.getByRole('option', { name: /^Sem categoria/ }).click();
      await expect(categoria).toHaveAccessibleName('Categoria: Sem categoria. Escolher.');
      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(2);
      expect(gravados[1].corpo.categoria).toBeNull();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
