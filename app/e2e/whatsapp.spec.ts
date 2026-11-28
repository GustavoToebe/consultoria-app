import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROTULOS_TIPO_AVISO } from '../src/dominio/whatsapp';
import type { AvisosWhatsAppDoAluno, ConexaoWhatsApp, ModeloWhatsApp, TipoDeAvisoWhatsApp } from '../src/servicos/whatsapp';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * WhatsApp oficial da Meta (passo B9 de `docs/planos/contato-da-consultoria.md`): a tela `/treinador/whatsapp` (conexão,
 * modelos por tipo, recurso desligado, erro, permissão `WHATSAPP_ALTERAR`) e o opt-in do aluno na Conta
 * (`aluno/InterruptorDeWhatsApp`). O token de acesso nunca volta à tela: o GET não o traz e, depois de salvar, ele não
 * fica em lugar nenhum do DOM. Tema escuro em 390 e 1280. Só dados fictícios. Capturas em `E2E_CAPTURAS`, se definida;
 * senão na pasta de resultados do teste.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const TOKEN = 'EAAGtokenFicticioNaoExibir0123456789';
const COM_PERMISSAO = { permissoes: [...PERMISSOES_TREINADOR, 'WHATSAPP_ALTERAR'], whatsappHabilitado: true };

const CONECTADA: ConexaoWhatsApp = {
  habilitado: true, configurada: true, phoneNumberId: '100000000000001', wabaId: '200000000000002',
  // 13:45 UTC = 10:45 em Brasília (o `timezoneId` dos testes).
  tokenGravadoEm: '2026-11-20T13:45:00Z', versao: 3,
};
const NAO_CONECTADA: ConexaoWhatsApp = { habilitado: true, configurada: false, phoneNumberId: null, wabaId: null, tokenGravadoEm: null, versao: null };

const TIPOS: TipoDeAvisoWhatsApp[] = ['ANTES', 'NO_DIA', 'DEPOIS', 'COMPROMISSO_NOVO', 'COMPROMISSO_REMARCADO', 'COMPROMISSO_CANCELADO'];

function modelo(tipo: TipoDeAvisoWhatsApp, configurado: Partial<ModeloWhatsApp> | null): ModeloWhatsApp {
  return {
    tipo, configurado: !!configurado, nome: null, idioma: null, situacao: null, versao: null,
    textoSugerido: `Aviso fictício ${tipo}: olá {{1}}, confira {{2}}.`,
    variaveis: ['nome do aluno', `dado ${tipo.toLowerCase()}`],
    ...configurado,
  };
}

/** Os seis tipos, com as situações que a Meta devolve: aprovado, em análise, recusado, não encontrado e dois sem modelo. */
const MODELOS: ModeloWhatsApp[] = [
  modelo('ANTES', { nome: 'lembrete_antes', idioma: 'pt_BR', situacao: 'APPROVED', versao: 1 }),
  modelo('NO_DIA', { nome: 'lembrete_no_dia', idioma: 'pt_BR', situacao: 'PENDING', versao: 2 }),
  modelo('DEPOIS', { nome: 'lembrete_depois', idioma: 'en_US', situacao: 'REJECTED', versao: 1 }),
  modelo('COMPROMISSO_NOVO', { nome: 'compromisso_novo', idioma: 'pt_BR', situacao: 'NAO_ENCONTRADO', versao: 1 }),
  modelo('COMPROMISSO_REMARCADO', null),
  modelo('COMPROMISSO_CANCELADO', null),
];
const SELOS: Record<TipoDeAvisoWhatsApp, string> = {
  ANTES: 'Aprovado', NO_DIA: 'Em análise', DEPOIS: 'Recusado na Meta', COMPROMISSO_NOVO: 'Não encontrado na Meta',
  COMPROMISSO_REMARCADO: 'Não configurado', COMPROMISSO_CANCELADO: 'Não configurado',
};
/** A API sempre devolve os seis tipos; "sem modelos" é os seis sem configuração. */
const SEM_MODELOS: ModeloWhatsApp[] = TIPOS.map((t) => modelo(t, null));

