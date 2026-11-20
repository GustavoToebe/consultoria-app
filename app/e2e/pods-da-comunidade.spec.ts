import { expect, test, type Page } from '@playwright/test';

import type { PaginaDoMural, PodResumo, PostDoMural } from '../src/api/comunidadeTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Pods da comunidade (`docs/planos/pods-da-comunidade.md`, passo 3): "Geral" e "Meu grupo" no mural do aluno, a seção
 * "Grupos" das "Configurações do mural" (aberta pelo "Gerenciar grupos" do seletor) e o filtro do mural da equipe, o "Publicar em" da equipe com o aviso de menor e o "Mudar grupo" da ficha, com o
 * 409 `POD_CHEIO`. A API simulada segue os formatos reais (`/comunidade/pods`, `/alunos/{id}/pod`, `?podId=`). Só dados
 * fictícios; o grupo do aluno vem do servidor (`pod` da configuração), nunca de uma escolha do app.
 */
const POD_A: PodResumo = { id: 'd0000000-0000-4000-8000-0000000000a1', nome: 'Turma das 6h', membros: 5, temMenor: true, criadoEm: '2026-11-10T12:00:00-03:00' };
const POD_B: PodResumo = { id: 'd0000000-0000-4000-8000-0000000000b2', nome: 'Turma da noite', membros: 11, temMenor: false, criadoEm: '2026-11-11T12:00:00-03:00' };
const AVISO_DE_MENOR = 'Este grupo tem pelo menos um aluno menor de idade. Confira o que será publicado nele.';

const POST_GERAL: PostDoMural = {
  id: 'p1', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Recado para o time todo.',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-11-15T12:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const POST_DO_GRUPO: PostDoMural = { ...POST_GERAL, id: 'p2', texto: 'Recado só da turma das 6h.', podId: POD_A.id, podNome: POD_A.nome };
const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });

/** Só os posts do `?tipo=` pedido, como a API (cada aba do mural pede um tipo por vez, C39). */
const doTipo = (p: PedidoFalso, pg: PaginaDoMural): PaginaDoMural => {
  const tipo = p.busca.get('tipo');
  return tipo ? pagina(...pg.content.filter((x) => x.tipo === tipo)) : pg;
};
/** O mural responde pelo `?podId=` como a API: nulo = geral; a fila de denunciadas traz todos os grupos. Os posts são conversas (aba Alunos). */
const muralPorGrupo = (p: PedidoFalso) => doTipo(p,
  p.busca.get('denunciados') === 'true' ? pagina({ ...POST_DO_GRUPO, denuncias: 1 })
    : p.busca.get('podId') === POD_A.id ? pagina(POST_DO_GRUPO) : pagina(POST_GERAL));

const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}
async function tema(page: Page, usuarioId: string, t: string) {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [usuarioId, t]);
}
const TEMAS = [['claro', 'CLARO'], ['areia', 'AREIA'], ['escuro', 'ESCURO']] as const;

