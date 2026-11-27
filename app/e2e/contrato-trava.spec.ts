import { expect, test, type Page } from '@playwright/test';

import type { ContratoDoAlunoDetalhe, ContratoDoAlunoResumo, ModeloDeContrato } from '../src/api/contratos';
import type { FinanceiroDoAluno } from '../src/api/financeiroTipos';
import type { EuResponse } from '../src/api/tipos';
import type { RegistroLocal } from '../src/offline/repositorioLocal';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Contrato digital, passo 5 (`docs/planos/contrato-digital.md`, D3, D8, D19, D21, S6 e S7): a tela de bloqueio do aluno
 * com contrato pendente vencido (dentro do `AlunoProvider`, a fila continua enviando), a assinatura que libera na hora, o
 * menor que espera o responsável, o contrato junto com a pausa por atraso, o "Sair" com treino não enviado e o "Prazo para
 * assinar" em Configurações › Contratos. Só dados fictícios; o código de verificação é inventado. Capturas em
 * `CAPTURAS_CONTRATOS` quando a variável existe (fora do repositório).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const HASH = '9b74c9897bac770ffc029102a200c5de4c1a6e3f0d2b8a7c6e5f4d3c2b1a0f9e';
const TITULO_ASSINAR = 'Assine o contrato para continuar';
const TITULO_AGUARDA = 'Aguardando a assinatura do responsável';
const FRASE_DA_PAUSA = 'Seu acesso também está pausado por pagamento em atraso. Depois de assinar, você vê os detalhes.';
const TRAVA = erroApi(403, 'Assine o contrato para continuar.', 'CONTRATO_PENDENTE');

const contrato = (n: number, p: Partial<ContratoDoAlunoResumo> = {}): ContratoDoAlunoResumo => ({
  id: `k0000000-0000-4000-8000-00000000000${n}`, titulo: 'Prestação de serviço', origem: 'MODELO', signatario: 'ALUNO', situacao: 'PENDENTE',
  prazoAte: '2026-11-20T02:59:59Z', vencido: true, geradoEm: '2026-11-10T15:00:00Z', assinadoEm: null, ...p,
});
const detalhe = (c: ContratoDoAlunoResumo): ContratoDoAlunoDetalhe => ({
  ...c, texto: 'Contratante: **Aluno Teste**.\n\nPlano Trimestral.', sha256: HASH,
  assinatura: c.situacao === 'ASSINADO' ? { assinadoEm: c.assinadoEm!, nome: 'Aluno Teste da Silva' } : null,
});

const SEM_COBRANCAS: FinanceiroDoAluno = { plano: null, abertas: [], historico: [], pagamentoOnline: false, formasDePagamento: ['MANUAL'] };

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_CONTRATOS;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true });
}

// ---------------------------------------------------------------- aluno

interface EstadoDoAluno {
  /** `aluno.contratoPendenteVencido` do /eu; assinar o contrato do aluno o desliga quando não sobra vencido. */
  travado: boolean;
  pausado?: boolean;
  chave?: boolean;
  lista: ContratoDoAlunoResumo[];
  /** Fila do aparelho antes de abrir (treino feito offline). */
  fila?: RegistroLocal[];
}