function captura(nome: string): string {
  const arquivo = `whatsapp-${nome}.png`;
  return process.env.E2E_CAPTURAS ? `${process.env.E2E_CAPTURAS}/${arquivo}` : test.info().outputPath(arquivo);
}

async function temaEscuro(page: Page, usuarioId: string) {
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), usuarioId);
}

/** O DOM inteiro (texto, atributos e o valor dos campos) não tem o token. */
async function semTokenNoDom(page: Page) {
  const achou = await page.evaluate((t) => document.documentElement.outerHTML.includes(t)
    || [...document.querySelectorAll('input, textarea')].some((c) => (c as HTMLInputElement).value.includes(t)), TOKEN);
  expect(achou).toBe(false);
}

const AJUDA_DO_INTERRUPTOR = 'Lembretes de cobrança e avisos de compromisso enviados pelo WhatsApp da consultoria.';

/** Rola cada caixa rolável acima do elemento até o fim (a folha da Conta rola por dentro). */
async function rolarAteOFim(alvo: Locator) {
  await alvo.evaluate((no) => {
    for (let p = no.parentElement; p; p = p.parentElement) {
      const estilo = getComputedStyle(p);
      if (p.scrollHeight > p.clientHeight + 1 && /(auto|scroll)/.test(estilo.overflowY)) p.scrollTop = p.scrollHeight;
    }
  });
}

/** Nenhuma das caixas cruza a do aviso; a falha diz quantos px de altura se cruzam. */
async function semSobreposicao(aviso: Locator, alvos: Locator[], quando: string) {
  const a = await aviso.boundingBox();
  expect(a, 'caixa do aviso').not.toBeNull();
  for (const alvo of alvos) {
    const b = await alvo.boundingBox();
    expect(b, `caixa de ${alvo}`).not.toBeNull();
    const largura = Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
    const altura = Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
    const cruza = largura > 0 && altura > 0 ? Math.round(altura) : 0;
    console.log(`[medida ${quando}] aviso y=${Math.round(a!.y)}..${Math.round(a!.y + a!.height)} × ${alvo}: y=${Math.round(b!.y)}..${Math.round(b!.y + b!.height)}, cruza ${cruza} px`);
    expect(cruza, `o aviso cobre ${alvo} (${quando})`).toBe(0);
  }
}

const doWhatsApp = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.caminho.startsWith('/whatsapp'));
const pedido = (pedidos: PedidoFalso[], metodo: string, caminho: string) => pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho);

async function abrirTela(page: Page, largura: number, rotas: RespostasApi, extra: object = COM_PERMISSAO) {
  await page.setViewportSize({ width: largura, height: 900 });
  await temaEscuro(page, TREINADOR.id);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, extra)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...rotas,
  });
  await page.goto('/treinador/whatsapp');
  await expect(page.getByRole('heading', { name: /^(WhatsApp oficial|Sem acesso a esta tela)$/ }).first()).toBeVisible();
  return api;
}

const campoDoToken = (page: Page, configurada: boolean) =>
  page.getByLabel(configurada ? 'Novo token de acesso (opcional)' : 'Token de acesso da Meta', { exact: true });
const botao = (escopo: Page | Locator, nome: string) => escopo.getByRole('button', { name: nome, exact: true });

/** Nenhum campo da conexão na tela (a busca do menu também é campo de texto: por isso não conta todos). */
async function semCamposDaConexao(page: Page) {
  await expect(page.getByRole('textbox', { name: 'Phone Number ID', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'WABA ID (Conta do WhatsApp Business)', exact: true })).toHaveCount(0);
  await expect(campoDoToken(page, true)).toHaveCount(0);
  await expect(campoDoToken(page, false)).toHaveCount(0);
}