const ALUNO_COMUM: RespostasApi = {
  'GET /aluno/comunidade/aulas': { corpo: [] },
  'GET /aluno/comunidade/conquistas': { corpo: [] },
  'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 1, pontuacao: 10, participantes: 2, nivel: 1, xp: 10, xpNoNivel: 10, faltam: 90 } },
  'GET /aluno/comunidade/mural': (p, route) => json(route, muralPorGrupo(p)),
  'POST /aluno/comunidade/mural': { status: 201, corpo: POST_GERAL },
};
const configuracaoDoAluno = (pod: { id: string; nome: string } | null) =>
  ({ 'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false, pod } } });

/** Grupos com estado, como a API: criar e renomear mudam a lista; nome repetido (sem caixa) = 409 `POD_NOME_EM_USO`. */
function comPods(inicial: PodResumo[]) {
  const estado = { pods: [...inicial] };
  const repetido = (nome: string, id?: string) => estado.pods.some((p) => p.id !== id && p.nome.toLowerCase() === nome.toLowerCase());
  const emUso = erroApi(409, 'Nome em uso.', 'POD_NOME_EM_USO');
  const rotas: RespostasApi = {
    'GET /comunidade/pods': (_p, route) => json(route, estado.pods),
    'POST /comunidade/pods': (p, route) => {
      const { nome } = p.corpo as { nome: string };
      if (repetido(nome)) return json(route, emUso.corpo, 409);
      const novo: PodResumo = { id: `d0000000-0000-4000-8000-00000000000${estado.pods.length + 1}`, nome, membros: 0, temMenor: false, criadoEm: '2026-11-17T12:00:00-03:00' };
      estado.pods.push(novo);
      return json(route, novo, 201);
    },
    'PUT /comunidade/pods/{id}': (p, route) => {
      const id = p.caminho.split('/').pop();
      const { nome } = p.corpo as { nome: string };
      if (repetido(nome, id)) return json(route, emUso.corpo, 409);
      estado.pods = estado.pods.map((x) => (x.id === id ? { ...x, nome } : x));
      return json(route, estado.pods.find((x) => x.id === id));
    },
  };
  return { estado, rotas };
}

const MODERAR = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'];
async function abrirMuralDaEquipe(page: Page, rotas: RespostasApi, permissoes = MODERAR) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /comunidade/aulas': { corpo: [] },
    'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
    'GET /comunidade/mural': (p, route) => json(route, muralPorGrupo(p)),
    'POST /comunidade/mural': { status: 201, corpo: POST_GERAL },
    ...rotas,
  });
  await page.goto('/treinador/comunidade?aba=mural&mural=alunos');
  await expect(page.getByText('Recado para o time todo.')).toBeVisible();
  return api;
}

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, podId: null, podNome: null,
};
async function abrirFicha(page: Page, rotas: RespostasApi, ficha: AlunoDetalhe = FICHA, permissoes = MODERAR) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: ficha },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
    ...rotas,
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  await expect(page.getByText('Dados do aluno', { exact: true })).toBeVisible();
  return api;
}

