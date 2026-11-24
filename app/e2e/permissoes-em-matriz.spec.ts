// permissões em matriz (23/11)
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { PerfilEquipe } from '../src/api/equipeTipos';
import { CATALOGO_DE_EXEMPLO } from '../src/dominio/catalogoDePermissoes.exemplo';
import { MOTIVO_DO_TETO } from '../src/dominio/matrizDePermissoes';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Equipe › Perfis › Editar perfil em matriz (plano `docs/planos/permissoes-em-matriz.md`): seções recolhíveis com "N de M"
 * e "Marcar toda a seção" com estado parcial, linhas por recurso e colunas Ver | Criar e editar | Publicar | Outras, célula
 * vazia sem caixa, nome acessível "recurso: ação", dica no lugar do texto longo, dependência travada com "Necessária
 * para …", selo de dado sensível na célula do recurso, filtro, resumo vivo, barra de salvar e "Sair sem salvar?".
 * Folha de ~900 px em 1280 e tela cheia em 390 (blocos por recurso). Só perfis e nomes fictícios.
 */
const ADMIN = { perfil: { id: 'p-adm', nome: 'Administrador', acessoTotal: true }, permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'USUARIO_ALTERAR', 'PERFIL_ALTERAR'] };

// Perfil parcial: Início e Planos completos, Alunos em parte, e o treino publicado trava a leitura e o editar do treino.
const PARCIAL = ['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_SENSIVEL_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'];
const ESTAGIO: PerfilEquipe = { id: 'p-est', nome: 'Estagiário', descricao: 'Perfil de exemplo.', acessoTotal: false, sistema: false, ativo: true, permissoes: PARCIAL, usuarios: 0, versao: 3 };
const SISTEMA: PerfilEquipe = { id: 'p-adm', nome: 'Administrador', descricao: null, acessoTotal: true, sistema: true, ativo: true, permissoes: [], usuarios: 1, versao: 1 };

const BASE: RespostasApi = {
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  'GET /usuarios': { corpo: [] },
  'GET /perfis': { corpo: [SISTEMA, ESTAGIO] },
  'GET /permissoes/catalogo': { corpo: CATALOGO_DE_EXEMPLO },
};

