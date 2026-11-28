import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import type { ConquistaDoAluno, PreferenciasDoPerfil } from '../src/api/comunidadeTipos';
import { AJUDA_DO_NOME, NOTA_SEM_APELIDO, TEXTO_LIMITE_DO_PERFIL } from '../src/dominio/perfilDaComunidade';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * "Meu perfil" da Comunidade na Conta do aluno (conta do aluno reorganizada (23/11): o detalhe `aluno/conta/DetalheMeuPerfil`,
 * que abre pela linha "Meu perfil", com a barra de salvar no rodapé) e o aviso único no topo da Comunidade, com a API
 * simulada no formato real de `GET`/`PUT /aluno/comunidade/perfil` (o PUT substitui as cinco preferências e devolve o que
 * ficou). Só dados fictícios.
 */
const AVISO = 'Seus colegas podem ver seu perfil; você pode reservá-lo.';
const conquista = (tipo: string, titulo: string): ConquistaDoAluno => ({
  id: `c-${tipo}`, tipo, titulo, descricao: `Conquista fictícia: ${titulo.toLowerCase()}.`, icone: 'award', conquistadaEm: '2026-11-01T12:00:00-03:00',
});
const CONQUISTAS = [
  conquista('PRIMEIRO_TREINO', 'Primeiro treino'), conquista('DEZ_TREINOS', 'Dez treinos'), conquista('SEMANA_COMPLETA', 'Semana completa'),
  conquista('NOVO_RECORDE_CARGA', 'Novo recorde'), conquista('MES_CONSTANTE', 'Mês constante'),
];
const SEM_ESCOLHA: PreferenciasDoPerfil = {
  perfilReservado: null, reservadoEfetivo: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', opcoesDeDestaque: CONQUISTAS, exibicaoDoNome: 'NOME',
};

/** Servidor falso: guarda o perfil; `falha` responde o próximo PUT com o erro dado (uma vez). */
function rotasDoPerfil(estado: { atual: PreferenciasDoPerfil; falha?: { status: number; corpo: unknown } }): RespostasApi {
  return {
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/comunidade/perfil': (_p: PedidoFalso, route: Route) => json(route, estado.atual),
    'PUT /aluno/comunidade/perfil': (p: PedidoFalso, route: Route) => {
      if (estado.falha) {
        const { status, corpo } = estado.falha;
        estado.falha = undefined;
        return json(route, corpo, status);
      }
      const c = p.corpo as Pick<PreferenciasDoPerfil, 'perfilReservado' | 'destaques' | 'cor' | 'moldura' | 'exibicaoDoNome'>;
      estado.atual = { ...estado.atual, ...c, reservadoEfetivo: c.perfilReservado ?? estado.atual.reservadoEfetivo };
      return json(route, estado.atual);
    },
  };
}

const CAPTURAS = process.env.CAPTURAS_DIR;
const TEMAS = [['claro', 'CLARO', 'PADRAO'], ['escuro', 'ESCURO', 'PADRAO'], ['areia', 'AREIA', 'PADRAO'], ['contraste', 'CLARO', 'ALTO']] as const;

async function tema(page: Page, t: string, contraste = 'PADRAO') {
  await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [ALUNO.id, t, contraste]);
}

async function abrirConta(page: Page, estado: { atual: PreferenciasDoPerfil; falha?: { status: number; corpo: unknown } }, extras: RespostasApi = {}) {
  const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...rotasDoPerfil(estado), ...extras });
  await page.goto('/aluno/conta');
  // Conta do aluno reorganizada (23/11): o perfil abre em folha pela linha "Perfil na comunidade" do cartão do Perfil (28/11).
  await page.getByRole('button', { name: /^Perfil na comunidade/ }).click();
  const cartao = page.getByRole('dialog', { name: 'Meu perfil' });
  await expect(cartao.getByRole('switch', { name: 'Reservar meu perfil' })).toBeVisible();
  return { api, cartao };
}

/** O cartão inteiro: a tela rola por dentro (ScrollView), então a janela cresce antes da foto e volta depois. */
async function capturarCartao(page: Page, cartao: Locator, nome: string) {
  if (!CAPTURAS) return;
  const antes = page.viewportSize();
  await page.setViewportSize({ width: antes?.width ?? 390, height: 4000 });
  await cartao.screenshot({ path: `${CAPTURAS}/${nome}.png` });
  if (antes) await page.setViewportSize(antes);
}

