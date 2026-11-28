import { expect, test, type Page } from '@playwright/test';

import type { ConfirmacaoResultado, GrupoImportavel, SessaoDetalhe, SessaoListaItem } from '../src/servicos/importacaoAssistida';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Importação assistida (texto colado → ler → conferir → escolher → gravar rascunhos), com a API simulada e só dados fictícios.
 * Confere o destino numa escolha só (aluno parecido, criar novo, modelo, ignorar), o aluno parecido que precisa de
 * resposta, a seleção explícita ("Incluir na gravação") com a prévia (`hashPrevia`) e a chave de idempotência no corpo,
 * o resultado com erro e o "tentar de novo" só dos grupos com erro, as linhas resumidas (importado, ignorado, erro),
 * o "—" sem permissão de ler, a opção desabilitada com motivo sem permissão de alterar, e os 409/403 do gravar.
 */
const BASE = '/importacoes/assistidas/sessoes';
const TODAS = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', 'PASTA_ALTERAR', 'MODELO_ALTERAR'];

const grupo = (id: string, nome: string, estado: GrupoImportavel['estado'], extra: Partial<GrupoImportavel> = {}): GrupoImportavel => ({
  id, identificadorOrigem: id, nomeDetectado: nome, destino: 'CRIAR_ALUNO', arquivosOrigem: ['Mensagens de teste'],
  cadastro: { nome, email: `${id}@exemplo.test` }, pesos: [], treino: null, dieta: null, pendenciasIds: [], estado, candidatos: [],
  erroCodigo: null, ...extra,
});
/** Esqueleto que a API devolve do grupo já gravado ou descartado: sem nome nem dados. */
const esqueleto = (id: string, estado: 'IMPORTADO' | 'IGNORADO', destino: GrupoImportavel['destino']): GrupoImportavel => ({
  id, identificadorOrigem: '', nomeDetectado: 'Importado', destino, arquivosOrigem: [], cadastro: null, pesos: [], treino: null,
  dieta: null, pendenciasIds: [], estado, erroCodigo: null, candidatos: [],
});

const recebendo: SessaoDetalhe = {
  id: 's1', estado: 'RECEBENDO', revisao: 1,
  arquivos: [{ id: 'f1', nomeOriginal: 'Mensagens de teste', formato: 'TEXTO', tamanhoBytes: 40, estado: 'RECEBIDO', criadoEm: '2026-10-19T12:00:00Z' }],
  grupos: [], duvidas: [], criadoEm: '2026-10-19T12:00:00Z', expiraEm: '2026-10-20T12:00:00Z',
  modoProcessamento: { modoEfetivo: 'REGRAS', fallbackParaRegras: false },
};
const revisando: SessaoDetalhe = {
  ...recebendo, estado: 'REVISANDO', revisao: 2, hashPrevia: 'h2',
  // Lido: nenhum arquivo pendente (com um RECEBIDO a revisão ofereceria "Ler os arquivos" de novo, 2.1).
  arquivos: recebendo.arquivos.map((a) => ({ ...a, estado: 'PROCESSADO', modo: 'REGRAS', motivoFallback: 'ENVIO_DESLIGADO' })),
  grupos: [
    grupo('g1', 'Aluna Fictícia', 'PRONTO', { treino: { sessoes: [{}, {}] }, pesos: [{ data: '2026-10-01', kg: 70 }, { data: '', kg: 71 }] }),
    grupo('g2', 'Aluno Fictício', 'COM_DUVIDAS', { candidatos: [{ alunoId: 'a1', nome: 'Aluno Fictício', motivo: 'NOME' }] }),
    grupo('g3', 'Modelo de Teste', 'PRONTO', { destino: 'IGNORAR' }),
    // O aluno vinculado foi anonimizado com a sessão aberta: a API o devolve ignorado, só o esqueleto.
    esqueleto('g4', 'IGNORADO', 'IGNORAR'),
  ],
  duvidas: [{
    id: 'd1', tipo: 'EXERCICIO_NAO_RECONHECIDO', termoOriginal: 'sup inc', trechoOriginal: 'sup inc 4x10', arquivoOrigem: 'Mensagens de teste',
    ocorrencias: 1, sugestoes: [{ termo: 'Supino inclinado', origem: 'CATALOGO', nota: 0.9 }], resolvida: false,
  }],
};
/** Termo em branco ou só pontuação (escapou do filtro da API) e um termo de verdade com o trecho em branco. */
const comTermosVazios: SessaoDetalhe = {
  ...revisando,
  duvidas: [
    ...revisando.duvidas,
    { ...revisando.duvidas[0], id: 'd2', termoOriginal: '', trechoOriginal: '' },
    { ...revisando.duvidas[0], id: 'd3', termoOriginal: '  ', trechoOriginal: '  ' },
    { ...revisando.duvidas[0], id: 'd4', termoOriginal: '"" .', trechoOriginal: '""' },
    { ...revisando.duvidas[0], id: 'd5', tipo: 'ALIMENTO_NAO_RECONHECIDO', termoOriginal: 'whey iso', trechoOriginal: ' ', sugestoes: [], ocorrencias: 3 },
  ],
};

const resultado = (extra: Partial<ConfirmacaoResultado>): ConfirmacaoResultado => ({
  id: 's1', situacao: 'CONCLUIDA', gruposImportados: 0, alunosCriados: 0, alunosVinculados: 0, treinosCriados: 0, dietasCriadas: 0,
  modelosCriados: 0, gruposComErro: 0, pesosGravados: 0, pesosIgnorados: 0, ...extra,
});

const CAPTURAS = process.env.CAPTURAS_DIR;
/** A rolagem da tela é interna (o `fullPage` só pega a janela): estica a altura para a captura e volta ao tamanho do teste. */
async function capturar(page: Page, nome: string) {
  if (!CAPTURAS) return;
  const janela = page.viewportSize();
  if (janela) await page.setViewportSize({ width: janela.width, height: 2600 });
  await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
  if (janela) await page.setViewportSize(janela);
}

/**
 * Sessão simulada que muda como a API: ler → revisando; PUT do grupo troca destino e aluno e sobe a revisão; o primeiro
 * gravar deixa g1 importado e g2 com erro; o segundo (só g2) conclui a sessão. `confirmar` troca a resposta do gravar.
 */