for (const largura of [390, 1280]) {
  test.describe(`WhatsApp oficial (${largura}, escuro)`, () => {
    test('conectada: só "salvo em", o PUT leva o token digitado e ele some da tela depois de salvar', async ({ page }) => {
      let conexao = CONECTADA;
      const { pedidos, errosDaPagina } = await abrirTela(page, largura, {
        'GET /whatsapp/conexao': (_p, route) => json(route, conexao),
        'GET /whatsapp/modelos': { corpo: { modelos: MODELOS } },
        'PUT /whatsapp/conexao': (_p, route) => {
          conexao = { ...CONECTADA, tokenGravadoEm: '2026-11-26T15:00:00Z', versao: conexao.versao! + 1 };
          return json(route, conexao);
        },
        'DELETE /whatsapp/conexao': { status: 204 },
      });
      await expect(page.getByText('Conectada', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Token de acesso salvo em 20\/11\/2026 10:45\. Por segurança, ele não é exibido/)).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Phone Number ID', exact: true })).toHaveValue('100000000000001');
      await expect(page.getByRole('textbox', { name: 'WABA ID (Conta do WhatsApp Business)', exact: true })).toHaveValue('200000000000002');
      const token = campoDoToken(page, true);
      // Defeito de 28/11: campo de texto que pede para não preencher (nunca type=password: o navegador punha a senha do login).
      // O react-native-web não escreve `type` sem `inputMode`/`keyboardType`; sem o atributo o `<input>` é de texto (a propriedade).
      await expect(token).toHaveJSProperty('type', 'text');
      await expect(token).toHaveAttribute('autocomplete', 'off');
      // Sem `name` (o React 19 apaga o que não vem das props): o `id` neutro cobre.
      await expect(token).toHaveAttribute('id', 'token-da-meta');
      await expect(token).toHaveAttribute('data-1p-ignore', 'true');
      await expect(token).toHaveAttribute('data-lpignore', 'true');
      await expect(token).toHaveAttribute('data-form-type', 'other');
      await expect(token).toHaveValue('');
      await expect(token).toHaveAttribute('placeholder', 'Deixe em branco para manter o atual');
      await semTokenNoDom(page);
      await page.screenshot({ path: captura(`conectada-${largura}`) });

      // Troca do token: vai no corpo do PUT e, salvo, o campo volta vazio e o token não fica no DOM.
      // Só o que vem de tecla ou colar entra no campo.
      await token.pressSequentially(TOKEN);
      await expect(token).toHaveJSProperty('type', 'text');
      await botao(page, 'Salvar conexão').click();
      await expect(page.getByText('Conexão do WhatsApp salva.')).toBeVisible();
      expect(pedido(pedidos, 'PUT', '/whatsapp/conexao')[0]?.corpo).toEqual({ phoneNumberId: '100000000000001', wabaId: '200000000000002', accessToken: TOKEN, versao: 3 });
      await expect(page.getByText(/^Token de acesso salvo em 26\/11\/2026 12:00\./)).toBeVisible();
      await expect(token).toHaveValue('');
      await semTokenNoDom(page);

      // Salvar sem mexer no token manda nulo (mantém o gravado).
      await botao(page, 'Salvar conexão').click();
      await expect.poll(() => pedido(pedidos, 'PUT', '/whatsapp/conexao').length).toBe(2);
      expect(pedido(pedidos, 'PUT', '/whatsapp/conexao')[1]?.corpo).toMatchObject({ accessToken: null, versao: 4 });

      // Desconectar pede confirmação e manda a versão lida.
      await botao(page, 'Desconectar').click();
      const painel = page.getByRole('alertdialog', { name: 'Desconectar o WhatsApp?' });
      await expect(painel).toBeVisible();
      await expect(painel.getByText('A conexão com a Meta será removida e todos os avisos pendentes serão cancelados.')).toBeVisible();
      await page.screenshot({ path: captura(`desconectar-${largura}`) });
      conexao = NAO_CONECTADA;
      await botao(painel, 'Desconectar').click();
      await expect(page.getByText('Conexão removida e avisos pendentes cancelados.')).toBeVisible();
      expect(pedido(pedidos, 'DELETE', '/whatsapp/conexao')[0]?.busca.get('versao')).toBe('5');
      await expect(page.getByText('Não conectada', { exact: true })).toBeVisible();
      await semTokenNoDom(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('não conectada e sem modelos: "Conectar WhatsApp", sem "Desconectar" e os erros dos três campos', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirTela(page, largura, {
        'GET /whatsapp/conexao': { corpo: NAO_CONECTADA },
        'GET /whatsapp/modelos': { corpo: { modelos: SEM_MODELOS } },
      });
      await expect(page.getByText('Não conectada', { exact: true })).toBeVisible();
      await expect(page.getByText(/Token de acesso salvo em/)).toHaveCount(0);
      await expect(botao(page, 'Desconectar')).toHaveCount(0);
      await expect(campoDoToken(page, false)).toHaveAttribute('placeholder', 'Cole o token permanente da Meta');
      // Os seis tipos aparecem para configurar, nenhum com "Remover".
      await expect(page.getByText('Não configurado', { exact: true })).toHaveCount(6);
      for (const tipo of TIPOS) await expect(botao(page, `Configurar modelo: ${ROTULOS_TIPO_AVISO[tipo]}`)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Remover modelo/ })).toHaveCount(0);

      await botao(page, 'Conectar WhatsApp').click();
      await expect(page.getByText('Informe o ID do número de telefone (Phone Number ID).')).toBeVisible();
      await expect(page.getByText('Informe o ID da conta comercial (WABA ID).')).toBeVisible();
      await expect(page.getByText('Informe o token de acesso da Meta para conectar.')).toBeVisible();
      await expect(campoDoToken(page, false)).toHaveAttribute('aria-invalid', 'true');
      expect(pedido(pedidos, 'PUT', '/whatsapp/conexao')).toHaveLength(0);
      await page.screenshot({ path: captura(`nao-conectada-erros-${largura}`), fullPage: true });
      expect(errosDaPagina).toEqual([]);
    });

    test('modelos: os seis tipos com nome, idioma, selo e texto sugerido; editar manda o PUT do tipo', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirTela(page, largura, {
        'GET /whatsapp/conexao': { corpo: CONECTADA },
        'GET /whatsapp/modelos': { corpo: { modelos: MODELOS } },
        'PUT /whatsapp/modelos/{tipo}': (p, route) => json(route, { ...MODELOS[1], ...(p.corpo as object), versao: 3 }),
        'DELETE /whatsapp/modelos/{tipo}': { status: 204 },
      });
      for (const m of MODELOS) {
        const rotulo = ROTULOS_TIPO_AVISO[m.tipo];
        await expect(page.getByText(rotulo, { exact: true })).toBeVisible();
        await expect(page.getByText(`Texto sugerido: ${m.textoSugerido}`, { exact: true })).toBeVisible();
        await expect(page.getByText(`Variáveis: {{1}} nome do aluno · {{2}} dado ${m.tipo.toLowerCase()}`, { exact: true })).toBeVisible();
        if (m.configurado) {
          await expect(page.getByText(`Modelo: ${m.nome} (${m.idioma})`, { exact: true })).toBeVisible();
          await expect(botao(page, `Editar modelo: ${rotulo}`)).toBeVisible();
          await expect(botao(page, `Remover modelo: ${rotulo}`)).toBeVisible();
        } else {
          await expect(botao(page, `Configurar modelo: ${rotulo}`)).toBeVisible();
        }
      }
      for (const texto of new Set(Object.values(SELOS))) {
        await expect(page.getByText(texto, { exact: true })).toHaveCount(Object.values(SELOS).filter((s) => s === texto).length);
      }
      const cartao = page.getByRole('heading', { name: 'Modelos de mensagem' });
      await cartao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: captura(`modelos-${largura}`) });

      // Editar abre a folha com o nome do tipo, os campos preenchidos e o texto sugerido; salvar manda nome, idioma e versão.
      await botao(page, `Editar modelo: ${ROTULOS_TIPO_AVISO.NO_DIA}`).click();
      const folha = page.getByRole('dialog', { name: ROTULOS_TIPO_AVISO.NO_DIA });
      await expect(folha).toBeVisible();
      await expect(folha.getByText(`Texto sugerido para cadastrar na Meta: ${MODELOS[1].textoSugerido}`)).toBeVisible();
      const nome = folha.getByRole('textbox', { name: 'Nome do modelo na Meta', exact: true });
      await expect(nome).toHaveValue('lembrete_no_dia');
      await expect(folha.getByRole('textbox', { name: 'Idioma', exact: true })).toHaveValue('pt_BR');
      await page.screenshot({ path: captura(`modelo-folha-${largura}`) });
      // Nome vazio trava no app, sem PUT.
      await nome.fill('   ');
      await botao(folha, 'Salvar modelo').click();
      await expect(folha.getByText('Informe o nome exato do modelo cadastrado na Meta.')).toBeVisible();
      expect(pedido(pedidos, 'PUT', '/whatsapp/modelos/NO_DIA')).toHaveLength(0);
      await nome.fill(' lembrete_no_dia_v2 ');
      await botao(folha, 'Salvar modelo').click();
      await expect(page.getByText('Modelo salvo.')).toBeVisible();
      await expect(folha).toBeHidden();
      expect(pedido(pedidos, 'PUT', '/whatsapp/modelos/NO_DIA')[0]?.corpo).toEqual({ nome: 'lembrete_no_dia_v2', idioma: 'pt_BR', versao: 2 });

      // Remover pede confirmação e manda a versão do modelo.
      await botao(page, `Remover modelo: ${ROTULOS_TIPO_AVISO.DEPOIS}`).click();
      const painel = page.getByRole('alertdialog', { name: 'Remover este modelo?' });
      await botao(painel, 'Remover').click();
      await expect(page.getByText('Modelo removido.')).toBeVisible();
      expect(pedido(pedidos, 'DELETE', '/whatsapp/modelos/DEPOIS')[0]?.busca.get('versao')).toBe('1');
      await semTokenNoDom(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('recurso desligado no servidor (503 WHATSAPP_INDISPONIVEL): "Recurso desativado", sem formulário nem "Tentar de novo"', async ({ page }) => {
      const desligado = erroApi(503, 'WhatsApp oficial indisponível.', 'WHATSAPP_INDISPONIVEL');
      const { errosDaPagina } = await abrirTela(page, largura, { 'GET /whatsapp/conexao': desligado, 'GET /whatsapp/modelos': desligado });
      await expect(page.getByRole('heading', { name: 'Recurso desativado' })).toBeVisible();
      await expect(page.getByText('Os avisos pelo WhatsApp oficial não estão ativos nesta instalação do app.')).toBeVisible();
      await semCamposDaConexao(page);
      await expect(botao(page, 'Tentar de novo')).toHaveCount(0);
      await page.screenshot({ path: captura(`desligado-${largura}`) });
      expect(errosDaPagina).toEqual([]);
    });

    test('erro da API (500): mensagem com "Tentar de novo", que recarrega e mostra a conexão; erro ao salvar vira aviso', async ({ page }) => {
      let falhar = true;
      const { errosDaPagina } = await abrirTela(page, largura, {
        'GET /whatsapp/conexao': (_p, route) => (falhar
          ? json(route, erroApi(500, 'Falha fictícia ao ler a conexão.').corpo, 500)
          : json(route, CONECTADA)),
        'GET /whatsapp/modelos': { corpo: { modelos: MODELOS } },
        'PUT /whatsapp/conexao': erroApi(500, 'Falha fictícia ao salvar a conexão.'),
      });
      const alerta = page.getByRole('alert').filter({ hasText: 'Falha fictícia ao ler a conexão.' });
      await expect(alerta).toBeVisible();
      await semCamposDaConexao(page);
      await page.screenshot({ path: captura(`erro-${largura}`) });
      falhar = false;
      await botao(alerta, 'Tentar de novo').click();
      await expect(page.getByText('Conectada', { exact: true })).toBeVisible();
      await expect(alerta).toHaveCount(0);

      await campoDoToken(page, true).pressSequentially(TOKEN);
      await botao(page, 'Salvar conexão').click();
      await expect(page.getByText('Falha fictícia ao salvar a conexão.')).toBeVisible();
      // Recusado, o que foi digitado fica no campo (nada se perde), sem aparecer como texto.
      await expect(campoDoToken(page, true)).toHaveValue(TOKEN);
      await expect(page.getByText(TOKEN)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem WHATSAPP_ALTERAR: o guard da rota mostra "Sem acesso a esta tela", sem campos nem botões e sem chamar a API do WhatsApp', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirTela(page, largura, {
        'GET /whatsapp/conexao': { corpo: CONECTADA },
        'GET /whatsapp/modelos': { corpo: { modelos: MODELOS } },
      }, { permissoes: PERMISSOES_TREINADOR, whatsappHabilitado: true });
      // O guard da rota (dominio/telas) barra antes de a tela montar; o "Acesso restrito" do componente é a segunda camada.
      await expect(page.getByRole('heading', { name: 'Sem acesso a esta tela', level: 1 })).toBeVisible();
      await expect(page.getByText('Seu perfil não tem permissão para abrir esta tela.')).toBeVisible();
      await semCamposDaConexao(page);
      for (const nome of ['Salvar conexão', 'Conectar WhatsApp', 'Desconectar']) await expect(botao(page, nome)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^(Editar|Configurar|Remover) modelo/ })).toHaveCount(0);
      expect(doWhatsApp(pedidos)).toHaveLength(0);
      await page.screenshot({ path: captura(`sem-permissao-${largura}`) });
      expect(errosDaPagina).toEqual([]);
    });
  });

  test.describe(`Conta do aluno: avisos pelo WhatsApp (${largura}, escuro)`, () => {
    async function abrirPreferencias(page: Page, habilitado: boolean, rotas: RespostasApi) {
      await page.setViewportSize({ width: largura, height: 900 });
      await temaEscuro(page, ALUNO.id);
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        ...(await sessao(page, ALUNO, { whatsappHabilitado: habilitado })),
        'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
        'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
        'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste', emailDeAcesso: ALUNO.email, versao: 1 } },
        'GET /aluno/indicacao': { corpo: { link: null } },
        ...rotas,
      });
      await page.goto('/aluno/conta');
      await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
      const folha = page.getByRole('dialog', { name: 'Aparência e preferências' });
      await expect(folha).toBeVisible();
      return { ...api, folha };
    }
    const interruptor = (folha: Locator) => folha.getByRole('switch', { name: 'Receber avisos pelo WhatsApp', exact: true });

    test('liga e desliga: o PUT leva a escolha, o aviso confirma e o interruptor acompanha', async ({ page }) => {
      let estado: AvisosWhatsAppDoAluno = { receber: false, disponivel: true, temTelefone: true };
      const { folha, pedidos, errosDaPagina } = await abrirPreferencias(page, true, {
        'GET /aluno/avisos-pelo-whatsapp': (_p, route) => json(route, estado),
        'PUT /aluno/avisos-pelo-whatsapp': (p, route) => {
          estado = { ...estado, receber: (p.corpo as { receber: boolean }).receber };
          return json(route, estado);
        },
      });
      await expect(folha.getByText('Avisos pelo WhatsApp', { exact: true })).toBeVisible();
      const chave = interruptor(folha);
      await expect(chave).not.toBeChecked();
      // Pior caso: a folha rolada até o fim, com o cartão (o último dela) colado no pé, onde o aviso aparece.
      await rolarAteOFim(chave);
      await page.screenshot({ path: captura(`aluno-desligado-${largura}`) });

      await chave.click();
      const aviso = page.getByRole('alert').filter({ hasText: 'Avisos pelo WhatsApp ativados.' });
      await expect(aviso).toBeVisible();
      await expect(chave).toBeChecked();
      // O aviso (fixo no pé da folha, 4 s) não cobre o interruptor nem o texto dele, logo que aparece e depois de assentar.
      const textos = [chave, folha.getByText('Receber avisos pelo WhatsApp', { exact: true }), folha.getByText(AJUDA_DO_INTERRUPTOR, { exact: true })];
      await semSobreposicao(aviso, textos, 'logo');
      await page.waitForTimeout(1000);
      await semSobreposicao(aviso, textos, 'depois de 1 s');
      await page.screenshot({ path: captura(`aluno-ligado-${largura}`) });
      await chave.click();
      await expect(page.getByText('Avisos pelo WhatsApp desativados.')).toBeVisible();
      await expect(chave).not.toBeChecked();
      expect(pedido(pedidos, 'PUT', '/aluno/avisos-pelo-whatsapp').map((p) => p.corpo)).toEqual([{ receber: true }, { receber: false }]);
      expect(errosDaPagina).toEqual([]);
    });

    test('erro ao salvar: o aviso traz a mensagem e o interruptor fica como estava', async ({ page }) => {
      const { folha, errosDaPagina } = await abrirPreferencias(page, true, {
        'GET /aluno/avisos-pelo-whatsapp': { corpo: { receber: false, disponivel: true, temTelefone: true } },
        'PUT /aluno/avisos-pelo-whatsapp': erroApi(500, 'Falha fictícia ao salvar sua escolha.'),
      });
      const chave = interruptor(folha);
      await chave.click();
      await expect(page.getByText('Falha fictícia ao salvar sua escolha.')).toBeVisible();
      await expect(chave).not.toBeChecked();
      await chave.scrollIntoViewIfNeeded();
      await page.screenshot({ path: captura(`aluno-erro-${largura}`) });
      expect(errosDaPagina).toEqual([]);
    });

    test('sem telefone: pede o telefone em Meus dados, sem interruptor', async ({ page }) => {
      const { folha, errosDaPagina } = await abrirPreferencias(page, true, {
        'GET /aluno/avisos-pelo-whatsapp': { corpo: { receber: false, disponivel: true, temTelefone: false } },
      });
      await expect(folha.getByText('Cadastre seu telefone em Meus dados para ativar os avisos pelo WhatsApp.')).toBeVisible();
      await expect(interruptor(folha)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('com whatsappHabilitado desligado o cartão não aparece e a API nem é consultada', async ({ page }) => {
      // Chave desligada: nem pergunta à API.
      const desligada = await abrirPreferencias(page, false, { 'GET /aluno/avisos-pelo-whatsapp': { corpo: { receber: true, disponivel: true, temTelefone: true } } });
      await expect(desligada.folha.getByRole('heading', { name: 'Navegador', level: 2, exact: true })).toBeVisible();
      await expect(desligada.folha.getByText('Avisos pelo WhatsApp', { exact: true })).toHaveCount(0);
      expect(desligada.pedidos.filter((p) => p.caminho === '/aluno/avisos-pelo-whatsapp')).toHaveLength(0);
      expect(desligada.errosDaPagina).toEqual([]);
    });

    test('consultoria sem número conectado ou leitura com erro: o cartão não aparece', async ({ page }) => {
      let resposta: RespostasApi[string] = { corpo: { receber: false, disponivel: false, temTelefone: true } };
      const { folha, pedidos, errosDaPagina } = await abrirPreferencias(page, true, {
        'GET /aluno/avisos-pelo-whatsapp': (p, route) => (typeof resposta === 'function' ? resposta(p, route) : json(route, resposta.corpo, resposta.status)),
      });
      await expect.poll(() => pedido(pedidos, 'GET', '/aluno/avisos-pelo-whatsapp').length).toBeGreaterThan(0);
      await expect(folha.getByRole('heading', { name: 'Navegador', level: 2, exact: true })).toBeVisible();
      await expect(folha.getByText('Avisos pelo WhatsApp', { exact: true })).toHaveCount(0);

      // Leitura recusada (500): o cartão também some (sem aviso; ver relatório).
      resposta = erroApi(500, 'Falha fictícia.');
      await page.reload();
      await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
      await expect(folha.getByRole('heading', { name: 'Navegador', level: 2, exact: true })).toBeVisible();
      await expect.poll(() => pedido(pedidos, 'GET', '/aluno/avisos-pelo-whatsapp').length).toBeGreaterThan(1);
      await expect(folha.getByText('Avisos pelo WhatsApp', { exact: true })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