const puts = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/comunidade/perfil').map((p) => p.corpo);

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('aviso único no cartão: "Entendi" grava a escolha e some; reservar e desreservar reenviam o resto', async ({ page }) => {
      const estado = { atual: { ...SEM_ESCOLHA, destaques: ['DEZ_TREINOS'], cor: 'ROXO', moldura: 'DUPLA' } };
      const { api, cartao } = await abrirConta(page, estado);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(cartao.getByText(AVISO)).toBeVisible();
      await expect(cartao.getByRole('switch', { name: 'Reservar meu perfil' })).not.toBeChecked();

      await cartao.getByRole('button', { name: 'Entendi, manter visível' }).click();
      await expect(cartao.getByText(AVISO)).toHaveCount(0);
      expect(puts(api.pedidos)).toEqual([{ perfilReservado: false, destaques: ['DEZ_TREINOS'], cor: 'ROXO', moldura: 'DUPLA', exibicaoDoNome: 'NOME' }]);

      await cartao.getByRole('switch', { name: 'Reservar meu perfil' }).click();
      await expect(cartao.getByText('Os colegas veem só o seu nome.')).toBeVisible();
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(page.getByText('Perfil salvo.')).toBeVisible();
      await cartao.getByRole('switch', { name: 'Reservar meu perfil' }).click();
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => puts(api.pedidos).length).toBe(3);
      expect(puts(api.pedidos).slice(1)).toEqual([
        { perfilReservado: true, destaques: ['DEZ_TREINOS'], cor: 'ROXO', moldura: 'DUPLA', exibicaoDoNome: 'NOME' },
        { perfilReservado: false, destaques: ['DEZ_TREINOS'], cor: 'ROXO', moldura: 'DUPLA', exibicaoDoNome: 'NOME' },
      ]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('reservado pelo padrão da idade: explica, sem aviso, e trocar só a cor mantém perfilReservado nulo', async ({ page }) => {
      const estado = { atual: { ...SEM_ESCOLHA, reservadoEfetivo: true } };
      const { api, cartao } = await abrirConta(page, estado);
      await expect(cartao.getByRole('switch', { name: 'Reservar meu perfil' })).toBeChecked();
      await expect(cartao.getByText(/Seu perfil começa reservado/)).toBeVisible();
      await expect(cartao.getByText(AVISO)).toHaveCount(0);
      await cartao.getByRole('radio', { name: 'Verde' }).click();
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => puts(api.pedidos)).toEqual([{ perfilReservado: null, destaques: [], cor: 'VERDE', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' }]);
    });

    test('até 4 destaques, o 5º recusado sem PUT; cor e moldura com nome e prévia', async ({ page }) => {
      const estado = { atual: { ...SEM_ESCOLHA, perfilReservado: false } };
      const { api, cartao } = await abrirConta(page, estado);
      await expect(cartao.getByText('0 de 4', { exact: true })).toBeVisible();
      for (const nome of ['Semana completa', 'Primeiro treino', 'Novo recorde', 'Dez treinos']) await cartao.getByRole('checkbox', { name: nome }).click();
      await cartao.getByRole('checkbox', { name: 'Mês constante' }).click();
      await expect(cartao.getByRole('checkbox', { name: 'Mês constante' })).not.toBeChecked();
      await expect(cartao.getByText('4 de 4. Você já escolheu 4: desmarque um para trocar.')).toBeVisible();
      expect(puts(api.pedidos)).toEqual([]);

      await cartao.getByRole('radio', { name: 'Rosa' }).click();
      await cartao.getByRole('radio', { name: /^Tracejada/ }).click();
      await expect(cartao.getByRole('radio', { name: 'Rosa' })).toBeChecked();
      // A prévia mostra os destaques na ordem marcada.
      await expect(cartao.getByText('Semana completa', { exact: true }).first()).toBeVisible();
      await capturarCartao(page, cartao, `meu-perfil-escolhas-${largura}`);
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => puts(api.pedidos)).toEqual([{
        perfilReservado: false, destaques: ['SEMANA_COMPLETA', 'PRIMEIRO_TREINO', 'NOVO_RECORDE_CARGA', 'DEZ_TREINOS'], cor: 'ROSA', moldura: 'TRACEJADA', exibicaoDoNome: 'NOME',
      }]);
      // Salvo: a barra diz "Tudo salvo" e não mostra botão.
      await expect(cartao.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);
      await expect(cartao.getByText('Tudo salvo')).toBeVisible();
    });

    test('sem conquistas: estado vazio', async ({ page }) => {
      const { cartao } = await abrirConta(page, { atual: { ...SEM_ESCOLHA, perfilReservado: false, opcoesDeDestaque: [] } });
      await expect(cartao.getByText(/Você ainda não tem conquistas/)).toBeVisible();
      await expect(cartao.getByText('Sem destaques escolhidos.')).toBeVisible();
    });

    test('422 aparece no grupo; 429 vira texto amigável; as escolhas ficam', async ({ page }) => {
      const estado: { atual: PreferenciasDoPerfil; falha?: { status: number; corpo: unknown } } = { atual: { ...SEM_ESCOLHA, perfilReservado: false } };
      const { cartao } = await abrirConta(page, estado);
      await cartao.getByRole('checkbox', { name: 'Dez treinos' }).click();
      const e422 = erroApi(422, 'Confira o perfil.', 'PERFIL_INVALIDO', [{ field: 'destaques', message: 'Só dá para destacar uma conquista que você já ganhou.' }]);
      estado.falha = { status: e422.status, corpo: e422.corpo };
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(cartao.getByText('Só dá para destacar uma conquista que você já ganhou.')).toBeVisible();
      await capturarCartao(page, cartao, `meu-perfil-422-${largura}`);

      const e429 = erroApi(429, 'Muitas tentativas. Tente de novo mais tarde.', 'LOGIN_LIMITADO');
      estado.falha = { status: e429.status, corpo: e429.corpo };
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(page.getByText(TEXTO_LIMITE_DO_PERFIL)).toBeVisible();
      await expect(cartao.getByRole('checkbox', { name: 'Dez treinos' })).toBeChecked();
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/meu-perfil-429-${largura}.png` });
      await capturarCartao(page, cartao, `meu-perfil-erros-${largura}`);
    });

    test('sem internet: o cartão fica com as escolhas e o salvar espera a rede, com o motivo', async ({ page }) => {
      const { api, cartao } = await abrirConta(page, { atual: { ...SEM_ESCOLHA, perfilReservado: false } });
      await cartao.getByRole('radio', { name: 'Laranja' }).click();
      await page.context().setOffline(true);
      await expect(cartao.getByText('Sem conexão. Suas escolhas continuam aqui; salve quando a internet voltar.')).toBeVisible();
      await expect(cartao.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled();
      await expect(cartao.getByText('Sem conexão.', { exact: true })).toBeVisible();
      await expect(cartao.getByRole('radio', { name: 'Laranja' })).toBeChecked();
      await capturarCartao(page, cartao, `meu-perfil-offline-${largura}`);
      await page.context().setOffline(false);
      // O Chromium emulado não avisa o NetInfo (que ouve `navigator.connection`) quando a rede volta; o navegador de verdade avisa.
      await page.evaluate(() => (navigator as Navigator & { connection?: EventTarget }).connection?.dispatchEvent(new Event('change')));
      await expect(cartao.getByRole('button', { name: 'Salvar perfil' })).toBeEnabled();
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => puts(api.pedidos)).toEqual([{ perfilReservado: false, destaques: [], cor: 'LARANJA', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' }]);
    });

    test('Comunidade: aviso no topo, atalho leva ao interruptor na Conta e "Entendi" some', async ({ page }) => {
      const estado = { atual: { ...SEM_ESCOLHA } };
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...rotasDoPerfil(estado),
        'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
        'GET /aluno/comunidade/mural': { corpo: { content: [], totalElements: 0 } },
        'GET /aluno/comunidade/aulas': { corpo: [] },
        'GET /aluno/comunidade/conquistas': { corpo: [] },
        'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 0, pontuacao: 0, participantes: 1, nivel: 1, xp: 0, xpNoNivel: 0, faltam: 100 } },
      });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText(AVISO)).toBeVisible();
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/comunidade-aviso-perfil-${largura}.png` });
      await page.getByRole('button', { name: 'Reservar meu perfil' }).click();
      await expect(page).toHaveURL(/\/aluno\/conta/);
      await expect(page.getByRole('dialog', { name: 'Meu perfil' }).getByRole('switch', { name: 'Reservar meu perfil' })).toBeInViewport();

      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Entendi, manter visível' }).click();
      await expect(page.getByText(AVISO)).toHaveCount(0);
      expect(puts(api.pedidos)).toEqual([{ perfilReservado: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME' }]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('nome para os colegas: prévia de cada opção, escolher, salvar com o corpo completo e o 422 no grupo', async ({ page }) => {
      const estado: { atual: PreferenciasDoPerfil; falha?: { status: number; corpo: unknown } } = { atual: { ...SEM_ESCOLHA, perfilReservado: false } };
      const { api, cartao } = await abrirConta(page, estado, {
        'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste da Silva', apelido: 'Testinho' } },
      });
      const grupo = cartao.getByRole('radiogroup', { name: 'Como seu nome aparece para os colegas' });
      await expect(cartao.getByText(AJUDA_DO_NOME)).toBeVisible();
      await expect(grupo.getByRole('radio', { name: 'Primeiro nome. Aluno', exact: true })).toBeChecked();
      await expect(grupo.getByRole('radio', { name: 'Nome completo. Aluno Teste da Silva' })).toBeVisible();
      await expect(grupo.getByRole('radio', { name: 'Apelido. Testinho', exact: true })).toBeVisible();
      await expect(grupo.getByRole('radio', { name: 'Nome e apelido. Aluno (Testinho)' })).toBeVisible();
      await expect(cartao.getByText(NOTA_SEM_APELIDO)).toHaveCount(0);
      await expect(cartao.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);

      await grupo.getByRole('radio', { name: /^Nome e apelido/ }).click();
      await expect(grupo.getByRole('radio', { name: /^Nome e apelido/ })).toBeChecked();
      // A prévia do topo passa a mostrar o nome do jeito escolhido.
      await expect(cartao.getByText('Aluno (Testinho)', { exact: true }).first()).toBeVisible();
      await capturarCartao(page, cartao, `meu-perfil-nome-${largura}`);

      const e422 = erroApi(422, 'Confira o perfil.', 'PERFIL_INVALIDO', [{ field: 'exibicaoDoNome', message: 'Escolha uma das opções de nome.' }]);
      estado.falha = { status: e422.status, corpo: e422.corpo };
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(cartao.getByText('Escolha uma das opções de nome.')).toBeVisible();
      await expect(grupo.getByRole('radio', { name: /^Nome e apelido/ })).toBeChecked();
      await capturarCartao(page, cartao, `meu-perfil-nome-422-${largura}`);

      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(page.getByText('Perfil salvo.')).toBeVisible();
      expect(puts(api.pedidos)).toEqual([
        { perfilReservado: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME_E_APELIDO' },
        { perfilReservado: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME_E_APELIDO' },
      ]);
      // Depois de salvo, trocar só a cor mantém a escolha (o PUT substitui tudo).
      await cartao.getByRole('radio', { name: 'Roxo' }).click();
      await cartao.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => puts(api.pedidos).length).toBe(3);
      expect(puts(api.pedidos)[2]).toEqual({ perfilReservado: false, destaques: [], cor: 'ROXO', moldura: 'SIMPLES', exibicaoDoNome: 'NOME_E_APELIDO' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('nome para os colegas sem apelido: as opções com apelido mostram o primeiro nome e a nota explica', async ({ page }) => {
      const { cartao } = await abrirConta(page, { atual: { ...SEM_ESCOLHA, perfilReservado: false, exibicaoDoNome: 'APELIDO' } });
      const grupo = cartao.getByRole('radiogroup', { name: 'Como seu nome aparece para os colegas' });
      await expect(grupo.getByRole('radio', { name: 'Apelido. Aluno', exact: true })).toBeChecked();
      await expect(grupo.getByRole('radio', { name: 'Nome e apelido. Aluno' })).toBeVisible();
      await expect(cartao.getByText(NOTA_SEM_APELIDO)).toBeVisible();
      await capturarCartao(page, cartao, `meu-perfil-nome-sem-apelido-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`tema ${nome}: cartão com aviso, destaques, cor e moldura`, async ({ page }) => {
        await tema(page, t, contraste);
        const { cartao } = await abrirConta(page, { atual: { ...SEM_ESCOLHA, destaques: ['PRIMEIRO_TREINO', 'NOVO_RECORDE_CARGA'], cor: 'VERDE', moldura: 'GROSSA' } });
        await expect(cartao.getByText(AVISO)).toBeVisible();
        await capturarCartao(page, cartao, `meu-perfil-${nome}-${largura}`);
        // A amostra laranja (token próprio do perfil) escolhida: anel e prévia da moldura na cor.
        await cartao.getByRole('radio', { name: 'Laranja' }).click();
        await expect(cartao.getByRole('radio', { name: 'Laranja' })).toBeChecked();
        await capturarCartao(page, cartao, `meu-perfil-laranja-${nome}-${largura}`);
      });
    }
  });
}