async function abrir(page: Page, { tema = 'CLARO', contraste = 'PADRAO', permissoes = TODAS, confirmar, lida = revisando, inicial = recebendo, atrasoDoGet = 0, abertas = [], arquivo, getFalhaDepoisDe }: {
  tema?: string; contraste?: string; permissoes?: string[]; confirmar?: RespostasApi[string]; lida?: SessaoDetalhe;
  /** Importações em aberto que o `GET` da lista devolve (as descartadas saem dela). */
  abertas?: SessaoListaItem[];
  /** Resposta do envio de cada arquivo (padrão: aceito). */
  arquivo?: RespostasApi[string];
  /** Sessão que o GET devolve antes de ler (a retomada pelo endereço, `?sessaoId=s1`). */
  inicial?: SessaoDetalhe;
  /** Espera (ms) no GET da sessão, para teclar antes de ela chegar. */
  atrasoDoGet?: number;
  /** Depois de tantos GET da sessão bem-sucedidos, os seguintes dão 500 (a espera da leitura, 2.6). */
  getFalhaDepoisDe?: number;
} = {}) {
  await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [TREINADOR.id, tema, contraste]);
  let atual = inicial;
  let lista = abertas;
  let gravacoes = 0;
  let leituras = 0;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    [`POST ${BASE}`]: { corpo: { ...recebendo, arquivos: [] } },
    [`POST ${BASE}/{id}/textos`]: { corpo: recebendo.arquivos[0] },
    [`GET ${BASE}`]: (_p, route) => json(route, lista),
    [`POST ${BASE}/{id}/arquivos`]: arquivo ?? { corpo: recebendo.arquivos[0] },
    [`GET ${BASE}/{id}`]: async (_p, route) => {
      if (atrasoDoGet) await new Promise((r) => setTimeout(r, atrasoDoGet));
      leituras++;
      if (getFalhaDepoisDe !== undefined && leituras > getFalhaDepoisDe) return json(route, erroApi(500, 'Falha.', 'ERRO_INTERNO').corpo, 500);
      return json(route, atual);
    },
    [`POST ${BASE}/{id}/cancelar`]: (p, route) => {
      const id = p.caminho.split('/')[4];
      lista = lista.filter((l) => l.id !== id);
      return json(route, { ...atual, estado: 'CANCELADA' });
    },
    [`POST ${BASE}/{id}/processar`]: (_p, route) => { atual = lida; return json(route, atual); },
    [`POST ${BASE}/{id}/respostas`]: (p, route) => {
      const { duvidaId, respostaEscolhida } = p.corpo as { duvidaId: string; respostaEscolhida: string };
      atual = { ...atual, revisao: atual.revisao + 1, duvidas: atual.duvidas.map((d) => (d.id === duvidaId ? { ...d, resolvida: true, respostaEscolhida: respostaEscolhida } : d)) };
      return json(route, atual);
    },
    [`PUT ${BASE}/{id}/grupos/{g}`]: (p, route) => {
      const { destino, alunoExistenteId, nome, email, telefone } = p.corpo as { destino?: GrupoImportavel['destino']; alunoExistenteId?: string; nome?: string; email?: string; telefone?: string };
      const id = p.caminho.split('/').pop();
      const revisao = atual.revisao + 1;
      // Só troca o que veio no corpo: o destino ou o cadastro (2.2).
      atual = { ...atual, revisao, hashPrevia: `h${revisao}`, grupos: atual.grupos.map((g) => (g.id !== id ? g : {
        ...g,
        ...(destino ? { destino, alunoExistenteId: alunoExistenteId ?? null } : {}),
        // Como a API: nome digitado num grupo sem nome lido vira DIGITADO (destrava o "Gravar").
        ...(nome && g.origemDoNome !== 'CONTEUDO' ? { origemDoNome: 'DIGITADO' as const, nomeDetectado: nome } : {}),
        cadastro: { nome: nome ?? g.cadastro?.nome ?? g.nomeDetectado, email: email ?? g.cadastro?.email, telefone: telefone ?? g.cadastro?.telefone },
      })) };
      return json(route, atual);
    },
    [`POST ${BASE}/{id}/grupos/{g}/juntar`]: (p, route) => {
      const { comGrupoId, comGruposIds } = p.corpo as { comGrupoId?: string; comGruposIds?: string[] };
      const saem = comGruposIds ?? [comGrupoId];
      atual = { ...atual, revisao: atual.revisao + 1, grupos: atual.grupos.filter((g) => !saem.includes(g.id)).map((g) => ({ ...g, possivelMesmoAluno: false, possiveisParceiros: [] })) };
      return json(route, atual);
    },
    [`POST ${BASE}/{id}/confirmar`]: confirmar ?? ((_p, route) => {
      gravacoes++;
      if (gravacoes === 1) {
        atual = { ...atual, revisao: atual.revisao + 1, hashPrevia: `h${atual.revisao + 1}`, grupos: [
          esqueleto('g1', 'IMPORTADO', 'CRIAR_ALUNO'),
          { ...atual.grupos[1], estado: 'ERRO', erroCodigo: 'ALUNO_INATIVO' },
          atual.grupos[2],
          atual.grupos[3],
        ] };
        return json(route, resultado({ situacao: 'CONCLUIDA_COM_ERROS', gruposImportados: 1, alunosCriados: 1, treinosCriados: 1, gruposComErro: 1, pesosGravados: 1, pesosIgnorados: 1 }));
      }
      atual = { ...atual, estado: 'CONCLUIDA', duvidas: [], grupos: [
        esqueleto('g1', 'IMPORTADO', 'CRIAR_ALUNO'), esqueleto('g2', 'IMPORTADO', 'VINCULAR_EXISTENTE'), esqueleto('g3', 'IGNORADO', 'IGNORAR'),
      ] };
      return json(route, resultado({ gruposImportados: 1, alunosVinculados: 1, alunos: [{ alunoId: 'a1', nome: 'Aluno Fictício', criado: false, pastaId: 'p1', treinoId: 't9', dietaId: null }] }));
    }),
  });
  return api;
}

async function colarELer(page: Page) {
  await page.goto('/treinador/importacao/assistida');
  await expect(page.getByRole('heading', { name: 'Enviar arquivos ou texto' })).toBeVisible();
  await page.getByRole('button', { name: 'Colar texto' }).click();
  const adicionar = page.getByRole('button', { name: 'Adicionar o texto' });
  await expect(adicionar).toBeDisabled();
  await expect(page.getByText('Cole o texto antes de adicionar.')).toBeVisible();
  // 2.2: o título virou o nome do aluno, sem valor padrão.
  await expect(page.getByRole('textbox', { name: 'Nome do aluno (se o texto é de um aluno só)' })).toHaveValue('');
  await page.getByRole('textbox', { name: /^Texto colado/ }).fill('Aluno de teste\nTreino A\nsup inc 4x10');
  await adicionar.click();
  await expect(page.getByText('Recebendo arquivos · 1 arquivo ou texto')).toBeVisible();
  // 2.6: a sessão fica no endereço.
  await expect(page).toHaveURL(/sessaoId=s1/);
}

async function lerEConferir(page: Page) {
  await colarELer(page);
  await page.getByRole('button', { name: 'Ler os arquivos' }).click();
  await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();
  // 2.8: o modo da leitura numa frase, sem falar de servidor.
  await expect(page.getByText('Em revisão · 1 arquivo ou texto · Lido sem IA')).toBeVisible();
}

const corpoDoGravar = (api: Awaited<ReturnType<typeof abrir>>) =>
  api.pedidos.filter((p) => p.caminho === `${BASE}/s1/confirmar`).map((p) => p.corpo as { gruposIds: string[]; revisaoEsperada: number; hashPrevia: string; chaveIdempotencia: string });

