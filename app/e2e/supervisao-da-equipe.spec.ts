import { expect, test, type Page } from '@playwright/test';

import type { MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import type { NumerosDaConsultoria } from '../src/api/tipos';
import { ERRO_DO_LIMITE } from '../src/dominio/limiteDeAlunos';
import { CLARO, ESCURO } from '../src/tema/tokens';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Supervisão da equipe (plano supervisao-da-equipe, D1, D2, D13, D14, D16 e D17): o campo "Limite de alunos" no editar
 * membro só para o Administrador (perfil de acesso total), gravado na rota própria e só quando muda; e a tabela da equipe
 * em Números, só quando a API a manda (sem `EQUIPE_LER` vem `null` e a seção some). Só contagens e nomes de membros
 * fictícios; nunca nome de aluno. Em 390 e 1280 px; o selo "Acima do limite" também no tema escuro.
 */
const ADMIN = { perfil: { id: 'p-adm', nome: 'Administrador', acessoTotal: true }, permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'USUARIO_ALTERAR', 'PERFIL_ALTERAR'] };
const NAO_ADMIN = { perfil: { id: 'p-1', nome: 'Treinador', acessoTotal: false }, permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'USUARIO_ALTERAR'] };

const PERFIS: PerfilEquipe[] = [
  { id: 'p-1', nome: 'Treinador', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 1, versao: 1 },
];
const BIA: MembroEquipe = {
  id: 'm0000000-0000-4000-8000-000000000002', nome: 'Bia Exemplo', email: 'bia@exemplo.test', perfilId: 'p-1', perfilNome: 'Treinador',
  ativo: true, convitePendente: false, conviteExpiraEm: null, ultimoAcesso: null, limiteDeAlunos: 30,
};

const NUMEROS: NumerosDaConsultoria = {
  meses: [{ mes: '2026-11', parcial: true, alunosAtivos: 40, atualizacoesNoPrazo: 3, atualizacoesAtrasadas: 1 }],
  equipe: [
    { usuarioId: 'u1', nome: 'Ana Fictícia', alunosAtivos: 32, limiteDeAlunos: 30, atualizacoesAtrasadas: 2, atualizacoesParaRevisar: 5 },
    { usuarioId: 'u2', nome: 'Bia Exemplo', alunosAtivos: 4, limiteDeAlunos: null, atualizacoesAtrasadas: null, atualizacoesParaRevisar: null },
  ],
  semResponsavel: { alunosAtivos: 3, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
};

const TEMAS = { CLARO, ESCURO } as const;
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

const BASE: RespostasApi = {
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  'GET /perfis': { corpo: PERFIS },
  'GET /permissoes/catalogo': { corpo: [] },
};

async function preparar(page: Page, largura: number, tema: 'CLARO' | 'ESCURO' = 'CLARO') {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
}

/** Os PUT em ordem: `membro` (`/usuarios/{id}`) ou `limite` (`/usuarios/{id}/limite-de-alunos`). */
const puts = (pedidos: { metodo: string; caminho: string }[]) =>
  pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.startsWith('/usuarios/')).map((p) => (p.caminho.endsWith('/limite-de-alunos') ? 'limite' : 'membro'));