async function abrir(page: Page, largura: number, extra: RespostasApi = {}, ator = ADMIN) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, { ...(await sessao(page, TREINADOR, ator)), ...BASE, ...extra });
  await page.goto('/treinador/equipe?aba=perfis');
  await page.getByRole('button', { name: 'Editar Estagiário' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar perfil' });
  await expect(folha.getByRole('textbox', { name: 'Nome do perfil' })).toHaveValue('Estagiário');
  return { folha, ...api };
}
const caixa = (folha: Locator, nome: string) => folha.getByRole('checkbox', { name: nome, exact: true });
const abrirSecao = (folha: Locator, secao: string) => folha.getByRole('button', { name: `${secao}, recolhido` }).click();

for (const largura of [390, 1280]) {
  test.describe(`permissões em matriz em ${largura} px`, () => {
    test('folha, resumo vivo, seções com "N de M", matriz ou blocos, célula vazia e dependência travada', async ({ page }) => {
      const { folha, errosDaPagina } = await abrir(page, largura);

      // ~900 px no PC; tela cheia no celular.
      const caixaDaFolha = (await folha.boundingBox())!;
      if (largura === 1280) expect(Math.round(caixaDaFolha.width)).toBe(900);
      else { expect(Math.round(caixaDaFolha.width)).toBe(390); expect(Math.round(caixaDaFolha.height)).toBeGreaterThanOrEqual(895); }

      await expect(folha.getByText('11 permissões · 1 com dado sensível')).toBeVisible();
      // tamanho das folhas (24/11): Nome, Descrição e "Perfil ativo" na largura toda, alinhados com "Filtrar permissões";
      // nenhuma faixa vazia à direita deles.
      const filtroCaixa = (await folha.getByRole('textbox', { name: 'Filtrar permissões' }).boundingBox())!;
      for (const campo of [folha.getByRole('textbox', { name: 'Nome do perfil' }), folha.getByRole('textbox', { name: 'Descrição' }), folha.getByRole('checkbox', { name: 'Perfil ativo' })]) {
        const c = (await campo.boundingBox())!;
        expect(Math.abs(c.x - filtroCaixa.x)).toBeLessThan(1.5);
        expect(Math.abs((c.x + c.width) - (filtroCaixa.x + filtroCaixa.width))).toBeLessThan(1.5);
      }
      // Seções nascem fechadas (4.8), com a contagem e a caixa da seção na faixa.
      await expect(folha.getByRole('button', { name: 'Alunos, recolhido' })).toBeVisible();
      await expect(folha.getByText('3 de 13')).toBeVisible();
      await expect(folha.getByText('7 de 7')).toBeVisible();
      await expect(caixa(folha, 'Marcar toda a seção Alunos')).toHaveAttribute('aria-checked', 'mixed');
      await expect(caixa(folha, 'Marcar toda a seção Planos')).toHaveAttribute('aria-checked', 'true');
      await expect(caixa(folha, 'Marcar toda a seção Conteúdo')).toHaveAttribute('aria-checked', 'false');

      await abrirSecao(folha, 'Planos');
      if (largura === 1280) {
        const tabela = folha.getByRole('table', { name: 'Permissões da seção Planos' });
        await expect(tabela.getByRole('columnheader')).toHaveText(['Recurso', 'Ver', 'Criar e editar', 'Publicar', 'Outras']);
        await expect(tabela.getByRole('rowheader')).toHaveText(['Pastas', 'Treino', 'Dieta']);
        // Pastas não tem "Ver" nem "Publicar": células vazias, sem caixa.
        const pastas = tabela.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Pastas' }) });
        await expect(pastas.getByRole('cell')).toHaveCount(4);
        await expect(pastas.getByRole('cell').nth(0).getByRole('checkbox')).toHaveCount(0);
        await expect(pastas.getByRole('cell').nth(1).getByRole('checkbox')).toHaveCount(1);
        await expect(pastas.getByRole('cell').nth(2).getByRole('checkbox')).toHaveCount(0);
      } else {
        await expect(folha.getByRole('table')).toHaveCount(0);
        await expect(caixa(folha, 'Pastas: criar e editar')).toBeVisible();
        await expect(caixa(folha, 'Pastas: ver')).toHaveCount(0);
        // Sem mouse no celular: o motivo fica escrito embaixo da ação.
        await expect(folha.getByText('Necessária para Treino: criar e editar e Treino: publicar.')).toBeVisible();
      }

      const ver = caixa(folha, 'Treino: ver');
      await expect(ver).toHaveAttribute('aria-checked', 'true');
      await expect(ver).toHaveAttribute('aria-disabled', 'true');
      await expect(ver).toHaveAccessibleDescription('Necessária para Treino: criar e editar e Treino: publicar.');
      // Travada continua no Tab (aria-disabled, não fora do foco): Espaço não muda nada.
      await ver.focus();
      await expect(ver).toBeFocused();
      await page.keyboard.press(' ');
      await expect(ver).toHaveAttribute('aria-checked', 'true');

      // Desmarcar quem depende libera, um passo de cada vez.
      await caixa(folha, 'Treino: publicar').click();
      await expect(ver).toHaveAccessibleDescription('Necessária para Treino: criar e editar.');
      await expect(caixa(folha, 'Treino: criar e editar')).not.toHaveAttribute('aria-disabled', 'true');
      await caixa(folha, 'Treino: criar e editar').click();
      await expect(ver).not.toHaveAttribute('aria-disabled', 'true');
      await expect(ver).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByText('5 de 7')).toBeVisible();
      await expect(caixa(folha, 'Marcar toda a seção Planos')).toHaveAttribute('aria-checked', 'mixed');
      await expect(folha.getByText('9 permissões · 1 com dado sensível')).toBeVisible();
      await expect(folha.getByText('Alterações não salvas')).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('dica no lugar do texto longo, selo de dado sensível na célula, filtro e o defeito da equipe corrigido', async ({ page }) => {
      const { folha } = await abrir(page, largura);
      const filtro = folha.getByRole('textbox', { name: 'Filtrar permissões' });

      await filtro.fill('inscri');
      await expect(folha.getByRole('button', { name: 'Alunos, aberto' })).toBeVisible();
      const atender = caixa(folha, 'Interessados: criar e editar');
      await expect(atender).toHaveAccessibleDescription('Atender, aceitar e recusar: interessados; configurar o link de inscrição.');
      await expect(caixa(folha, 'Cadastro: ver')).toHaveCount(0);
      const textoLongo = folha.getByText('Atender, aceitar e recusar: interessados; configurar o link de inscrição.');
      if (largura === 1280) {
        await expect(textoLongo).toBeHidden();
        await atender.hover();
        await expect(textoLongo).toBeVisible();
      } else await expect(textoLongo).toBeVisible();

      await filtro.fill('medicacao');
      await expect(folha.getByRole('button', { name: 'Conteúdo, aberto' })).toBeVisible();
      if (largura === 1280) await expect(folha.getByRole('rowheader', { name: /Medicação e ergogênicos/ })).toContainText('Dado sensível');
      else await expect(folha.getByText('Dado sensível', { exact: true }).filter({ visible: true })).toHaveCount(1);
      await expect(caixa(folha, 'Medicação e ergogênicos: ver')).toHaveAccessibleDescription(largura === 1280 ? 'Dado sensível.' : '');

      // Selo na mesma posição em todos os recursos (regra única, `arranjoDaMatriz`): ao lado do nome em 1280; em 390 o nome
      // mais longo ("Medicação e ergogênicos") não cabe com ele, então fica abaixo do nome em todos. "Dados sensíveis" não tem selo.
      await filtro.fill('dado sensivel');
      for (const nome of ['Privacidade', 'Check-in', 'Anamnese', 'Medicação e ergogênicos', 'Financeiro', 'WhatsApp']) {
        const recurso = folha.getByText(nome, { exact: true }).filter({ visible: true });
        const selo = recurso.locator('xpath=../..').getByText('Dado sensível', { exact: true });
        const [r, sl] = [(await recurso.boundingBox())!, (await selo.boundingBox())!];
        if (largura === 1280) {
          expect(sl.x).toBeGreaterThan(r.x + r.width - 1);
          expect(Math.abs((sl.y + sl.height / 2) - (r.y + r.height / 2))).toBeLessThan(6);
        } else {
          // O texto do selo começa depois do ícone e do recuo da pílula (~27 px): a pílula está alinhada ao nome.
          expect(sl.x - r.x).toBeGreaterThanOrEqual(0);
          expect(sl.x - r.x).toBeLessThan(40);
          expect(sl.y).toBeGreaterThan(r.y + r.height - 1);
        }
      }
      await expect(folha.getByText('Dados sensíveis', { exact: true }).filter({ visible: true }).locator('xpath=..').getByText('Dado sensível', { exact: true })).toHaveCount(0);

      // Antes, "Equipe · Criar e editar: equipe" aparecia duas vezes (USUARIO_ALTERAR e PERFIL_ALTERAR com a mesma descrição na API).
      await filtro.fill('equipe');
      await expect(caixa(folha, 'Equipe: ver')).toBeVisible();
      await expect(caixa(folha, 'Equipe: convidar e editar membros')).toBeVisible();
      await expect(caixa(folha, 'Equipe: criar e editar perfis')).toBeVisible();
      await expect(folha.getByText('Criar e editar: equipe.')).toHaveCount(0);

      await filtro.fill('xyz');
      await expect(folha.getByText('Nenhuma permissão com “xyz”.')).toBeVisible();
      await folha.getByRole('button', { name: 'Limpar filtro' }).click();
      await expect(filtro).toHaveValue('');
      // Limpar volta ao estado de antes da busca: tudo fechado.
      await expect(folha.getByRole('button', { name: 'Alunos, recolhido' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Conteúdo, recolhido' })).toBeVisible();
    });

    test('"Marcar toda a seção": parcial marca tudo; desmarcar mantém travado o que outra seção exige; salvar manda a lista de códigos', async ({ page }) => {
      const { folha, pedidos } = await abrir(page, largura, { 'PUT /perfis/{id}': { corpo: ESTAGIO } });
      const alunos = caixa(folha, 'Marcar toda a seção Alunos');
      await alunos.click();
      await expect(alunos).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByText('13 de 13')).toBeVisible();
      await expect(folha.getByText('21 permissões · 4 com dado sensível')).toBeVisible();
      await alunos.click();
      // As pastas (Planos) ainda precisam do cadastro: ele fica, travado, e a seção volta parcial.
      await expect(alunos).toHaveAttribute('aria-checked', 'mixed');
      await expect(folha.getByText('1 de 13')).toBeVisible();
      await abrirSecao(folha, 'Alunos');
      await expect(caixa(folha, 'Cadastro: ver')).toHaveAccessibleDescription('Necessária para Pastas: criar e editar.');

      await folha.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Perfil salvo.')).toBeVisible();
      const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/perfis/p-est')!;
      const corpo = put.corpo as { nome: string; permissoes: string[]; versao: number; ativo: boolean };
      expect(corpo.versao).toBe(3);
      expect(corpo.permissoes.sort()).toEqual(['ALUNO_LER', 'DIETA_ALTERAR', 'DIETA_LER', 'DIETA_PUBLICAR', 'PAINEL_VER', 'PASTA_ALTERAR', 'TREINO_ALTERAR', 'TREINO_LER', 'TREINO_PUBLICAR']);
    });

    test('409 do servidor fica no rodapé; "Sair sem salvar?" ao fechar com alteração', async ({ page }) => {
      const { folha } = await abrir(page, largura, {
        'PUT /perfis/{id}': (_p, route) => json(route, erroApi(409, 'Outra pessoa alterou este perfil. Recarregue para ver.', 'CONFLITO_EDICAO').corpo, 409),
      });
      // Sem alteração, Cancelar fecha direto.
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await expect(folha).toHaveCount(0);
      await page.getByRole('button', { name: 'Editar Estagiário' }).click();
      await caixa(folha, 'Marcar toda a seção Conteúdo').click();
      await folha.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(folha.getByText('Outra pessoa alterou este perfil. Recarregue para ver.')).toBeVisible();
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      const aviso = page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).or(page.getByRole('dialog', { name: 'Sair sem salvar?' }));
      await expect(aviso).toBeVisible();
      await aviso.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(folha).toBeVisible();
      await folha.getByRole('button', { name: 'Fechar' }).click();
      await aviso.getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
      await expect(folha).toHaveCount(0);
    });
  });
}

// revisão 24/11: o selo "Acesso total · perfil do sistema" é do perfil com `acessoTotal`, não de todo perfil do sistema.
test('lista de perfis: o selo "Acesso total" só aparece no perfil do sistema com acesso total', async ({ page }) => {
  const TREINADOR_DO_SISTEMA: PerfilEquipe = { id: 'p-tre', nome: 'Treinador', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 2, versao: 1 };
  let perfis: PerfilEquipe[] = [TREINADOR_DO_SISTEMA];
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await simularApi(page, { ...(await sessao(page, TREINADOR, ADMIN)), ...BASE, 'GET /perfis': (_p, route) => json(route, perfis) });
  await page.goto('/treinador/equipe?aba=perfis');
  const selo = page.getByText('Acesso total · perfil do sistema', { exact: true });
  await expect(page.getByText('2 usuários', { exact: true })).toBeVisible();
  await expect(selo).toHaveCount(0);

  perfis = [TREINADOR_DO_SISTEMA, SISTEMA];
  await page.reload();
  await expect(page.getByText('1 usuário', { exact: true })).toBeVisible();
  await expect(selo).toHaveCount(1);
  expect(errosDaPagina).toEqual([]);
});

test('teto: o que quem edita não tem fica travado, com o motivo, e "Marcar toda a seção" não o marca', async ({ page }) => {
  const gestor = { perfil: { id: 'p-gestor', nome: 'Gestor', acessoTotal: false }, permissoes: [...PARCIAL, 'EQUIPE_LER', 'PERFIL_ALTERAR'] };
  const { folha } = await abrir(page, 1280, {}, gestor);
  await expect(folha.getByText('Nada que você possa atribuir')).toHaveCount(2); // Atualizações e Conteúdo
  await abrirSecao(folha, 'Consultoria');
  const financeiro = caixa(folha, 'Financeiro: ver');
  await expect(financeiro).toHaveAttribute('aria-disabled', 'true');
  await expect(financeiro).toHaveAccessibleDescription(`Consultar: planos comerciais, cobranças dos alunos, painel e lançamentos. Dado sensível. ${MOTIVO_DO_TETO}`);
  await financeiro.focus();
  await page.keyboard.press(' ');
  await expect(financeiro).toHaveAttribute('aria-checked', 'false');
  await caixa(folha, 'Marcar toda a seção Consultoria').click();
  await expect(caixa(folha, 'Equipe: criar e editar perfis')).toHaveAttribute('aria-checked', 'true');
  await expect(financeiro).toHaveAttribute('aria-checked', 'false');
  await expect(folha.getByText('2 de 2')).toBeVisible();
});
