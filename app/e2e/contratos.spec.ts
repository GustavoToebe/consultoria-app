import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import type {
  ContratoDetalhe, ContratoDoAlunoDetalhe, ContratoDoAlunoResumo, ContratoResumo, ModeloDeContrato, PreviaDoContrato,
} from '../src/api/contratos';
import type { ContratacaoResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';
import { ALUNO_FINANCEIRO_ID, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel } from './financeiro-falso';

/**
 * Contrato digital, passo 2 (`docs/planos/contrato-digital-telas.md`): Configurações › Contratos (modelos), o cartão da ficha
 * (gerar, ver, cancelar, prorrogar, comprovante) e o aluno (pendência, ponto do Início, assinar, Conta › Meus contratos). Só
 * dados fictícios; o código de verificação é inventado (o app nunca calcula hash). Capturas em `CAPTURAS_CONTRATOS` quando a
 * variável existe (fora do repositório).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ID = ALUNO_FINANCEIRO_ID;
const HASH = '9b74c9897bac770ffc029102a200c5de4c1a6e3f0d2b8a7c6e5f4d3c2b1a0f9e';
const PERMISSOES = [...PERMISSOES_TREINADOR, 'CONTRATO_LER', 'CONTRATO_ALTERAR', 'FINANCEIRO_LER'];

const FICHA: AlunoDetalhe = {
  id: ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000d1', alunoId: ID, planoComercialId: 'b0000000-0000-4000-8000-0000000000d1',
  planoNome: 'Trimestral', periodicidade: 'TRIMESTRAL', valorCentavos: 99_700, motivoValor: null, inicio: '2026-10-19', diaVencimento: 19,
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-10-19T12:00:00Z', versao: 0, minimoAte: null,
  terminoVigencia: '2027-01-19', diasRestantesVigencia: 92, alertaRenovacao: 'EM_DIA',
};

const TEXTO = 'Contratante: **{aluno_nome}**, CPF {aluno_cpf}.\n\nPlano {plano}, valor {valor_total}.';
const modelo = (n: number, nome: string, p: Partial<ModeloDeContrato> = {}): ModeloDeContrato => ({
  id: `m0000000-0000-4000-8000-00000000000${n}`, nome, texto: TEXTO, arquivadoEm: null, versao: 0, atualizadoEm: '2026-11-20T15:00:00Z', ...p,
});
const MODELO = modelo(1, 'Prestação de serviço');

const resumo = (n: number, p: Partial<ContratoResumo> = {}): ContratoResumo => ({
  id: `k0000000-0000-4000-8000-00000000000${n}`, alunoId: ID, titulo: 'Prestação de serviço', origem: 'MODELO', signatario: 'ALUNO',
  situacao: 'PENDENTE', prazoAte: null, vencido: false, contratacaoId: CONTRATACAO.id, geradoEm: '2026-11-20T15:00:00Z',
  assinadoEm: null, canceladoEm: null, versao: 0, grupoId: null, linkExpiraEm: null, ...p,
});
const PENDENTE = resumo(1);
const ASSINADO = resumo(2, { titulo: 'Contrato anual', situacao: 'ASSINADO', assinadoEm: '2026-11-21T17:03:09Z' });
const detalheDe = (r: ContratoResumo): ContratoDetalhe => ({
  ...r, motivoCancelamento: null, texto: r.origem === 'PDF' ? null : 'Contratante: **Aluno Teste**, CPF 529.982.247-25.\n\nPlano Trimestral, valor R$ 997,00.', sha256: HASH,
  geradoPorNome: TREINADOR.nome, link: null,
  assinatura: r.situacao === 'ASSINADO' ? { assinadoEm: r.assinadoEm!, nome: 'Aluno Teste da Silva', cpf: null, ip: '203.0.113.7', agente: 'Navegador de teste' } : null,
});
const PREVIA_OK: PreviaDoContrato = { titulo: 'Prestação de serviço', texto: 'Contratante: **Aluno Teste**.', faltas: [], podeGerar: true };

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_CONTRATOS;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true });
}

// ---------------------------------------------------------------- treinador: modelos

interface Opcoes { largura: number; chave?: boolean; permissoes?: string[]; modelos?: ModeloDeContrato[]; rotas?: RespostasApi }

async function abrirModelos(page: Page, o: Opcoes, caminho = '/treinador/contratos') {
  await page.setViewportSize({ width: o.largura, height: 900 });
  let modelos = [...(o.modelos ?? [])];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES, contratosHabilitados: o.chave ?? true })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria/contratos': { corpo: { prazoDias: null } },
    'GET /contratos/modelos': (_p, r) => json(r, modelos),
    'POST /contratos/modelos': (p, r) => {
      const c = p.corpo as { nome: string; texto: string };
      const novo = modelo(9, c.nome, { texto: c.texto });
      modelos = [...modelos, novo];
      return json(r, novo, 201);
    },
    'POST /contratos/modelos/{id}/previa': { corpo: { titulo: 'Prestação de serviço', texto: 'Contratante: **Ana Exemplo**, CPF 000.000.000-00.' } },
    'POST /contratos/modelos/{id}/arquivar': (p, r) => {
      const id = p.caminho.split('/').at(-2)!;
      modelos = modelos.map((m) => (m.id === id ? { ...m, arquivadoEm: '2026-11-26T12:00:00Z', versao: m.versao + 1 } : m));
      return json(r, modelos.find((m) => m.id === id));
    },
    ...o.rotas,
  });
  await page.goto(caminho);
  return api;
}

for (const largura of [390, 1280]) {
  test.describe(`Configurações › Contratos em ${largura} px`, () => {
    test('chave desligada: diz que não está ativo e não chama a API', async ({ page }) => {
      const api = await abrirModelos(page, { largura, chave: false });
      await expect(page.getByRole('heading', { level: 1, name: 'Contratos' })).toBeVisible();
      await expect(page.getByText('Contratos não estão ativos')).toBeVisible();
      expect(api.pedidos.filter((p) => p.caminho.startsWith('/contratos'))).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });

    test('novo modelo: chip no cursor, campo desconhecido sem chamar a API, salvar, prévia e arquivar', async ({ page }) => {
      const api = await abrirModelos(page, { largura });
      await expect(page.getByText('Nenhum modelo de contrato')).toBeVisible();
      await page.getByRole('button', { name: 'Novo modelo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo modelo de contrato' });
      // Sem mexer em nada, o rodapé só orienta; a dica sai assim que o nome entra (aí vira "Alterações não salvas").
      await expect(folha.getByText('Dê um nome ao modelo e ajuste o texto de exemplo.')).toBeVisible();
      await folha.getByLabel('Nome do modelo').fill('Prestação de serviço');
      await expect(folha.getByText('Alterações não salvas')).toBeVisible();
      const texto = folha.getByLabel('Texto do contrato');
      // D27: o modelo novo nasce com o texto de exemplo e a cláusula de aceite eletrônico; sem mexer, nada a salvar.
      await expect(texto).toHaveValue(/Medida Provisória nº 2\.200-2\/2001 e da Lei nº 14\.063\/2020\./);
      await texto.fill('Contratante: ');
      await folha.getByRole('button', { name: 'Inserir campo Nome do aluno' }).click();
      await expect(texto).toHaveValue('Contratante: {aluno_nome}');
      await capturar(page, `modelo-texto-${largura}`);
      await texto.fill('Contratante: {aluno_nome} {apelido_secreto}');
      await folha.getByRole('button', { name: 'Salvar modelo' }).click();
      await expect(folha.getByText('Campos desconhecidos: {apelido_secreto}. Use só os da lista.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho !== '/auth/refresh')).toEqual([]);
      await texto.fill('Contratante: {aluno_nome}.');
      await folha.getByRole('button', { name: 'Salvar modelo' }).click();
      await expect(page.getByText('Modelo salvo.')).toBeVisible();
      const editar = page.getByRole('dialog', { name: 'Editar modelo de contrato' });
      await expect(editar.getByText('Tudo salvo')).toBeVisible();
      expect(api.pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/contratos/modelos')?.corpo).toEqual({ nome: 'Prestação de serviço', texto: 'Contratante: {aluno_nome}.' });
      await editar.getByRole('tab', { name: 'Prévia' }).click();
      await expect(editar.getByText('Dados de exemplo, nenhum dado de aluno.')).toBeVisible();
      await expect(editar.getByText('Ana Exemplo', { exact: false })).toBeVisible();
      await capturar(page, `modelo-previa-${largura}`);
      await editar.getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('button', { name: 'Mais ações do modelo Prestação de serviço' }).click();
      await page.getByRole('button', { name: 'Arquivar modelo' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Arquivar o modelo?' });
      await painel.getByRole('button', { name: 'Arquivar' }).click();
      await expect(page.getByText('Modelo arquivado.')).toBeVisible();
      await expect(page.getByRole('button', { name: /Arquivados \(1\)/ })).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('só CONTRATO_LER: sem "Novo modelo", "Ver" abre o texto cru', async ({ page }) => {
      await abrirModelos(page, { largura, modelos: [MODELO], permissoes: [...PERMISSOES_TREINADOR, 'CONTRATO_LER'] });
      await expect(page.getByText('Prestação de serviço')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo modelo' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Ver modelo Prestação de serviço' }).click();
      const folha = page.getByRole('dialog', { name: 'Modelo de contrato' });
      await expect(folha.getByText('{aluno_nome}', { exact: false })).toBeVisible();
      await expect(folha.getByRole('tab', { name: 'Prévia' })).toHaveCount(0);
    });
  });
}

test('1280 e 1920: Configurações › Contratos dentro das Configurações', async ({ page }) => {
  for (const largura of [1280, 1920]) {
    await abrirModelos(page, { largura, modelos: [MODELO, modelo(2, 'Termo antigo', { arquivadoEm: '2026-11-01T12:00:00Z' })] }, '/treinador/configuracoes/contratos');
    await expect(page.getByRole('heading', { level: 1, name: 'Contratos' })).toBeVisible();
    await expect(page.getByText('Prestação de serviço')).toBeVisible();
    await capturar(page, `configuracoes-contratos-${largura}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

// ---------------------------------------------------------------- treinador: ficha

interface OpcoesDaFicha {
  largura: number; permissoes?: string[]; contratos?: ContratoResumo[]; previa?: () => PreviaDoContrato; gerar?: (p: PedidoFalso) => { status: number; corpo: unknown };
  modelos?: ModeloDeContrato[]; rotas?: RespostasApi; pagamentos?: boolean;
  /** O que entra na lista depois de gerar (padrão: o pendente do aluno). */
  depoisDeGerar?: ContratoResumo[];
}

