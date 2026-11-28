import { expect, test, type Page } from '@playwright/test';

import type { Atualizacao, ConteudoDieta, PlanoDetalhe, Receita } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { ALUNO_ID as ALUNO_ID_EDITOR, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';
import { abrirEditor } from './editor-questionario.dados';

/**
 * O ⓘ "Sobre esta tela" do cabeçalho de página (`ui/AjudaDoCabecalho`, pedido de 25/11): a descrição sai da tela e vai
 * para um balão que abre no mouse, no Tab e no clique; Esc e clique fora fecham; "Saiba mais" abre a seção da Ajuda
 * quando a tela tem artigo (`dominio/ajudaDaTela`). Em 390 e 1280 px. Só dados fictícios, API simulada.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CONFIGURACOES = 'Sua conta, a consultoria, a equipe e o atendimento, num lugar só.';
const AJUSTES = 'Valem só neste aparelho e para a sua conta.';
const AUDITORIA = 'Ações feitas na consultoria, guardadas por um ano. Valores clínicos não aparecem.';
/**
 * Tela de amostra com "Saiba mais" (seção consultoria). Em 1280 Configurações abre direto em Meus dados (duas colunas, 26/11),
 * que não tem artigo: lá a amostra é a Auditoria, da mesma seção; no celular continua a lista de Configurações.
 */
const amostra = (largura: number) => (largura < 1024
  ? { caminho: '/treinador/configuracoes', titulo: 'Configurações', texto: CONFIGURACOES }
  : { caminho: '/treinador/auditoria', titulo: 'Auditoria', texto: AUDITORIA });

async function abrir(page: Page, largura: number, caminho: string) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 800 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'AUDITORIA_LER', 'MARCA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto(caminho);
  return { errosDaPagina };
}

const icone = (page: Page) => page.getByRole('button', { name: 'Sobre esta tela' });
const balao = (page: Page) => page.getByRole('dialog', { name: 'Sobre esta tela' });

/** O balão inteiro dentro da janela, com no máximo 320 px de largura. */
async function dentroDaJanela(page: Page, largura: number) {
  const c = await balao(page).boundingBox();
  expect(c).not.toBeNull();
  expect(c!.x).toBeGreaterThanOrEqual(0);
  expect(c!.x + c!.width).toBeLessThanOrEqual(largura);
  expect(c!.width).toBeLessThanOrEqual(320);
}

for (const largura of [1280, 390]) {
  const { caminho, titulo, texto } = amostra(largura);
  test.describe(`${largura} px`, () => {
    test('a descrição sai da tela e vai para o ⓘ ao lado do título, com a mesma descrição acessível', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, caminho);
      const h1 = page.getByRole('heading', { level: 1, name: titulo });
      await expect(h1).toBeVisible();
      await expect(icone(page)).toBeVisible();
      await expect(page.getByText(texto)).toBeHidden();
      await expect(icone(page)).toHaveAccessibleDescription(texto);
      await expect(icone(page)).toHaveAttribute('aria-expanded', 'false');
      // Na mesma linha do título, logo depois dele; alvo de 44 px.
      const t = (await h1.boundingBox())!;
      const i = (await icone(page).boundingBox())!;
      expect(i.x).toBeGreaterThanOrEqual(t.x + t.width - 8);
      expect(i.y).toBeLessThan(t.y + t.height);
      expect(i.y + i.height).toBeGreaterThan(t.y);
      expect(Math.round(i.width)).toBe(44);
      expect(Math.round(i.height)).toBe(44);
      expect(errosDaPagina).toEqual([]);
    });

    test('clique abre e fecha; Esc fecha e devolve o foco; clique fora fecha', async ({ page }) => {
      await abrir(page, largura, caminho);
      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      await expect(balao(page).getByText(texto)).toBeVisible();
      await expect(icone(page)).toHaveAttribute('aria-expanded', 'true');
      await dentroDaJanela(page, largura);
      await icone(page).click();
      await expect(balao(page)).toBeHidden();

      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(balao(page)).toBeHidden();
      await expect(icone(page)).toBeFocused();

      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      // Um ponto vazio à direita do título, fora do balão.
      const t = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      await page.mouse.click(largura - 30, t.y + 4);
      await expect(balao(page)).toBeHidden();
    });

    test('Tab abre, passa ao "Saiba mais" e o link abre a seção da Ajuda', async ({ page }) => {
      await abrir(page, largura, caminho);
      await expect(icone(page)).toBeVisible();
      // Foco do teclado: o Tab chega ao ⓘ vindo do elemento anterior.
      await icone(page).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(balao(page)).toBeHidden();
      await page.keyboard.press('Tab');
      await expect(icone(page)).toBeFocused();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Tab');
      const link = balao(page).getByRole('link', { name: 'Saiba mais' });
      await expect(link).toBeFocused();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/treinador\/ajuda\?secao=consultoria$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
      // A seção pedida nasce aberta: o item Auditoria dela está à vista.
      await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeVisible();
    });

    test('tela sem artigo: só o texto, sem "Saiba mais"', async ({ page }) => {
      await abrir(page, largura, '/treinador/ajustes');
      await expect(page.getByText(AJUSTES)).toBeHidden();
      await icone(page).click();
      await expect(balao(page).getByText(AJUSTES)).toBeVisible();
      await expect(balao(page).getByRole('link')).toHaveCount(0);
      await dentroDaJanela(page, largura);
    });
  });
}

