import { expect, test, type Page } from '@playwright/test';

import type { ConfirmacaoResultado, GrupoImportavel, SessaoDetalhe } from '../src/servicos/importacaoAssistida';
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
  id: 's1', objetivo: 'CADASTROS_E_PLANOS_ATUAIS', estado: 'RECEBENDO', revisao: 1,
  arquivos: [{ id: 'f1', nomeOriginal: 'Mensagens de teste', formato: 'TEXTO', tamanhoBytes: 40, estado: 'RECEBIDO', criadoEm: '2026-10-19T12:00:00Z' }],
  grupos: [], duvidas: [], criadoEm: '2026-10-19T12:00:00Z', expiraEm: '2026-10-20T12:00:00Z',
  modoProcessamento: { modoEfetivo: 'REGRAS', fallbackParaRegras: false },
};
const revisando: SessaoDetalhe = {
  ...recebendo, estado: 'REVISANDO', revisao: 2, hashPrevia: 'h2',
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
async function abrir(page: Page, { tema = 'CLARO', contraste = 'PADRAO', permissoes = TODAS, confirmar, lida = revisando }: {
  tema?: string; contraste?: string; permissoes?: string[]; confirmar?: RespostasApi[string]; lida?: SessaoDetalhe;
} = {}) {
  await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [TREINADOR.id, tema, contraste]);
  let atual = recebendo;
  let gravacoes = 0;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    [`POST ${BASE}`]: { corpo: { ...recebendo, arquivos: [] } },
    [`POST ${BASE}/{id}/textos`]: { corpo: recebendo.arquivos[0] },
    [`GET ${BASE}`]: { corpo: [] },
    [`GET ${BASE}/{id}`]: (_p, route) => json(route, atual),
    [`POST ${BASE}/{id}/cancelar`]: (_p, route) => json(route, { ...atual, estado: 'CANCELADA' }),
    [`POST ${BASE}/{id}/processar`]: (_p, route) => { atual = lida; return json(route, atual); },
    [`POST ${BASE}/{id}/respostas`]: (p, route) => {
      const { duvidaId, respostaEscolhida } = p.corpo as { duvidaId: string; respostaEscolhida: string };
      atual = { ...atual, revisao: atual.revisao + 1, duvidas: atual.duvidas.map((d) => (d.id === duvidaId ? { ...d, resolvida: true, respostaEscolhida: respostaEscolhida } : d)) };
      return json(route, atual);
    },
    [`PUT ${BASE}/{id}/grupos/{g}`]: (p, route) => {
      const { destino, alunoExistenteId } = p.corpo as { destino: GrupoImportavel['destino']; alunoExistenteId?: string };
      const id = p.caminho.split('/').pop();
      const revisao = atual.revisao + 1;
      atual = { ...atual, revisao, hashPrevia: `h${revisao}`, grupos: atual.grupos.map((g) => (g.id === id ? { ...g, destino, alunoExistenteId: alunoExistenteId ?? null } : g)) };
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
      return json(route, resultado({ gruposImportados: 1, alunosVinculados: 1 }));
    }),
  });
  return api;
}

async function colarELer(page: Page) {
  await page.goto('/treinador/importacao/assistida');
  await expect(page.getByText('Enviar arquivos ou texto')).toBeVisible();
  await page.getByRole('button', { name: 'Colar texto' }).click();
  const adicionar = page.getByRole('button', { name: 'Adicionar o texto' });
  await expect(adicionar).toBeDisabled();
  await expect(page.getByText('Cole o texto antes de adicionar.')).toBeVisible();
  await page.getByRole('textbox', { name: /^Texto colado/ }).fill('Aluno de teste\nTreino A\nsup inc 4x10');
  await adicionar.click();
  await expect(page.getByText('Recebendo arquivos · 1 arquivo ou texto')).toBeVisible();
  // O modo da leitura só aparece com a sessão aberta (o servidor diz que leu por regras fixas).
  await expect(page.getByText(/O servidor leu os arquivos por regras fixas/)).toBeVisible();
}

async function lerEConferir(page: Page) {
  await colarELer(page);
  await page.getByRole('button', { name: 'Ler os arquivos' }).click();
  await expect(page.getByText('Em revisão · 1 arquivo ou texto')).toBeVisible();
}

const corpoDoGravar = (api: Awaited<ReturnType<typeof abrir>>) =>
  api.pedidos.filter((p) => p.caminho === `${BASE}/s1/confirmar`).map((p) => p.corpo as { gruposIds: string[]; revisaoEsperada: number; hashPrevia: string; chaveIdempotencia: string });