async function abrirFicha(page: Page, o: OpcoesDaFicha) {
  await page.setViewportSize({ width: o.largura, height: 1000 });
  let contratos = [...(o.contratos ?? [])];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES, pagamentosHabilitados: o.pagamentos ?? true, contratosHabilitados: true })),
    ...rotasDoFinanceiro(estadoFinanceiro({ contratacoes: [CONTRATACAO], cobrancas: [] })), ...rotasDoResponsavel(estadoDoResponsavel()),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ID}`]: { corpo: FICHA },
    'GET /responsaveis': { corpo: [] },
    'GET /questionarios/opcoes': { corpo: [] },
    [`GET /alunos/${ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ID}/contratos`]: (_p, r) => json(r, contratos),
    'GET /contratos/modelos': { corpo: o.modelos ?? [MODELO] },
    [`POST /alunos/${ID}/contratos/previa`]: (_p, r) => json(r, (o.previa ?? (() => PREVIA_OK))()),
    [`POST /alunos/${ID}/contratos`]: (p, r) => {
      const resposta = o.gerar?.(p) ?? { status: 201, corpo: detalheDe(PENDENTE) };
      if (resposta.status < 300) contratos = [...(o.depoisDeGerar ?? [PENDENTE]), ...contratos];
      return json(r, resposta.corpo, resposta.status);
    },
    'GET /contratos/{id}': (p, r) => json(r, detalheDe([...contratos, PENDENTE, ASSINADO].find((c) => c.id === p.caminho.split('/').at(-1))!)),
    ...o.rotas,
  });
  await page.goto(`/treinador/alunos/${ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Dados do aluno' })).toBeVisible();
  return api;
}