const limitesPedidos = (pedidos: { metodo: string; caminho: string; corpo: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/limite-de-alunos'));

for (const largura of [390, 1280]) {
  test.describe(`limite de alunos e tabela da equipe em ${largura} px`, () => {
    test('Administrador: valida o número, grava só quando muda e vazio vira sem limite', async ({ page }) => {
      await preparar(page, largura);
      let limite: number | null = BIA.limiteDeAlunos;
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, ADMIN)), ...BASE,
        // A lista devolve o limite gravado por último, como a API.
        'GET /usuarios': (_p, route) => json(route, [{ ...BIA, limiteDeAlunos: limite }]),
        'PUT /usuarios/{id}': { corpo: BIA },
        'PUT /usuarios/{id}/limite-de-alunos': (p, route) => {
          limite = (p.corpo as { limite: number | null }).limite;
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/treinador/equipe');
      await expect(page.getByText('Último acesso: — · Limite: 30 alunos')).toBeVisible();

      // Salvar sem mexer no limite: só o PUT do membro, nenhuma gravação (nem auditoria) do limite.
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar membro' });
      const campo = folha.getByRole('textbox', { name: 'Limite de alunos (opcional)' });
      await expect(campo).toHaveValue('30');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha).toHaveCount(0);
      expect(limitesPedidos(pedidos)).toEqual([]);

      // Fora da faixa e não inteiro: o erro aparece no campo, nada é cortado para um número válido, Salvar desabilitado
      // com o motivo e nada enviado.
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      await campo.fill('1000');
      await expect(folha.getByText(ERRO_DO_LIMITE)).toBeVisible();
      await expect(campo).toHaveValue('1000');
      await campo.fill('1,5');
      await expect(folha.getByText(ERRO_DO_LIMITE)).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Salvar membro' })).toBeDisabled();
      await expect(folha.getByText('Corrija o limite de alunos.')).toBeVisible();

      await campo.fill('20');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Último acesso: — · Limite: 20 alunos')).toBeVisible();

      // Vazio = sem limite: `{limite: null}` explícito (sem a chave a API recusaria, D22).
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      await campo.fill('');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Último acesso: — · Sem limite de alunos')).toBeVisible();
      expect(limitesPedidos(pedidos).map((p) => p.corpo)).toEqual([{ limite: 20 }, { limite: null }]);
      // Ordem: o membro é gravado antes do limite, em cada salvar.
      expect(puts(pedidos)).toEqual(['membro', 'membro', 'limite', 'membro', 'limite']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Administrador: falha parcial e nova tentativa sem repetir o membro nem a confirmação', async ({ page }) => {
      await preparar(page, largura);
      let tentativasDoLimite = 0;
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, ADMIN)), ...BASE,
        'GET /usuarios': { corpo: [BIA] },
        'PUT /usuarios/{id}': (p, route) => json(route, { ...BIA, ...(p.corpo as object) }),
        // A primeira gravação do limite é recusada (422 no campo); a segunda passa.
        'PUT /usuarios/{id}/limite-de-alunos': (_p, route) => (++tentativasDoLimite === 1
          ? json(route, erroApi(422, 'Confira os campos.', 'LIMITE_DE_ALUNOS_INVALIDO', [{ field: 'limite', message: 'Limite recusado pela API.' }]).corpo, 422)
          : route.fulfill({ status: 204 })),
      });
      await page.goto('/treinador/equipe');
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar membro' });
      await folha.getByRole('checkbox', { name: 'Membro ativo' }).click();
      await folha.getByRole('textbox', { name: 'Limite de alunos (opcional)' }).fill('7');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await page.getByRole('button', { name: 'Desativar membro', exact: true }).click();
      await expect(folha.getByText('Limite recusado pela API.')).toBeVisible();
      await expect(page.getByText('Nome, perfil e situação foram salvos; o limite de alunos não.')).toBeVisible();
      expect(puts(pedidos)).toEqual(['membro', 'limite']);

      // Nova tentativa: só o limite vai, e o "Desativar membro?" não aparece de novo (o membro já está inativo).
      await folha.getByRole('textbox', { name: 'Limite de alunos (opcional)' }).fill('8');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Desativar membro?')).toHaveCount(0);
      expect(puts(pedidos)).toEqual(['membro', 'limite', 'limite']);
      expect(limitesPedidos(pedidos).map((p) => p.corpo)).toEqual([{ limite: 7 }, { limite: 8 }]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Administrador: se o membro não é salvo, o limite não é chamado', async ({ page }) => {
      await preparar(page, largura);
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, ADMIN)), ...BASE,
        'GET /usuarios': { corpo: [BIA] },
        'PUT /usuarios/{id}': erroApi(403, 'Você não pode alterar este membro.', 'PERMISSAO_NEGADA'),
        'PUT /usuarios/{id}/limite-de-alunos': { status: 204 },
      });
      await page.goto('/treinador/equipe');
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar membro' });
      await folha.getByRole('textbox', { name: 'Limite de alunos (opcional)' }).fill('7');
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha.getByText('Você não pode alterar este membro.')).toBeVisible();
      expect(puts(pedidos)).toEqual(['membro']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('quem não é Administrador vê o limite só para leitura', async ({ page }) => {
      await preparar(page, largura);
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, NAO_ADMIN)), ...BASE,
        'GET /usuarios': { corpo: [BIA] },
        'PUT /usuarios/{id}': { corpo: BIA },
      });
      await page.goto('/treinador/equipe');
      await page.getByRole('button', { name: 'Editar Bia Exemplo' }).click();
      const folha = page.getByRole('dialog', { name: 'Editar membro' });
      await expect(folha.getByText('Só um administrador altera o limite de alunos.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: /Limite de alunos/ })).toHaveCount(0);
      await folha.getByRole('button', { name: 'Salvar membro' }).click();
      await expect(folha).toHaveCount(0);
      expect(limitesPedidos(pedidos)).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    for (const tema of ['CLARO', 'ESCURO'] as const) {
      test(`Números: tabela da equipe com "Sem responsável" (tema ${tema})`, async ({ page }) => {
        await preparar(page, largura, tema);
        const { naoTratadas, errosDaPagina } = await simularApi(page, {
          ...(await sessao(page, TREINADOR, ADMIN)), ...BASE,
          'GET /numeros': { corpo: NUMEROS },
        });
        await page.goto('/treinador/numeros');
        const tabela = page.getByLabel('Alunos e atualizações de cada membro da equipe');
        await expect(tabela.getByText('Ana Fictícia')).toBeVisible();
        await expect(tabela.getByText('32 / 30')).toBeVisible();
        await expect(tabela.getByText('Acima do limite')).toBeVisible();
        await expect(tabela.getByText('4 / sem limite')).toBeVisible();
        await expect(tabela.getByText('Sem responsável')).toBeVisible();
        // O tema pedido valeu: o texto da linha tem a cor do tema (sem isso, claro e escuro seriam o mesmo teste).
        expect(await tabela.getByText('Sem responsável').evaluate((e) => getComputedStyle(e).color)).toBe(rgb(TEMAS[tema].texto));
        // Sem a permissão das atualizações, a API manda nulo: "—", nunca zero.
        await expect(tabela.getByText('—')).toHaveCount(2);
        await expect(page.getByText(/Na equipe, atrasadas/)).toBeVisible();
        expect(naoTratadas).toEqual([]);
        expect(errosDaPagina).toEqual([]);
      });
    }

    test('Números sem EQUIPE_LER: a seção da equipe não aparece', async ({ page }) => {
      await preparar(page, largura);
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR)), ...BASE,
        'GET /numeros': { corpo: { ...NUMEROS, equipe: null, semResponsavel: null } },
      });
      await page.goto('/treinador/numeros');
      await expect(page.getByText('Mês a mês')).toBeVisible();
      await expect(page.getByText('Equipe', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Sem responsável')).toHaveCount(0);
      await expect(page.getByText(/Na equipe, atrasadas/)).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