/** Marca "Incluir na gravação" dos grupos pendentes que ainda têm a caixa (o ignorado não tem), na ordem da lista. */
async function incluirNaGravacao(page: Page, quantos: number) {
  const caixas = page.getByRole('checkbox', { name: 'Incluir na gravação' });
  await expect(caixas).toHaveCount(quantos);
  for (let i = 0; i < quantos; i++) {
    await caixas.nth(i).click();
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
      await expect(gravar(page)).toBeDisabled();
      await expect(page.getByText('Selecione pelo menos um grupo para gravar.')).toBeVisible();
      // Os grupos com destino Ignorar não têm a caixa: só g1 e g2.
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
      await expect(page.getByText('1 grupo não foi gravado. O motivo aparece em cada um, na lista acima.')).toBeVisible();
      await expect(page.getByText('1 peso não gravado: sem data legível, fora da faixa ou já registrado nessa data')).toBeVisible();
      await expect(page.getByText('Aluno novo criado')).toBeVisible();
      await expect(page.getByText('Importado', { exact: true })).toBeVisible();
      await expect(page.getByText('Com erro', { exact: true })).toBeVisible();
      await expect(page.getByText('O aluno escolhido está inativo. Reative-o na ficha antes de tentar de novo.')).toBeVisible();
      // Gravou só os incluídos, com a revisão e a prévia que a tela tinha e uma chave de idempotência.
      expect(corpoDoGravar(api)[0]).toEqual({ gruposIds: ['g1', 'g2'], revisaoEsperada: 3, hashPrevia: 'h3', chaveIdempotencia: expect.any(String) });
      // Sobraram só o erro e o ignorado: a ação da vez é tentar de novo, sem "Gravar" desabilitado ao lado.
      await expect(gravar(page)).toHaveCount(0);
      await capturar(page, `importacao-com-erro-${largura}`);

      await page.getByRole('button', { name: 'Tentar de novo os que deram erro' }).click();
      await expect(page.getByText('Importação concluída')).toBeVisible();
      await expect(page.getByText('1 aluno já cadastrado recebeu os dados')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fazer outra importação' })).toBeVisible();
      expect(corpoDoGravar(api)[1]).toMatchObject({ gruposIds: ['g2'], revisaoEsperada: 4, hashPrevia: 'h4' });
      await capturar(page, `importacao-concluida-${largura}`);
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
      await expect(page.getByRole('complementary', { name: 'Resumo da importação' })).toHaveCount(0);
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
      await expect(page.getByText('Enviar arquivos ou texto')).toBeVisible();
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
  const lateral = (page: Page) => page.getByRole('complementary', { name: 'Resumo da importação' });

  test('resumo e próxima etapa na coluna lateral; termos numa tabela compacta', async ({ page }) => {
    const api = await abrir(page, { lida: comTermosVazios });
    await page.goto('/treinador/importacao/assistida');
    // Sem sessão a coluna já está no lugar, dizendo o que vai aparecer nela.
    await expect(lateral(page).getByText(/O que for lido aparece aqui/)).toBeVisible();
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
    await expect(coluna.getByText('Alunos encontrados')).toBeVisible();
    await expect(coluna.getByText('4', { exact: true })).toBeVisible();
    await expect(coluna.getByText('Treinos encontrados')).toBeVisible();
    // Dois termos pendentes (os em branco não contam).
    await expect(coluna.getByText('Termos pendentes')).toBeVisible();
    await expect(coluna.getByText('2', { exact: true })).toBeVisible();

    // Termos: tabela com cabeçalho; sem linha para o termo em branco.
    const tabela = page.getByRole('table', { name: 'Termos para conferir' });
    for (const t of ['Tipo', 'Termo', 'Trecho', 'Ocorrências']) await expect(tabela.getByRole('columnheader', { name: t })).toBeVisible();
    await expect(tabela.getByRole('row')).toHaveCount(3);
    await expect(page.getByText('“”')).toHaveCount(0);

    // Gravar: o botão está só na lateral, e o resultado aparece junto dele.
    await expect(gravar(page)).toHaveCount(1);
    await expect(coluna.getByRole('button', { name: /^Gravar selecionados/ })).toBeVisible();
    await expect(coluna.getByText('Selecione pelo menos um grupo para gravar.')).toBeVisible();
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

  test('corrigir o termo abre as sugestões embaixo da linha e a resposta fica na tabela', async ({ page }) => {
    const api = await abrir(page);
    await lerEConferir(page);
    await page.getByRole('button', { name: 'Corrigir o termo sup inc' }).click();
    await page.getByRole('button', { name: 'Supino inclinado (90%)' }).click();
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