async function abrirAluno(page: Page, largura: number, estado: EstadoDoAluno, rotas: RespostasApi = {}, caminho = '/aluno') {
  await page.setViewportSize({ width: largura, height: 900 });
  if (estado.fila) {
    await page.addInitScript(([chave, valor]) => { if (localStorage.getItem(chave) === null) localStorage.setItem(chave, valor); },
      [`treinos:${ALUNO.id}:registros`, JSON.stringify(estado.fila)] as const);
  }
  const base = await sessaoDeAluno(page);
  const doEu = await sessao(page, ALUNO, { contratosHabilitados: estado.chave ?? true });
  const eu = (doEu['GET /eu'] as { corpo: EuResponse }).corpo;
  const painel = (base['GET /aluno/painel'] as { corpo: unknown }).corpo;
  const api = await simularApi(page, {
    ...base,
    ...doEu,
    'GET /eu': (_p, r) => json(r, {
      ...eu,
      aluno: { id: eu.aluno!.id, nome: eu.aluno!.nome, acessoDesativadoMotivo: estado.pausado ? 'ATRASO' : null, contratoPendenteVencido: estado.travado },
    }),
    // Como a API: fora da lista fechada, a trava responde 403 (o plano só volta depois de assinar). Sem a chave, nunca trava.
    'GET /aluno/painel': (_p, r) => (estado.travado && estado.chave !== false ? json(r, TRAVA.corpo, 403) : json(r, painel)),
    // O que o Início e o resto do layout pedem quando a trava sai (ou nunca houve): nada publicado.
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/dieta': erroApi(404, 'Nenhuma dieta publicada.', 'NAO_ENCONTRADO'),
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/anamnese': erroApi(404, 'Nenhuma anamnese.', 'NAO_ENCONTRADO'),
    'GET /aluno/contratos': (_p, r) => json(r, estado.lista),
    'GET /aluno/contratos/{id}': (p, r) => {
      const c = estado.lista.find((x) => x.id === p.caminho.split('/').at(-1));
      return c ? json(r, detalhe(c)) : json(r, erroApi(404, 'Contrato não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
    },
    'POST /aluno/contratos/{id}/assinar': (p, r) => {
      const id = p.caminho.split('/').at(-2)!;
      estado.lista = estado.lista.map((c) => (c.id === id ? { ...c, situacao: 'ASSINADO', vencido: false, assinadoEm: '2026-11-26T17:03:09Z' } : c));
      estado.travado = estado.lista.some((c) => c.situacao === 'PENDENTE' && c.vencido);
      return json(r, detalhe(estado.lista.find((c) => c.id === id)!));
    },
    ...rotas,
  });
  await page.goto(caminho);
  return api;
}

async function assinar(page: Page) {
  await page.getByLabel('Seu nome completo').fill('Aluno Teste da Silva');
  await page.getByRole('checkbox', { name: 'Li o contrato e concordo com os termos.' }).click();
  await page.getByRole('button', { name: 'Assinar contrato' }).click();
  await expect(page.getByText('Contrato assinado.')).toBeVisible();
}

const registroNaFila = (): RegistroLocal => ({
  id: 'r0000000-0000-4000-8000-000000000001', planoVersaoId: 't0000000-0000-4000-8000-000000000002', sessaoUid: 'sa', exercicioUid: 'sae1',
  serieUid: 'sae1-s1', exercicioId: null, trabalho: false, data: '2026-11-19', carga: 20, repeticoes: 8, concluida: true, observacao: null,
  etapas: null, referenciaCarga: null, referenciaOrigem: null, alteradoEm: '2026-11-19T12:00:00Z', situacao: 'LOCAL', motivo: null,
});

for (const largura of [390, 1280]) {
  test.describe(`trava do contrato, aluno em ${largura} px`, () => {
    test('vencido: só a tela de bloqueio, sem o menu; o botão leva à assinatura e assinar libera na hora', async ({ page }) => {
      const pendente = contrato(1);
      const api = await abrirAluno(page, largura, { travado: true, lista: [pendente] });
      await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toBeVisible();
      await expect(page.getByText('O prazo para assinar o contrato terminou. Assine para voltar a usar o app.')).toBeVisible();
      await expect(page.getByRole('link', { name: /^Início/ })).toHaveCount(0);
      await expect(page.getByText(FRASE_DA_PAUSA)).toHaveCount(0);
      await capturar(page, `trava-assinar-${largura}`);
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await expect(page).toHaveURL(new RegExp(`/aluno/contrato/${pendente.id}$`));
      await expect(page.getByRole('heading', { level: 1, name: 'Prestação de serviço' })).toBeVisible();
      await assinar(page);
      // Sem outro vencido, o /eu novo tira a trava: o menu volta e o plano é buscado de novo, já sem o 403.
      await expect(page.getByRole('link', { name: /^Início/ }).first()).toBeVisible();
      // Tirar a trava remonta o layout (o que deu 403 é buscado de novo) e a tela cai no Início, não na tela do contrato.
      await expect(page.getByRole('heading', { level: 1, name: /^Olá, / })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toHaveCount(0);
      const indiceDaAssinatura = api.pedidos.findIndex((p) => p.metodo === 'POST' && p.caminho.endsWith('/assinar'));
      await expect.poll(() => api.pedidos.findLastIndex((p) => p.metodo === 'GET' && p.caminho === '/aluno/painel')).toBeGreaterThan(indiceDaAssinatura);
      await capturar(page, `trava-assinada-${largura}`);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('menor com o contrato do responsável: "Aguardando a assinatura do responsável", sem botão de assinar (D8)', async ({ page }) => {
      const api = await abrirAluno(page, largura, { travado: true, lista: [contrato(2, { signatario: 'RESPONSAVEL' })] });
      await expect(page.getByRole('heading', { level: 1, name: TITULO_AGUARDA })).toBeVisible();
      await expect(page.getByText('O contrato precisa da assinatura do seu responsável. Fale com o seu treinador se precisar de um novo link.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Assinar contrato' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
      await capturar(page, `trava-responsavel-${largura}`);
      expect(api.naoTratadas).toEqual([]);
    });

    test('par de 16 a 17 anos: assinar o do aluno não libera; a tela passa a esperar o responsável', async ({ page }) => {
      const api = await abrirAluno(page, largura, { travado: true, lista: [contrato(3), contrato(4, { signatario: 'RESPONSAVEL' })] });
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await assinar(page);
      await page.getByRole('button', { name: 'Voltar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: TITULO_AGUARDA })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Início/ })).toHaveCount(0);
      expect(api.naoTratadas).toEqual([]);
    });

    test('contrato e pausa por atraso: a do contrato primeiro, com a frase da pausa; assinado, cai na pausa (D21)', async ({ page }) => {
      const api = await abrirAluno(page, largura, { travado: true, pausado: true, lista: [contrato(5)] }, {
        'GET /aluno/financeiro': { corpo: SEM_COBRANCAS },
      });
      await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toBeVisible();
      await expect(page.getByText(FRASE_DA_PAUSA)).toBeVisible();
      await capturar(page, `trava-com-pausa-${largura}`);
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await assinar(page);
      await expect(page.getByRole('heading', { level: 1, name: /^Seu acesso está pausado/ })).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
    });

    test('"Sair" avisa do treino não enviado; a fila tenta enviar durante a trava (D19)', async ({ page }) => {
      const api = await abrirAluno(page, largura, { travado: true, lista: [contrato(6)], fila: [registroNaFila()] }, {
        // Sem servidor para o lote: o registro fica LOCAL, como sem internet.
        'POST /aluno/execucoes/lote': erroApi(503, 'Indisponível.'),
      });
      await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toBeVisible();
      await expect.poll(() => api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === '/aluno/execucoes/lote')).toBe(true);
      await page.getByRole('button', { name: 'Sair' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Sair da conta?' });
      await expect(painel.getByText('Você tem 1 treino ainda não enviado. Sair apaga esse registro. Conecte-se e sincronize antes, se puder.')).toBeVisible();
      await capturar(page, `trava-sair-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
    });

    test('sem a chave dos contratos nada muda: o Início de sempre e nenhum pedido de contrato', async ({ page }) => {
      // O /eu traz a marca ligada de propósito: sem a chave, o app a ignora.
      const api = await abrirAluno(page, largura, { travado: true, chave: false, lista: [contrato(7)] });
      await expect(page.getByRole('link', { name: /^Início/ }).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: TITULO_ASSINAR })).toHaveCount(0);
      expect(api.pedidos.filter((p) => p.caminho.startsWith('/aluno/contratos'))).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  });
}

test('trava do contrato em 390 no tema escuro (captura)', async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), ALUNO.id);
  await abrirAluno(page, 390, { travado: true, pausado: true, lista: [contrato(8)] });
  await expect(page.getByRole('heading', { level: 1, name: TITULO_ASSINAR })).toBeVisible();
  await capturar(page, 'trava-com-pausa-390-escuro');
});

// ---------------------------------------------------------------- treinador: prazo para assinar

const PERMISSOES = [...PERMISSOES_TREINADOR, 'CONTRATO_LER', 'CONTRATO_ALTERAR'];
const MODELO: ModeloDeContrato = {
  id: 'm0000000-0000-4000-8000-000000000001', nome: 'Prestação de serviço', texto: 'Contratante: {aluno_nome}.', arquivadoEm: null, versao: 0,
  atualizadoEm: '2026-11-20T15:00:00Z',
};

async function abrirPrazo(page: Page, largura: number, o: { prazoDias: number | null; permissoes?: string[]; rotas?: RespostasApi }) {
  await page.setViewportSize({ width: largura, height: 900 });
  let prazoDias = o.prazoDias;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES, contratosHabilitados: true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /contratos/modelos': { corpo: [MODELO] },
    'GET /consultoria/contratos': (_p, r) => json(r, { prazoDias }),
    'PUT /consultoria/contratos': (p, r) => {
      prazoDias = (p.corpo as { prazoDias: number | null }).prazoDias;
      return json(r, { prazoDias });
    },
    ...o.rotas,
  });
  await page.goto('/treinador/contratos');
  await expect(page.getByRole('heading', { name: 'Prazo para assinar' })).toBeVisible();
  return api;
}

const opcao = (page: Page, rotulo: string) =>
  page.getByRole('radiogroup', { name: 'Quando o aluno não assina' }).getByRole('radio', { name: rotulo, exact: true });

for (const largura of [390, 1280]) {
  test.describe(`prazo para assinar em ${largura} px`, () => {
    test('liga o prazo, salva e volta a "Tudo salvo"; desligar manda nulo', async ({ page }) => {
      const api = await abrirPrazo(page, largura, { prazoDias: null });
      await expect(page.getByText('Depois desse prazo, quem não assinou fica sem acesso ao app até assinar. Vale para os contratos gerados daqui em diante.')).toBeVisible();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      await expect(opcao(page, 'Não travar o acesso')).toBeChecked();
      await opcao(page, 'Travar depois de um prazo').click();
      await page.getByLabel('Dias para assinar').fill('15');
      await expect(page.getByText('Alterações não salvas')).toBeVisible();
      await capturar(page, `prazo-editando-${largura}`);
      await page.getByRole('button', { name: 'Salvar prazo' }).click();
      await expect(page.getByText('Prazo para assinar salvo.')).toBeVisible();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ prazoDias: 15 }]);
      await opcao(page, 'Não travar o acesso').click();
      await page.getByRole('button', { name: 'Salvar prazo' }).click();
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ prazoDias: 15 }, { prazoDias: null }]);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('fora de 1 a 60 não chama a API; o 422 do servidor aparece no campo; descartar volta ao gravado', async ({ page }) => {
      const api = await abrirPrazo(page, largura, {
        prazoDias: 10,
        rotas: { 'PUT /consultoria/contratos': erroApi(422, 'Confira o prazo para assinar.', 'CONTRATO_PRAZO_INVALIDO', [{ field: 'prazoDias', message: 'Informe de 1 a 60 dias, ou deixe em branco para não travar o acesso.' }]) },
      });
      const dias = page.getByLabel('Dias para assinar');
      await expect(dias).toHaveValue('10');
      await dias.fill('0');
      await page.getByRole('button', { name: 'Salvar prazo' }).click();
      await expect(page.getByText('Informe um número inteiro de 1 a 60 dias.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
      await dias.fill('30');
      await page.getByRole('button', { name: 'Salvar prazo' }).click();
      await expect(page.getByText('Informe de 1 a 60 dias, ou deixe em branco para não travar o acesso.')).toBeVisible();
      await capturar(page, `prazo-erro-${largura}`);
      await page.getByRole('button', { name: 'Descartar alterações do prazo para assinar' }).click();
      await expect(dias).toHaveValue('10');
      await expect(page.getByText('Tudo salvo')).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
    });

    test('só CONTRATO_LER: o prazo só para leitura, sem escolha nem salvar', async ({ page }) => {
      const api = await abrirPrazo(page, largura, { prazoDias: 15, permissoes: [...PERMISSOES_TREINADOR, 'CONTRATO_LER'] });
      await expect(page.getByLabel('Quando o aluno não assina: Trava o acesso depois de 15 dias')).toBeVisible();
      await expect(page.getByRole('radiogroup', { name: 'Quando o aluno não assina' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Salvar prazo' })).toHaveCount(0);
      expect(api.naoTratadas).toEqual([]);
    });
  });
}
