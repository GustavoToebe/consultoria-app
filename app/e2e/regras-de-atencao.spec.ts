import { expect, test, type Page } from '@playwright/test';

import type { RegrasDeAtencaoResposta, SalvarRegrasDeAtencao } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { REGRA_CAIU, REGRA_DESCONHECIDA, resposta } from './regras-de-atencao-falsas';

/**
 * Configurações › Regras de atenção (frente 2A de `docs/planos/regras-de-atencao.md`) e o interruptor "Avisos no celular"
 * em Aparência e preferências (C7). API simulada, só dados fictícios. Capturas em `E2E_CAPTURAS` quando a variável existe.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const LER = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'];
const ALTERAR = [...LER, 'REGRA_ATENCAO_ALTERAR'];

interface Opcoes {
  largura: number;
  chave?: boolean;
  permissoes?: string[];
  tema?: 'CLARO' | 'ESCURO';
  rotas?: RespostasApi;
  dados?: RegrasDeAtencaoResposta;
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.E2E_CAPTURAS;
  if (!pasta) return;
  // A rolagem é da `Tela`: a janela cresce para caber tudo (a faixa depende só da largura).
  const janela = page.viewportSize()!;
  await page.setViewportSize({ width: janela.width, height: 2000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
  await page.setViewportSize(janela);
}

async function abrir(page: Page, o: Opcoes, caminho = '/treinador/regras-de-atencao') {
  await page.setViewportSize({ width: o.largura, height: 900 });
  if (o.tema) await page.addInitScript(([id, tema]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema })), [TREINADOR.id, o.tema] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? ALTERAR, regrasAtencaoHabilitada: o.chave ?? true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /regras-de-atencao': { corpo: o.dados ?? resposta() },
    ...o.rotas,
  });
  await page.goto(caminho);
  return api;
}

const titulo = (page: Page) => page.getByRole('heading', { level: 1, name: 'Regras de atenção' });
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar regras' });
const doLote = (pedidos: { metodo: string; caminho: string; corpo: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/regras-de-atencao').map((p) => p.corpo as SalvarRegrasDeAtencao);

async function escolherPergunta(page: Page, nome: string) {
  await page.getByRole('button', { name: 'Pergunta: —. Escolher.' }).click();
  await page.getByRole('option', { name: new RegExp(`^${nome}`) }).click();
}

const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test.describe(`Regras de atenção em ${largura} px`, () => {
    test('chave desligada: diz que não está ativa e não chama a API', async ({ page }) => {
      const api = await abrir(page, { largura, chave: false });
      await expect(titulo(page)).toBeVisible();
      await expect(page.getByText('Regras de atenção não estão ativas', { exact: true })).toBeVisible();
      expect(api.pedidos.filter((p) => p.caminho.startsWith('/regras-de-atencao'))).toEqual([]);
    });

    test('ligar, validar no app, adicionar e remover pergunta e salvar o lote (com a regra desconhecida intacta)', async ({ page }) => {
      const api = await abrir(page, {
        largura,
        rotas: {
          'PUT /regras-de-atencao': (p, r) => {
            const c = p.corpo as SalvarRegrasDeAtencao;
            return json(r, resposta({ versao: c.versao + 1, regras: c.regras.map((x, i) => ({ ...x, id: x.id ?? `n0000000-0000-4000-8000-00000000000${i}` })) as RegrasDeAtencaoResposta['regras'] }));
          },
        },
      });
      await expect(titulo(page)).toBeVisible();
      await expect(page.getByText('1 de 6 ligada')).toBeVisible();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      // ⓘ do cabeçalho com a explicação da tela (sem "Saiba mais": não há seção da Ajuda para ela ainda).
      await expect(page.getByRole('button', { name: 'Sobre esta tela' })).toBeVisible();

      await page.getByRole('switch', { name: 'Nota até um número' }).click();
      await expect(page.getByText('2 de 6 ligadas')).toBeVisible();
      await expect(page.getByText('Alterações não salvas')).toBeVisible();
      // Nada sugerido: o número nasce vazio e salvar sem ele não chama a API.
      await expect(page.getByLabel('Nota igual ou menor que')).toHaveValue('');
      await salvar(page).click();
      await expect(page.getByText('Escolha a pergunta.')).toBeVisible();
      await expect(page.getByText('Digite o número da regra.')).toBeVisible();
      await expect(page.getByText('Confira os campos marcados.')).toBeVisible();
      await expect(page.getByLabel('Nota igual ou menor que')).toBeFocused();
      expect(doLote(api.pedidos)).toEqual([]);

      await escolherPergunta(page, 'Energia nos treinos');
      await page.getByLabel('Nota igual ou menor que').fill('7');
      await expect(page.getByText('Use um número de 1 a 5, a escala desta pergunta.')).toBeVisible();
      await page.getByLabel('Nota igual ou menor que').fill('2');
      // Sem erro, a ajuda do campo mostra a escala da pergunta escolhida (o erro a substitui enquanto existe).
      await expect(page.getByText('Escala desta pergunta: 1 a 5.')).toBeVisible();

      // Outra pergunta do mesmo modelo: a linha nova não oferece a que já tem regra; remover a tira do rascunho.
      await page.getByRole('button', { name: 'Adicionar outra pergunta: Nota até um número' }).click();
      await page.getByRole('button', { name: 'Pergunta: —. Escolher.' }).click();
      await expect(page.getByRole('option', { name: /^Energia nos treinos/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Remover a regra de Nota até um número' }).click();
      await expect(page.getByRole('button', { name: /^Remover a regra/ })).toHaveCount(0);

      await page.getByRole('switch', { name: 'Peso mudou' }).click();
      const peso = page.getByLabel('Mudou pelo menos (kg)');
      await peso.fill('1,55');
      await peso.blur();
      await expect(page.getByText('Use no máximo 1 casa decimal.')).toBeVisible();
      await peso.fill('1,5');
      await capturar(page, `regras-edicao-${largura}`);

      await salvar(page).click();
      await expect(page.getByText('Regras de atenção salvas.')).toBeVisible();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      expect(doLote(api.pedidos)).toEqual([{
        versao: 3,
        regras: [
          { id: REGRA_CAIU.id, tipo: 'NOTA_CAIU', perguntaId: null, limite: 2, ativa: true },
          { tipo: 'NOTA_ABAIXO', perguntaId: 'energia', limite: 2, ativa: true },
          { tipo: 'PESO_MUDOU', perguntaId: null, limite: 1.5, ativa: true },
          { id: REGRA_DESCONHECIDA.id, tipo: 'TIPO_FUTURO', perguntaId: null, limite: 7, ativa: true },
        ],
      }]);
      await semRolagemHorizontal(page);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('desligar guarda o número; 409 recarrega e avisa', async ({ page }) => {
      let leituras = 0;
      const api = await abrir(page, {
        largura,
        rotas: {
          'GET /regras-de-atencao': (_p, r) => { leituras += 1; return json(r, resposta({ versao: 3 + leituras })); },
          'PUT /regras-de-atencao': erroApi(409, 'Conflito.', 'CONFLITO_EDICAO'),
        },
      });
      await page.getByRole('switch', { name: 'Nota que caiu' }).click();
      await expect(page.getByText('Nenhuma regra ligada')).toBeVisible();
      await salvar(page).click();
      await expect(page.getByText('As regras de atenção foram alteradas por outra pessoa. Carregamos a versão atual; confira e salve de novo.')).toBeVisible();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      await expect(page.getByText('1 de 6 ligada')).toBeVisible();
      expect(leituras).toBe(2);
      expect(doLote(api.pedidos)[0].regras[0]).toEqual({ id: REGRA_CAIU.id, tipo: 'NOTA_CAIU', perguntaId: null, limite: 2, ativa: false });
    });

    test('422: a mensagem da API vai para a linha certa e some ao corrigir', async ({ page }) => {
      await abrir(page, {
        largura,
        rotas: { 'PUT /regras-de-atencao': erroApi(422, 'Regra inválida.', 'REGRA_INVALIDA', [{ field: 'regras[0].limite', message: 'Mensagem fixa da API para o número.' }]) },
      });
      const numero = page.getByLabel('Caiu pelo menos (pontos)');
      await numero.fill('3');
      await salvar(page).click();
      await expect(page.getByText('Mensagem fixa da API para o número.')).toBeVisible();
      await expect(page.getByText('Confira os campos marcados.')).toBeVisible();
      await capturar(page, `regras-422-${largura}`);
      await numero.fill('4');
      await expect(page.getByText('Mensagem fixa da API para o número.')).toHaveCount(0);
    });

    test('teto, pergunta fora dos questionários e modelo sem pergunta do tipo', async ({ page }) => {
      await abrir(page, {
        largura,
        dados: resposta({
          teto: 3,
          regras: [
            REGRA_CAIU,
            { id: 'r0000000-0000-4000-8000-000000000002', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 4, ativa: true },
            { id: 'r0000000-0000-4000-8000-000000000003', tipo: 'SIM', perguntaId: 'pergunta-apagada', limite: null, ativa: true },
          ],
        }),
      });
      await expect(page.getByText('3 de 6 ligadas')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Adicionar outra pergunta: Nota até um número' })).toBeDisabled();
      await expect(page.getByText('Limite de 3 regras de atenção.').first()).toBeVisible();
      await expect(page.getByText('Pergunta fora dos questionários', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('A regra fica gravada, mas não vale até a pergunta voltar. Escolha outra pergunta se quiser.')).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Item marcado' })).toBeDisabled();
      await expect(page.getByText('Nenhum questionário de atualização publicado tem pergunta de itens do plano.')).toBeVisible();
      await capturar(page, `regras-teto-${largura}`);
    });

    test('só leitura sem REGRA_ATENCAO_ALTERAR', async ({ page }) => {
      await abrir(page, { largura, permissoes: LER });
      await expect(page.getByText('Ligada: nota caiu 2 pontos ou mais')).toBeVisible();
      await expect(page.getByText('Para mudar as regras, peça a quem administra a consultoria.')).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expect(salvar(page)).toHaveCount(0);
      await capturar(page, `regras-leitura-${largura}`);
    });

    test('erro na carga com "Tentar de novo"; 403 diz que falta acesso', async ({ page }) => {
      let leituras = 0;
      await abrir(page, {
        largura,
        rotas: { 'GET /regras-de-atencao': (_p, r) => (++leituras === 1 ? json(r, { status: 500, message: 'Falha.' }, 500) : json(r, resposta())) },
      });
      await expect(page.getByText(/Não foi possível carregar as regras de atenção\./)).toBeVisible();
      await capturar(page, `regras-erro-${largura}`);
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByText('1 de 6 ligada')).toBeVisible();
    });

    test('403 na carga', async ({ page }) => {
      await abrir(page, { largura, rotas: { 'GET /regras-de-atencao': erroApi(403, 'Sem permissão.', 'PERMISSAO_NEGADA') } });
      await expect(page.getByText('Sem acesso às regras de atenção')).toBeVisible();
    });

    test('guarda de saída com alteração não salva', async ({ page }) => {
      await abrir(page, { largura });
      await page.getByRole('switch', { name: 'Poucos dias com treino' }).click();
      await page.getByLabel('Dias com treino igual ou menor que').fill('3');
      // No PC a trilha; no celular a seta de voltar (a mesma guarda).
      if (largura >= 768) await page.getByRole('link', { name: 'Configurações' }).first().click();
      else await page.getByRole('button', { name: 'Voltar' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Sair sem salvar?' })).toBeVisible();
    });
  });
}

// ---------------------------------------------------------------- capturas nos dois temas

for (const largura of [390, 1920]) for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`capturas ${largura} px ${tema.toLowerCase()}`, async ({ page }) => {
    await abrir(page, {
      largura, tema,
      dados: resposta({ regras: [REGRA_CAIU, { id: 'r0000000-0000-4000-8000-000000000002', tipo: 'NOTA_ABAIXO', perguntaId: 'sono', limite: 4, ativa: true }] }),
    });
    await expect(page.getByText('2 de 6 ligadas')).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar outra pergunta: Nota até um número' }).click();
    await semRolagemHorizontal(page);
    await capturar(page, `regras-${largura}-${tema.toLowerCase()}`);
  });
}

// ---------------------------------------------------------------- Aparência e preferências › Avisos no celular

const ROTULO_DO_PUSH = 'Avisar quando a atualização de um aluno tiver pontos de atenção';

async function abrirAjustes(page: Page, largura: number, chave: boolean, rotas: RespostasApi = {}, permissoes = ALTERAR) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, regrasAtencaoHabilitada: chave })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /eu/preferencias-de-push': { corpo: { atencao: true } },
    ...rotas,
  });
  await page.goto('/treinador/ajustes');
  await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
  return api;
}

for (const largura of [390, 1280]) {
  test.describe(`Avisos no celular em ${largura} px`, () => {
    test('chave desligada: não aparece e não consulta', async ({ page }) => {
      const api = await abrirAjustes(page, largura, false);
      await expect(page.getByRole('heading', { name: 'Navegador', level: 2 })).toBeVisible();
      await expect(page.getByRole('switch', { name: ROTULO_DO_PUSH })).toHaveCount(0);
      expect(api.pedidos.filter((p) => p.caminho === '/eu/preferencias-de-push')).toEqual([]);
    });

    test('liga e desliga na hora; recusa da API volta e avisa', async ({ page }) => {
      let falhar = false;
      const api = await abrirAjustes(page, largura, true, {
        'PUT /eu/preferencias-de-push': (p, r) => (falhar ? json(r, { status: 500, message: 'Falha.' }, 500) : json(r, p.corpo)),
      });
      const interruptor = page.getByRole('switch', { name: ROTULO_DO_PUSH });
      await expect(interruptor).toBeChecked();
      await expect(page.getByText('Chega pelo app no celular, só com o primeiro nome do aluno. Vale para a sua conta, em todos os aparelhos.')).toBeVisible();
      await interruptor.click();
      await expect(interruptor).not.toBeChecked();
      expect(api.pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/eu/preferencias-de-push').map((p) => p.corpo)).toEqual([{ atencao: false }]);
      falhar = true;
      await interruptor.click();
      await expect(page.getByText('Não foi possível mudar o aviso. Tente de novo.')).toBeVisible();
      await expect(interruptor).not.toBeChecked();
      await capturar(page, `push-${largura}`);
    });
  });
}

test('Avisos no celular: sem ALUNO_SENSIVEL_LER não aparece', async ({ page }) => {
  const api = await abrirAjustes(page, 1280, true, {}, ALTERAR.filter((p) => p !== 'ALUNO_SENSIVEL_LER'));
  await expect(page.getByRole('heading', { name: 'Navegador', level: 2 })).toBeVisible();
  await expect(page.getByRole('switch', { name: ROTULO_DO_PUSH })).toHaveCount(0);
  expect(api.pedidos.filter((p) => p.caminho === '/eu/preferencias-de-push')).toEqual([]);
});
