import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, AlunoResumo, Atualizacao, TagDaConsultoria, TagDeAluno } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Tags de aluno (`docs/planos/tags-de-aluno.md`, passo 4): o campo dos Dados do aluno (chips, sugestões, criar ao digitar,
 * limite de 10, 409 de nome em uso, só leitura sem `ALUNO_ALTERAR`), as tags na linha da lista (2 e "+N"), o seletor no painel
 * "Filtros de alunos" (com o endereço) e a tela "Tags dos alunos" das Configurações. Só dados fictícios; capturas em
 * `CAPTURAS_TAGS` quando a variável existe (fora do repositório).
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000031';
const tag = (n: number, nome: string, cor: TagDeAluno['cor'] = 'AZUL'): TagDeAluno => ({ id: `70000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`, nome, cor });
const ONLINE = tag(1, 'Online', 'CIANO');
const RETORNO = tag(2, 'Retorno', 'VIOLETA');
const PRESENCIAL = tag(3, 'Presencial', 'MAGENTA');
const AVANCADO = tag(4, 'Avançado', 'INDIGO');
const daConsultoria = (t: TagDeAluno, totalAlunos: number, versao = 0): TagDaConsultoria => ({ ...t, totalAlunos, versao });
const CONSULTORIA: TagDaConsultoria[] = [daConsultoria(ONLINE, 3), daConsultoria(RETORNO, 1), daConsultoria(PRESENCIAL, 0), daConsultoria(AVANCADO, 2)];

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: 'Paula Fictícia', email: 'paula@exemplo.test', telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: 'paula@exemplo.test', aguardandoPrimeiroAcesso: false, tags: [ONLINE],
};
const SEM_ATUALIZACAO: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
};
const PERMISSOES = [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'TREINO_LER'];
const SO_LEITURA = PERMISSOES.filter((p) => p !== 'ALUNO_ALTERAR');

/** Tags da consultoria e do aluno que o teste muda (a API falsa guarda o estado como o servidor). */
interface Estado { consultoria: TagDaConsultoria[]; doAluno: TagDeAluno[] }

function rotasDasTags(e: Estado, extra: RespostasApi = {}): RespostasApi {
  return {
    'GET /tags-de-alunos': (_p, r) => json(r, e.consultoria),
    'POST /tags-de-alunos': (p, r) => {
      const { nome, cor } = p.corpo as { nome: string; cor: TagDeAluno['cor'] };
      const nova = daConsultoria(tag(50 + e.consultoria.length, nome, cor), 0);
      e.consultoria = [...e.consultoria, nova];
      return json(r, nova, 201);
    },
    [`PUT /alunos/${ALUNO_ID}/tags`]: (p, r) => {
      const ids = (p.corpo as { tagIds: string[] }).tagIds;
      if (ids.length > 10) return json(r, erroApi(422, 'Confira as tags.', 'TAGS_LIMITE').corpo, 422);
      e.doAluno = ids.map((id) => e.consultoria.find((t) => t.id === id)!).map(({ id, nome, cor }) => ({ id, nome, cor }));
      return json(r, e.doAluno);
    },
    'PUT /tags-de-alunos/{id}': (p, r) => {
      const id = p.caminho.split('/').at(-1)!;
      const c = p.corpo as { nome: string; cor: TagDeAluno['cor']; versao: number };
      const atual = e.consultoria.find((t) => t.id === id)!;
      if (c.versao !== atual.versao) return json(r, erroApi(409, 'A tag mudou.', 'CONFLITO_EDICAO').corpo, 409);
      const nova = { ...atual, nome: c.nome, cor: c.cor, versao: atual.versao + 1 };
      e.consultoria = e.consultoria.map((t) => (t.id === id ? nova : t));
      return json(r, nova);
    },
    'DELETE /tags-de-alunos/{id}': (p, r) => {
      const id = p.caminho.split('/').at(-1)!;
      e.consultoria = e.consultoria.filter((t) => t.id !== id);
      return r.fulfill({ status: 204 });
    },
    ...extra,
  };
}

async function preparar(page: Page, o: { largura: number; tema?: string; permissoes?: string[]; ficha?: AlunoDetalhe; alunos?: AlunoResumo[]; rotas?: RespostasApi }) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema ?? 'CLARO']);
  await page.setViewportSize({ width: o.largura, height: 900 });
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /questionarios/opcoes': { corpo: [] },
    'GET /alunos': { corpo: { itens: o.alunos ?? [], total: (o.alunos ?? []).length } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: o.ficha ?? FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    ...o.rotas,
  });
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_TAGS;
  if (pasta) await page.screenshot({ path: `${pasta}/tags-${nome}.png`, fullPage: false });
}

