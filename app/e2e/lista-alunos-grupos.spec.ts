import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, AlunoResumo, SituacaoDaAtualizacao } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Lista de alunos em grupos e colunas (D1 a D3 de `docs/planos/telas-do-aluno-visual.md`): um cartão por grupo (Para
 * revisar, Atrasados, Em dia, Sem pasta com período), colunas alinhadas no PC (linha de tabela, sem caixa) e a linha
 * empilhada na caixa no celular, a linha continua link (com a seta, por último) e o lápis, antes da seta e fora do link,
 * abre a ficha já editando. Só dados fictícios, API simulada.
 */
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

const id = (n: number) => `a0000000-0000-4000-8000-00000000000${n}`;
function situacao(n: number, fase: SituacaoDaAtualizacao['fase'], extra: Partial<SituacaoDaAtualizacao> = {}): SituacaoDaAtualizacao {
  return { id: `b0000000-0000-4000-8000-00000000000${n}`, dataAtualizacao: ontem, fase, diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, ...extra };
}
function aluno(n: number, nome: string, atualizacao: SituacaoDaAtualizacao | null, extra: Partial<AlunoResumo> = {}): AlunoResumo {
  return {
    id: id(n), nome, ativo: true, temAcesso: true, planoAtivo: { id: `pl${n}`, titulo: 'Treino de outubro' }, ultimoRegistro: ontem,
    responsavelId: TREINADOR.id, atualizacao, ...extra,
  };
}

const ALUNOS: AlunoResumo[] = [
  aluno(1, 'Ana Fictícia', situacao(1, 'ENVIADA', { diasParaData: -1 })),
  aluno(2, 'Bruno Exemplo', situacao(2, 'ATRASADA', { diasParaData: -3, diasDeAtraso: 3 })),
  aluno(3, 'Carla Teste', situacao(3, 'ABERTA', { diasParaData: 15 })),
  aluno(4, 'Davi Modelo', situacao(4, 'REVISADA')),
  aluno(5, 'Eva Amostra', null, { temAcesso: false, planoAtivo: null, ultimoRegistro: null, responsavelId: null }),
];

const FICHA: AlunoDetalhe = {
  id: id(1), nome: 'Ana Fictícia', email: 'ana@exemplo.test', telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: 'ana@exemplo.test', aguardandoPrimeiroAcesso: false,
};

async function abrir(page: Page, { veAtualizacao = true } = {}) {
  const itens = veAtualizacao ? ALUNOS : ALUNOS.map((a) => ({ ...a, atualizacao: null }));
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: veAtualizacao ? [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] : PERMISSOES_TREINADOR })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 1, atualizacoesAtrasadas: 1, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 5, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens, total: itens.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    [`GET /alunos/${id(1)}`]: { corpo: FICHA },
  });
}