const cartao = (page: Page) => page.getByRole('heading', { name: 'Contratos', exact: true });
const folhaGerar = (page: Page) => page.getByRole('dialog', { name: 'Gerar contrato' });

for (const largura of [390, 1280]) {
  test.describe(`ficha › Contratos em ${largura} px`, () => {
    test('gerar com falta: botão desabilitado com o motivo e o atalho para completar o cadastro', async ({ page }) => {
      const api = await abrirFicha(page, { largura, previa: () => ({ ...PREVIA_OK, podeGerar: false, faltas: [{ campo: 'aluno_cpf', mensagem: 'Falta o CPF do aluno.' }] }) });
      await expect(page.getByText('Nenhum contrato gerado.')).toBeVisible();
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      const folha = folhaGerar(page);
      await expect(folha.getByText('Falta preencher antes de gerar')).toBeVisible();
      await expect(folha.getByText('• Falta o CPF do aluno.')).toBeVisible();
      await expect(folha.getByText('Faltam dados: veja a lista acima.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Gerar contrato' })).toBeDisabled();
      await expect(folha.getByRole('button', { name: 'Completar o cadastro do aluno' })).toBeVisible();
      await capturar(page, `gerar-com-falta-${largura}`);
      // A contratação ativa (a única) vai na prévia.
      expect(api.pedidos.find((p) => p.caminho.endsWith('/contratos/previa'))?.corpo).toMatchObject({ modeloId: MODELO.id, contratacaoId: CONTRATACAO.id });
      expect(api.naoTratadas.filter((r) => r.includes('contrat'))).toEqual([]);
    });

    test('gerar com 500 e reenvio com o mesmo pedidoId; o contrato aparece "Pendente"', async ({ page }) => {
      let vez = 0;
      const api = await abrirFicha(page, { largura, gerar: () => (vez++ === 0 ? { status: 500, corpo: erroApi(500, 'Erro interno no servidor.').corpo } : { status: 201, corpo: detalheDe(PENDENTE) }) });
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      const folha = folhaGerar(page);
      await expect(folha.getByText('Contratante:', { exact: false })).toBeVisible();
      await capturar(page, `gerar-contrato-${largura}`);
      await folha.getByRole('button', { name: 'Gerar contrato' }).click();
      await expect(folha.getByText('Erro interno no servidor.')).toBeVisible();
      await folha.getByRole('button', { name: 'Gerar contrato' }).click();
      await expect(page.getByText('Contrato gerado. O aluno já pode assinar no app.')).toBeVisible();
      await expect(folhaGerar(page)).toHaveCount(0);
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible();
      const envios = api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ID}/contratos`).map((p) => (p.corpo as { pedidoId: string }).pedidoId);
      expect(envios).toHaveLength(2);
      expect(envios[0]).toBe(envios[1]);
      await capturar(page, `ficha-contratos-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('sem FINANCEIRO_LER: sem a contratação e com a nota do Financeiro', async ({ page }) => {
      await abrirFicha(page, {
        largura, permissoes: [...PERMISSOES_TREINADOR, 'CONTRATO_LER', 'CONTRATO_ALTERAR'],
        previa: () => ({ ...PREVIA_OK, podeGerar: false, faltas: [{ campo: 'plano', mensagem: 'Falta o plano.' }] }),
      });
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      const folha = folhaGerar(page);
      await expect(folha.getByText('Plano, valor, parcelas, vigência e responsável precisam do Financeiro, que não está disponível para o seu perfil.')).toBeVisible();
      await expect(folha.getByText('Contratação', { exact: true })).toHaveCount(0);
      // O responsável mora no Financeiro (D12): sem FINANCEIRO_LER não há "Quem assina".
      await expect(folha.getByText('Quem assina', { exact: true })).toHaveCount(0);
    });

    test('cancelar: sem motivo trava; 409 CONTRATO_ASSINADO avisa e recarrega', async ({ page }) => {
      const api = await abrirFicha(page, {
        largura, contratos: [PENDENTE],
        rotas: { 'POST /contratos/{id}/cancelar': erroApi(409, 'Contrato assinado.', 'CONTRATO_ASSINADO') },
      });
      await page.getByRole('button', { name: 'Mais ações do contrato Prestação de serviço' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar contrato' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Cancelar este contrato?' });
      await expect(painel.getByRole('button', { name: 'Cancelar contrato' })).toBeDisabled();
      await expect(painel.getByText('Escreva o motivo.')).toBeVisible();
      await painel.getByLabel('Motivo (só a equipe vê)').fill('Aluno pediu outro plano.');
      const antes = api.pedidos.filter((p) => p.caminho === `/alunos/${ID}/contratos`).length;
      await painel.getByRole('button', { name: 'Cancelar contrato' }).click();
      await expect(page.getByText('O aluno assinou antes do cancelamento. Contrato assinado não se cancela.')).toBeVisible();
      await expect.poll(() => api.pedidos.filter((p) => p.caminho === `/alunos/${ID}/contratos`).length).toBeGreaterThan(antes);
      expect(api.pedidos.find((p) => p.caminho.endsWith('/cancelar'))?.corpo).toEqual({ motivo: 'Aluno pediu outro plano.', versao: 0 });
    });

    test('prorrogar só com prazo: 15 dias', async ({ page }) => {
      const comPrazo = resumo(3, { titulo: 'Com prazo', prazoAte: '2026-11-30T02:59:59Z' });
      const api = await abrirFicha(page, {
        largura, contratos: [comPrazo, PENDENTE],
        rotas: { 'POST /contratos/{id}/prorrogar': { corpo: { ...detalheDe(comPrazo), prazoAte: '2026-12-15T02:59:59Z' } } },
      });
      await page.getByRole('button', { name: 'Mais ações do contrato Prestação de serviço' }).click();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Prorrogar prazo' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('button', { name: 'Mais ações do contrato Com prazo' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Prorrogar prazo' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Prorrogar o prazo?' });
      await painel.getByRole('radio', { name: '15 dias' }).click();
      await painel.getByRole('button', { name: 'Prorrogar' }).click();
      await expect(page.getByText('Prazo prorrogado até 14/12/2026.')).toBeVisible();
      expect(api.pedidos.find((p) => p.caminho.endsWith('/prorrogar'))?.corpo).toEqual({ dias: 15, versao: 0 });
    });

    test('só CONTRATO_LER: sem "Gerar" nem ⋯ no pendente; sem CONTRATO_LER, sem o cartão', async ({ page }) => {
      await abrirFicha(page, { largura, contratos: [PENDENTE], permissoes: [...PERMISSOES_TREINADOR, 'CONTRATO_LER', 'FINANCEIRO_LER'] });
      await expect(cartao(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver contrato Prestação de serviço' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gerar contrato' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Mais ações do contrato/ })).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await abrirFicha(page, { largura, contratos: [PENDENTE], permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER'] });
      await expect(page.getByRole('heading', { name: 'Plano contratado' })).toBeVisible();
      await expect(cartao(page)).toHaveCount(0);
    });

    test('comprovante: "Evidências da assinatura" e o código inteiro no bloco de impressão', async ({ page }) => {
      await page.addInitScript(() => { window.print = () => undefined; });
      const api = await abrirFicha(page, { largura, contratos: [ASSINADO] });
      await page.getByRole('button', { name: 'Ver contrato Contrato anual' }).click();
      const folha = page.getByRole('dialog', { name: 'Contrato anual' });
      await expect(folha.getByText(HASH)).toBeVisible();
      await expect(folha.getByText('203.0.113.7')).toBeVisible();
      await capturar(page, `ficha-contrato-assinado-${largura}`);
      await folha.getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('button', { name: 'Mais ações do contrato Contrato anual' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Baixar comprovante' }).click();
      const bloco = page.locator('#treinos-impressao');
      await expect(bloco).toContainText('Evidências da assinatura');
      await expect(bloco).toContainText(HASH);
      await expect(bloco).toContainText('Navegador de teste');
      if (largura === 1280 && process.env.CAPTURAS_CONTRATOS) {
        await page.emulateMedia({ media: 'print' });
        await capturar(page, 'comprovante');
        await page.emulateMedia({ media: 'screen' });
      }
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

// ---------------------------------------------------------------- passo 4: responsável por link

const CODIGO_DO_LINK = 'Tq3vX9_kLm2Pw8Zr-Ab4Cd7Ef';
const CODIGO_NOVO = 'Nv8wQ2_pRs5Tu1Xy-Gh6Jk3Lm';
const EXPIRA = '2026-12-27T02:59:59Z';
const DO_RESPONSAVEL = resumo(5, { titulo: 'Contrato do responsável', signatario: 'RESPONSAVEL', linkExpiraEm: EXPIRA });
const GRUPO = 'g0000000-0000-4000-8000-000000000001';
const PAR_ALUNO = resumo(6, { titulo: 'Contrato em par', grupoId: GRUPO });
const PAR_RESPONSAVEL = resumo(7, { titulo: 'Contrato em par', signatario: 'RESPONSAVEL', grupoId: GRUPO, linkExpiraEm: EXPIRA });

/** O WhatsApp abre fora do app: a página de teste responde no lugar do wa.me (nada sai da máquina). */
async function whatsappFalso(page: Page) {
  await page.context().route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }));
}

for (const largura of [390, 1280]) {
  test.describe(`ficha › Contratos, responsável, em ${largura} px`, () => {
    test('"Quem assina: Responsável" vai na prévia e no gerar; o link aparece uma vez, com copiar e WhatsApp', async ({ page }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await whatsappFalso(page);
      const api = await abrirFicha(page, {
        largura, depoisDeGerar: [DO_RESPONSAVEL],
        gerar: () => ({ status: 201, corpo: { ...detalheDe(DO_RESPONSAVEL), link: { contratoId: DO_RESPONSAVEL.id, codigo: CODIGO_DO_LINK, expiraEm: EXPIRA } } }),
      });
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      const folha = folhaGerar(page);
      // Sem a data de nascimento à mão, só a regra geral dos menores.
      await expect(folha.getByText('Para menores de idade o app pede também a assinatura do responsável.')).toBeVisible();
      await folha.getByRole('radio', { name: 'Responsável' }).click();
      await expect(folha.getByText('O responsável financeiro assina por um link, sem conta no app.')).toBeVisible();
      await expect(folha.getByText('O responsável assina pelo link que aparece quando você gerar.')).toBeVisible();
      await expect.poll(() => api.pedidos.filter((p) => p.caminho.endsWith('/contratos/previa')).at(-1)?.corpo).toMatchObject({ signatario: 'RESPONSAVEL' });
      await capturar(page, `gerar-responsavel-${largura}`);
      await folha.getByRole('button', { name: 'Gerar contrato' }).click();

      const link = page.getByRole('dialog', { name: 'Link do responsável' });
      await expect(link.getByText(`/contrato#codigo=${CODIGO_DO_LINK}`, { exact: false })).toBeVisible();
      expect(api.pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ID}/contratos`)?.corpo).toMatchObject({ signatario: 'RESPONSAVEL' });
      await expect(link.getByText('Válido até 26/12/2026.')).toBeVisible();
      await expect(link.getByText('Este link aparece só agora. Para outro, use “Gerar novo link” na ficha.')).toBeVisible();
      await capturar(page, `link-do-responsavel-${largura}`);
      await link.getByRole('button', { name: 'Copiar link' }).click();
      await expect(page.getByText('Link copiado.')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/contrato#codigo=${CODIGO_DO_LINK}$`));

      const [popup] = await Promise.all([page.waitForEvent('popup'), link.getByRole('button', { name: /^Enviar pelo WhatsApp/ }).click()]);
      await popup.waitForLoadState();
      const url = new URL(popup.url());
      expect(url.origin + url.pathname).toBe('https://wa.me/');
      expect(url.searchParams.get('text')).toMatch(new RegExp(`^Olá! Segue o link para assinar o contrato: .*/contrato#codigo=${CODIGO_DO_LINK}$`));
      await popup.close();

      await link.getByRole('button', { name: 'Concluir' }).click();
      await expect(page.getByRole('dialog', { name: 'Link do responsável' })).toHaveCount(0);
      await expect(page.getByText('Assina: responsável', { exact: false })).toBeVisible();
      await expect(page.getByText('Link válido até 26/12/2026', { exact: false })).toBeVisible();
      // O código nunca vai a caminho nem busca de pedido algum.
      for (const p of api.pedidos) expect(`${p.caminho}?${p.busca.toString()}`).not.toContain(CODIGO_DO_LINK);
      expect(api.naoTratadas.filter((r) => r.includes('contrat'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('reenvio do mesmo pedido sem código: avisa e oferece um link novo', async ({ page }) => {
      const api = await abrirFicha(page, {
        largura, depoisDeGerar: [DO_RESPONSAVEL],
        gerar: () => ({ status: 200, corpo: { ...detalheDe(DO_RESPONSAVEL), link: { contratoId: DO_RESPONSAVEL.id, codigo: null, expiraEm: EXPIRA } } }),
        rotas: { 'POST /contratos/{id}/link': { corpo: { contratoId: DO_RESPONSAVEL.id, codigo: CODIGO_NOVO, expiraEm: EXPIRA } } },
      });
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      await folhaGerar(page).getByRole('radio', { name: 'Responsável' }).click();
      await folhaGerar(page).getByRole('button', { name: 'Gerar contrato' }).click();
      const link = page.getByRole('dialog', { name: 'Link do responsável' });
      await expect(link.getByText('O link do responsável aparece só uma vez', { exact: false })).toBeVisible();
      await link.getByRole('button', { name: 'Gerar novo link do responsável' }).click();
      await expect(page.getByRole('dialog', { name: 'Link do responsável' }).getByText(`/contrato#codigo=${CODIGO_NOVO}`, { exact: false })).toBeVisible();
      expect(api.pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/contratos/${DO_RESPONSAVEL.id}/link`)).toBe(true);
    });

    test('⋯ "Gerar novo link do responsável" e o par de 16 a 17 anos em duas linhas', async ({ page }) => {
      const api = await abrirFicha(page, {
        largura, contratos: [PAR_ALUNO, PAR_RESPONSAVEL],
        rotas: {
          'POST /contratos/{id}/link': { corpo: { contratoId: PAR_RESPONSAVEL.id, codigo: CODIGO_NOVO, expiraEm: EXPIRA } },
          'GET /contratos/{id}': (p, r) => {
            const c = [PAR_ALUNO, PAR_RESPONSAVEL].find((x) => x.id === p.caminho.split('/').at(-1))!;
            return json(r, { ...detalheDe(c), link: c.signatario === 'RESPONSAVEL' ? { contratoId: c.id, codigo: null, expiraEm: EXPIRA } : null });
          },
        },
      });
      await expect(page.getByText('Assina: aluno', { exact: false })).toBeVisible();
      await expect(page.getByText('Assina: responsável', { exact: false })).toBeVisible();
      await capturar(page, `ficha-par-${largura}`);
      // Só o contrato do responsável tem link (o do aluno vem primeiro).
      const botoesDeMais = page.getByRole('button', { name: 'Mais ações do contrato Contrato em par' });
      await expect(botoesDeMais).toHaveCount(2);
      await botoesDeMais.first().click();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Gerar novo link do responsável' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Fechar' }).click();
      await botoesDeMais.last().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Gerar novo link do responsável' }).click();
      const link = page.getByRole('dialog', { name: 'Link do responsável' });
      await expect(link.getByText(`/contrato#codigo=${CODIGO_NOVO}`, { exact: false })).toBeVisible();
      await link.getByRole('button', { name: 'Concluir' }).click();
      expect(api.pedidos.filter((p) => p.caminho === `/contratos/${PAR_RESPONSAVEL.id}/link`)).toHaveLength(1);

      // Na folha do contrato: quem assina, a validade do link e o mesmo "Gerar novo link".
      await page.getByRole('button', { name: 'Ver contrato Contrato em par' }).last().click();
      const ver = page.getByRole('dialog', { name: 'Contrato em par' });
      await expect(ver.getByText('Responsável, pelo link')).toBeVisible();
      await expect(ver.getByText('Válido até 26/12/2026')).toBeVisible();
      await ver.getByRole('button', { name: 'Gerar novo link do responsável' }).click();
      await expect(page.getByRole('dialog', { name: 'Link do responsável' })).toBeVisible();
      await expect.poll(() => api.pedidos.filter((p) => p.caminho === `/contratos/${PAR_RESPONSAVEL.id}/link`).length).toBe(2);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}

test('ficha em 1920: o cartão Contratos na coluna da esquerda', async ({ page }) => {
  await abrirFicha(page, { largura: 1920, contratos: [ASSINADO, PENDENTE] });
  await cartao(page).scrollIntoViewIfNeeded();
  await expect(cartao(page)).toBeVisible();
  await capturar(page, 'ficha-contratos-1920');
});

// ---------------------------------------------------------------- aluno

const doAluno = (r: ContratoResumo): ContratoDoAlunoResumo => ({
  id: r.id, titulo: r.titulo, origem: r.origem, signatario: r.signatario, situacao: r.situacao, prazoAte: r.prazoAte, vencido: r.vencido,
  geradoEm: r.geradoEm, assinadoEm: r.assinadoEm,
});
const detalheDoAluno = (r: ContratoResumo): ContratoDoAlunoDetalhe => {
  const d = detalheDe(r);
  return { ...doAluno(r), texto: d.texto, sha256: d.sha256, assinatura: d.assinatura ? { assinadoEm: d.assinatura.assinadoEm, nome: d.assinatura.nome } : null };
};

async function abrirAluno(page: Page, largura: number, lista: ContratoResumo[], rotas: RespostasApi = {}, caminho = '/aluno') {
  await page.setViewportSize({ width: largura, height: 900 });
  return simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { contratosHabilitados: true })),
    'GET /aluno/contratos': (_p, r) => json(r, lista.map(doAluno)),
    'GET /aluno/contratos/{id}': (p, r) => {
      const c = lista.find((x) => x.id === p.caminho.split('/').at(-1));
      return c ? json(r, detalheDoAluno(c)) : json(r, erroApi(404, 'Contrato não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
    },
    ...rotas,
  }).then(async (api) => { await page.goto(caminho); return api; });
}

for (const largura of [390, 1280]) {
  test.describe(`aluno em ${largura} px`, () => {
    test('pendência primeiro e o ponto do Início', async ({ page }) => {
      await abrirAluno(page, largura, [PENDENTE]);
      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Assinar contrato/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Início, pendência' }).first()).toBeVisible();
    });

    test('assinar: aceite vazio, 422 do nome, 409 com aceite desmarcado e nome mantido, sucesso', async ({ page }) => {
      let vez = 0;
      const api = await abrirAluno(page, largura, [PENDENTE], {
        'POST /aluno/contratos/{id}/assinar': (_p, r) => {
          vez += 1;
          if (vez === 1) return json(r, erroApi(422, 'Confira a assinatura.', 'ASSINATURA_INVALIDA', [{ field: 'nome', message: 'Escreva o nome como no cadastro.' }]).corpo, 422);
          if (vez === 2) return json(r, erroApi(409, 'O contrato mudou.', 'CONTRATO_ALTERADO').corpo, 409);
          return json(r, detalheDoAluno({ ...PENDENTE, situacao: 'ASSINADO', assinadoEm: '2026-11-26T17:03:09Z' }));
        },
      }, `/aluno/contrato/${PENDENTE.id}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Prestação de serviço' })).toBeVisible();
      await expect(page.getByText('Para assinar')).toBeVisible();
      await capturar(page, `aluno-pendente-${largura}`);
      const assinar = page.getByRole('button', { name: 'Assinar contrato' });
      await assinar.click();
      await expect(page.getByText('Escreva seu nome completo.')).toBeVisible();
      await expect(page.getByText('Marque que leu e concorda com o contrato.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho !== '/auth/refresh')).toEqual([]);
      const nome = page.getByLabel('Seu nome completo');
      const aceite = page.getByRole('checkbox', { name: 'Li o contrato e concordo com os termos.' });
      await nome.fill('Aluno T');
      await aceite.click();
      await assinar.click();
      await expect(page.getByText('Escreva o nome como no cadastro.')).toBeVisible();
      await nome.fill('Aluno Teste da Silva');
      await assinar.click();
      await expect(page.getByText('O contrato mudou desde que você abriu. Leia de novo antes de assinar.')).toBeVisible();
      await expect(aceite).not.toBeChecked();
      await expect(nome).toHaveValue('Aluno Teste da Silva');
      await aceite.click();
      await assinar.click();
      await expect(page.getByText('Contrato assinado.')).toBeVisible();
      await expect(page.getByText(HASH)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Baixar comprovante' })).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'POST').at(-1)?.corpo).toEqual({ sha256: HASH, nome: 'Aluno Teste da Silva', aceite: true });
      await capturar(page, `aluno-assinado-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('Conta › Meus contratos', async ({ page }) => {
      await abrirAluno(page, largura, [ASSINADO], {
        'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
        'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
        'GET /aluno/meus-dados': { corpo: { nome: ALUNO.nome, email: ALUNO.email, emailDeAcesso: ALUNO.email, versao: 1 } },
        'GET /aluno/indicacao': erroApi(404, 'Sem link.', 'NAO_ENCONTRADO'),
      }, '/aluno/conta');
      await expect(page.getByRole('heading', { name: 'Meus contratos' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Contrato anual, Assinado em 21/11/2026' })).toBeVisible();
    });

    test('404: contrato indisponível; sem internet, assinar fica desabilitado', async ({ page }) => {
      await abrirAluno(page, largura, [PENDENTE], {}, '/aluno/contrato/k0000000-0000-4000-8000-000000000099');
      await expect(page.getByText('Contrato indisponível')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
      await page.goto(`/aluno/contrato/${PENDENTE.id}`);
      await expect(page.getByRole('button', { name: 'Assinar contrato' })).toBeEnabled();
      await page.context().setOffline(true);
      await expect(page.getByRole('button', { name: 'Assinar contrato' })).toBeDisabled();
      await expect(page.getByText('Sem internet: conecte-se para assinar.')).toBeVisible();
      await page.context().setOffline(false);
    });
  });
}

test('aluno em 390 no tema escuro: contrato pendente (captura)', async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), ALUNO.id);
  await abrirAluno(page, 390, [PENDENTE], {}, `/aluno/contrato/${PENDENTE.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Prestação de serviço' })).toBeVisible();
  await capturar(page, 'aluno-pendente-390-escuro');
});

// ---------------------------------------------------------------- passo 3: PDF próprio

/** PDF fictício mínimo (só o cabeçalho `%PDF-` importa ao app e à API falsa). */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PENDENTE_PDF = resumo(4, { titulo: 'Contrato em PDF', origem: 'PDF' });
const arquivoPdf = (_p: PedidoFalso, r: Route) => r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });

/** Escolhe o arquivo pelo seletor da web (o `expo-document-picker` abre um `<input type=file>`). */
async function escolherArquivo(page: Page, botao: Locator, nome: string, conteudo: Buffer) {
  const seletor = page.waitForEvent('filechooser');
  await botao.click();
  await (await seletor).setFiles({ name: nome, mimeType: 'application/pdf', buffer: conteudo });
}

/** Na web, "Baixar o PDF" baixa `contrato.pdf` com os bytes da API (sem guia nova: a política de segurança pode barrar o visualizador). */
async function baixarPdf(page: Page, botao: Locator) {
  const [download] = await Promise.all([page.waitForEvent('download'), botao.click()]);
  expect(download.suggestedFilename()).toBe('contrato.pdf');
  expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe('%PDF-');
}

for (const largura of [390, 1280]) {
  test.describe(`PDF próprio em ${largura} px`, () => {
    test('gerar: PDF falso recusado no app, 422 da API no campo e outro arquivo leva outro pedidoId', async ({ page }) => {
      let vez = 0;
      const api = await abrirFicha(page, {
        largura,
        gerar: () => (vez++ === 0
          ? { status: 422, corpo: erroApi(422, 'Contrato inválido.', 'CONTRATO_INVALIDO', [{ field: 'arquivo', message: 'O PDF passa de 900 KB.' }]).corpo }
          : { status: 201, corpo: detalheDe(PENDENTE_PDF) }),
      });
      await page.getByRole('button', { name: 'Gerar contrato' }).click();
      const folha = folhaGerar(page);
      await folha.getByRole('radio', { name: 'PDF próprio' }).click();
      const gerar = folha.getByRole('button', { name: 'Gerar contrato' });
      await expect(gerar).toBeDisabled();
      await expect(folha.getByText('Escolha o PDF.')).toBeVisible();
      await expect(folha.getByText('Prévia', { exact: true })).toHaveCount(0);
      await escolherArquivo(page, folha.getByRole('button', { name: 'Escolher PDF' }), 'falso.pdf', Buffer.from('<html>não é pdf</html>'));
      await expect(folha.getByText('Envie um arquivo PDF.')).toBeVisible();
      await expect(gerar).toBeDisabled();
      await escolherArquivo(page, folha.getByRole('button', { name: 'Trocar o PDF' }), 'contrato-assinatura.pdf', PDF);
      await expect(folha.getByText('contrato-assinatura.pdf')).toBeVisible();
      await expect(folha.getByText('Escreva o título.')).toBeVisible();
      await folha.getByLabel('Título').fill('Contrato em PDF');
      await capturar(page, `pdf-gerar-${largura}`);
      await gerar.click();
      await expect(folha.getByText('O PDF passa de 900 KB.')).toBeVisible();
      await expect(gerar).toBeDisabled();
      await capturar(page, `pdf-gerar-422-${largura}`);
      await escolherArquivo(page, folha.getByRole('button', { name: 'Trocar o PDF' }), 'contrato-assinatura.pdf', PDF);
      await gerar.click();
      await expect(page.getByText('Contrato gerado. O aluno já pode assinar no app.')).toBeVisible();
      const envios = api.pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ID}/contratos`).map((p) => String(p.corpo));
      expect(envios).toHaveLength(2);
      const pedidoDe = (corpo: string) => /"pedidoId":"([^"]+)"/.exec(corpo)?.[1];
      expect(pedidoDe(envios[0])).toBeTruthy();
      // Trocar o arquivo é outro documento: outro pedido (a API recusa o mesmo pedido com outro PDF).
      expect(pedidoDe(envios[1])).toBeTruthy();
      expect(pedidoDe(envios[0])).not.toBe(pedidoDe(envios[1]));
      // O nome do arquivo escolhido nunca vai à API: a parte leva o nome fixo.
      expect(envios[1]).toContain('filename="contrato.pdf"');
      expect(envios[1]).not.toContain('contrato-assinatura');
      expect(envios[1]).toContain('%PDF-');
      expect(envios[1]).toContain('"titulo":"Contrato em PDF"');
      expect(envios[1]).toContain(`"contratacaoId":"${CONTRATACAO.id}"`);
      // Só a prévia do modelo, de antes de escolher "PDF próprio"; o PDF não tem prévia.
      expect(api.pedidos.filter((p) => p.caminho.endsWith('/contratos/previa')).length).toBeLessThanOrEqual(1);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('equipe: "Baixar o PDF"; 404 avisa', async ({ page }) => {
      let falhar = false;
      const api = await abrirFicha(page, {
        largura, contratos: [PENDENTE_PDF],
        rotas: { 'GET /contratos/{id}/arquivo': (p, r) => (falhar ? json(r, erroApi(404, 'Contrato não encontrado.', 'NAO_ENCONTRADO').corpo, 404) : arquivoPdf(p, r)) },
      });
      await page.getByRole('button', { name: 'Ver contrato Contrato em PDF' }).click();
      const folha = page.getByRole('dialog', { name: 'Contrato em PDF' });
      await expect(folha.getByText('O contrato é o PDF enviado pela equipe.', { exact: false })).toBeVisible();
      await expect(folha.getByText('Texto do contrato')).toHaveCount(0);
      await capturar(page, `pdf-equipe-${largura}`);
      await baixarPdf(page, folha.getByRole('button', { name: 'Baixar o PDF' }));
      falhar = true;
      await folha.getByRole('button', { name: 'Baixar o PDF' }).click();
      await expect(page.getByText('Contrato não encontrado.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.caminho.endsWith('/arquivo'))).toHaveLength(2);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: lê pelo PDF e assina', async ({ page }) => {
      const api = await abrirAluno(page, largura, [PENDENTE_PDF], {
        'GET /aluno/contratos/{id}/arquivo': arquivoPdf,
        'POST /aluno/contratos/{id}/assinar': (_p, r) => json(r, detalheDoAluno({ ...PENDENTE_PDF, situacao: 'ASSINADO', assinadoEm: '2026-11-26T17:03:09Z' })),
      }, `/aluno/contrato/${PENDENTE_PDF.id}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Contrato em PDF' })).toBeVisible();
      await expect(page.getByText('O contrato está no PDF. Baixe e leia antes de assinar.')).toBeVisible();
      await expect(page.getByText('Texto do contrato')).toHaveCount(0);
      await capturar(page, `pdf-aluno-pendente-${largura}`);
      await baixarPdf(page, page.getByRole('button', { name: 'Baixar o PDF' }));
      await page.getByLabel('Seu nome completo').fill('Aluno Teste da Silva');
      await page.getByRole('checkbox', { name: 'Li o contrato e concordo com os termos.' }).click();
      await page.getByRole('button', { name: 'Assinar contrato' }).click();
      await expect(page.getByText('Contrato assinado.')).toBeVisible();
      await expect(page.getByText('O contrato que você assinou está no PDF.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'POST').at(-1)?.corpo).toEqual({ sha256: HASH, nome: 'Aluno Teste da Silva', aceite: true });
      await capturar(page, `pdf-aluno-assinado-${largura}`);
      await page.context().setOffline(true);
      await expect(page.getByRole('button', { name: 'Baixar o PDF' })).toBeDisabled();
      await page.context().setOffline(false);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}