const campo = (page: Page) => page.getByRole('combobox', { name: 'Adicionar tag ao aluno' });
const sugestoes = (page: Page) => page.getByRole('listbox', { name: 'Sugestões de tags' });
const linhaDasTags = (page: Page) => page.getByLabel(/^Tags: /);

async function abrirFicha(page: Page) {
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  await expect(page.getByRole('heading', { level: 1, name: FICHA.nome })).toBeVisible();
}

async function editar(page: Page) {
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await expect(campo(page)).toBeVisible();
  await campo(page).scrollIntoViewIfNeeded();
}

for (const largura of [1280, 390]) {
  test.describe(`${largura} px`, () => {
    test('Dados do aluno: chips na leitura; na edição sugere, cria ao digitar e remove pelo botão', async ({ page }) => {
      const e: Estado = { consultoria: [...CONSULTORIA], doAluno: [ONLINE] };
      const { pedidos, errosDaPagina } = await preparar(page, { largura, rotas: rotasDasTags(e) });
      await abrirFicha(page);
      await expect(linhaDasTags(page)).toHaveAttribute('aria-label', 'Tags: Online');
      await capturar(page, `ficha-leitura-${largura}-claro`);
      // A leitura não busca a lista da consultoria.
      expect(pedidos.filter((p) => p.caminho === '/tags-de-alunos')).toHaveLength(0);

      await editar(page);
      await expect(page.getByText('Rótulos só da equipe: o aluno não vê. Não use para saúde.')).toBeVisible();
      await campo(page).click();
      // Sugestões: as da consultoria que o aluno ainda não tem.
      await expect(sugestoes(page).getByRole('option')).toHaveText(['Retorno', 'Presencial', 'Avançado']);
      await capturar(page, `ficha-sugestoes-${largura}-claro`);

      // Backspace no campo vazio não apaga nenhuma tag.
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);

      // Setas andam nas sugestões e o Enter escolhe a destacada.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Remover tag Presencial' })).toBeVisible();
      expect(pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo).toEqual({ tagIds: [ONLINE.id, PRESENCIAL.id] });

      // Digitar um nome novo: "Criar tag" e o Enter cria com a cor padrão e põe no aluno.
      await campo(page).fill('Manhã');
      await expect(sugestoes(page).getByRole('option', { name: 'Criar tag “Manhã”' })).toBeVisible();
      await campo(page).press('Enter');
      await expect(page.getByRole('button', { name: 'Remover tag Manhã' })).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/tags-de-alunos')!.corpo).toEqual({ nome: 'Manhã', cor: 'AZUL' });
      expect((pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { tagIds: string[] }).tagIds).toHaveLength(3);
      await expect(campo(page)).toHaveValue('');

      // O nome de uma tag que já existe (sem acento e caixa) usa a existente, sem criar outra.
      await campo(page).fill('AVANCADO');
      await expect(sugestoes(page).getByRole('option')).toHaveText(['Avançado']);
      await campo(page).press('Enter');
      await expect(page.getByRole('button', { name: 'Remover tag Avançado' })).toBeVisible();
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/tags-de-alunos')).toHaveLength(1);

      // Remover pelo botão (alvo de 44 px): espera a resposta, sem otimismo.
      const remover = page.getByRole('button', { name: 'Remover tag Online' });
      const alvo = (await remover.boundingBox())!;
      expect([Math.round(alvo.width), Math.round(alvo.height)]).toEqual([44, 44]);
      await remover.click();
      await expect(remover).toHaveCount(0);
      expect(e.doAluno.map((t) => t.nome)).toEqual(['Presencial', 'Manhã', 'Avançado']);

      // Esc fecha só a lista.
      await campo(page).click();
      await expect(sugestoes(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sugestoes(page)).toHaveCount(0);
      await expect(campo(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });

    test('Dados do aluno: 409 de nome em uso recarrega a lista e usa a tag existente; limite de 10 trava o campo', async ({ page }) => {
      // Outra pessoa criou "Noite" agora: o POST dá 409 e a lista nova já a traz.
      const noite = daConsultoria(tag(9, 'Noite', 'CIANO'), 1);
      const e: Estado = { consultoria: [...CONSULTORIA], doAluno: [ONLINE] };
      let listas = 0;
      const { pedidos } = await preparar(page, {
        largura, tema: 'ESCURO',
        rotas: rotasDasTags(e, {
          'GET /tags-de-alunos': (_p, r) => { listas += 1; return json(r, listas > 1 ? [...e.consultoria, noite] : e.consultoria); },
          'POST /tags-de-alunos': (_p, r) => { e.consultoria = [...e.consultoria, noite]; return json(r, erroApi(409, 'Nome em uso.', 'TAG_NOME_EM_USO').corpo, 409); },
        }),
      });
      await abrirFicha(page);
      await editar(page);
      await campo(page).fill('noite');
      await campo(page).press('Enter');
      await expect(page.getByRole('button', { name: 'Remover tag Noite' })).toBeVisible();
      expect(pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo).toEqual({ tagIds: [ONLINE.id, noite.id] });

      // Dez tags: o campo trava com a mensagem e as sugestões somem.
      const dez = Array.from({ length: 8 }, (_, i) => daConsultoria(tag(20 + i, `Grupo ${i + 1}`), 1));
      e.consultoria = [...e.consultoria, ...dez];
      for (const t of dez) {
        await campo(page).fill(t.nome);
        await campo(page).press('Enter');
        await expect(page.getByRole('button', { name: `Remover tag ${t.nome}` })).toBeVisible();
      }
      await expect(page.getByText('O aluno pode ter até 10 tags. Remova uma para adicionar outra.')).toBeVisible();
      // No limite o campo sai (a frase diz o porquê); remover uma o traz de volta.
      await expect(campo(page)).toHaveCount(0);
      await capturar(page, `ficha-limite-${largura}-escuro`);
      await page.getByRole('button', { name: 'Remover tag Grupo 8' }).click();
      await expect(campo(page)).toBeVisible();
    });

    test('sem ALUNO_ALTERAR: chips só de leitura, nenhum campo e nenhuma busca da lista; sem tags, a linha some', async ({ page }) => {
      const { pedidos } = await preparar(page, { largura, permissoes: SO_LEITURA, ficha: { ...FICHA, tags: [ONLINE, RETORNO] } });
      await abrirFicha(page);
      await expect(linhaDasTags(page)).toHaveAttribute('aria-label', 'Tags: Online, Retorno');
      await expect(page.getByRole('button', { name: 'Editar dados', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Remover tag/ })).toHaveCount(0);
      expect(pedidos.filter((p) => p.caminho === '/tags-de-alunos')).toHaveLength(0);

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await preparar(page, { largura, permissoes: SO_LEITURA, ficha: { ...FICHA, tags: [] } });
      await abrirFicha(page);
      await expect(page.getByText('Treinador responsável', { exact: true })).toBeVisible();
      await expect(linhaDasTags(page)).toHaveCount(0);
    });

    test('lista: duas tags e "+N" na linha, com o nome acessível; o painel filtra por tags e vai ao endereço', async ({ page }) => {
      const alunos: AlunoResumo[] = [
        { id: ALUNO_ID, nome: 'Paula Fictícia', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: TREINADOR.id, atualizacao: null, tags: [ONLINE, RETORNO, PRESENCIAL, AVANCADO] },
        { id: 'a0000000-0000-4000-8000-000000000032', nome: 'Rui Exemplo', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null, atualizacao: null },
      ];
      const e: Estado = { consultoria: [...CONSULTORIA], doAluno: [] };
      const { pedidos, errosDaPagina } = await preparar(page, { largura, alunos, rotas: rotasDasTags(e) });
      await page.goto('/treinador/alunos');
      const link = page.getByRole('link', { name: /^Abrir Paula Fictícia/ });
      await expect(link).toHaveAttribute('aria-label', /Tags: Online, Retorno e mais 2/);
      await expect(page.getByText('+2', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Abrir Rui Exemplo/ })).not.toHaveAttribute('aria-label', /Tags:/);
      await capturar(page, `lista-${largura}-claro`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.getByRole('button', { name: /^Filtros, / }).click();
      const painel = page.getByRole('dialog', { name: 'Filtros de alunos' });
      await expect(painel).toBeVisible();
      await painel.getByRole('button', { name: 'Tags: Qualquer. Escolher.' }).click();
      const lista = page.getByRole('dialog', { name: 'Tags' });
      await lista.getByRole('checkbox', { name: 'Online', exact: true }).click();
      await lista.getByRole('checkbox', { name: 'Retorno', exact: true }).click();
      await capturar(page, `painel-tags-${largura}-claro`);
      await page.keyboard.press('Escape');
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(page).toHaveURL(new RegExp(`tag=${ONLINE.id}(%2C|,)${RETORNO.id}`));
      await expect(page.getByText('Tags: Online, Retorno')).toBeVisible();
      await expect.poll(() => pedidos.filter((p) => p.caminho === '/alunos').at(-1)!.busca.getAll('tag')).toEqual([ONLINE.id, RETORNO.id]);
      expect(errosDaPagina).toEqual([]);
    });

    test('lista: a lista de tags falha, a de alunos segue e o painel avisa no lugar do seletor', async ({ page }) => {
      await preparar(page, {
        largura, tema: 'ESCURO',
        alunos: [{ id: ALUNO_ID, nome: 'Paula Fictícia', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null, atualizacao: null, tags: [ONLINE] }],
        rotas: { 'GET /tags-de-alunos': erroApi(500, 'Falhou.') },
      });
      await page.goto(`/treinador/alunos?tag=${ONLINE.id}`);
      await expect(page.getByRole('link', { name: /^Abrir Paula Fictícia/ })).toBeVisible();
      // Id que a tela não conhece vira "Outra tag".
      await expect(page.getByText('Tags: Outra tag')).toBeVisible();
      await page.getByRole('button', { name: /^Filtros, / }).click();
      const painel = page.getByRole('dialog', { name: 'Filtros de alunos' });
      await expect(painel.getByText('Não foi possível carregar as tags para filtrar.')).toBeVisible();
      await expect(painel.getByRole('button', { name: /^Tags: / })).toHaveCount(0);
      await capturar(page, `painel-falha-${largura}-escuro`);
    });

    test('Configurações › Tags dos alunos: renomear, trocar a cor e apagar com a contagem; 409 recarrega', async ({ page }) => {
      const e: Estado = { consultoria: [...CONSULTORIA], doAluno: [] };
      const { pedidos, errosDaPagina } = await preparar(page, { largura, rotas: rotasDasTags(e) });
      await page.goto('/treinador/configuracoes');
      await page.getByRole('link', { name: /Tags dos alunos/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Tags dos alunos' })).toBeVisible();
      await expect(page.getByText('Ciano · 3 alunos')).toBeVisible();
      await expect(page.getByText('Magenta · Nenhum aluno')).toBeVisible();
      await capturar(page, `configuracoes-${largura}-claro`);

      // Renomear e trocar a cor na linha, com a versão lida.
      await page.getByRole('button', { name: 'Editar tag Online' }).click();
      await expect(page.getByText('A tag está em 3 alunos; a mudança vale em todos.')).toBeVisible();
      await page.getByRole('textbox', { name: 'Nome da tag Online' }).fill('Online ao vivo');
      // A linha em edição vem antes do cartão "Nova tag", que também tem a escolha da cor.
      await page.getByRole('radio', { name: 'Violeta' }).first().click();
      await page.waitForTimeout(400);
      await capturar(page, `configuracoes-editar-${largura}-claro`);
      await page.getByRole('button', { name: 'Salvar tag' }).click();
      await expect(page.getByText('Violeta · 3 alunos')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'PUT')!.corpo).toEqual({ nome: 'Online ao vivo', cor: 'VIOLETA', versao: 0 });

      // Apagar: o painel diz em quantos alunos ela está.
      await page.getByRole('button', { name: 'Apagar tag Avançado' }).click();
      await expect(page.getByText('A tag está em 2 alunos; ao apagar, sai de todos. Não dá para desfazer.')).toBeVisible();
      await capturar(page, `configuracoes-apagar-${largura}-claro`);
      await page.getByRole('button', { name: 'Apagar tag', exact: true }).click();
      await expect(page.getByText('Índigo · 2 alunos')).toHaveCount(0);
      const apagou = pedidos.find((p) => p.metodo === 'DELETE')!;
      expect([apagou.caminho, apagou.busca.get('versao')]).toEqual([`/tags-de-alunos/${AVANCADO.id}`, '0']);

      // Criar uma tag nova; nome repetido é recusado antes de ir à API.
      await page.getByRole('textbox', { name: 'Nome da nova tag' }).fill('retorno');
      await page.getByRole('button', { name: 'Criar tag', exact: true }).click();
      await expect(page.getByText('Já existe uma tag com esse nome.')).toBeVisible();
      await page.getByRole('textbox', { name: 'Nome da nova tag' }).fill('Tarde');
      await page.getByRole('button', { name: 'Criar tag', exact: true }).click();
      await expect(page.getByText('Azul · Nenhum aluno')).toBeVisible();

      // Outra pessoa mudou a tag: 409, a lista volta e o aviso fica no topo.
      e.consultoria = e.consultoria.map((t) => (t.id === RETORNO.id ? { ...t, versao: 5 } : t));
      await page.getByRole('button', { name: 'Editar tag Retorno' }).click();
      await page.getByRole('textbox', { name: 'Nome da tag Retorno' }).fill('Retorno 2');
      await page.getByRole('button', { name: 'Salvar tag' }).click();
      await expect(page.getByText('A tag mudou enquanto você editava. Confira e tente de novo.')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Nome da tag Retorno' })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('tema escuro: ficha (leitura e sugestões), lista com +N, painel e Configurações com o painel de apagar', async ({ page }) => {
      const e: Estado = { consultoria: [...CONSULTORIA], doAluno: [ONLINE, RETORNO] };
      const alunos: AlunoResumo[] = [{ id: ALUNO_ID, nome: 'Paula Fictícia', ativo: true, temAcesso: false, planoAtivo: null, ultimoRegistro: null, responsavelId: TREINADOR.id, atualizacao: null, tags: [ONLINE, RETORNO, PRESENCIAL] }];
      const { errosDaPagina } = await preparar(page, { largura, tema: 'ESCURO', alunos, ficha: { ...FICHA, tags: [ONLINE, RETORNO] }, rotas: rotasDasTags(e) });
      await abrirFicha(page);
      await linhaDasTags(page).scrollIntoViewIfNeeded();
      await capturar(page, `ficha-leitura-${largura}-escuro`);
      await editar(page);
      await campo(page).fill('pre');
      await expect(sugestoes(page).getByRole('option')).toHaveText(['Presencial', 'Criar tag “pre”']);
      await capturar(page, `ficha-sugestoes-${largura}-escuro`);
      await page.keyboard.press('Escape');
      await capturar(page, `ficha-edicao-${largura}-escuro`);

      await page.goto('/treinador/alunos');
      await expect(page.getByText('+1', { exact: true })).toBeVisible();
      await capturar(page, `lista-${largura}-escuro`);
      await page.getByRole('button', { name: /^Filtros, / }).click();
      await expect(page.getByRole('dialog', { name: 'Filtros de alunos' }).getByRole('button', { name: 'Tags: Qualquer. Escolher.' })).toBeVisible();
      await capturar(page, `painel-${largura}-escuro`);

      await page.goto('/treinador/alunos/tags');
      await expect(page.getByText('Ciano · 3 alunos')).toBeVisible();
      await capturar(page, `configuracoes-${largura}-escuro`);
      // Trocar a cor no "Nova tag" (fora da linha); a captura espera a transição do fundo de seleção (150 ms) terminar.
      const magenta = page.getByRole('radio', { name: 'Magenta' }).last();
      await magenta.click();
      await expect(magenta).toHaveAttribute('aria-checked', 'true');
      await page.waitForTimeout(400);
      await capturar(page, `configuracoes-nova-cor-${largura}-escuro`);
      await page.getByRole('button', { name: 'Apagar tag Retorno' }).click();
      await expect(page.getByText('A tag está em 1 aluno; ao apagar, sai dele. Não dá para desfazer.')).toBeVisible();
      await capturar(page, `configuracoes-apagar-${largura}-escuro`);
      expect(errosDaPagina).toEqual([]);
    });

    test('Configurações › Tags dos alunos: vazio e só leitura sem ALUNO_ALTERAR', async ({ page }) => {
      await preparar(page, { largura, tema: 'ESCURO', permissoes: SO_LEITURA, rotas: { 'GET /tags-de-alunos': { corpo: [] } } });
      await page.goto('/treinador/alunos/tags');
      await expect(page.getByRole('heading', { level: 1, name: 'Tags dos alunos' })).toBeVisible();
      await expect(page.getByText('A equipe ainda não criou tags para os alunos.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar tag' })).toHaveCount(0);
      await capturar(page, `configuracoes-vazio-${largura}-escuro`);
    });
  });
}
