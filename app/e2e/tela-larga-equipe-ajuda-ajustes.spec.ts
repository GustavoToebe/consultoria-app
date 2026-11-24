// tela larga: revisão (24/11)
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import type { EventoAuditoria, MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import type { ConsultoriaResponse, ConsumoDoPlano, MinhaConta, TagDaConsultoria } from '../src/api/tipos';
import { CATALOGO_DE_EXEMPLO } from '../src/dominio/catalogoDePermissoes.exemplo';
import type { ModeloWhatsApp } from '../src/servicos/whatsapp';
import { fixarHoje } from './aluno';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Tela larga: revisão (24/11) do grupo Equipe, Ajuda e Ajustes (plano `docs/planos/tela-larga-revisao-equipe-ajuda-ajustes.md`).
 * Confere por geometria, em 1920, 2560 e 3440 px com o menu aberto, que o espaço extra vira colunas e nada estica além do
 * limite (4.10 de `docs/design-e-front.md`). Capturas só com `CAPTURAS_TELA_LARGA_GRUPO` (pasta fora do git) e `FASE`
 * (`antes` ou `depois`). Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const PERMISSOES = [
  ...PERMISSOES_TREINADOR, 'MARCA_ALTERAR', 'CONTA_LER', 'EQUIPE_LER', 'USUARIO_ALTERAR', 'PERFIL_ALTERAR', 'AUDITORIA_LER',
  'MODELO_LER', 'FINANCEIRO_LER', 'AGENDA_LER', 'BIBLIOTECA_LER', 'ATUALIZACAO_LER', 'WHATSAPP_ALTERAR',
];

const PERFIS: PerfilEquipe[] = [
  { id: 'p-adm', nome: 'Administrador', descricao: null, acessoTotal: true, sistema: true, ativo: true, permissoes: [], usuarios: 2, versao: 1 },
  { id: 'p-tre', nome: 'Treinador', descricao: 'Monta treinos e acompanha os alunos.', acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER', 'ALUNO_LER', 'TREINO_LER', 'TREINO_ALTERAR'], usuarios: 5, versao: 1 },
  { id: 'p-nut', nome: 'Nutricionista', descricao: 'Monta dietas.', acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER', 'ALUNO_LER', 'DIETA_LER', 'DIETA_ALTERAR'], usuarios: 3, versao: 1 },
  { id: 'p-ass', nome: 'Assistente', descricao: 'Atende os interessados.', acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER', 'INSCRICAO_LER'], usuarios: 2, versao: 1 },
  { id: 'p-est', nome: 'Estagiário', descricao: 'Perfil de exemplo, só leitura.', acessoTotal: false, sistema: false, ativo: true, permissoes: ['PAINEL_VER', 'ALUNO_LER'], usuarios: 1, versao: 3 },
  { id: 'p-ant', nome: 'Avaliador antigo', descricao: null, acessoTotal: false, sistema: false, ativo: false, permissoes: ['ALUNO_LER'], usuarios: 0, versao: 2 },
];

const NOMES = ['Ana Fictícia', 'Bruno Exemplo', 'Carla Teste', 'Diego Modelo', 'Eva Amostra', 'Fábio Fictício', 'Gina Exemplo', 'Hugo Teste', 'Iris Modelo', 'João Amostra', 'Kátia Fictícia', 'Lucas Exemplo'];
const membro = (i: number): MembroEquipe => {
  const perfil = PERFIS[[0, 1, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3][i]];
  return {
    id: `m-${i}`, nome: NOMES[i], email: `membro${i}@exemplo.test`, perfilId: perfil.id, perfilNome: perfil.nome,
    ativo: i !== 7, convitePendente: i === 10, conviteExpiraEm: i === 10 ? '2026-10-24T12:00:00Z' : null,
    ultimoAcesso: i === 10 ? null : `2026-10-${String(18 - (i % 9)).padStart(2, '0')}T1${i % 10}:00:00Z`, limiteDeAlunos: i % 3 === 0 ? 40 : null,
  };
};
const MEMBROS = NOMES.map((_, i) => membro(i));

const ACOES = ['ALUNO_CRIADO', 'TREINO_PUBLICADO', 'DIETA_PUBLICADA', 'LOGIN_SUCESSO', 'MARCA_ALTERADA'];
const evento = (i: number): EventoAuditoria => ({
  id: `e-${i}`, usuarioId: `m-${i % 5}`, nomeUsuario: NOMES[i % 5], acao: ACOES[i % ACOES.length], entidade: 'aluno', entidadeId: null,
  resumo: 'Registro fictício de exemplo.', criadoEm: `2026-10-${String(19 - (i % 18)).padStart(2, '0')}T1${i % 10}:${String(i % 60).padStart(2, '0')}:00Z`,
});

const CONTA: MinhaConta = {
  cliente: {
    nome: 'Consultoria Fictícia Ltda.', documento: '00.000.000/0001-00',
    endereco: { logradouro: 'Rua Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Cidade Teste', uf: 'PR', cep: '00000-000' },
    contatos: [{ nome: 'Ana Fictícia', email: 'financeiro@exemplo.test', telefone: '(45) 90000-0000', principal: true }],
  },
  contratacao: {
    planoNome: 'Profissional', periodicidade: 'MENSAL', valor: 199.9, diaVencimento: 10, inicio: '2026-01-10', vigenteAte: '2026-11-10',
    situacaoComercial: 'ATIVA', nomeInstancia: 'consultoria-ficticia', adicionais: [{ nome: 'Membros extras', quantidade: 2 }],
  },
  cobrancas: Array.from({ length: 10 }, (_, i) => ({
    id: `c-${i}`, competenciaInicio: `2026-${String(10 - i).padStart(2, '0')}-10`, competenciaFim: `2026-${String(11 - i).padStart(2, '0')}-09`,
    vencimento: `2026-${String(10 - i).padStart(2, '0')}-10`, valor: 199.9, situacao: i === 0 ? 'ABERTA' : 'PAGA', vencida: false,
    pagoEm: i === 0 ? null : `2026-${String(10 - i).padStart(2, '0')}-09`,
  })),
  previa: true,
};
const CONSUMO: ConsumoDoPlano = {
  planoNome: 'Profissional', versaoDireitos: 3, direitosConfirmadosEm: '2026-10-01T12:00:00Z', consultadoEm: '2026-10-19T12:00:00Z',
  itens: [
    { codigo: 'alunos_ativos', nome: 'Alunos ativos', usado: 84, limite: 100, disponivel: 16, unidade: 'alunos', estado: 'ATENCAO' },
    { codigo: 'membros_equipe', nome: 'Membros da equipe', usado: 12, limite: 15, disponivel: 3, unidade: 'membros', estado: 'DISPONIVEL' },
  ],
};

const CONSULTORIA: ConsultoriaResponse = {
  marca: MARCA, versao: 3, diasAtualizacaoPadrao: 30, metaDoPeso: 'REDUZIR',
  whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test',
};

const CORES: TagDaConsultoria['cor'][] = ['CIANO', 'AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA'];
const TAGS: TagDaConsultoria[] = ['Iniciante', 'Avançado', 'Online', 'Presencial', 'Emagrecimento', 'Hipertrofia', 'Corrida', 'Retorno'].map((nome, i) => ({
  id: `t-${i}`, nome, cor: CORES[i % CORES.length], totalAlunos: 3 + i * 4, versao: 1,
}));

const TIPOS: ModeloWhatsApp['tipo'][] = ['ANTES', 'NO_DIA', 'DEPOIS', 'COMPROMISSO_NOVO', 'COMPROMISSO_REMARCADO', 'COMPROMISSO_CANCELADO'];
const MODELOS: ModeloWhatsApp[] = TIPOS.map((tipo, i) => ({
  tipo, configurado: i < 2, nome: i < 2 ? `aviso_${tipo.toLowerCase()}` : null, idioma: i < 2 ? 'pt_BR' : null, situacao: i < 2 ? 'APPROVED' : null,
  versao: i < 2 ? 1 : null, textoSugerido: 'Olá {{1}}, este é um aviso fictício da {{2}}.', variaveis: ['primeiro nome', 'consultoria'],
}));

interface Dados { membros: MembroEquipe[]; eventos: number; tags: TagDaConsultoria[] }
const CHEIO: Dados = { membros: MEMBROS, eventos: 50, tags: TAGS };
const POUCOS: Dados = { membros: MEMBROS.slice(0, 2), eventos: 3, tags: TAGS.slice(0, 1) };

async function preparar(page: Page, largura: number, altura: number, dados: Dados = CHEIO, opcoes: { tema?: string; tamanhoTexto?: string } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, prefs);
    } catch { /* quadro sem armazenamento */ }
  }, [TREINADOR.id, JSON.stringify({ tema: opcoes.tema ?? 'ESCURO', larguraConteudo: 'AUTOMATICA', ...(opcoes.tamanhoTexto ? { tamanhoTexto: opcoes.tamanhoTexto } : {}) })] as const);
  const itens = Array.from({ length: dados.eventos }, (_, i) => evento(i));
  const respostas: RespostasApi = {
    ...(await sessao(page, TREINADOR, {
      permissoes: PERMISSOES, perfil: { id: 'p-adm', nome: 'Administrador', acessoTotal: true },
      pagamentosHabilitados: true, recebimentoOnlineHabilitado: true, whatsappHabilitado: true,
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /usuarios': { corpo: dados.membros },
    'GET /perfis': { corpo: PERFIS },
    'GET /permissoes/catalogo': { corpo: CATALOGO_DE_EXEMPLO },
    'GET /auditoria': { corpo: { itens, total: dados.eventos > 10 ? 230 : dados.eventos, pagina: 0 } },
    'GET /auditoria/pessoas': { corpo: NOMES.slice(0, 5).map((nome, i) => ({ id: `m-${i}`, nome })) },
    'GET /minha-conta': { corpo: CONTA },
    'GET /minha-conta/consumo': { corpo: CONSUMO },
    'GET /consultoria': { corpo: CONSULTORIA },
    'GET /tags-de-alunos': { corpo: dados.tags },
    'GET /whatsapp/conexao': { corpo: { habilitado: true, configurada: true, phoneNumberId: '123456789012345', wabaId: '987654321098765', tokenGravadoEm: '2026-10-10T12:00:00Z', versao: 2 } },
    'GET /whatsapp/modelos': { corpo: { modelos: MODELOS } },
  };
  return simularApi(page, respostas);
}

/** As telas do grupo: rota e o que esperar antes de medir ou capturar. */
const TELAS: { nome: string; rota: string; pronta: (page: Page) => Promise<void> }[] = [
  { nome: 'configuracoes', rota: '/treinador/configuracoes', pronta: (p) => expect(p.getByRole('heading', { level: 2, name: 'Ajuda' })).toBeVisible() },
  { nome: 'equipe-membros', rota: '/treinador/equipe?aba=membros', pronta: (p) => expect(p.getByRole('heading', { level: 2, name: 'Membros da equipe' })).toBeVisible() },
  { nome: 'equipe-perfis', rota: '/treinador/equipe?aba=perfis', pronta: (p) => expect(p.getByRole('button', { name: 'Editar Estagiário' })).toBeVisible() },
  { nome: 'ajuda', rota: '/treinador/ajuda', pronta: (p) => expect(p.getByRole('heading', { name: 'Começar a usar', level: 2 })).toBeVisible() },
  { nome: 'ajustes', rota: '/treinador/ajustes', pronta: (p) => expect(p.getByRole('radiogroup', { name: 'Largura do conteúdo' })).toBeVisible() },
  { nome: 'marca', rota: '/treinador/marca', pronta: (p) => expect(p.getByRole('heading', { name: 'Contato' })).toBeVisible() },
  { nome: 'minha-conta-cadastro', rota: '/treinador/minha-conta?aba=cadastro', pronta: (p) => expect(p.getByRole('tab', { name: 'Cadastro' })).toBeVisible() },
  { nome: 'minha-conta-assinatura', rota: '/treinador/minha-conta?aba=assinatura', pronta: (p) => expect(p.getByRole('tab', { name: 'Assinatura' })).toBeVisible() },
  { nome: 'minha-conta-faturas', rota: '/treinador/minha-conta?aba=faturas', pronta: (p) => expect(p.getByRole('tab', { name: 'Faturas' })).toBeVisible() },
  { nome: 'whatsapp', rota: '/treinador/whatsapp', pronta: (p) => expect(p.getByRole('heading', { name: 'Modelos de mensagem' })).toBeVisible() },
  { nome: 'auditoria', rota: '/treinador/auditoria', pronta: (p) => expect(p.getByRole('table', { name: 'Eventos da auditoria' })).toBeVisible() },
  { nome: 'tags', rota: '/treinador/alunos/tags', pronta: (p) => expect(p.getByRole('heading', { level: 1, name: 'Tags dos alunos' })).toBeVisible() },
];
const COM_POUCOS = new Set(['equipe-membros', 'auditoria', 'tags']);

const LARGURAS: [number, number][] = [[1920, 1080], [2560, 1440], [3440, 1440]];

async function caixa(page: Page, alvo: ReturnType<Page['locator']>) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

/** Quantos dos títulos estão na mesma linha (mesmo topo) do primeiro. */
async function naPrimeiraLinha(page: Page, nomes: string[]) {
  const tops = await Promise.all(nomes.map(async (n) => (await caixa(page, page.getByRole('heading', { name: n, exact: true }).first())).y));
  return tops.filter((y) => Math.abs(y - tops[0]) < 4).length;
}

/** O bloco que contém o h1 e as sobras dele dentro da área. */
async function blocoDoTitulo(page: Page, h1: string) {
  return page.getByRole('heading', { name: h1, level: 1 }).evaluate((titulo) => {
    // O primeiro ancestral de pelo menos 900 px cujo pai é mais largo (o título e o cabeçalho podem ser só da largura do texto).
    let bloco = titulo as HTMLElement;
    while (bloco.parentElement && (bloco.getBoundingClientRect().width < 900 || bloco.parentElement.getBoundingClientRect().width - bloco.getBoundingClientRect().width < 4)) bloco = bloco.parentElement;
    const b = bloco.getBoundingClientRect();
    const area = bloco.parentElement!.getBoundingClientRect();
    return { esquerda: b.left - area.left, direita: area.right - b.right, largura: b.width };
  });
}

const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });

// Colunas esperadas por largura (menu aberto, Automática): hub, perfis, modelos do WhatsApp.
const ESPERADO: Record<number, { hub: number; perfis: number; modelos: number; ajudaEmTres: boolean }> = {
  1920: { hub: 2, perfis: 2, modelos: 2, ajudaEmTres: false },
  2560: { hub: 4, perfis: 3, modelos: 3, ajudaEmTres: true },
  3440: { hub: 4, perfis: 3, modelos: 3, ajudaEmTres: true },
};
const GRUPOS = ['Sua conta', 'Consultoria', 'Equipe', 'Alunos e atendimento', 'Financeiro', 'Dados', 'Ajuda'];

for (const [largura, altura] of LARGURAS) {
  test(`${largura} px: o espaço extra vira colunas e nada passa do limite`, async ({ page }) => {
    const { errosDaPagina } = await preparar(page, largura, altura);
    const e = ESPERADO[largura];

    // Configurações: colunas de ~508 px, bloco centrado, sem cartão sozinho na última linha (7 grupos = 4 + 3).
    await page.goto('/treinador/configuracoes');
    await TELAS[0].pronta(page);
    await assentado(async () => {
      expect(await naPrimeiraLinha(page, GRUPOS.slice(0, 4))).toBe(Math.min(e.hub, 4));
      const sua = await caixa(page, page.getByRole('heading', { name: 'Sua conta', exact: true }));
      const ajuda = await caixa(page, page.getByRole('heading', { name: 'Ajuda', level: 2 }));
      const financeiro = await caixa(page, page.getByRole('heading', { name: 'Financeiro', level: 2 }));
      if (e.hub === 4) expect(Math.abs(ajuda.y - financeiro.y)).toBeLessThan(4);
      const margens = await blocoDoTitulo(page, 'Configurações');
      expect(Math.abs(margens.esquerda - margens.direita)).toBeLessThanOrEqual(2);
      expect(margens.largura).toBeLessThanOrEqual(e.hub * 508 + (e.hub - 1) * 24 + 1);
      expect(sua.x).toBeGreaterThan(0);
    });
    await semRolagemHorizontal(page);

    // Equipe › Membros: tabela com uma coluna por dado (não uma linha esticada com o Editar na outra ponta).
    await page.goto('/treinador/equipe?aba=membros');
    const tabela = page.getByRole('table', { name: 'Membros da equipe' });
    await expect(tabela).toBeVisible();
    await expect(tabela.getByRole('columnheader')).toHaveText(['Membro', 'Perfil', 'Situação', 'Último acesso', 'Limite', '']);
    await expect(page.getByRole('button', { name: 'Editar Ana Fictícia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renovar convite de Kátia Fictícia' })).toBeVisible();
    // Seis colunas não se espalham por 3000 px: a tabela para no teto das listas (como a Auditoria).
    expect((await caixa(page, tabela)).width).toBeLessThanOrEqual(1800);
    await semRolagemHorizontal(page);

    // Equipe › Perfis: cartões lado a lado, células de pelo menos 560 px, no cartão de até 1800 px.
    await page.goto('/treinador/equipe?aba=perfis');
    await TELAS[2].pronta(page);
    await assentado(async () => {
      expect(await naPrimeiraLinha(page, ['Administrador', 'Treinador', 'Nutricionista', 'Assistente'])).toBe(e.perfis);
    });
    await semRolagemHorizontal(page);

    // WhatsApp: Conexão com largura de formulário, Modelos ao lado e em grade.
    await page.goto('/treinador/whatsapp');
    await TELAS[9].pronta(page);
    await assentado(async () => {
      const campo = await caixa(page, page.getByRole('textbox', { name: 'Phone Number ID' }));
      const conexao = await caixa(page, page.getByRole('heading', { name: 'Conexão com a Meta' }));
      const modelos = await caixa(page, page.getByRole('heading', { name: 'Modelos de mensagem' }));
      expect(campo.width).toBeLessThanOrEqual(640);
      expect(modelos.x).toBeGreaterThan(campo.x + campo.width);
      expect(Math.abs(modelos.y - conexao.y)).toBeLessThan(4);
      expect(await naPrimeiraLinha(page, ['Lembrete antes do vencimento', 'Lembrete no dia do vencimento', 'Lembrete após o vencimento'])).toBe(e.modelos);
    });
    await semRolagemHorizontal(page);

    // Ajustes: as duas colunas centradas, sem metade da tela vazia à direita.
    await page.goto('/treinador/ajustes');
    await TELAS[4].pronta(page);
    await assentado(async () => {
      const tema = await caixa(page, page.getByRole('heading', { name: 'Tema', exact: true }).first());
      const contraste = await caixa(page, page.getByRole('heading', { name: 'Contraste', exact: true }));
      expect(contraste.x).toBeGreaterThan(tema.x);
      const margens = await blocoDoTitulo(page, 'Ajustes');
      expect(margens.largura).toBeLessThanOrEqual(1464 + 1);
      expect(Math.abs(margens.esquerda - margens.direita)).toBeLessThanOrEqual(2);
    });
    await semRolagemHorizontal(page);

    // Ajuda: 3 colunas quando cabem (2560 já abre), texto corrido no limite.
    await page.goto('/treinador/ajuda');
    await TELAS[3].pronta(page);
    await assentado(async () => {
      const comecar = await caixa(page, page.getByRole('heading', { name: 'Começar a usar', level: 2 }));
      const consultar = await caixa(page, page.getByRole('heading', { name: 'Consultar', level: 2 }));
      if (e.ajudaEmTres) expect(consultar.x).toBeGreaterThan(comecar.x + comecar.width);
      else expect(consultar.y).toBeGreaterThan(comecar.y);
      expect(comecar.width).toBeLessThanOrEqual(800);
    });
    await semRolagemHorizontal(page);

    expect(errosDaPagina).toEqual([]);
  });
}

test('1280 px: Membros segue como lista de linhas e Perfis, um por linha', async ({ page }) => {
  const { errosDaPagina } = await preparar(page, 1280, 900);
  await page.goto('/treinador/equipe?aba=membros');
  await expect(page.getByRole('button', { name: 'Editar Ana Fictícia' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Membros da equipe' })).toHaveCount(0);
  await page.goto('/treinador/equipe?aba=perfis');
  await TELAS[2].pronta(page);
  expect(await naPrimeiraLinha(page, ['Administrador', 'Treinador'])).toBe(1);
  await page.goto('/treinador/configuracoes');
  await TELAS[0].pronta(page);
  expect(await naPrimeiraLinha(page, GRUPOS.slice(0, 3))).toBe(2);
  await semRolagemHorizontal(page);
  expect(errosDaPagina).toEqual([]);
});

test('capturas da revisão (só com CAPTURAS_TELA_LARGA_GRUPO)', async ({ page }) => {
  const base = process.env.CAPTURAS_TELA_LARGA_GRUPO;
  test.skip(!base, 'capturas desligadas');
  test.setTimeout(600_000);
  const fase = process.env.FASE ?? 'antes';
  for (const [largura, altura] of LARGURAS) {
    for (const dados of [CHEIO, POUCOS]) {
      await preparar(page, largura, altura, dados);
      for (const t of TELAS) {
        if (dados === POUCOS && !COM_POUCOS.has(t.nome)) continue;
        await page.goto(t.rota, { waitUntil: 'domcontentloaded' });
        await t.pronta(page);
        await page.waitForTimeout(400);
        const pasta = path.join(base!, dados === POUCOS ? `${t.nome}-poucos` : t.nome, fase);
        fs.mkdirSync(pasta, { recursive: true });
        await page.screenshot({ path: path.join(pasta, `${largura}.png`) });
        // Texto corrido da Ajuda (uma seção longa aberta) e o fim da Marca (Acompanhamento e Contato).
        const extra = dados === CHEIO && t.nome === 'ajuda'
          ? { nome: 'ajuda-secao-aberta', abrir: async () => {
            await page.getByRole('button', { name: 'Treino, dieta e mobilidade, recolhido' }).click();
            await page.getByRole('button', { name: 'Treino, dieta e mobilidade, aberto' }).scrollIntoViewIfNeeded();
          } }
          : dados === CHEIO && t.nome === 'marca'
            ? { nome: 'marca-fim', abrir: () => page.getByRole('heading', { name: 'Contato' }).scrollIntoViewIfNeeded() }
            : null;
        if (extra) {
          await extra.abrir();
          await page.waitForTimeout(300);
          const outra = path.join(base!, extra.nome, fase);
          fs.mkdirSync(outra, { recursive: true });
          await page.screenshot({ path: path.join(outra, `${largura}.png`) });
        }
      }
    }
  }
});

test('capturas de conferência em 1280 e 390 (só com CAPTURAS_TELA_LARGA_GRUPO)', async ({ page }) => {
  const base = process.env.CAPTURAS_TELA_LARGA_GRUPO;
  test.skip(!base, 'capturas desligadas');
  test.setTimeout(600_000);
  const tocadas = TELAS.filter((t) => ['configuracoes', 'equipe-membros', 'equipe-perfis', 'whatsapp', 'ajustes', 'ajuda'].includes(t.nome));
  const cenarios = [
    { largura: 1280, altura: 900, tema: 'ESCURO' }, { largura: 1280, altura: 900, tema: 'CLARO' }, { largura: 1280, altura: 900, tema: 'AREIA' },
    { largura: 390, altura: 844, tema: 'ESCURO' }, { largura: 390, altura: 844, tema: 'CLARO' }, { largura: 1280, altura: 900, tema: 'ESCURO', tamanhoTexto: 'EXTRA' },
  ];
  for (const c of cenarios) {
    const { errosDaPagina } = await preparar(page, c.largura, c.altura, CHEIO, { tema: c.tema, tamanhoTexto: c.tamanhoTexto });
    for (const t of tocadas) {
      await page.goto(t.rota, { waitUntil: 'domcontentloaded' });
      await t.pronta(page);
      await page.waitForTimeout(400);
      await semRolagemHorizontal(page);
      const pasta = path.join(base!, t.nome, 'conferencia');
      fs.mkdirSync(pasta, { recursive: true });
      await page.screenshot({ path: path.join(pasta, `${c.largura}-${c.tema.toLowerCase()}${c.tamanhoTexto ? '-texto-extra' : ''}.png`) });
    }
    expect(errosDaPagina).toEqual([]);
  }
});