const foi = (p: PedidoFalso, metodo: string, caminho: string) => p.metodo === metodo && p.caminho === caminho;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('aluno sem grupo: mural Geral sem seletor, e a publicação vai sem podId', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...ALUNO_COMUM, ...configuracaoDoAluno(null) });
      await page.goto('/aluno/comunidade?grupo=meu&mural=alunos');
      await expect(page.getByText('Recado para o time todo.')).toBeVisible();
      await expect(page.getByRole('radiogroup', { name: 'Qual mural' })).toHaveCount(0);
      expect(api.pedidos.some((p) => foi(p, 'GET', '/aluno/comunidade/mural') && p.busca.has('podId'))).toBe(false);

      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = page.getByRole('dialog', { name: 'Nova publicação' });
      await expect(folha.getByText(/Vai para/)).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Oi, time');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foi(p, 'POST', '/aluno/comunidade/mural'))?.corpo).toEqual({ tipo: 'CONVERSA', texto: 'Oi, time' });
      await expect(page.getByText('Publicado no mural.')).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno com grupo: Geral e Meu grupo; o post do grupo vai com o podId e o do Geral sem', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...ALUNO_COMUM, ...configuracaoDoAluno({ id: POD_A.id, nome: POD_A.nome }) });
      await page.goto('/aluno/comunidade?mural=alunos');
      const visao = page.getByRole('radiogroup', { name: 'Qual mural' });
      await expect(visao.getByRole('radio', { name: 'Geral' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText('Recado para o time todo.')).toBeVisible();
      // O aluno nunca vê quem está no grupo nem o aviso de menor.
      await expect(page.getByText(AVISO_DE_MENOR)).toHaveCount(0);

      // Geral: a publicação diz para onde vai e sai sem podId.
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      let folha = page.getByRole('dialog', { name: 'Nova publicação' });
      await expect(folha.getByText('Vai para o mural Geral, que todo o time vê.')).toBeVisible();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Para todos');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.filter((p) => foi(p, 'POST', '/aluno/comunidade/mural')).at(-1)?.corpo).toEqual({ tipo: 'CONVERSA', texto: 'Para todos' });
      await expect(folha).toHaveCount(0);

      await visao.getByRole('radio', { name: 'Meu grupo' }).click();
      await expect(page).toHaveURL(/[?&]grupo=meu/);
      // As abas valem dentro de cada mural: trocar o grupo mantém a aba.
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByText(`Grupo ${POD_A.nome}: só quem está nele vê estas publicações.`)).toBeVisible();
      await expect(page.getByText('Recado só da turma das 6h.')).toBeVisible();
      expect(api.pedidos.some((p) => foi(p, 'GET', '/aluno/comunidade/mural') && p.busca.get('podId') === POD_A.id)).toBe(true);
      await expect(page.getByText(/^Grupo: /)).toHaveCount(0);

      await page.getByRole('button', { name: 'Nova publicação' }).click();
      folha = page.getByRole('dialog', { name: 'Nova publicação' });
      await expect(folha.getByText(`Vai para o grupo ${POD_A.nome}: só quem está nele vê.`)).toBeVisible();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Só para a turma');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.filter((p) => foi(p, 'POST', '/aluno/comunidade/mural')).at(-1)?.corpo)
        .toEqual({ tipo: 'CONVERSA', texto: 'Só para a turma', podId: POD_A.id });
      await expect(page.getByText(`Publicado no grupo ${POD_A.nome}.`)).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno tirado do grupo: o 404 do mural do grupo volta ao Geral com aviso', async ({ page }) => {
      let pod: { id: string; nome: string } | null = { id: POD_A.id, nome: POD_A.nome };
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...ALUNO_COMUM,
        'GET /aluno/comunidade/configuracao': (_p, route) => json(route, { alunosPublicam: true, podeAnexarFoto: false, pod }),
        'GET /aluno/comunidade/mural': (p, route) => {
          if (p.busca.has('podId')) { pod = null; return json(route, erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO').corpo, 404); }
          return json(route, doTipo(p, pagina(POST_GERAL)));
        },
      });
      await page.goto('/aluno/comunidade?grupo=meu&mural=alunos');
      await expect(page.getByText('Você não está mais nesse grupo. Mostrando o mural Geral.')).toBeVisible();
      await expect(page.getByText('Recado para o time todo.')).toBeVisible();
      await expect(page).not.toHaveURL(/grupo=meu/);
      await expect(page.getByRole('radiogroup', { name: 'Qual mural' })).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: cria e renomeia grupos, com N de 12 e o aviso de menor', async ({ page }) => {
      const pods = comPods([POD_A]);
      const api = await abrirMuralDaEquipe(page, pods.rotas);
      await page.getByRole('button', { name: 'Gerenciar grupos' }).click();
      const folha = page.getByRole('dialog', { name: 'Configurações do mural' });
      await expect(folha.getByText('5 de 12 alunos')).toBeVisible();
      await expect(folha.getByText(AVISO_DE_MENOR)).toBeVisible();

      // Nome curto: erro no campo, sem pedido.
      await folha.getByRole('textbox', { name: 'Nome do novo grupo' }).fill(' a ');
      await folha.getByRole('button', { name: 'Criar grupo' }).click();
      await expect(folha.getByText('Use de 2 a 40 caracteres.')).toBeVisible();
      expect(api.pedidos.some((p) => foi(p, 'POST', '/comunidade/pods'))).toBe(false);

      // Nome em uso (a API não diferencia caixa): erro no campo.
      await folha.getByRole('textbox', { name: 'Nome do novo grupo' }).fill('turma das 6h');
      await folha.getByRole('button', { name: 'Criar grupo' }).click();
      await expect(folha.getByText('Já existe um grupo com esse nome. Escolha outro.')).toBeVisible();

      await folha.getByRole('textbox', { name: 'Nome do novo grupo' }).fill('  Turma da noite ');
      await folha.getByRole('button', { name: 'Criar grupo' }).click();
      await expect.poll(() => api.pedidos.filter((p) => foi(p, 'POST', '/comunidade/pods')).at(-1)?.corpo).toEqual({ nome: 'Turma da noite' });
      await expect(folha.getByText('Turma da noite', { exact: true })).toBeVisible();
      await expect(folha.getByText('0 de 12 alunos')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Nome do novo grupo' })).toHaveValue('');
      await capturar(page, `treinador-grupos-${largura}`);

      await folha.getByRole('button', { name: 'Renomear o grupo Turma da noite' }).click();
      await folha.getByRole('textbox', { name: 'Novo nome de Turma da noite' }).fill('Turma das 19h');
      await folha.getByRole('button', { name: 'Salvar nome' }).click();
      await expect(folha.getByText('Turma das 19h', { exact: true })).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'PUT' && p.caminho.startsWith('/comunidade/pods/') && (p.corpo as { nome: string }).nome === 'Turma das 19h')).toBe(true);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: filtra o mural por grupo e publica no grupo com o aviso de menor', async ({ page }) => {
      const api = await abrirMuralDaEquipe(page, comPods([POD_A, POD_B]).rotas);
      const mural = page.getByRole('radiogroup', { name: 'Mural' });
      await expect(mural.getByRole('radio', { name: 'Geral' })).toHaveAttribute('aria-checked', 'true');
      await mural.getByRole('radio', { name: POD_A.nome }).click();
      await expect(page.getByText('Recado só da turma das 6h.')).toBeVisible();
      expect(api.pedidos.some((p) => foi(p, 'GET', '/comunidade/mural') && p.busca.get('podId') === POD_A.id)).toBe(true);
      await expect(page.getByText(`Grupo: ${POD_A.nome}`)).toBeVisible();

      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = page.getByRole('dialog', { name: 'Nova publicação' });
      // Geral por padrão, sem aviso; o grupo com menor mostra o aviso.
      await expect(folha.getByRole('radio', { name: 'Geral' })).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByText(AVISO_DE_MENOR)).toHaveCount(0);
      await folha.getByRole('radio', { name: POD_B.nome }).click();
      await expect(folha.getByText(AVISO_DE_MENOR)).toHaveCount(0);
      await folha.getByRole('radio', { name: POD_A.nome }).click();
      await expect(folha.getByText(AVISO_DE_MENOR)).toBeVisible();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Recado da turma');
      await capturar(page, `treinador-publicar-no-grupo-${largura}`);
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foi(p, 'POST', '/comunidade/mural'))?.corpo)
        .toEqual({ tipo: 'CONVERSA', texto: 'Recado da turma', podId: POD_A.id });
      await expect(page.getByText(`Publicado no grupo ${POD_A.nome}.`)).toBeVisible();

      // Só denunciadas vem de todos os grupos: o seletor trava com o motivo e o pedido vai sem podId.
      await page.getByRole('button', { name: /^Filtros, / }).click();
      const painel = page.getByRole('dialog', { name: 'Filtros do mural' });
      await painel.getByRole('checkbox', { name: /Só denunciadas/ }).click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      // Só denunciadas: no lugar da escolha, o motivo (os grupos voltam ao tirar o filtro).
      await expect(page.getByText('As denunciadas vêm de todos os grupos.')).toBeVisible();
      await expect(mural).toHaveCount(0);
      await expect.poll(() => api.pedidos.filter((p) => foi(p, 'GET', '/comunidade/mural')).at(-1)?.busca.toString()).not.toContain('podId');
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: lista de grupos com erro e vazia', async ({ page }) => {
      let falhar = true;
      const api = await abrirMuralDaEquipe(page, {
        'GET /comunidade/pods': (_p, route) => (falhar ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500) : json(route, [])),
      });
      await expect(page.getByRole('radiogroup', { name: 'Mural' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Gerenciar grupos' }).click();
      const folha = page.getByRole('dialog', { name: 'Configurações do mural' });
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await capturar(page, `treinador-grupos-erro-${largura}`);
      falhar = false;
      await folha.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(folha.getByText('Nenhum grupo ainda. Dê um nome acima para criar o primeiro.')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('sem COMUNIDADE_MODERAR: nem grupos no mural nem na ficha', async ({ page }) => {
      const api = await abrirMuralDaEquipe(page, {}, [...PERMISSOES_TREINADOR, 'TREINO_LER']);
      await expect(page.getByRole('button', { name: 'Gerenciar grupos' })).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: 'Mural' })).toHaveCount(0);
      expect(api.pedidos.some((p) => p.caminho === '/comunidade/pods')).toBe(false);

      const ficha = await page.context().newPage();
      await abrirFicha(ficha, {}, FICHA, [...PERMISSOES_TREINADOR, 'TREINO_LER']);
      await expect(ficha.getByText('Grupo da comunidade', { exact: true })).toHaveCount(0);
      await expect(ficha.getByRole('button', { name: /Mudar grupo/ })).toHaveCount(0);
    });

    test('extremos: nove grupos (escolha em folha) e nome de 40 caracteres', async ({ page }) => {
      const LONGO = { id: POD_A.id, nome: 'Turma das seis da manhã do time de corrida'.slice(0, 40) }; // o teto do nome
      const nove: PodResumo[] = [{ ...POD_A, nome: LONGO.nome }, POD_B,
        ...Array.from({ length: 7 }, (_, i) => ({ ...POD_B, id: `d0000000-0000-4000-8000-00000000010${i}`, nome: `Grupo ${i + 3}`, membros: i, temMenor: false }))];

      await simularApi(page, { ...(await sessaoDeAluno(page)), ...ALUNO_COMUM, ...configuracaoDoAluno(LONGO) });
      await page.goto('/aluno/comunidade');
      await page.getByRole('radio', { name: 'Meu grupo' }).click();
      await expect(page.getByText(`Grupo ${LONGO.nome}: só quem está nele vê estas publicações.`)).toBeVisible();
      await capturar(page, `extremo-aluno-nome-longo-${largura}`);

      const equipe = await page.context().newPage();
      await equipe.setViewportSize({ width: largura, height: 900 });
      const api = await abrirMuralDaEquipe(equipe, comPods(nove).rotas);
      // Acima de quatro grupos o seletor do mural vira lista suspensa (D5, 19/11).
      await expect(equipe.getByRole('radiogroup', { name: 'Mural' })).toHaveCount(0);
      await expect(equipe.getByRole('button', { name: 'Mural: Geral. Escolher.' })).toBeVisible();
      await capturar(equipe, `extremo-mural-nove-grupos-${largura}`);
      await equipe.getByRole('button', { name: /^Filtros, / }).click();
      const painel = equipe.getByRole('dialog', { name: 'Filtros do mural' });
      await painel.getByRole('checkbox', { name: /Só denunciadas/ }).click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(equipe.getByText('As denunciadas vêm de todos os grupos.')).toBeVisible();
      await capturar(equipe, `extremo-mural-denunciadas-${largura}`);

      await equipe.getByRole('button', { name: 'Gerenciar grupos' }).click();
      await expect(equipe.getByRole('dialog', { name: 'Configurações do mural' }).getByText(LONGO.nome, { exact: true })).toBeVisible();
      await capturar(equipe, `extremo-folha-grupos-${largura}`);
      expect(api.errosDaPagina).toEqual([]);

      const ficha = await page.context().newPage();
      await ficha.setViewportSize({ width: largura, height: 900 });
      // Um dos nove está cheio: na folha de escolha ele fica desabilitado, com o motivo no lugar do "N de 12".
      const comCheio = nove.map((p, i) => (i === 2 ? { ...p, membros: 12 } : p));
      await abrirFicha(ficha, { 'GET /comunidade/pods': { corpo: comCheio } });
      await ficha.getByRole('button', { name: 'Mudar grupo' }).click();
      const folhaDaFicha = ficha.getByRole('dialog', { name: 'Grupo da comunidade' });
      await expect(folhaDaFicha).toBeVisible();
      await capturar(ficha, `extremo-ficha-nove-grupos-${largura}`);
      await folhaDaFicha.getByRole('button', { name: /^Grupo: / }).click();
      const lista = ficha.getByRole('dialog', { name: 'Grupo', exact: true });
      await expect(lista.getByRole('radio', { name: `${comCheio[2].nome}, Grupo cheio: 12 de 12` })).toBeDisabled();
      await expect(lista.getByRole('radio', { name: `${POD_B.nome}, 11 de 12 alunos` })).toBeEnabled();
      await capturar(ficha, `extremo-ficha-nove-grupos-lista-${largura}`);
    });

    test('ficha: mostra o grupo atual, põe o aluno num grupo com o aviso de menor e trata o POD_CHEIO da corrida', async ({ page }) => {
      // POD_B tem 11 na lista, mas lota antes do salvar: o servidor responde 409 e a lista nova vem com 12.
      let membrosDoB = 11;
      const api = await abrirFicha(page, {
        'GET /comunidade/pods': (_p, route) => json(route, [POD_A, { ...POD_B, membros: membrosDoB }]),
        'PUT /alunos/{id}/pod': (p, route) => {
          if ((p.corpo as { podId: string | null }).podId !== POD_B.id) return route.fulfill({ status: 204 });
          membrosDoB = 12;
          return json(route, erroApi(409, 'Pod cheio.', 'POD_CHEIO').corpo, 409);
        },
      });
      await expect(page.getByText('Sem grupo', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Mudar grupo' }).click();
      const folha = page.getByRole('dialog', { name: 'Grupo da comunidade' });
      // Abre no atual (Sem grupo); salvar só depois de escolher outro.
      await expect(folha.getByRole('radio', { name: 'Sem grupo' })).toHaveAttribute('aria-checked', 'true');
      await expect(folha.getByRole('button', { name: /Salvar grupo/ })).toBeDisabled();

      await folha.getByRole('radio', { name: POD_B.nome }).click();
      await expect(folha.getByText('11 de 12 alunos neste grupo.')).toBeVisible();
      await folha.getByRole('button', { name: /Salvar grupo/ }).click();
      await expect(folha.getByText('Este grupo já tem 12 alunos. Tire alguém dele antes de incluir outro.')).toBeVisible();
      // A lista volta com o B cheio: desabilitado com o motivo, e a escolha volta ao atual.
      await expect(folha.getByRole('radio', { name: POD_B.nome })).toBeDisabled();
      await expect(folha.getByText('Grupo cheio: 12 de 12')).toBeVisible();
      await expect(folha.getByRole('radio', { name: 'Sem grupo' })).toHaveAttribute('aria-checked', 'true');
      await capturar(page, `ficha-grupo-cheio-corrida-${largura}`);

      await folha.getByRole('radio', { name: POD_A.nome }).click();
      await expect(folha.getByText(AVISO_DE_MENOR)).toBeVisible();
      await capturar(page, `ficha-grupo-menor-${largura}`);
      await folha.getByRole('button', { name: /Salvar grupo/ }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText(`Aluno está no grupo ${POD_A.nome}.`)).toBeVisible();
      // A ficha passa a mostrar o grupo novo.
      await expect(page.getByText(`Grupo: ${POD_A.nome}`, { exact: true })).toBeVisible();
      expect(api.pedidos.filter((p) => foi(p, 'PUT', `/alunos/${ALUNO_ID}/pod`)).map((p) => p.corpo)).toEqual([{ podId: POD_B.id }, { podId: POD_A.id }]);

      // Reabre no grupo novo; "Sem grupo" manda null e a ficha volta a "Sem grupo".
      await page.getByRole('button', { name: 'Mudar grupo' }).click();
      const deNovo = page.getByRole('dialog', { name: 'Grupo da comunidade' });
      await expect(deNovo.getByRole('radio', { name: POD_A.nome })).toHaveAttribute('aria-checked', 'true');
      await deNovo.getByRole('radio', { name: 'Sem grupo' }).click();
      await expect(deNovo.getByText('Aluno sai do grupo e passa a ver só o mural Geral.')).toBeVisible();
      await deNovo.getByRole('button', { name: /Salvar grupo/ }).click();
      await expect.poll(() => api.pedidos.filter((p) => foi(p, 'PUT', `/alunos/${ALUNO_ID}/pod`)).at(-1)?.corpo).toEqual({ podId: null });
      await expect(page.getByText('Sem grupo', { exact: true })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('ficha: grupo cheio desabilitado com o motivo, menos o atual do aluno; Sem grupo sempre livre', async ({ page }) => {
      const CHEIO_ATUAL: PodResumo = { ...POD_A, membros: 12 };
      const CHEIO_OUTRO: PodResumo = { ...POD_B, membros: 12 };
      const api = await abrirFicha(page, { 'GET /comunidade/pods': { corpo: [CHEIO_ATUAL, CHEIO_OUTRO] } },
        { ...FICHA, podId: POD_A.id, podNome: POD_A.nome });
      await page.getByText(`Grupo: ${POD_A.nome}`, { exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByText(`Grupo: ${POD_A.nome}`, { exact: true })).toBeVisible();
      await capturar(page, `ficha-linha-do-grupo-${largura}`);
      await page.getByRole('button', { name: 'Mudar grupo' }).click();
      const folha = page.getByRole('dialog', { name: 'Grupo da comunidade' });
      const atual = folha.getByRole('radio', { name: POD_A.nome });
      await expect(atual).toHaveAttribute('aria-checked', 'true');
      await expect(atual).toBeEnabled();
      await expect(folha.getByRole('radio', { name: POD_B.nome })).toBeDisabled();
      await expect(folha.getByText('Grupo cheio: 12 de 12')).toBeVisible();
      await expect(folha.getByRole('radio', { name: 'Sem grupo' })).toBeEnabled();
      await expect(folha.getByText('12 de 12 alunos neste grupo.')).toBeVisible();
      await expect(folha.getByRole('button', { name: /Salvar grupo/ })).toBeDisabled();
      await capturar(page, `ficha-grupo-cheio-${largura}`);
      expect(api.pedidos.some((p) => foi(p, 'PUT', `/alunos/${ALUNO_ID}/pod`))).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('publicar e filtrar não ocupam vaga: o grupo cheio continua escolhível no mural', async ({ page }) => {
      const CHEIO: PodResumo = { ...POD_B, membros: 12 };
      const api = await abrirMuralDaEquipe(page, comPods([POD_A, CHEIO]).rotas);
      const mural = page.getByRole('radiogroup', { name: 'Mural' });
      await expect(mural.getByRole('radio', { name: CHEIO.nome })).toBeEnabled();
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = page.getByRole('dialog', { name: 'Nova publicação' });
      await folha.getByRole('radio', { name: CHEIO.nome }).click();
      await expect(folha.getByRole('radio', { name: CHEIO.nome })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText(/Grupo cheio/)).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('ficha: aluno sem acesso não entra num grupo (botão com o motivo)', async ({ page }) => {
      await abrirFicha(page, {}, { ...FICHA, temAcesso: false, emailDeAcesso: null });
      await expect(page.getByRole('button', { name: /Mudar grupo/ })).toBeDisabled();
      await expect(page.getByText('Só entra num grupo quem já tem acesso ao app.')).toBeVisible();
    });
  });
}

// Capturas das telas novas nos três temas (claro, areia e escuro), nas duas larguras.
for (const largura of [390, 1280]) {
  for (const [nome, id] of TEMAS) {
    test(`capturas ${nome} ${largura} px: Meu grupo do aluno e Grupos da equipe`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await tema(page, ALUNO.id, id);
      await tema(page, TREINADOR.id, id);
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...ALUNO_COMUM, ...configuracaoDoAluno({ id: POD_A.id, nome: POD_A.nome }) });
      await page.goto('/aluno/comunidade?grupo=meu&mural=alunos');
      await expect(page.getByText('Recado só da turma das 6h.')).toBeVisible();
      await capturar(page, `aluno-meu-grupo-${nome}-${largura}`);

      const outra = await page.context().newPage();
      await outra.setViewportSize({ width: largura, height: 900 });
      await tema(outra, TREINADOR.id, id);
      await abrirMuralDaEquipe(outra, comPods([POD_A, POD_B]).rotas);
      await capturar(outra, `treinador-mural-grupos-${nome}-${largura}`);
      await outra.getByRole('button', { name: 'Gerenciar grupos' }).click();
      await expect(outra.getByRole('dialog', { name: 'Configurações do mural' }).getByText(AVISO_DE_MENOR)).toBeVisible();
      await capturar(outra, `treinador-folha-grupos-${nome}-${largura}`);
      await outra.getByRole('dialog', { name: 'Configurações do mural' }).getByRole('button', { name: 'Fechar' }).click();
      await outra.getByRole('button', { name: 'Nova publicação' }).click();
      const nova = outra.getByRole('dialog', { name: 'Nova publicação' });
      await nova.getByRole('radio', { name: POD_A.nome }).click();
      await expect(nova.getByText(AVISO_DE_MENOR)).toBeVisible();
      await capturar(outra, `treinador-publicar-no-grupo-${nome}-${largura}`);

      const ficha = await page.context().newPage();
      await ficha.setViewportSize({ width: largura, height: 900 });
      await tema(ficha, TREINADOR.id, id);
      // O B cheio mostra o desabilitado com o motivo em cada tema.
      await abrirFicha(ficha, { 'GET /comunidade/pods': { corpo: [POD_A, { ...POD_B, membros: 12 }] } });
      await ficha.getByRole('button', { name: 'Mudar grupo' }).click();
      const folhaDaFicha = ficha.getByRole('dialog', { name: 'Grupo da comunidade' });
      await expect(folhaDaFicha.getByText('Grupo cheio: 12 de 12')).toBeVisible();
      await folhaDaFicha.getByRole('radio', { name: POD_A.nome }).click();
      await expect(folhaDaFicha.getByText(AVISO_DE_MENOR)).toBeVisible();
      await capturar(ficha, `ficha-grupo-${nome}-${largura}`);
    });
  }
}