test('1280 px: o mouse abre, pode entrar no balão e, ao sair, fecha', async ({ page }) => {
  await abrir(page, 1280, '/treinador/auditoria');
  await icone(page).hover();
  await expect(balao(page)).toBeVisible();
  await balao(page).getByRole('link', { name: 'Saiba mais' }).hover();
  await page.waitForTimeout(400);
  await expect(balao(page)).toBeVisible();
  await page.mouse.move(1200, 700);
  await expect(balao(page)).toBeHidden();
});

test('1280 px: com a Ajuda já aberta antes, o "Saiba mais" abre a seção pedida', async ({ page }) => {
  await abrir(page, 1280, '/treinador/ajuda');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
  await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeHidden();
  await page.getByRole('link', { name: 'Equipe', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipe' })).toBeVisible();
  await icone(page).click();
  await balao(page).getByRole('link', { name: 'Saiba mais' }).click();
  await expect(page).toHaveURL(/\/treinador\/ajuda\?secao=consultoria$/);
  await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeVisible();
});

/**
 * Varredura (25/11): toda tela principal do menu do treinador, as de Configurações, a ficha do aluno e os editores têm o ⓘ
 * "Sobre esta tela" com texto no balão, e o "Saiba mais" só existe quando `dominio/ajudaDaTela` tem a seção da tela
 * (e leva a `?secao=` certa). `secao: null` = sem seção própria na Ajuda, então sem link.
 */
const PERMISSOES_DA_VARREDURA = [
  ...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'EQUIPE_ALTERAR', 'AUDITORIA_LER', 'MARCA_ALTERAR', 'CONTA_LER', 'MODELO_LER', 'MODELO_ALTERAR',
  'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER',
  'ATUALIZACAO_RESPONDER', 'WHATSAPP_ALTERAR', 'VITRINE_LER', 'VITRINE_ALTERAR', 'COMUNIDADE_LER', 'COMUNIDADE_ALTERAR', 'REGISTRO_LER',
  'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'ERGOGENICO_LER', 'IMPORTACAO_LER', 'IMPORTACAO_ALTERAR', 'USUARIO_LER', 'PERFIL_LER',
  'CONTRATO_LER', 'CONTRATO_ALTERAR',
];
const ALUNO_DA_FICHA = 'a0000000-0000-4000-8000-000000000002';
const MOBILIDADE_ID = 'p0000000-0000-4000-8000-0000000000m1';
const DIETA_ID = 'p0000000-0000-4000-8000-0000000000d1';
const MODELO_ID = 'r0000000-0000-4000-8000-0000000000r1';
const ATUALIZACAO_ID = 'e0000000-0000-4000-8000-000000000005';

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: DIETA_ID, alunoId: ALUNO_ID_EDITOR, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
    suplementacao: [], ergogenicos: [],
    refeicoes: [{ uid: 'r1', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'r1-a', rotulo: 'A', itens: [
      { uid: 'r1-i1', alimentoId: null, nome: 'Pão fictício', quantidade: 100, unidade: 'g', kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false },
    ] }] }],
  },
  versoes: [],
};
const MODELO: Receita = {
  id: MODELO_ID, tipo: 'MOBILIDADE', origem: 'CONSULTORIA', nome: 'Rotina fictícia da manhã', descricao: 'Modelo fictício.', pastaId: null, ordem: 0, versao: 1,
  conteudo: { orientacoes: 'Antes do treino.', secoes: [{ uid: 's1', titulo: 'Aquecimento', itens: [{ uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null }] }] },
};
const ATUALIZACAO: Atualizacao = {
  id: ATUALIZACAO_ID, pastaId: 'f0000000-0000-4000-8000-0000000000a1', alunoId: ALUNO_DA_FICHA, nomeAluno: 'Aluna Fictícia',
  dataAtualizacao: '2026-10-20', fase: 'ENVIADA', diasParaData: -11, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-10-20T12:00:00Z', feedback: null, versao: 1, resumo: null,
};

