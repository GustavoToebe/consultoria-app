import { expect, test, type Page } from '@playwright/test';

import type { EuResponse, LoginResponse } from '../src/api/tipos';
import { NAO_E_TELEFONE } from '../src/dominio/entradaDoTelefone';
import { CONTATO_DO_SUPORTE } from '../src/dominio/produto';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Configurações › Meus dados do treinador (28/11): dois cartões ("Seus dados" com o e-mail de entrada só leitura e o selo do
 * perfil; "Trocar senha" com o indicador de força), atributos de preenchimento automático certos (o defeito era o Chrome pôr
 * o e-mail no Telefone), telefone que recusa e-mail, "Salvar seus dados" só com alteração e "Trocar senha" só com a nova
 * pela `RegrasSenha`. Em 390 e 1280. O preenchimento automático de verdade não roda no Chromium sem interface: aqui só os
 * atributos que o navegador lê. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const TELEFONE = '(45) 99999-8888';
const USUARIO = { ...TREINADOR, telefone: TELEFONE };

const ADMINISTRADOR = { id: 'p-adm', nome: 'Administrador', acessoTotal: true };

async function abrir(page: Page, largura: number, extra: RespostasApi = {}, perfil = ADMINISTRADOR) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  const base = await sessao(page, USUARIO, { perfil, permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER'] });
  const eu = (base['GET /eu'] as { corpo: EuResponse }).corpo;
  const api = await simularApi(page, {
    ...base,
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    // Salvar devolve o /eu novo; o `recarregarPerfil` lê o mesmo objeto, então a tela volta a "Nenhuma alteração".
    'PUT /eu': (pedido, route) => {
      const corpo = pedido.corpo as { nome: string; telefone: string | null };
      eu.usuario = { ...eu.usuario, nome: corpo.nome, telefone: corpo.telefone };
      return json(route, eu);
    },
    'PUT /eu/senha': { corpo: { accessToken: 'token-novo', expiresIn: 900, usuario: USUARIO, marca: MARCA } satisfies LoginResponse },
    ...extra,
  });
  await page.goto('/treinador/meus-dados');
  await expect(page.getByRole('heading', { level: 1, name: 'Meus dados' })).toBeVisible();
  return api;
}

const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar seus dados' });
const trocar = (page: Page) => page.getByRole('button', { name: 'Trocar senha' });
const telefone = (page: Page) => page.getByRole('textbox', { name: 'Telefone (opcional)' });

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test('atributos de preenchimento automático e o cartão "Seus dados"', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura);
      await expect(page.getByRole('heading', { name: 'Acesso', exact: true })).toHaveCount(0);
      await expect(page.getByLabel(`E-mail de entrada: ${TREINADOR.email}`)).toBeVisible();
      // Administrador: quem troca o e-mail dele é o suporte do produto (o link só aparece com o contato definido).
      await expect(page.getByText('Para mudar o e-mail de entrada, fale com o suporte do Overtraining.')).toBeVisible();
      // Com o contato definido o botão aparece; o recuo de 30/11 (`CONTATO_DO_SUPORTE = null`) o esconde.
      await expect(page.getByRole('button', { name: /^Fale com o suporte do Overtraining/ })).toHaveCount(CONTATO_DO_SUPORTE ? 1 : 0);
      // O selo do perfil fica colado ao título, fora do h2 (o nome do título continua "Seus dados").
      const selo = page.getByText('Perfil: Administrador', { exact: true });
      await expect(selo).toBeVisible();
      const titulo = await page.getByRole('heading', { name: 'Seus dados', exact: true }).boundingBox();
      const caixaDoSelo = await selo.boundingBox();
      expect(titulo && caixaDoSelo).toBeTruthy();
      expect(caixaDoSelo!.x).toBeGreaterThanOrEqual(titulo!.x + titulo!.width);
      expect(caixaDoSelo!.x - (titulo!.x + titulo!.width)).toBeLessThan(40);

      await expect(page.getByRole('textbox', { name: 'Seu nome' })).toHaveAttribute('autocomplete', 'name');
      await expect(telefone(page)).toHaveAttribute('type', 'tel');
      await expect(telefone(page)).toHaveAttribute('inputmode', 'tel');
      await expect(telefone(page)).toHaveAttribute('autocomplete', 'tel-national');
      await expect(telefone(page)).toHaveValue(TELEFONE);
      await expect(page.getByLabel('Senha atual', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
      await expect(page.getByLabel('Nova senha', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
      // O usuário do gerenciador de senhas: oculto, junto das senhas, com o e-mail da sessão.
      const usuario = page.locator('input[autocomplete="username"]');
      await expect(usuario).toHaveCount(1);
      await expect(usuario).toHaveValue(TREINADOR.email);
      await expect(usuario).toBeHidden();
      expect(errosDaPagina).toEqual([]);
    });

    test('perfil que não é administrador fala com o administrador da consultoria', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, {}, { id: 'p-assist', nome: 'Assistente', acessoTotal: false });
      await expect(page.getByText('Para mudar o e-mail de entrada, fale com o administrador da consultoria.')).toBeVisible();
      await expect(page.getByText(/suporte do Overtraining/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Fale com o suporte/ })).toHaveCount(0);
      await expect(page.getByText('Perfil: Assistente', { exact: true })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('"Fale com o suporte do Overtraining" abre o e-mail fixo do suporte, com o assunto fixo e nada da pessoa', async ({ page }) => {
      test.skip(!CONTATO_DO_SUPORTE, 'Sem contato do suporte (recuo de 30/11): o botão não existe.');
      // O clique no `mailto:` é registrado e não sai da página (o navegador sem interface não tem programa de e-mail).
      await page.addInitScript(() => {
        const w = window as unknown as { mailtos: string[] };
        w.mailtos = [];
        const clicar = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
          if (this.href.startsWith('mailto:')) w.mailtos.push(this.href);
          else clicar.call(this);
        };
      });
      const { errosDaPagina } = await abrir(page, largura);
      await page.getByRole('button', { name: /^Fale com o suporte do Overtraining/ }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { mailtos: string[] }).mailtos))
        .toEqual([`mailto:${CONTATO_DO_SUPORTE}?subject=Suporte%20Overtraining`]);
      await expect(page.getByRole('heading', { level: 1, name: 'Meus dados' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('telefone recusa e-mail; "Salvar seus dados" só com alteração e avisa ao salvar', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, largura);
      await expect(salvar(page)).toBeDisabled();
      if (largura < 768) await expect(page.getByText('Nenhuma alteração para salvar.')).toBeVisible();
      else {
        await salvar(page).hover();
        await expect(page.getByTestId('dica-do-botao')).toHaveText('Nenhuma alteração para salvar.');
      }

      // O que o Chrome fazia: o e-mail no Telefone. Fica o número de antes e o erro no campo.
      await telefone(page).fill(TREINADOR.email);
      await expect(telefone(page)).toHaveValue(TELEFONE);
      await expect(page.getByText(NAO_E_TELEFONE)).toBeVisible();
      await expect(telefone(page)).toHaveAttribute('aria-invalid', 'true');

      await telefone(page).fill('45988887777');
      await expect(telefone(page)).toHaveValue('(45) 98888-7777');
      await expect(page.getByText(NAO_E_TELEFONE)).toHaveCount(0);
      await expect(salvar(page)).toBeEnabled();
      await salvar(page).click();
      await expect(page.getByText('Seus dados foram salvos.')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/eu')?.corpo).toEqual({ nome: TREINADOR.nome, telefone: '(45) 98888-7777' });
      await expect(salvar(page)).toBeDisabled();

      // Telefone incompleto: erro ao sair do campo e o botão não envia.
      await telefone(page).fill('4598');
      await page.getByRole('textbox', { name: 'Seu nome' }).focus();
      await expect(page.getByText('Telefone inválido. Informe o DDD e o número.')).toBeVisible();
      await expect(salvar(page)).toBeDisabled();
      expect(errosDaPagina).toEqual([]);
    });

    test('"Trocar senha" só com as duas senhas e a nova de 8+, com a força embaixo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, largura);
      await expect(trocar(page)).toBeDisabled();
      await page.getByLabel('Senha atual', { exact: true }).fill('senha-atual-1');
      await page.getByLabel('Nova senha', { exact: true }).fill('curta');
      await expect(page.getByText('Força da senha: curta. Use pelo menos 8 caracteres.')).toBeVisible();
      await expect(trocar(page)).toBeDisabled();
      await page.getByLabel('Nova senha', { exact: true }).fill('abcdefgh');
      await expect(page.getByText(/^Força da senha: fraca\./)).toBeVisible();
      await page.getByLabel('Nova senha', { exact: true }).fill(TREINADOR.email);
      await expect(page.getByText('A senha não pode ser igual ao e-mail.')).toBeVisible();
      await expect(trocar(page)).toBeDisabled();
      await page.getByLabel('Nova senha', { exact: true }).fill('Abcdefgh123!');
      await expect(page.getByText('Força da senha: forte.')).toBeVisible();
      await expect(trocar(page)).toBeEnabled();
      await trocar(page).click();
      await expect(page.getByText('Senha alterada. As outras sessões foram encerradas.')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/eu/senha')?.corpo).toEqual({ senhaAtual: 'senha-atual-1', senhaNova: 'Abcdefgh123!' });
      await expect(page.getByLabel('Senha atual', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Nova senha', { exact: true })).toHaveValue('');
      // Nada da senha fica no aparelho.
      const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
      expect(guardado).not.toContain('Abcdefgh123!');
      expect(errosDaPagina).toEqual([]);
    });

    test('erros da API ficam no cartão de cada ação', async ({ page }) => {
      await abrir(page, largura, {
        'PUT /eu': erroApi(400, 'Telefone inválido.'),
        'PUT /eu/senha': erroApi(400, 'Senha atual incorreta.'),
      });
      await page.getByRole('textbox', { name: 'Seu nome' }).fill('Treinadora Fictícia');
      await salvar(page).click();
      await expect(page.getByText('Telefone inválido.', { exact: true })).toBeVisible();
      await page.getByLabel('Senha atual', { exact: true }).fill('errada-123');
      await page.getByLabel('Nova senha', { exact: true }).fill('Abcdefgh123!');
      await trocar(page).click();
      await expect(page.getByText('Senha atual incorreta.')).toBeVisible();
      await expect(page.getByLabel('Nova senha', { exact: true })).toHaveValue('Abcdefgh123!');
    });
  });
}

test('1280: área menor que 1144 px, os cartões empilham à esquerda, cada um até 560 px', async ({ page }) => {
  await abrir(page, 1280);
  // 1280 com o menu lateral aberto: área menor que 1144 px, então os cartões empilham, cada um até 560.
  const seus = await page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: 'Seus dados' }) }).boundingBox();
  const senha = await page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: 'Trocar senha' }) }).boundingBox();
  expect(seus && senha).toBeTruthy();
  expect(seus!.width).toBeLessThanOrEqual(561);
  expect(senha!.width).toBeLessThanOrEqual(561);
  expect(Math.abs(seus!.x - senha!.x)).toBeLessThanOrEqual(1);
  expect(senha!.y).toBeGreaterThan(seus!.y + seus!.height);
});