/** Deixa marcado "Incluir na gravação" dos alunos pendentes que têm a caixa (o ignorado não tem); os prontos já vêm marcados. */
async function incluirNaGravacao(page: Page, quantos: number) {
  const caixas = page.getByRole('checkbox', { name: 'Incluir na gravação' });
  await expect(caixas).toHaveCount(quantos);
  for (let i = 0; i < quantos; i++) {
    if (!(await caixas.nth(i).isChecked())) await caixas.nth(i).click();
    await expect(caixas.nth(i)).toBeChecked();
  }
}
const gravar = (page: Page) => page.getByRole('button', { name: /^Gravar selecionados/ });

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('escolher o aluno parecido, gravar com erro e tentar de novo só o que deu erro', async ({ page }) => {
      const api = await abrir(page);
      await colarELer(page);
      await capturar(page, `importacao-recebendo-${largura}`);
      await page.getByRole('button', { name: 'Ler os arquivos' }).click();

      await expect(page.getByText('Exercício não reconhecido')).toBeVisible();
      await expect(page.getByText('Treino: 2 divisões')).toBeVisible();
      await expect(page.getByText('Peso: 2 pesagens')).toBeVisible();
      await expect(page.getByText('Dieta: —').first()).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Criar aluno novo' }).first()).toBeChecked();
      // Grupo que a API devolveu ignorado: linha resumida, selo neutro e nenhuma escolha de destino.
      await expect(page.getByText('Não gravado', { exact: true })).toBeVisible();
      await expect(page.getByText('Ignorado', { exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Ignorar' })).toHaveCount(3);
      // Aluno parecido: nada marcado. Sem seleção o gravar pede escolher; com o grupo incluído, espera a resposta.
      await expect(page.getByText(/Já existe aluno cadastrado parecido/)).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' })).not.toBeChecked();
      // 2.7: a seleção nasce com os prontos (g1) e a frase diz o que a gravação vai fazer; o parecido (g2) não vem marcado.
      const caixas = page.getByRole('checkbox', { name: 'Incluir na gravação' });
      await expect(caixas.nth(0)).toBeChecked();
      await expect(caixas.nth(1)).not.toBeChecked();
      await expect(page.getByText('Vai criar 1 aluno novo.')).toBeVisible();
      await expect(gravar(page)).toBeEnabled();
      // Os alunos com destino Ignorar não têm a caixa: só g1 e g2.
      await incluirNaGravacao(page, 2);
      await expect(gravar(page)).toBeDisabled();
      await expect(page.getByText('Diga se Aluno Fictício é um aluno já cadastrado ou um aluno novo.')).toBeVisible();
      await capturar(page, `importacao-revisando-${largura}`);

      await page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' }).click();
      await expect(page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' })).toBeChecked();
      const put = api.pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `${BASE}/s1/grupos/g2`);
      expect(put?.corpo).toEqual({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' });
      await expect(page.getByText(/Já existe aluno cadastrado parecido/)).toHaveCount(0);

      await expect(gravar(page)).toBeEnabled();
      await gravar(page).click();
      // O resultado aparece onde a pessoa tocou, não no topo da página.
      await expect(page.getByText('Importação gravada em parte')).toBeInViewport();
      await expect(page.getByText('1 aluno não foi gravado. O motivo aparece em cada um, na lista acima.')).toBeVisible();
      await expect(page.getByText('1 peso não gravado: sem data legível, fora da faixa ou já registrado nessa data')).toBeVisible();
      await expect(page.getByText('Aluno novo criado')).toBeVisible();
      await expect(page.getByText('Importado', { exact: true })).toBeVisible();
      await expect(page.getByText('Com erro', { exact: true })).toBeVisible();
      // 2.3: o aluno com erro continua um cartão editável, com o motivo no topo e o destino.
      await expect(page.getByText('Não foi gravado: O aluno escolhido está inativo. Reative-o na ficha antes de tentar de novo.')).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Ignorar' })).toHaveCount(2);
      // Gravou só os incluídos, com a revisão e a prévia que a tela tinha e uma chave de idempotência.
      expect(corpoDoGravar(api)[0]).toEqual({ gruposIds: ['g1', 'g2'], revisaoEsperada: 3, hashPrevia: 'h3', chaveIdempotencia: expect.any(String) });
      // Sobraram só o erro e o ignorado: a ação da vez é tentar de novo, sem "Gravar" desabilitado ao lado.
      await expect(gravar(page)).toHaveCount(0);
      await capturar(page, `importacao-com-erro-${largura}`);

      await page.getByRole('button', { name: 'Tentar de novo os que deram erro' }).click();
      await expect(page.getByText('Importação concluída')).toBeVisible();
      await expect(page.getByText('1 aluno já cadastrado recebeu os dados')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fazer outra importação' })).toBeVisible();
      // 2.5: atalhos por aluno gravado; sem rascunho de dieta, sem o atalho dela.
      const gravados = page.getByRole('list', { name: 'Alunos gravados' });
      await expect(gravados.getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', '/treinador/alunos/a1');
      await expect(gravados.getByRole('link', { name: 'Abrir rascunho do treino' })).toHaveAttribute('href', '/treinador/treinos/t9');
      await expect(gravados.getByRole('link', { name: 'Abrir rascunho da dieta' })).toHaveCount(0);
      // Sessão concluída: o endereço volta ao começo.
      await expect(page).not.toHaveURL(/sessaoId=/);
      expect(corpoDoGravar(api)[1]).toMatchObject({ gruposIds: ['g2'], revisaoEsperada: 4, hashPrevia: 'h4' });
      await capturar(page, `importacao-concluida-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('foco ao entrar: no título sem sessão; em "Ler os arquivos" na sessão retomada; não volta a cada etapa', async ({ page }) => {
      const api = await abrir(page);
      await page.goto('/treinador/importacao/assistida');
      const titulo = page.getByRole('heading', { level: 1, name: 'Importação assistida' });
      await expect(titulo).toBeFocused();
      // O título não rola nada: toda caixa rolável continua no começo.
      expect(await page.evaluate(() => [...document.querySelectorAll('*')].every((e) => e.scrollTop === 0))).toBe(true);
      await capturar(page, `importacao-foco-titulo-${largura}`);

      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      const ler = page.getByRole('button', { name: 'Ler os arquivos' });
      await expect(ler).toBeFocused();
      await expect(titulo).not.toBeFocused();
      // Passar de etapa não traz o foco de volta ao título nem leva ao termo novo.
      await ler.click();
      await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();
      await page.waitForTimeout(600);
      await expect(titulo).not.toBeFocused();
      await expect(page.getByRole('button', { name: 'Corrigir o termo sup inc' })).not.toBeFocused();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('foco ao entrar: sessão retomada com termo para conferir vai ao "Corrigir o termo"; sem termo, ao aluno parecido', async ({ page }) => {
      let api = await abrir(page, { inicial: revisando });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      const corrigir = page.getByRole('button', { name: 'Corrigir o termo sup inc' });
      await expect(corrigir).toBeFocused();
      // Fica à vista (a tabela vira cartões no celular e o botão remonta: o foco segue o novo).
      await page.waitForTimeout(600);
      await expect(corrigir).toBeFocused();
      await expect(corrigir).toBeInViewport();
      await capturar(page, `importacao-foco-termo-${largura}`);
      expect(api.errosDaPagina).toEqual([]);

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      api = await abrir(page, { inicial: { ...revisando, duvidas: revisando.duvidas.map((d) => ({ ...d, resolvida: true, respostaEscolhida: 'Supino inclinado' })) } });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      await expect(page.getByText(/Já existe aluno cadastrado parecido/)).toBeVisible();
      await expect(page.locator(':focus')).toHaveAttribute('role', 'radio');
      expect(api.errosDaPagina).toEqual([]);
    });

    test('foco ao entrar não rouba: quem teclou antes de a sessão chegar fica onde está', async ({ page }) => {
      const api = await abrir(page, { inicial: revisando, atrasoDoGet: 1500 });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      await expect(page.getByRole('heading', { level: 1, name: 'Importação assistida' })).toBeVisible();
      await page.keyboard.press('Tab');
      const corrigir = page.getByRole('button', { name: 'Corrigir o termo sup inc' });
      await expect(corrigir).toBeVisible();
      await page.waitForTimeout(600);
      await expect(corrigir).not.toBeFocused();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('todos ignorados: não sobra nada para gravar e o botão de gravar some', async ({ page }) => {
      const api = await abrir(page);
      await lerEConferir(page);
      await page.getByRole('radio', { name: 'Ignorar' }).nth(0).click();
      await expect(page.getByRole('radio', { name: 'Ignorar' }).nth(0)).toBeChecked();
      await page.getByRole('radio', { name: 'Ignorar' }).nth(1).click();
      await expect(page.getByRole('radio', { name: 'Ignorar' }).nth(1)).toBeChecked();
      // Sem grupo pendente (todos Ignorar) a tela não oferece gravar, nem selecionar: só cancelar a importação.
      await expect(gravar(page)).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'Incluir na gravação' })).toHaveCount(0);
      expect(api.pedidos.some((p) => p.caminho === `${BASE}/s1/confirmar`)).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('sem permissão: "—" no que não pode ver e opção desabilitada com o motivo no que não pode gravar', async ({ page }) => {
      // Lê o treino, mas não altera treino, pasta nem modelo; não vê a dieta.
      const api = await abrir(page, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER'] });
      await lerEConferir(page);
      await expect(page.getByText('Dieta: —').first()).toBeVisible();
      await expect(page.getByText('Seu perfil não permite gravar treino e pasta.').first()).toBeVisible();
      await expect(page.getByText('Seu perfil não permite gravar modelos.').first()).toBeVisible();
      await incluirNaGravacao(page, 2);
      await page.getByRole('radio', { name: 'Criar aluno novo' }).nth(1).click();
      await expect(page.getByText('Seu perfil não permite gravar treino e pasta. Escolha outro destino para Aluna Fictícia.')).toBeVisible();
      await expect(gravar(page)).toBeDisabled();
      await capturar(page, `importacao-sem-permissao-${largura}`);
      expect(api.pedidos.some((p) => p.caminho === `${BASE}/s1/confirmar`)).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('gravar: 409 recarrega a sessão e avisa; 403 diz que nada foi gravado', async ({ page }) => {
      let chamadas = 0;
      const api = await abrir(page, {
        confirmar: (_p, route) => {
          chamadas++;
          return chamadas === 1
            ? json(route, erroApi(409, 'A importação mudou.', 'CONFLITO_EDICAO').corpo, 409)
            : json(route, erroApi(403, 'Acesso negado.', 'PERMISSAO_NEGADA').corpo, 403);
        },
      });
      await lerEConferir(page);
      await incluirNaGravacao(page, 2);
      await page.getByRole('radio', { name: 'Criar aluno novo' }).nth(1).click();
      const leiturasAntes = api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `${BASE}/s1`).length;
      await gravar(page).click();
      await expect(page.getByText('A importação mudou desde que você abriu. A lista foi atualizada: confira e grave de novo.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === `${BASE}/s1`).length).toBeGreaterThan(leiturasAntes);

      await gravar(page).click();
      await expect(page.getByRole('alert').filter({ hasText: /Nada foi gravado\. Escolha Ignorar nesses grupos/ })).toBeVisible();
      await capturar(page, `importacao-403-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('abaixo de 1600 não há coluna lateral; termo em branco não aparece e trecho em branco vira "—"', async ({ page }) => {
      const api = await abrir(page, { lida: comTermosVazios });
      await lerEConferir(page);
      await expect(page.getByRole('complementary', { name: 'Etapas da importação' })).toHaveCount(0);
      // O botão da próxima etapa continua no cartão, um só.
      await expect(gravar(page)).toHaveCount(1);
      // Só os dois termos de verdade: nada de aspas vazias.
      await expect(page.getByRole('button', { name: /^Corrigir o termo/ })).toHaveCount(2);
      await expect(page.getByText('“”')).toHaveCount(0);
      await expect(page.getByText(/^Termo: /)).toHaveCount(0);
      await expect(page.getByText('whey iso', { exact: true })).toBeVisible();
      await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
      await capturar(page, `importacao-termos-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('cancelar pede confirmação num painel e volta ao começo', async ({ page }) => {
      const api = await abrir(page);
      await colarELer(page);
      await page.getByRole('button', { name: 'Cancelar importação' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Cancelar a importação?' });
      await expect(painel).toBeVisible();
      await capturar(page, `importacao-descartar-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar importação' }).click();
      await expect(page.getByRole('heading', { name: 'Enviar arquivos ou texto' })).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/cancelar`)).toBe(true);
    });

    for (const [nome, t, contraste] of [['escuro', 'ESCURO', 'PADRAO'], ['areia', 'AREIA', 'PADRAO'], ['contraste', 'CLARO', 'ALTO']] as const) {
      test(`revisão e resultado com erro no tema ${nome}`, async ({ page }) => {
        const api = await abrir(page, { tema: t, contraste });
        await lerEConferir(page);
        await expect(page.getByText('Com dúvidas')).toBeVisible();
        await capturar(page, `importacao-tema-${nome}-revisando-${largura}`);
        await page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' }).click();
        await expect(page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' })).toBeChecked();
        await incluirNaGravacao(page, 2);
        await gravar(page).click();
        await expect(page.getByText('Importação gravada em parte')).toBeVisible();
        await capturar(page, `importacao-tema-${nome}-com-erro-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
      });
    }
  });
}

/**
 * Tela larga (25/11, monitor de 1920 com o menu aberto = faixa larga): o conteúdo ocupa a largura toda e, ao lado, a
 * coluna de 360 px grudada com o resumo (arquivos, alunos, planos, termos pendentes) e o único botão da próxima etapa.
 */
test.describe('1920 px', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  const lateral = (page: Page) => page.getByRole('complementary', { name: 'Etapas da importação' });
  /** O valor da contagem ao lado do rótulo (os números dos círculos das etapas também são texto). */
  const contagem = (page: Page, rotulo: string) => lateral(page).getByText(rotulo, { exact: true }).locator('..');

  test('resumo e próxima etapa na coluna lateral; termos numa tabela compacta', async ({ page }) => {
    const api = await abrir(page, { lida: comTermosVazios });
    await page.goto('/treinador/importacao/assistida');
    // Sem sessão a coluna já está no lugar, com as cinco etapas e a primeira destacada.
    await expect(lateral(page).getByText('Comece aqui')).toBeVisible();
    await colarELer(page);
    await expect(lateral(page).getByText('Arquivos enviados')).toBeVisible();
    // Um botão da próxima etapa, só na coluna lateral.
    await expect(page.getByRole('button', { name: 'Ler os arquivos' })).toHaveCount(1);
    await expect(lateral(page).getByRole('button', { name: 'Ler os arquivos' })).toBeVisible();
    await capturar(page, 'importacao-1920-recebendo');
    await lateral(page).getByRole('button', { name: 'Ler os arquivos' }).click();
    await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();

    const coluna = lateral(page);
    await expect(coluna.getByText('Arquivos lidos')).toBeVisible();
    await expect(coluna.getByText('1 de 1')).toBeVisible();
    await expect(contagem(page, 'Alunos encontrados')).toContainText('4');
    await expect(coluna.getByText('Treinos encontrados')).toBeVisible();
    // Dois termos pendentes (os em branco não contam).
    await expect(contagem(page, 'Termos pendentes')).toContainText('2');

    // Termos: tabela com cabeçalho; sem linha para o termo em branco.
    const tabela = page.getByRole('table', { name: 'Termos para conferir' });
    for (const t of ['Tipo', 'Termo', 'Trecho', 'Ocorrências']) await expect(tabela.getByRole('columnheader', { name: t })).toBeVisible();
    await expect(tabela.getByRole('row')).toHaveCount(3);
    await expect(page.getByText('“”')).toHaveCount(0);

    // Gravar: o botão está só na lateral, e o resultado aparece junto dele.
    await expect(gravar(page)).toHaveCount(1);
    await expect(coluna.getByRole('button', { name: /^Gravar selecionados/ })).toBeVisible();
    await expect(coluna.getByText('Vai criar 1 aluno novo.')).toBeVisible();
    // 2.4: a coluna do arquivo de cada termo.
    await expect(tabela.getByRole('columnheader', { name: 'Arquivo' })).toBeVisible();
    await capturar(page, 'importacao-1920-revisando');
    await page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' }).click();
    await expect(page.getByRole('radio', { name: 'Aluno Fictício · mesmo nome' })).toBeChecked();
    await incluirNaGravacao(page, 2);
    await gravar(page).click();
    await expect(coluna.getByText('Importação gravada em parte')).toBeInViewport();
    await expect(coluna.getByRole('button', { name: 'Tentar de novo os que deram erro' })).toBeVisible();
    await capturar(page, 'importacao-1920-com-erro');
    expect(api.errosDaPagina).toEqual([]);
  });

  test('foco ao entrar: título sem sessão; "Ler os arquivos" fica na lateral e recebe o foco na sessão retomada', async ({ page }) => {
    const api = await abrir(page);
    await page.goto('/treinador/importacao/assistida');
    await expect(page.getByRole('heading', { level: 1, name: 'Importação assistida' })).toBeFocused();
    await page.goto('/treinador/importacao/assistida?sessaoId=s1');
    await expect(lateral(page).getByRole('button', { name: 'Ler os arquivos' })).toBeFocused();
    expect(api.errosDaPagina).toEqual([]);
  });

  test('corrigir o termo abre as sugestões embaixo da linha e a resposta fica na tabela', async ({ page }) => {
    const api = await abrir(page);
    await lerEConferir(page);
    await page.getByRole('button', { name: 'Corrigir o termo sup inc' }).click();
    // 2.4: sem a porcentagem nas sugestões.
    await expect(page.getByRole('button', { name: /%\)/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Supino inclinado', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nome correto do exercício ou alimento' })).toHaveValue('Supino inclinado');
    await capturar(page, 'importacao-1920-corrigindo');
    await page.getByRole('button', { name: 'Salvar resposta' }).click();
    await expect(page.getByText('Ficou como: Supino inclinado')).toBeVisible();
    await expect(page.getByText('Resolvida', { exact: true })).toBeVisible();
    await expect(lateral(page).getByText('Nenhum', { exact: true })).toBeVisible();
    const resposta = api.pedidos.find((p) => p.caminho === `${BASE}/s1/respostas`);
    expect(resposta?.corpo).toMatchObject({ duvidaId: 'd1', respostaEscolhida: 'Supino inclinado' });
    expect(api.errosDaPagina).toEqual([]);
  });
});

/** Importações em aberto da lista (26/11): datas fixas no fuso do teste e prazo relativo ao relógio de verdade. */
const DIA = 86_400_000;
const emAberto = (id: string, extra: Partial<SessaoListaItem> = {}): SessaoListaItem => ({
  id, estado: 'REVISANDO', revisao: 1, totalArquivos: 2, totalGrupos: 16, duvidasAbertas: 26,
  criadoEm: '2026-11-24T17:30:00Z', expiraEm: new Date(Date.now() + 3 * DIA + 3_600_000).toISOString(), ...extra,
});
const ABERTAS = [
  emAberto('s1'),
  emAberto('s2', { estado: 'RECEBENDO', totalArquivos: 1, totalGrupos: 0, duvidasAbertas: 0, criadoEm: '2026-11-25T12:05:00Z', expiraEm: new Date(Date.now() + DIA + 3_600_000).toISOString() }),
];

/** Arquivos de mentira num `DataTransfer` criado na página. */
const arquivosArrastados = (page: Page, nomes: string[]) => page.evaluateHandle((lista) => {
  const d = new DataTransfer();
  for (const n of lista) d.items.add(new File(['conteudo de teste'], n, { type: 'application/pdf' }));
  return d;
}, nomes);

/** Arrasta até a área de soltar (os eventos vão no elemento) e, com `soltar`, solta. */
async function arrastar(page: Page, nomes: string[], soltar = true) {
  const area = page.getByTestId('area-de-soltar');
  const dt = await arquivosArrastados(page, nomes);
  await area.dispatchEvent('dragenter', { dataTransfer: dt });
  await area.dispatchEvent('dragover', { dataTransfer: dt });
  if (soltar) await area.dispatchEvent('drop', { dataTransfer: dt });
  return area;
}

for (const largura of [390, 1280]) {
  test.describe(`envio e importações em aberto, ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('ordem: enviar primeiro, em aberto logo abaixo; sem "O que importar" e a sessão nasce sem corpo', async ({ page }) => {
      const api = await abrir(page, { abertas: [...ABERTAS, emAberto('s3', { estado: 'RASCUNHO', totalArquivos: 0, totalGrupos: 0, duvidasAbertas: 0 })] });
      await page.goto('/treinador/importacao/assistida');
      const enviar = page.getByRole('heading', { name: 'Enviar arquivos ou texto' });
      const abertas = page.getByRole('heading', { name: 'Importações em aberto' });
      await expect(abertas).toBeVisible();
      expect((await enviar.boundingBox())!.y).toBeLessThan((await abertas.boundingBox())!.y);
      // 2.1: a sessão sem nenhum arquivo não aparece na lista.
      await expect(page.getByRole('list', { name: 'Importações em aberto' }).getByRole('listitem')).toHaveCount(2);
      await expect(page.getByRole('radiogroup', { name: 'O que importar' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Colar texto' }).click();
      await page.getByRole('textbox', { name: /^Texto colado/ }).fill('Aluno de teste');
      await page.getByRole('button', { name: 'Adicionar o texto' }).click();
      await expect(page.getByText('Recebendo arquivos · 1 arquivo ou texto')).toBeVisible();
      expect(api.pedidos.find((p) => p.metodo === 'POST' && p.caminho === BASE)?.corpo).toBeNull();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('linha da importação em aberto: data, selo, contagens e prazo; ⋯ com Enter descarta pelo painel; Retomar abre', async ({ page }) => {
      const api = await abrir(page, { abertas: ABERTAS });
      await page.goto('/treinador/importacao/assistida');
      const lista = page.getByRole('list', { name: 'Importações em aberto' });
      await expect(lista.getByRole('listitem')).toHaveCount(2);
      const primeira = lista.getByRole('listitem').first();
      await expect(primeira.getByText('24/11/2026 14:30')).toBeVisible();
      await expect(primeira.getByText('Em revisão')).toBeVisible();
      await expect(primeira.getByText('2 arquivos · 16 grupos · 26 dúvidas')).toBeVisible();
      await expect(primeira.getByText('expira em 3 dias')).toBeVisible();
      // Antes de ler não há grupos nem dúvidas para contar: só os arquivos.
      const segunda = lista.getByRole('listitem').nth(1);
      await expect(segunda.getByText('1 arquivo', { exact: true })).toBeVisible();
      await expect(segunda.getByText('expira em 1 dia')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retomar a importação de 24/11/2026 14:30' })).toBeVisible();
      await capturar(page, `importacao-em-aberto-${largura}`);

      const mais = page.getByRole('button', { name: 'Mais ações da importação de 24/11/2026 14:30' });
      await mais.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: /^Descartar/ }).click();
      const painel = page.getByRole('alertdialog', { name: 'Descartar a importação de 24/11/2026 14:30?' });
      await expect(painel).toBeVisible();
      await capturar(page, `importacao-descartar-da-lista-${largura}`);
      await painel.getByRole('button', { name: 'Descartar importação' }).click();
      await expect(lista.getByRole('listitem')).toHaveCount(1);
      expect(api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/cancelar`)).toBe(true);

      await page.getByRole('button', { name: 'Retomar a importação de 25/11/2026 09:05' }).click();
      await expect(page.getByText('Recebendo arquivos · 1 arquivo ou texto')).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'GET' && p.caminho === `${BASE}/s2`)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('envio por arquivo: o app recusa o formato sem subir, a API recusa o limite e o resto sobe', async ({ page }) => {
      let envios = 0;
      const api = await abrir(page, {
        inicial: { ...recebendo, arquivos: [] },
        arquivo: (_p, route) => {
          envios++;
          return envios === 1
            ? json(route, erroApi(409, 'Arquivos demais.', 'LIMITE_DE_ARQUIVOS').corpo, 409)
            : json(route, recebendo.arquivos[0]);
        },
      });
      await page.goto('/treinador/importacao/assistida');
      await expect(page.getByTestId('area-de-soltar')).toBeVisible();
      await arrastar(page, ['foto.png', 'a.pdf', 'b.pdf']);
      const lista = page.getByRole('list', { name: 'Arquivos do último envio' });
      await expect(lista.getByRole('listitem')).toHaveCount(3);
      await expect(lista.getByRole('listitem').nth(0)).toContainText('Recusado');
      await expect(lista.getByText('Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.')).toBeVisible();
      await expect(lista.getByText(/Esta importação já tem arquivos demais/)).toBeVisible();
      await expect(lista.getByRole('listitem').nth(2)).toContainText('Enviado');
      await capturar(page, `importacao-arquivo-recusado-${largura}`);
      // O PNG não subiu; os dois PDFs subiram um a um, e o recusado não parou o seguinte.
      expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/arquivos`)).toHaveLength(2);
      expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === BASE)).toHaveLength(1);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

test.describe('área de soltar e etapas, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('arrastar destaca na cor de ação e soltar envia todos os arquivos; botões e limites dentro da área', async ({ page }) => {
    const api = await abrir(page);
    await page.goto('/treinador/importacao/assistida');
    const area = page.getByTestId('area-de-soltar');
    await expect(area.getByText('Arraste os arquivos aqui')).toBeVisible();
    await expect(area.getByRole('button', { name: 'Escolher arquivos' })).toBeVisible();
    await expect(area.getByRole('button', { name: 'Colar texto' })).toBeVisible();
    await expect(area.getByText('PDF, DOCX, XLSX ou CSV · até 20 arquivos, 900 KB cada e 8 MB no total')).toBeVisible();
    const repouso = await area.evaluate((e) => getComputedStyle(e).borderTopColor);
    await arrastar(page, ['treino.pdf', 'dieta.pdf'], false);
    await expect(area.getByText('Solte para enviar')).toBeVisible();
    expect(await area.evaluate((e) => getComputedStyle(e).borderTopColor)).not.toBe(repouso);
    await capturar(page, 'importacao-arrastando-1280');
    await area.dispatchEvent('drop', { dataTransfer: await arquivosArrastados(page, ['treino.pdf', 'dieta.pdf']) });
    await expect(page.getByText('Recebendo arquivos · 1 arquivo ou texto')).toBeVisible();
    expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/arquivos`)).toHaveLength(2);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('abaixo de 1600: etapas numa linha compacta no topo, a atual com aria-current="step"', async ({ page }) => {
    const api = await abrir(page);
    await page.goto('/treinador/importacao/assistida');
    const etapas = page.getByRole('list', { name: 'Etapas da importação' });
    await expect(etapas.getByRole('listitem')).toHaveCount(5);
    await expect(page.getByRole('complementary', { name: 'Etapas da importação' })).toHaveCount(0);
    const primeira = etapas.getByRole('listitem', { name: 'Etapa 1 de 5: Enviar arquivos ou texto, etapa atual' });
    await expect(primeira).toHaveAttribute('aria-current', 'step');
    await expect(etapas.locator('[aria-current="step"]')).toHaveCount(1);
    // Fica acima do primeiro cartão.
    expect((await etapas.boundingBox())!.y).toBeLessThan((await page.getByRole('heading', { name: 'Enviar arquivos ou texto' }).boundingBox())!.y);
    await lerEConferir(page);
    await expect(etapas.getByRole('listitem', { name: 'Etapa 3 de 5: Conferir termos e dúvidas, etapa atual' })).toHaveAttribute('aria-current', 'step');
    await expect(etapas.getByRole('listitem', { name: 'Etapa 2 de 5: Ler e separar por aluno, concluída' })).toBeVisible();
    await capturar(page, 'importacao-etapas-compactas-1280');
    expect(api.errosDaPagina).toEqual([]);
  });
});

test.describe('coluna das etapas, 1920 px', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  const coluna = (page: Page) => page.getByRole('complementary', { name: 'Etapas da importação' });

  test('sem importação: cinco etapas, a 1 destacada; no meio: etapa 3 atual, 1 e 2 com ✓, contagens, botão no fim, fixa ao rolar', async ({ page }) => {
    const api = await abrir(page);
    await page.goto('/treinador/importacao/assistida');
    await expect(coluna(page).getByRole('listitem')).toHaveCount(5);
    await expect(coluna(page).locator('[aria-current="step"]')).toContainText('Enviar arquivos ou texto');
    await expect(coluna(page).getByText('Comece aqui')).toBeVisible();
    await expect(coluna(page).getByText('Treino e dieta entram como rascunho.')).toBeVisible();
    await expect(coluna(page).getByText(/Envie os arquivos ou cole um texto/)).toHaveCount(0);
    // Sem sessão não há botão na coluna: a ação é o "Escolher arquivos" da área.
    await expect(coluna(page).getByRole('button')).toHaveCount(0);
    // A altura é a do conteúdo, sem bloco vazio embaixo.
    expect((await coluna(page).boundingBox())!.height).toBeLessThan(700);

    await lerEConferir(page);
    const atual = coluna(page).locator('[aria-current="step"]');
    await expect(atual).toHaveCount(1);
    await expect(atual).toContainText('Conferir termos e dúvidas');
    await expect(coluna(page).getByLabel('Etapa 1 de 5: Enviar arquivos ou texto, concluída')).toBeVisible();
    await expect(coluna(page).getByLabel('Etapa 2 de 5: Ler e separar por aluno, concluída')).toBeVisible();
    await expect(coluna(page).getByText('Selecionados', { exact: true }).locator('..')).toContainText('1 de 2');
    await expect(coluna(page).getByRole('button', { name: /^Gravar selecionados/ })).toBeVisible();

    // Fixa ao rolar: a página rola e a coluna continua no topo da janela.
    const antes = (await page.getByRole('heading', { name: 'Arquivos da importação' }).boundingBox())!;
    await page.mouse.move(600, 600);
    await page.mouse.wheel(0, 1500);
    await expect.poll(async () => (await page.getByRole('heading', { name: 'Arquivos da importação' }).boundingBox())?.y ?? 0).toBeLessThan(antes.y - 200);
    const depois = (await coluna(page).boundingBox())!;
    expect(depois.y).toBeGreaterThanOrEqual(0);
    expect(depois.y).toBeLessThan(80);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/importacao-1920-rolada.png` });
    expect(api.errosDaPagina).toEqual([]);
  });
});

/**
 * Revisão de 28/11 (lote 0 e lote 2), em 390 e 1280: leitura que não terminou, acrescentar com a sessão aberta, cadastro
 * editável e "Juntar com…", "O que foi lido", termos de um toque, espera longa e a retomada pela tela Importação.
 */
const comParceiro: SessaoDetalhe = {
  ...revisando,
  grupos: [
    grupo('g1', 'Aluna Fictícia', 'PRONTO', { possivelMesmoAluno: true, possiveisParceiros: [{ grupoId: 'g5', nome: 'Aluna Fictícia (outro arquivo)' }] }),
    grupo('g5', 'Aluna Fictícia (outro arquivo)', 'PRONTO', { possivelMesmoAluno: true, possiveisParceiros: [{ grupoId: 'g1', nome: 'Aluna Fictícia' }] }),
  ],
  duvidas: [],
};

/** PDF grande sem nome lido em três partes ("Aluno 1" a "Aluno 3") e um aluno com o nome do arquivo (28/11). */
const semNome: SessaoDetalhe = {
  ...revisando,
  arquivos: [
    { ...revisando.arquivos[0], id: 'f1', nomeOriginal: 'plano.pdf', formato: 'PDF' },
    { ...revisando.arquivos[0], id: 'f2', nomeOriginal: 'Joana Ficticia.pdf', formato: 'PDF' },
  ],
  grupos: [
    grupo('g1', 'Aluno 1', 'PRONTO', { arquivosOrigem: ['plano.pdf'], origemDoNome: 'AUSENTE', cadastro: { nome: 'Aluno 1' } }),
    grupo('g2', 'Aluno 2', 'PRONTO', { arquivosOrigem: ['plano.pdf'], origemDoNome: 'AUSENTE', cadastro: { nome: 'Aluno 2' } }),
    grupo('g3', 'Aluno 3', 'PRONTO', { arquivosOrigem: ['plano.pdf'], origemDoNome: 'AUSENTE', cadastro: { nome: 'Aluno 3' } }),
    grupo('g4', 'Joana Ficticia', 'PRONTO', { arquivosOrigem: ['Joana Ficticia.pdf'], origemDoNome: 'NOME_DO_ARQUIVO', cadastro: { nome: 'Joana Ficticia' } }),
  ],
  duvidas: [],
};

/** Como `lerEConferir`, com os dois arquivos da `semNome`. */
async function lerDoisArquivos(page: Page) {
  await colarELer(page);
  await page.getByRole('button', { name: 'Ler os arquivos' }).click();
  await expect(page.getByText('Em revisão · 2 arquivos ou textos')).toBeVisible();
}

for (const largura of [390, 1280]) {
  test.describe(`nome não encontrado no documento, ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('sem nome o aluno fica fora da gravação com o motivo; digitar o nome destrava', async ({ page }) => {
      const api = await abrir(page, { lida: semNome });
      await lerDoisArquivos(page);
      await expect(page.getByText(/^Nome não encontrado no documento\. Digite o nome/)).toHaveCount(3);
      await expect(page.getByText(/^Nome não encontrado no documento\. O app usou o nome do arquivo/)).toBeVisible();
      const caixas = page.getByRole('checkbox', { name: 'Incluir na gravação' });
      await expect(caixas).toHaveCount(4);
      for (let i = 0; i < 4; i++) await expect(caixas.nth(i)).toBeDisabled();
      await expect(page.getByText(/^4 alunos novos sem nome não entram na gravação/)).toBeVisible();
      await expect(gravar(page)).toBeDisabled();
      await capturar(page, `importacao-sem-nome-${largura}`);

      // O campo do "Aluno N" vem vazio; o do nome do arquivo vem preenchido e "Usar este nome" confirma.
      await expect(page.getByRole('textbox', { name: 'Nome de Aluno 1' })).toHaveValue('');
      await page.getByRole('button', { name: 'Usar Joana Ficticia como nome do aluno' }).click();
      await expect.poll(() => api.pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `${BASE}/s1/grupos/g4`)?.corpo).toEqual({ nome: 'Joana Ficticia' });
      await expect(page.getByText(/O app usou o nome do arquivo/)).toHaveCount(0);
      await expect(caixas.nth(3)).toBeEnabled();
      await caixas.nth(3).click();
      await expect(gravar(page)).toBeEnabled();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('"Juntar as 3 partes" junta num toque, pela API, e o aluno continua sem nome até digitar', async ({ page }) => {
      const api = await abrir(page, { lida: semNome });
      await lerDoisArquivos(page);
      // Só oferece: nada foi juntado sozinho.
      expect(api.pedidos.some((p) => p.caminho.endsWith('/juntar'))).toBe(false);
      await expect(page.getByRole('button', { name: 'Juntar as 3 partes' })).toHaveCount(1);
      await page.getByRole('button', { name: 'Juntar as 3 partes' }).click();
      await expect(page.getByRole('button', { name: 'Juntar as 3 partes' })).toHaveCount(0);
      const juntar = api.pedidos.find((p) => p.caminho === `${BASE}/s1/grupos/g1/juntar`);
      expect(juntar?.corpo).toEqual({ comGruposIds: ['g2', 'g3'] });
      await expect(page.getByText(/^Nome não encontrado no documento\. Digite o nome/)).toHaveCount(1);

      await page.getByRole('textbox', { name: 'Nome de Aluno 1' }).fill('Carla Ficticia');
      await page.getByRole('button', { name: 'Salvar o cadastro de Aluno 1' }).click();
      await expect(page.getByText(/^Nome não encontrado no documento\. Digite o nome/)).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

for (const largura of [390, 1280]) {
  test.describe(`revisão de 28/11, ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('0.3: leitura que não terminou mostra o aviso e "Tentar ler de novo" lê de novo', async ({ page }) => {
      const api = await abrir(page, { inicial: { ...recebendo, estado: 'ERRO' } });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      await expect(page.getByText('A leitura não terminou. Seus arquivos continuam aqui.')).toBeVisible();
      const tentar = page.getByRole('button', { name: 'Tentar ler de novo' });
      await expect(tentar).toBeFocused();
      await capturar(page, `importacao-leitura-com-erro-${largura}`);
      await tentar.click();
      await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/processar`)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.1: com a sessão em revisão ainda dá para acrescentar arquivos e texto', async ({ page }) => {
      const api = await abrir(page);
      await lerEConferir(page);
      await expect(page.getByTestId('area-de-soltar')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Colar texto' })).toBeVisible();
      await arrastar(page, ['mais.pdf']);
      await expect(page.getByRole('list', { name: 'Arquivos do último envio' }).getByText('Enviado')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `${BASE}/s1/arquivos`)).toHaveLength(1);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.2: corrigir e-mail e WhatsApp antes de gravar, com erro no campo; "O que foi lido" abre o treino', async ({ page }) => {
      const api = await abrir(page);
      await lerEConferir(page);
      const email = page.getByRole('textbox', { name: 'E-mail de Aluna Fictícia' });
      await email.fill('sem-arroba');
      await page.getByRole('button', { name: 'Salvar o cadastro de Aluna Fictícia' }).click();
      await expect(page.getByText('Informe um e-mail válido, como nome@exemplo.com.')).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'PUT' && p.caminho === `${BASE}/s1/grupos/g1`)).toBe(false);
      await email.fill('aluna.nova@exemplo.test');
      await page.getByRole('textbox', { name: 'WhatsApp de Aluna Fictícia' }).fill('11987654321');
      await page.getByRole('button', { name: 'Salvar o cadastro de Aluna Fictícia' }).click();
      await expect(page.getByRole('button', { name: 'Salvar o cadastro de Aluna Fictícia' })).toHaveCount(0);
      const put = api.pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `${BASE}/s1/grupos/g1`);
      expect(put?.corpo).toEqual({ email: 'aluna.nova@exemplo.test', telefone: '(11) 98765-4321' });
      await expect(email).toHaveValue('aluna.nova@exemplo.test');

      await page.getByRole('button', { name: /O que foi lido/ }).first().click();
      await expect(page.getByRole('button', { name: 'Ver o treino de Aluna Fictícia como o aluno' })).toBeVisible();
      await capturar(page, `importacao-o-que-foi-lido-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.2: possível mesmo aluno oferece "Juntar com…" e junta pela API', async ({ page }) => {
      const api = await abrir(page, { lida: comParceiro });
      await lerEConferir(page);
      await expect(page.getByText(/Pode ser o mesmo aluno de outro arquivo/).first()).toBeVisible();
      await capturar(page, `importacao-juntar-${largura}`);
      await page.getByRole('button', { name: 'Juntar Aluna Fictícia com Aluna Fictícia (outro arquivo)' }).click();
      await expect(page.getByText(/Pode ser o mesmo aluno de outro arquivo/)).toHaveCount(0);
      const juntar = api.pedidos.find((p) => p.caminho === `${BASE}/s1/grupos/g1/juntar`);
      expect(juntar?.corpo).toEqual({ comGrupoId: 'g5' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.4: "Usar…" aceita a melhor sugestão num toque; "Manter como está" fica o termo, sem dicionário', async ({ page }) => {
      const api = await abrir(page, { lida: comTermosVazios });
      await lerEConferir(page);
      await expect(page.getByText('Termo não conferido entra com o nome do documento, sem vínculo com a biblioteca.', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'Usar Supino inclinado para sup inc' }).click();
      await expect(page.getByText('Ficou como: Supino inclinado')).toBeVisible();
      await page.getByRole('button', { name: 'Manter whey iso como está no documento' }).click();
      await expect(page.getByText('Ficou como: whey iso')).toBeVisible();
      const respostas = api.pedidos.filter((p) => p.caminho === `${BASE}/s1/respostas`).map((p) => p.corpo);
      expect(respostas[0]).toMatchObject({ duvidaId: 'd1', respostaEscolhida: 'Supino inclinado' });
      expect(respostas[1]).toMatchObject({ duvidaId: 'd5', respostaEscolhida: 'whey iso', salvarNoDicionario: false });
      await capturar(page, `importacao-termos-um-toque-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.6: lendo, a tela diz que dá para sair; 5 falhas seguidas do acompanhamento perguntam se continua', async ({ page }) => {
      test.setTimeout(60_000);
      const api = await abrir(page, { inicial: { ...recebendo, estado: 'PROCESSANDO', leitura: { lidos: 0, total: 1 } }, getFalhaDepoisDe: 1 });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      await expect(page.getByText('Pode sair desta tela: a leitura continua.')).toBeVisible();
      await expect(page.getByText('Lendo 0 de 1 arquivo')).toBeVisible();
      const aviso = page.getByText(/A leitura está demorando mais que o normal/);
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      await capturar(page, `importacao-espera-longa-${largura}`);
      await page.getByRole('button', { name: 'Continuar esperando' }).click();
      await expect(aviso).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.6: na fila da consultoria a tela diz que espera outra leitura, sem contagem falsa', async ({ page }) => {
      const api = await abrir(page, { inicial: { ...recebendo, estado: 'PROCESSANDO', leitura: { lidos: 0, total: 1, aguardando: true } } });
      await page.goto('/treinador/importacao/assistida?sessaoId=s1');
      await expect(page.getByText('Na fila: aguardando outra leitura terminar')).toBeVisible();
      await expect(page.getByText(/^Lendo \d+ de/)).toHaveCount(0);
      await expect(page.getByText('Pode sair desta tela: a leitura continua.')).toBeVisible();
      await capturar(page, `importacao-na-fila-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.8: tempo da IA esgotado mostra o aviso fixo de atenção', async ({ page }) => {
      const tempo = 'O tempo de leitura com IA acabou: parte do documento foi lida pelas regras fixas. Confira com atenção.';
      const api = await abrir(page, { lida: {
        ...revisando,
        modoProcessamento: { modoEfetivo: 'REGRAS', fallbackParaRegras: true, motivoFallback: 'TEMPO_ESGOTADO' },
        arquivos: revisando.arquivos.map((a) => ({ ...a, motivoFallback: 'TEMPO_ESGOTADO' })),
        // Como a API: o mesmo aviso fixo em cada aluno do arquivo.
        grupos: revisando.grupos.map((g) => (g.estado === 'IGNORADO' ? g : { ...g, avisos: [tempo] })),
      } });
      await lerEConferir(page);
      await expect(page.getByText(tempo).first()).toBeVisible();
      await expect(page.getByText(/Confira com atenção\. Confira/)).toHaveCount(0);
      await capturar(page, `importacao-tempo-esgotado-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.6: a tela Importação lista as importações assistidas em aberto e "Retomar" abre a sessão', async ({ page }) => {
      const api = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: TODAS, migracaoAssistidaHabilitada: true })),
        'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
        [`GET ${BASE}`]: { corpo: ABERTAS },
        [`GET ${BASE}/{id}`]: { corpo: revisando },
      });
      await page.goto('/treinador/importacao');
      await expect(page.getByRole('heading', { name: 'Importações em aberto' })).toBeVisible();
      await capturar(page, `importacao-tela-em-aberto-${largura}`);
      await page.getByRole('button', { name: 'Retomar a importação de 24/11/2026 14:30' }).click();
      await expect(page).toHaveURL(/\/treinador\/importacao\/assistida\?sessaoId=s1/);
      await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.8: dicionário da importação lista os termos, remove com confirmação e mostra o vazio', async ({ page }) => {
      let apelidos = [
        { id: 'ap1', tipo: 'EXERCICIO_NAO_RECONHECIDO', termoOriginal: 'sup inc', valorMapeado: 'Supino inclinado', referenciaId: 'e1', criadoEm: '2026-11-20T12:00:00Z' },
        { id: 'ap2', tipo: 'ALIMENTO_NAO_RECONHECIDO', termoOriginal: 'whey iso', valorMapeado: 'Whey Protein', referenciaId: null, criadoEm: '2026-11-21T12:00:00Z' },
      ];
      const api = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: TODAS })),
        'GET /importacoes/assistidas/apelidos': (_p, route) => json(route, apelidos),
        'DELETE /importacoes/assistidas/apelidos/{id}': (p, route) => {
          const id = p.caminho.split('/').pop();
          apelidos = apelidos.filter((a) => a.id !== id);
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/treinador/importacao/dicionario');
      await expect(page.getByRole('heading', { level: 1, name: 'Dicionário da importação' })).toBeVisible();
      await expect(page.getByText('Supino inclinado')).toBeVisible();
      await capturar(page, `importacao-dicionario-${largura}`);
      await page.getByRole('button', { name: 'Remover “sup inc” do dicionário' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Remover “sup inc” do dicionário?' });
      await painel.getByRole('button', { name: 'Remover do dicionário' }).click();
      await expect(page.getByText('Supino inclinado')).toHaveCount(0);
      expect(api.pedidos.some((p) => p.metodo === 'DELETE' && p.caminho === '/importacoes/assistidas/apelidos/ap1')).toBe(true);
      await page.getByRole('button', { name: 'Remover “whey iso” do dicionário' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remover do dicionário' }).click();
      await page.reload();
      await expect(page.getByText('Nenhum termo no dicionário')).toBeVisible();
      await capturar(page, `importacao-dicionario-vazio-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('2.8: dicionário com a importação assistida desligada diz isso em português', async ({ page }) => {
      const api = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: TODAS })),
        'GET /importacoes/assistidas/apelidos': erroApi(503, 'Desligada.', 'MIGRACAO_INDISPONIVEL'),
      });
      await page.goto('/treinador/importacao/dicionario');
      await expect(page.getByText('A importação assistida está desligada no momento.')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}