interface TelaDaVarredura { caminho: string; titulo: string; secao: string | null }
const TELAS: TelaDaVarredura[] = [
  { caminho: '/treinador', titulo: 'Início', secao: 'inicio' },
  { caminho: '/treinador/alunos', titulo: 'Alunos', secao: 'alunos' },
  { caminho: '/treinador/atualizacoes', titulo: 'Atualizações', secao: 'atualizacoes' },
  { caminho: '/treinador/agenda', titulo: 'Agenda', secao: 'agenda' },
  { caminho: '/treinador/comunidade', titulo: 'Comunidade', secao: 'comunidade' },
  { caminho: '/treinador/biblioteca', titulo: 'Biblioteca', secao: 'biblioteca' },
  { caminho: '/treinador/planejamento', titulo: 'Planejamento', secao: 'planos' },
  { caminho: '/treinador/interessados', titulo: 'Interessados', secao: 'interessados' },
  { caminho: '/treinador/financeiro', titulo: 'Financeiro', secao: 'financeiro' },
  { caminho: '/treinador/vitrine', titulo: 'Vitrine', secao: 'vitrine' },
  { caminho: '/treinador/numeros', titulo: 'Números', secao: null },
  { caminho: '/treinador/equipe', titulo: 'Equipe', secao: 'consultoria' },
  { caminho: '/treinador/importacao', titulo: 'Importação', secao: 'importacao' },
  { caminho: '/treinador/importacao/assistida', titulo: 'Importação assistida', secao: 'importacao' },
  { caminho: '/treinador/importacao/dicionario', titulo: 'Dicionário da importação', secao: 'importacao' },
  { caminho: '/treinador/auditoria', titulo: 'Auditoria', secao: 'consultoria' },
  // Itens abertos dentro de Configurações (26/11): o mesmo ⓘ e o mesmo "Saiba mais" da tela inteira (no celular, vão a ela).
  { caminho: '/treinador/configuracoes/marca', titulo: 'Marca', secao: 'consultoria' },
  // Telas só de Configurações (27/11): herdam o "Saiba mais" da Marca.
  { caminho: '/treinador/configuracoes/contato', titulo: 'Contato', secao: 'consultoria' },
  { caminho: '/treinador/configuracoes/padroes-do-acompanhamento', titulo: 'Padrões do acompanhamento', secao: 'consultoria' },
  { caminho: '/treinador/configuracoes/seguranca', titulo: 'Segurança', secao: null },
  { caminho: '/treinador/configuracoes/termos', titulo: 'Termos e privacidade', secao: 'privacidade' },
  { caminho: '/treinador/marca', titulo: 'Marca', secao: 'consultoria' },
  { caminho: '/treinador/whatsapp', titulo: 'WhatsApp oficial', secao: null },
  { caminho: '/treinador/documentos', titulo: 'Documentos (PDF)', secao: null },
  { caminho: '/treinador/documentos/personalizar', titulo: 'Personalizar documentos', secao: null },
  { caminho: '/treinador/contratos', titulo: 'Contratos', secao: 'contratos' },
  { caminho: '/treinador/regras-de-atencao', titulo: 'Regras de atenção', secao: 'regras-de-atencao' },
  { caminho: '/treinador/termos', titulo: 'Termos e privacidade', secao: 'privacidade' },
  { caminho: '/treinador/seguranca', titulo: 'Segurança', secao: null },
  { caminho: '/treinador/minha-conta', titulo: 'Assinatura e faturas', secao: null },
  { caminho: '/treinador/meus-dados', titulo: 'Meus dados', secao: null },
  { caminho: '/treinador/perfil', titulo: 'Perfil', secao: null },
  { caminho: '/treinador/ajustes', titulo: 'Aparência e preferências', secao: null },
  { caminho: '/treinador/ajuda', titulo: 'Ajuda', secao: null },
  { caminho: '/treinador/importacao/nova', titulo: 'Nova importação', secao: 'importacao' },
  { caminho: '/treinador/importacao/planilha-completa', titulo: 'Planilha completa', secao: 'importacao' },
  { caminho: '/treinador/alunos/tags', titulo: 'Tags dos alunos', secao: 'alunos' },
  { caminho: '/treinador/alunos/novo', titulo: 'Novo aluno', secao: 'alunos' },
  { caminho: `/treinador/alunos/${ALUNO_DA_FICHA}`, titulo: 'Aluna Fictícia', secao: 'alunos' },
];

