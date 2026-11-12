import { expect, test, type Page } from '@playwright/test';

import type { ErgogenicoDaBiblioteca, ErgogenicoDaBibliotecaRequest } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Biblioteca › Outros › Novo item/Editar item: Categoria vem primeiro e as sugestões são as categorias que já existem,
 * filtradas pelo que foi digitado (sem acento nem caixa). Só dados fictícios.
 */
function item(nome: string, categoria: string | null, extra: Partial<ErgogenicoDaBiblioteca> = {}): ErgogenicoDaBiblioteca {
  return { id: `e000000${nome.length}-0000-4000-8000-000000000000`, categoria, nome, principioAtivo: null, concentracao: null, apresentacao: null, observacao: null, ...extra };
}

const COM_CATEGORIAS = [item('Lisdexanfetamina', 'Medicamentos', { principioAtivo: 'Dimesilato' }), item('Testosterona', 'Injetáveis')];
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

    test('sem categoria cadastrada: Categoria vem antes do Nome e não há sugestão', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, SEM_CATEGORIAS);
      await page.getByRole('button', { name: 'Novo item' }).click();
      const folha = page.getByRole('dialog');
      const categoria = folha.getByRole('textbox', { name: 'Categoria (opcional)' });
      const nomeDoItem = folha.getByRole('textbox', { name: 'Nome', exact: true });
      await expect(categoria).toBeVisible();
      const [yCategoria, yNome] = await Promise.all([categoria.boundingBox(), nomeDoItem.boundingBox()]);
      expect(yCategoria!.y).toBeLessThan(yNome!.y);
      // Só os botões da própria folha: nenhum chip de categoria.
      await expect(folha.getByRole('button', { name: /Medicamentos|Injetáveis|Cafeína/ })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('com categorias: aparecem ao abrir, filtram ao digitar, o texto exato some e tocar preenche', async ({ page }) => {
      const { gravados, naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Novo item' }).click();
      const folha = page.getByRole('dialog');
      const categoria = folha.getByRole('textbox', { name: 'Categoria (opcional)' });
      const sugestao = (rotulo: string) => folha.getByRole('button', { name: rotulo, exact: true });

      await expect(sugestao('Medicamentos')).toBeVisible();
      await expect(sugestao('Injetáveis')).toBeVisible();

      await categoria.fill('med');
      await expect(sugestao('Medicamentos')).toBeVisible();
      await expect(sugestao('Injetáveis')).toHaveCount(0);

      await categoria.fill('MEDICAMENTOS');
      await expect(sugestao('Medicamentos')).toHaveCount(0);
      await expect(sugestao('Injetáveis')).toHaveCount(0);

      await categoria.fill('');
      await sugestao('Injetáveis').click();
      await expect(categoria).toHaveValue('Injetáveis');
      await expect(sugestao('Injetáveis')).toHaveCount(0);

      await folha.getByRole('textbox', { name: 'Nome', exact: true }).fill('Item novo');
      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(1);
      expect(gravados[0]).toEqual({
        metodo: 'POST',
        corpo: { categoria: 'Injetáveis', nome: 'Item novo', principioAtivo: null, concentracao: null, apresentacao: null, observacao: null },
      });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('seções do Editar alimento, pares em colunas no PC e empilhados no celular, rodapé visível com o corpo rolado', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Editar Lisdexanfetamina' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar item' });
      for (const secao of ['Identificação', 'Concentração e apresentação', 'Observação']) {
        await expect(folha.getByRole('heading', { name: secao, level: 3 })).toBeVisible();
      }
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

    test('editar um item existente mantém a categoria dele', async ({ page }) => {
      const { gravados, naoTratadas, errosDaPagina } = await abrir(page, COM_CATEGORIAS);
      await page.getByRole('button', { name: 'Editar Lisdexanfetamina' }).click();
      const folha = page.getByRole('dialog');
      await expect(folha.getByRole('textbox', { name: 'Categoria (opcional)' })).toHaveValue('Medicamentos');
      await expect(folha.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Lisdexanfetamina');
      // O campo abre com "Medicamentos": é igual ao texto (nada a sugerir) e "Injetáveis" não casa com ele.
      await expect(folha.getByRole('button', { name: 'Medicamentos', exact: true })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Injetáveis', exact: true })).toHaveCount(0);
      // Apagar o texto traz as duas de volta.
      await folha.getByRole('textbox', { name: 'Categoria (opcional)' }).fill('');
      await expect(folha.getByRole('button', { name: 'Injetáveis', exact: true })).toBeVisible();
      await folha.getByRole('textbox', { name: 'Categoria (opcional)' }).fill('Medicamentos');

      await folha.getByRole('button', { name: 'Salvar' }).click();
      await expect.poll(() => gravados.length).toBe(1);
      expect(gravados[0].metodo).toBe('PUT');
      expect(gravados[0].corpo.categoria).toBe('Medicamentos');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
