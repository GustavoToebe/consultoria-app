import { expect, test, type Page } from '@playwright/test';

import type { ConfiguracaoInscricao, InscricaoPublica, PlanoDaPagina } from '../src/api/inscricoesTipos';
import type { ConteudoQuestionario } from '../src/api/tipos';
import { erroApi, json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { CODIGO, contagensFalsas, detalheFalso, paginaPublica, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Sugestão de planos na página pública e o layout novo (27/11): os cartões dos planos ativos na Ficha rápida (uma parte
 * só) e na inscrição completa (parte 2), o preço só com a opção do link ligada, "Outro / ainda não sei" com o texto (na
 * completa, o campo próprio `planoOutroTexto`, obrigatório com "Outro"), o
 * interruptor da opção nas folhas do link e o plano escolhido na equipe (Kanban, folha e proposta). Só dados fictícios.
 */

const FICHA: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [{ titulo: 'Plano combinado', perguntas: [{ id: 'plano_combinado', tipo: 'TEXTO', rotulo: 'Qual plano combinou?', obrigatoria: false }] }],
};
const PERGUNTAS_DA_FICHA = { versaoId: 'v-ficha-1', conteudo: FICHA };
const MENSAL: PlanoDaPagina = { id: 'b0000000-0000-4000-8000-0000000000a1', nome: 'Consultoria mensal', periodicidade: 'MENSAL', valorCentavos: null };
const TRIMESTRAL: PlanoDaPagina = { id: 'b0000000-0000-4000-8000-0000000000a2', nome: 'Consultoria trimestral', periodicidade: 'TRIMESTRAL', valorCentavos: null };
const ANUAL: PlanoDaPagina = { id: 'b0000000-0000-4000-8000-0000000000a3', nome: 'Plano anual completo', periodicidade: 'ANUAL', valorCentavos: null };
const TRES = [MENSAL, TRIMESTRAL, ANUAL];
const PRECOS: Record<string, number> = { [MENSAL.id]: 39700, [TRIMESTRAL.id]: 99700, [ANUAL.id]: 358800 };
const comPreco = (planos: PlanoDaPagina[]) => planos.map((p) => ({ ...p, valorCentavos: PRECOS[p.id] }));

/** Perguntas próprias do treinador no link completo: duas seções, uma com descrição formatada. */
const DO_TREINADOR: ConteudoQuestionario = {
  formato: 2, instrucoes: [],
  secoes: [
    { uid: 's1', titulo: 'Sua rotina', descricao: 'Conte **como é** a sua semana hoje.', perguntas: [
      { id: 'treina', tipo: 'SIM_NAO', rotulo: 'Já treina?', obrigatoria: false },
      { id: 'dias', tipo: 'TEXTO', rotulo: 'Quantos dias por semana você consegue treinar?', obrigatoria: false },
    ] },
    { uid: 's2', titulo: 'Saúde e cuidados', perguntas: [
      { id: 'lesao', tipo: 'TEXTO_LONGO', rotulo: 'Tem alguma lesão ou dor que a equipe precisa saber?', obrigatoria: false },
    ] },
  ],
};
/** O erro de "Outro" sem texto na página completa (`ERRO_DO_OUTRO_VAZIO`; o domínio puxa o Expo, que o Playwright não carrega). */
const ERRO_DO_OUTRO_VAZIO = 'Escreva qual plano combinou ou escolha um da lista.';
const PERGUNTAS_DO_TREINADOR = { versaoId: 'v-treinador-1', conteudo: DO_TREINADOR };

/** Ficha rápida: só o e-mail entre os fixos e a pergunta do plano. */
const fichaRapida = (extra: Partial<InscricaoPublica> = {}) =>
  paginaPublica({ campos: ['EMAIL'], perguntas: PERGUNTAS_DA_FICHA, ...extra });

/** Marca com redes (a página pública traz `consultoria.redes`, uma chave por rede, link https ou nulo). */
const COM_REDES = {
  ...paginaPublica().consultoria,
  redes: { instagram: 'https://instagram.com/equipe.teste', tiktok: null, youtube: 'https://youtube.com/@equipeteste', x: null, site: 'https://exemplo.test',
    facebook: null, linkedin: null, telegram: null },
};

const envios = (pedidos: { metodo: string; caminho: string; corpo?: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/publico/inscricoes/${CODIGO}`);

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

async function abrir(page: Page, largura: number, corpo: InscricaoPublica, extra: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo },
    [`POST /publico/inscricoes/${CODIGO}`]: { status: 202, corpo: { mensagem: 'Recebemos sua inscrição. A equipe vai falar com você.' } },
    ...extra,
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await expect(page.getByRole('heading', { name: 'Quero ser aluno', level: 1 })).toBeVisible();
  return api;
}

async function preencherContato(page: Page) {
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  // O contato fica guardado na guia: nas capturas em sequência o WhatsApp já vem preenchido.
  await page.getByLabel('WhatsApp com DDD').fill('');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
}

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test('Ficha rápida com três planos: uma parte só, sem preço, e o plano escolhido vai sem o texto de "Outro"', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, fichaRapida({ planos: TRES }));
      // Uma parte só: sem a barrinha de passos, contato e plano na mesma página, com o envio.
      await expect(page.getByRole('list', { name: /Parte 1 de/ })).toHaveCount(0);
      const grupo = page.getByRole('radiogroup', { name: 'Qual plano combinou?' });
      await expect(grupo).toBeVisible();
      await expect(grupo.getByRole('radio')).toHaveCount(4);
      await expect(grupo.getByRole('radio', { name: 'Consultoria trimestral. Trimestral · a cada 3 meses' })).toBeVisible();
      await expect(grupo.getByRole('radio', { name: 'Outro / ainda não sei' })).toBeVisible();
      // Preço desligado: nenhum valor na página.
      await expect(page.getByText(/R\$/)).toHaveCount(0);
      await expect(grupo.getByRole('radio', { checked: true })).toHaveCount(0);
      // Cartões com 44 px de altura mínima.
      for (const caixa of await grupo.getByRole('radio').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
        expect(caixa).toBeGreaterThanOrEqual(44);
      }

      await preencherContato(page);
      // "Outro" abre o campo; depois a pessoa troca para um plano e o texto não vai.
      await grupo.getByRole('radio', { name: 'Outro / ainda não sei' }).click();
      await page.getByLabel('Qual plano? (opcional)').fill('Plano que um amigo faz');
      await grupo.getByRole('radio', { name: /Consultoria trimestral/ }).click();
      await expect(grupo.getByRole('radio', { name: /Consultoria trimestral/ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByLabel('Qual plano? (opcional)')).toHaveCount(0);
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      expect(envios(pedidos)[0].corpo).toMatchObject({ planoComercialId: TRIMESTRAL.id, questionarioVersaoId: 'v-ficha-1', respostas: {} });
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Ficha rápida com um plano: já vem marcado; "Outro" manda o texto e nenhum plano', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, fichaRapida({ planos: [MENSAL], consultoria: COM_REDES }));
      // As redes da consultoria (só as preenchidas), no painel no PC e depois do envio no celular.
      await expect(page.getByRole('button', { name: 'Abrir Instagram de Equipe Teste' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Abrir TikTok/ })).toHaveCount(0);
      const grupo = page.getByRole('radiogroup', { name: 'Qual plano combinou?' });
      await expect(grupo.getByRole('radio', { name: /Consultoria mensal/ })).toHaveAttribute('aria-checked', 'true');
      await preencherContato(page);
      await grupo.getByRole('radio', { name: 'Outro / ainda não sei' }).click();
      await page.getByLabel('Qual plano? (opcional)').fill('Ainda vou decidir');
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      const corpo = envios(pedidos)[0].corpo as Record<string, unknown>;
      expect(corpo.respostas).toEqual({ plano_combinado: 'Ainda vou decidir' });
      expect('planoComercialId' in corpo).toBe(false);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Ficha rápida sem planos: fica o campo de texto de antes', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, fichaRapida());
      await expect(page.getByRole('radiogroup')).toHaveCount(0);
      await preencherContato(page);
      await page.getByLabel('Qual plano combinou? (opcional)').fill('O de três meses');
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      expect(envios(pedidos)[0].corpo).toMatchObject({ respostas: { plano_combinado: 'O de três meses' } });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('preço ligado mostra "R$ ... por período"; o plano que saiu volta com erro e a lista recarrega', async ({ page }) => {
      let leituras = 0;
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, fichaRapida(), {
        [`GET /publico/inscricoes/${CODIGO}`]: (_p, route) => {
          leituras += 1;
          // Depois do 422 o trimestral sumiu (arquivado enquanto a pessoa preenchia).
          return json(route, fichaRapida({ planos: comPreco(leituras === 1 ? TRES : [MENSAL, ANUAL]), mostrarPrecoDosPlanos: true }));
        },
        [`POST /publico/inscricoes/${CODIGO}`]: erroApi(422, 'Confira os campos.', 'INSCRICAO_INVALIDA',
          [{ field: 'planoComercialId', message: 'Escolha um dos planos disponíveis.' }]),
      });
      const grupo = page.getByRole('radiogroup', { name: 'Qual plano combinou?' });
      await expect(grupo.getByText('R$ 997,00 por trimestre')).toBeVisible();
      await expect(grupo.getByText('R$ 397,00 por mês')).toBeVisible();
      await expect(grupo.getByText('R$ 3.588,00 por ano')).toBeVisible();
      await preencherContato(page);
      await grupo.getByRole('radio', { name: /Consultoria trimestral/ }).click();
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByText('Escolha um dos planos disponíveis.')).toBeVisible();
      await expect.poll(() => leituras).toBe(2);
      await expect(grupo.getByRole('radio', { name: /Consultoria trimestral/ })).toHaveCount(0);
      await expect(grupo.getByRole('radio', { checked: true })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('inscrição completa: os planos entram na parte 2, "Outro" abre "Qual plano?" com o foco; a barrinha marca a parte 1 com ✓', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, paginaPublica({ planos: TRES }));
      await expect(page.getByRole('radiogroup')).toHaveCount(0);
      await preencherContato(page);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
      await expect(page.getByRole('listitem', { name: 'Parte 1 de 2: Seu contato, concluída' })).toBeVisible();
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', 'Parte 2 de 2: Sobre você, atual');
      // "Voltar" é o botão pequeno ao lado do título da parte.
      await expect(page.getByRole('button', { name: 'Voltar ao contato' })).toBeVisible();
      const grupo = page.getByRole('radiogroup', { name: 'Qual plano combinou? (opcional)' });
      await grupo.getByRole('radio', { name: 'Outro / ainda não sei' }).click();
      // Campo próprio (V116), obrigatório com "Outro", logo abaixo da escolha e com o foco.
      const qualPlano = page.getByRole('textbox', { name: /^Qual plano\?/ });
      await expect(qualPlano).toBeFocused();
      await expect(page.getByLabel('Qual plano? (opcional)')).toHaveCount(0);
      // Teclado: as setas movem a escolha (radiogroup da APG) e o foco fica no cartão.
      await grupo.getByRole('radio', { name: 'Outro / ainda não sei' }).press('ArrowDown');
      await expect(grupo.getByRole('radio', { name: /Consultoria mensal/ })).toHaveAttribute('aria-checked', 'true');
      await expect(grupo.getByRole('radio', { name: /Consultoria mensal/ })).toBeFocused();
      await expect(qualPlano).toHaveCount(0);
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      expect(envios(pedidos)[0].corpo).toMatchObject({ planoComercialId: MENSAL.id, respostas: null });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('inscrição completa: "Outro" sem texto bloqueia o envio; com texto vai em planoOutroTexto, sem plano', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, paginaPublica({ planos: TRES }));
      await preencherContato(page);
      await page.getByRole('button', { name: 'Continuar' }).click();
      const grupo = page.getByRole('radiogroup', { name: 'Qual plano combinou? (opcional)' });
      await grupo.getByRole('radio', { name: 'Outro / ainda não sei' }).click();
      const qualPlano = page.getByRole('textbox', { name: /^Qual plano\?/ });
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      // Sem texto: o erro no campo, o foco nele e nada enviado.
      await expect(page.getByText(ERRO_DO_OUTRO_VAZIO)).toBeVisible();
      await expect(qualPlano).toBeFocused();
      expect(envios(pedidos)).toHaveLength(0);
      await qualPlano.fill('  Plano de um amigo  ');
      await expect(page.getByText(ERRO_DO_OUTRO_VAZIO)).toHaveCount(0);
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      const corpo = envios(pedidos)[0].corpo as Record<string, unknown>;
      expect(corpo.planoOutroTexto).toBe('Plano de um amigo');
      expect('planoComercialId' in corpo).toBe(false);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('inscrição completa com perguntas do treinador: cada seção com subtítulo e divisória, sem cartão dentro do cartão', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, paginaPublica({ planos: [MENSAL], perguntas: PERGUNTAS_DO_TREINADOR }));
      await preencherContato(page);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
      // As seções do treinador são subtítulos (h3) do cartão do formulário, como "Perguntas rápidas" e "Plano".
      for (const titulo of ['Sua rotina', 'Saúde e cuidados', 'Perguntas rápidas', 'Plano']) {
        await expect(page.getByRole('heading', { name: titulo, level: 3 })).toBeVisible();
      }
      await expect(page.getByText('como é', { exact: true })).toBeVisible();
      // Nenhum cartão aninhado: entre a pergunta do treinador e o cartão do formulário não há outra caixa com borda.
      const bordasAcima = await page.getByLabel('Quantos dias por semana você consegue treinar?').evaluate((campo) => {
        let n = 0;
        for (let no = campo.parentElement; no; no = no.parentElement) {
          const s = getComputedStyle(no);
          if (parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderLeftWidth) > 0 && parseFloat(s.borderRadius) > 0) n += 1;
        }
        return n;
      });
      // Só o cartão do formulário (com a seção num `Cartao` próprio seriam 2).
      expect(bordasAcima).toBe(1);
      // Um plano só: já vem marcado.
      await expect(page.getByRole('radio', { name: /Consultoria mensal/ })).toHaveAttribute('aria-checked', 'true');
      await page.getByLabel('Quantos dias por semana você consegue treinar?').fill('Três');
      await page.getByRole('button', { name: 'Enviar inscrição' }).click();
      await expect(page.getByRole('heading', { name: 'Inscrição enviada', level: 1 })).toBeVisible();
      expect(envios(pedidos)[0].corpo).toMatchObject({ planoComercialId: MENSAL.id, questionarioVersaoId: 'v-treinador-1', respostas: { dias: 'Três' } });
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('equipe: o interruptor do preço nas duas folhas do link; o plano escolhido no Kanban, na folha e na proposta', async ({ page }) => {
      const comPlano = resumoFalso(1, { nome: 'Pessoa Com Plano', planoComercialId: TRIMESTRAL.id, planoComercialNome: TRIMESTRAL.nome });
      const comOutro = resumoFalso(2, { nome: 'Pessoa Com Outro', planoComercialId: null, planoComercialNome: null, planoOutroTexto: 'Plano de um amigo' });
      const FICHA_ID = 'q0000000-0000-4000-8000-0000000000f3';
      let configFicha: ConfiguracaoInscricao = {
        aberta: true, codigo: 'ficha-rapida-teste-12345678', link: 'https://consultoria.exemplo.test/inscricao/ficha-rapida-teste-12345678',
        responsavelId: null, texto: null, camposOcultos: ['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE', 'PREVISAO_INICIO', 'ORIGEM'], versao: 0,
        mostrarPrecoDosPlanos: false,
      };
      await page.setViewportSize({ width: largura, height: 900 });
      const rotas = rotasDaTela();
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR)),
        ...rotas,
        'GET /inscricoes/links': {
          corpo: [...((rotas['GET /inscricoes/links'] as { corpo: unknown[] }).corpo), {
            id: FICHA_ID, nome: 'Ficha rápida', padrao: false, aberta: true, codigo: configFicha.codigo, link: configFicha.link,
            responsavelId: null, proximoQuestionarioId: null, texto: null, camposOcultos: configFicha.camposOcultos, versao: 0,
          }],
        },
        'PUT /inscricoes/configuracao': (p, route) => json(route, { ...(p.corpo as object), codigo: CODIGO, link: 'x', camposOcultos: [], versao: 3 }),
        [`GET /questionarios/${FICHA_ID}/link`]: (_p, route) => json(route, configFicha),
        [`PUT /questionarios/${FICHA_ID}/link`]: (p, route) => {
          configFicha = { ...configFicha, ...(p.corpo as object), versao: configFicha.versao + 1 };
          return json(route, configFicha);
        },
        'GET /questionarios/opcoes': { corpo: [] },
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 2 }) },
        'GET /inscricoes': (p, route) => json(route, !p.busca.get('situacao') || p.busca.get('situacao') === 'NOVA' || p.busca.get('situacao') === 'ABERTAS'
          ? { itens: [comPlano, comOutro], total: 2 } : { itens: [], total: 0 }),
        [`GET /inscricoes/${comPlano.id}`]: { corpo: detalheFalso(comPlano) },
        [`GET /inscricoes/${comOutro.id}`]: { corpo: detalheFalso(comOutro) },
        'GET /inscricoes/planos-de-referencia': { corpo: [{ ...MENSAL, valorCentavos: 39700 }, { ...TRIMESTRAL, valorCentavos: 99700 }] },
      });
      await page.goto('/treinador/interessados?visao=kanban');
      await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
      // Kanban: sem proposta, o cartão mostra o plano que a pessoa escolheu.
      await expect(page.getByText(`Plano: ${TRIMESTRAL.nome}`)).toBeVisible();
      // "Outro" com texto (V116): o texto que a pessoa escreveu.
      await expect(page.getByText('Plano: Outro: Plano de um amigo')).toBeVisible();

      // Folha do link padrão: o interruptor entra no PUT.
      await page.getByRole('button', { name: 'Configurar', exact: true }).click();
      const folha = page.getByRole('dialog', { name: 'Configurar o link de inscrição' });
      await folha.getByRole('switch', { name: 'Mostrar o preço dos planos na página de inscrição' }).click();
      await folha.getByRole('button', { name: 'Salvar configuração' }).click();
      await expect.poll(() => pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/inscricoes/configuracao')?.corpo)
        .toMatchObject({ mostrarPrecoDosPlanos: true });

      // Folha da Ficha rápida: o mesmo interruptor, com o nome do link.
      await page.getByRole('button', { name: 'Configurar Ficha rápida' }).click();
      const folhaFicha = page.getByRole('dialog', { name: 'Configurar Ficha rápida' });
      await folhaFicha.getByRole('switch', { name: 'Mostrar o preço dos planos na ficha rápida' }).click();
      await folhaFicha.getByRole('button', { name: 'Salvar configuração' }).click();
      await expect(page.getByText('Ficha rápida salvo.')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/questionarios/${FICHA_ID}/link`)?.corpo).toMatchObject({ mostrarPrecoDosPlanos: true });

      // Folha da inscrição: o plano escolhido e a proposta já abre nele.
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Com Plano' }).click();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      await expect(page.getByText(TRIMESTRAL.nome).first()).toBeVisible();
      await page.getByRole('button', { name: 'Registrar proposta' }).click();
      await expect(page.getByText('R$ 997,00').first()).toBeVisible();
      await semRolagemLateral(page);
      // A folha de quem escolheu "Outro" mostra o texto como o plano escolhido na página.
      await page.goto('/treinador/interessados?visao=kanban');
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Com Outro' }).click();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      await expect(page.getByText('Outro: Plano de um amigo').first()).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

/**
 * Capturas para conferir à mão (só com `E2E_CAPTURAS`): as duas páginas em 390, 1280 e 1920, claro e escuro, com três
 * planos, um plano, sem planos e com o preço ligado (a completa na parte 2), com perguntas do treinador e o erro de link.
 */
const CENARIOS: { nome: string; corpo: InscricaoPublica; parte2?: boolean }[] = [
  { nome: 'completa-parte1', corpo: paginaPublica({ planos: TRES, consultoria: COM_REDES, texto: 'Usamos seus dados só para falar com você.', textoVersao: 'v1' }) },
  { nome: 'completa-parte2', corpo: paginaPublica({ planos: TRES, consultoria: COM_REDES, texto: 'Usamos seus dados só para falar com você.', textoVersao: 'v1' }), parte2: true },
  { nome: 'completa-1-plano', corpo: paginaPublica({ planos: [MENSAL] }), parte2: true },
  { nome: 'completa-sem-planos', corpo: paginaPublica(), parte2: true },
  { nome: 'completa-preco-ligado', corpo: paginaPublica({ planos: comPreco(TRES), mostrarPrecoDosPlanos: true, consultoria: COM_REDES }), parte2: true },
  { nome: 'completa-perguntas-do-treinador', corpo: paginaPublica({ planos: TRES, perguntas: PERGUNTAS_DO_TREINADOR }), parte2: true },
  { nome: 'ficha-3-planos', corpo: fichaRapida({ planos: TRES }) },
  { nome: 'ficha-1-plano', corpo: fichaRapida({ planos: [MENSAL] }) },
  { nome: 'ficha-sem-planos', corpo: fichaRapida() },
  { nome: 'ficha-preco-ligado', corpo: fichaRapida({ planos: comPreco(TRES), mostrarPrecoDosPlanos: true, consultoria: COM_REDES }) },
];
/** A página rola dentro da `Tela` (não no documento): a janela cresce até a altura do conteúdo para a captura sair inteira. */
async function capturarInteira(page: Page, largura: number, nome: string) {
  const altura = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('*'), (e) => e.scrollHeight)));
  await page.setViewportSize({ width: largura, height: Math.min(Math.max(altura, 900), 4000) });
  await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/${nome}.png` });
  await page.setViewportSize({ width: largura, height: 900 });
}

test.describe('capturas', () => {
  test.skip(!process.env.E2E_CAPTURAS, 'só com E2E_CAPTURAS');
  for (const tema of ['light', 'dark'] as const) {
    for (const largura of [390, 1280, 1920]) {
      test(`páginas públicas de inscrição (${largura}px, ${tema})`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.emulateMedia({ colorScheme: tema });
        for (const c of CENARIOS) {
          await abrir(page, largura, c.corpo);
          if (c.parte2) {
            await preencherContato(page);
            await page.getByRole('button', { name: 'Continuar' }).click();
            await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
          }
          await capturarInteira(page, largura, `${c.nome}-${largura}-${tema === 'light' ? 'claro' : 'escuro'}`);
        }
        await page.setViewportSize({ width: largura, height: 900 });
        await simularApi(page, { [`GET /publico/inscricoes/${CODIGO}`]: erroApi(404, 'Link de inscrição não encontrado.', 'NAO_ENCONTRADO') });
        await page.goto(`/inscricao/${CODIGO}`);
        await expect(page.getByText('Link de inscrição não encontrado.')).toBeVisible();
        await capturarInteira(page, largura, `erro-link-${largura}-${tema === 'light' ? 'claro' : 'escuro'}`);
      });
    }
  }
});