async function abrirVarredura(page: Page, largura: number, caminho: string, extra: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 800 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: PERMISSOES_DA_VARREDURA, pagamentosHabilitados: true, vitrineHabilitada: true, whatsappHabilitado: true, contratosHabilitados: true, regrasAtencaoHabilitada: true,
      perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true },
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ALUNO_DA_FICHA}`]: { corpo: { id: ALUNO_DA_FICHA, nome: 'Aluna Fictícia', email: 'aluna@exemplo.test', ativo: true, temAcesso: true, versao: 1, anonimizado: false } },
    // Contrato digital ligado: os modelos e os contratos da ficha, vazios.
    'GET /contratos/modelos': { corpo: [] },
    'GET /alunos/{id}/contratos': { corpo: [] },
    ...extra,
  });
  await page.goto(caminho);
  return { errosDaPagina };
}

/** O ⓘ existe, o balão abre com texto e o "Saiba mais" bate com o mapa; fecha com Esc. */
async function conferirOIcone(page: Page, secao: string | null) {
  await expect(icone(page)).toHaveCount(1);
  await expect(icone(page)).toBeVisible();
  await icone(page).click();
  await expect(balao(page)).toBeVisible();
  expect(((await balao(page).innerText()).replace('Saiba mais', '')).trim().length).toBeGreaterThan(10);
  const link = balao(page).getByRole('link', { name: 'Saiba mais' });
  if (secao) await expect(link).toHaveAttribute('href', `/treinador/ajuda?secao=${secao}`);
  else await expect(link).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(balao(page)).toBeHidden();
}

for (const largura of [1280, 390]) {
  test.describe(`varredura em ${largura} px`, () => {
    for (const { caminho, titulo, secao } of TELAS) {
      test(`${caminho}: ⓘ${secao ? ` com Saiba mais (${secao})` : ' sem Saiba mais'}`, async ({ page }) => {
        const { errosDaPagina } = await abrirVarredura(page, largura, caminho);
        await expect(page.getByRole('heading', { level: 1, name: titulo, exact: true })).toBeVisible();
        await conferirOIcone(page, secao);
        expect(errosDaPagina).toEqual([]);
      });
    }

    test('editor de treino do aluno: ⓘ com Saiba mais (planos)', async ({ page }) => {
      const extra: RespostasApi = {
        [`GET /alunos/${ALUNO_ID_EDITOR}`]: { corpo: { id: ALUNO_ID_EDITOR, nome: 'Aluna Fictícia' } },
        'GET /exercicios': { corpo: BIBLIOTECA },
        [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
      };
      await abrirVarredura(page, largura, `/treinador/treinos/${PLANO_ID}`, extra);
      await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
      await conferirOIcone(page, 'planos');
    });

    test('editor de mobilidade do aluno: ⓘ com Saiba mais (planos)', async ({ page }) => {
      const mob = {
        plano: { id: MOBILIDADE_ID, alunoId: ALUNO_ID_EDITOR, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true, versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1 },
        rascunho: { orientacoes: null, secoes: [{ uid: 's1', titulo: 'Aquecimento', itens: [{ uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null }] }] },
        versoes: [],
      };
      await abrirVarredura(page, largura, `/treinador/mobilidades/${MOBILIDADE_ID}`, { [`GET /planos-mobilidade/${MOBILIDADE_ID}`]: { corpo: mob } });
      await expect(page.getByRole('heading', { name: 'Seções (1)' })).toBeVisible();
      await conferirOIcone(page, 'planos');
    });

    test('modelo do Planejamento (mobilidade): ⓘ com Saiba mais (planos)', async ({ page }) => {
      await abrirVarredura(page, largura, `/treinador/planejamento/modelo/${MODELO_ID}`, {
        'GET /pastas-modelos': { corpo: [] },
        'GET /receitas': { corpo: [] },
        [`GET /receitas/${MODELO_ID}`]: { corpo: MODELO },
      });
      await expect(page.getByRole('heading', { name: 'Sobre o modelo' })).toBeVisible();
      await conferirOIcone(page, 'planos');
    });

    test('editor de dieta do aluno: ⓘ com Saiba mais (planos)', async ({ page }) => {
      await abrirVarredura(page, largura, `/treinador/dietas/${DIETA_ID}`, {
        [`GET /alunos/${ALUNO_ID_EDITOR}`]: { corpo: { id: ALUNO_ID_EDITOR, nome: 'Aluna Fictícia' } },
        'GET /alimentos': { corpo: [] },
        [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DIETA },
      });
      await expect(page.getByRole('heading', { name: 'Refeições (1)' })).toBeVisible();
      await conferirOIcone(page, 'planos');
    });

    test('atualização do aluno: ⓘ com Saiba mais (atualizacoes)', async ({ page }) => {
      await abrirVarredura(page, largura, `/treinador/atualizacoes/${ATUALIZACAO_ID}`, {
        [`GET /atualizacoes/${ATUALIZACAO_ID}`]: { corpo: ATUALIZACAO },
      });
      await expect(page.getByRole('heading', { level: 1, name: /^Aluna Fictícia · Atualização/ })).toBeVisible();
      await conferirOIcone(page, 'atualizacoes');
    });

    test('editor de questionário: ⓘ sem Saiba mais', async ({ page }) => {
      await abrirEditor(page, { qual: 'anamnese', largura });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await conferirOIcone(page, null);
    });
  });
}