const topo = async (l: Locator) => (await l.boundingBox())?.y ?? Number.NaN;
const linkDe = (page: Page, nome: string) => page.getByRole('link', { name: new RegExp(`^Abrir ${nome}`) });
const grupo = (page: Page, titulo: string) => page.getByRole('heading', { name: titulo, exact: true, level: 2 });

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('grupos com título e contagem, cada aluno no seu grupo, colunas só no PC', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');

      await expect(grupo(page, 'Para revisar')).toBeVisible();
      await expect(page.getByText('1 aluno · A atualização chegou e espera o seu feedback.')).toBeVisible();
      await expect(page.getByText('1 aluno · Passou da data e o aluno ainda não enviou.')).toBeVisible();
      await expect(page.getByText('2 alunos · Atualização ainda por vir ou já revisada.')).toBeVisible();
      await expect(page.getByText('1 aluno · Sem atualização para acompanhar ainda.')).toBeVisible();

      // A ordem na tela diz o grupo: cada aluno fica entre o título do grupo dele e o do seguinte.
      const ordem = [
        grupo(page, 'Para revisar'), linkDe(page, 'Ana Fictícia'),
        grupo(page, 'Atrasados'), linkDe(page, 'Bruno Exemplo'),
        grupo(page, 'Em dia'), linkDe(page, 'Carla Teste'), linkDe(page, 'Davi Modelo'),
        grupo(page, 'Sem pasta com período'), linkDe(page, 'Eva Amostra'),
      ];
      const ys = [];
      for (const l of ordem) ys.push(await topo(l));
      expect(ys).toEqual([...ys].sort((a, b) => a - b));

      // Empilhado, o selo diz de quê; na coluna "Atualização" vale o texto curto. "Sem acesso" é exceção e aparece.
      await expect(page.getByText(largura < 1024 ? 'Atualização atrasada há 3 dias' : 'Atrasada há 3 dias', { exact: true })).toBeVisible();
      await expect(page.getByText('Sem acesso', { exact: true })).toBeVisible();

      const cabecalhos = page.getByText('Plano em uso', { exact: true });
      if (largura >= 1024) {
        // Um cabeçalho de colunas por grupo, e o responsável pelo primeiro nome.
        await expect(cabecalhos).toHaveCount(4);
        await expect(cabecalhos.first()).toBeVisible();
        await expect(page.getByText('Responsável', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Treinadora', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Sem plano ativo', { exact: true })).toBeVisible();
      } else {
        await expect(cabecalhos).toHaveCount(0);
        await expect(page.getByText('Sem plano ativo · Nunca registrou')).toBeVisible();
      }

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('a linha continua link, sem botão dentro; o lápis fica ao lado e abre a ficha já editando', async ({ page }) => {
      const { errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');

      const linkAna = linkDe(page, 'Ana Fictícia');
      await expect(linkAna).toHaveAttribute('href', `/treinador/alunos/${id(1)}`);
      await expect(linkAna.getByRole('button')).toHaveCount(0);
      await expect(page.getByRole('checkbox')).toHaveCount(0);

      const lapis = page.getByRole('button', { name: 'Editar cadastro de Ana Fictícia', exact: true });
      // 0,5 px de folga: o arredondamento de subpixel às vezes mede 39,99997.
      expect((await lapis.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(39.5);
      await lapis.click();

      await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${id(1)}$`));
      // Abre editando (o formulário com Salvar) e o `editar=1` sai do endereço.
      await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
      expect(new URL(page.url()).search).toBe('');

      // Sem passo sobrando: um voltar leva de novo à lista.
      await page.goBack();
      await expect(page).toHaveURL(/\/treinador\/alunos$/);
      await expect(linkDe(page, 'Ana Fictícia')).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('na ponta da linha o lápis vem antes e a seta por último; a seta continua dentro do link e abre a ficha', async ({ page }) => {
      const { errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');

      const linkAna = linkDe(page, 'Ana Fictícia');
      await expect(linkAna).toHaveCount(1);
      const seta = linkAna.getByTestId('seta-da-linha');
      await expect(seta).toHaveCount(1);
      const lapis = page.getByRole('button', { name: 'Editar cadastro de Ana Fictícia', exact: true });
      const caixaDoLapis = await lapis.boundingBox();
      const caixaDaSeta = await seta.boundingBox();
      expect(caixaDoLapis && caixaDaSeta).toBeTruthy();
      expect(caixaDoLapis!.x + caixaDoLapis!.width).toBeLessThanOrEqual(caixaDaSeta!.x);
      // O lápis é irmão do link (nunca filho), por cima do lugar que o link deixa vazio antes da seta.
      await expect(linkAna.getByRole('button')).toHaveCount(0);
      expect(await lapis.evaluate((b) => !!b.closest('a'))).toBe(false);

      await seta.click();
      await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${id(1)}$`));

      // Acima do lápis (fora do botão) ainda é o link: a faixa do botão não deixa ponto morto.
      await page.goBack();
      await expect(linkAna).toBeVisible();
      const doLink = await linkAna.boundingBox();
      const lapisDeNovo = await lapis.boundingBox();
      await page.mouse.click(lapisDeNovo!.x + lapisDeNovo!.width / 2, doLink!.y + 3);
      await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${id(1)}$`));
      await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test(largura >= 1024 ? 'no PC a linha é de tabela (divisória, sem caixa) e as colunas seguem o cabeçalho' : 'no celular a linha continua na caixa', async ({ page }) => {
      const { errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');

      const linkAna = linkDe(page, 'Ana Fictícia');
      await expect(linkAna).toBeVisible();
      // O contorno da linha: o contêiner em volta do link e do lápis.
      const contorno = linkAna.locator('xpath=../..');
      const estilo = () => contorno.evaluate((e) => {
        const s = getComputedStyle(e);
        return { esquerda: s.borderLeftColor, baixo: s.borderBottomColor, raio: s.borderTopLeftRadius, fundo: s.backgroundColor };
      });
      const transparente = 'rgba(0, 0, 0, 0)';
      const parado = await estilo();
      if (largura >= 1024) {
        expect(parado.esquerda).toBe(transparente);
        expect(parado.baixo).not.toBe(transparente);
        expect(parado.fundo).toBe(transparente);
        expect(parado.raio).toBe('0px');
        // Realce no hover, na linha inteira.
        await linkAna.hover();
        await expect.poll(async () => (await estilo()).fundo).not.toBe(transparente);

        // O texto da coluna "Plano em uso" começa onde começa o rótulo dela, com o lápis e no Selecionar.
        const alinhado = async () => {
          const rotulo = await page.getByText('Plano em uso', { exact: true }).first().boundingBox();
          const celula = await page.getByText('Treino de outubro', { exact: true }).first().boundingBox();
          return Math.abs((rotulo?.x ?? 0) - (celula?.x ?? 1000));
        };
        expect(await alinhado()).toBeLessThanOrEqual(1);
        await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
        await expect(page.getByRole('checkbox').first()).toBeVisible();
        expect(await alinhado()).toBeLessThanOrEqual(1);
      } else {
        expect(parado.esquerda).not.toBe(transparente);
        expect(parado.fundo).not.toBe(transparente);
      }
      expect(errosDaPagina).toEqual([]);
    });

    test('sem ver atualizações: um grupo só e sem a coluna Atualização', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, { veAtualizacao: false });
      await page.goto('/treinador/alunos');

      await expect(grupo(page, 'Alunos')).toBeVisible();
      await expect(page.getByText('5 alunos', { exact: true })).toBeVisible();
      await expect(grupo(page, 'Para revisar')).toHaveCount(0);
      await expect(page.getByText('Atualização', { exact: true })).toHaveCount(0);
      if (largura >= 1024) await expect(page.getByText('Plano em uso', { exact: true })).toHaveCount(1);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
